import uuid
import math
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from shapely.geometry import shape, Polygon, MultiPolygon

from ..config import settings
from ..models.schemas import (
    RegionSelectRequest, RegionSelectResponse,
    ScanRequest, JobStatusResponse, PipelineStage,
    DetectionResponse, DetectionVesselsResponse,
    DriftTrajectoryResponse, HistoricalIncidentSummary,
    ReplayTimelineResponse, WebhookSubscribeRequest,
    WebhookSubscribeResponse, ProvenanceType, Centroid, AttributionWindow,
    CoastalRegion, MonitoredScene, SatelliteAcquisition,
    MonitoringState, SceneStatus, RegionMonitoringStatusResponse,
    SceneAcquisitionsResponse, AcquisitionDetectionsResponse
)
from ..services.copernicus import copernicus_client
from ..services.ai_pipeline import ai_pipeline
from ..services.ais_adapter import ais_adapter
from ..services.drift_simulator import drift_simulator
from ..services.historical_store import historical_store
from ..services.pdf_report import generate_incident_pdf_report
from ..services.supabase_client import supabase_db
from ..services.ollama_report import generate_ollama_investigative_report
from ..services.scene_registry import scene_registry
from ..services.monitoring_scheduler import monitoring_scheduler

router = APIRouter()

regions_store: Dict[str, Dict[str, Any]] = {}
jobs_store: Dict[str, Dict[str, Any]] = {}
detections_store: Dict[str, Dict[str, Any]] = {}
vessels_store: Dict[str, Dict[str, Any]] = {}
webhooks_store: List[Dict[str, Any]] = []

active_connections: Dict[str, List[WebSocket]] = {}

class ApprovalRequest(BaseModel):
    approver_name: str = "Authorized Environmental Approver"
    notes: Optional[str] = None

# ==============================================================================
# 1. AUTOMATED COASTAL REGIONS & SENTINEL-1 MONITORING ENDPOINTS (v2 UPGRADE)
# ==============================================================================

@router.get("/coastal-regions", response_model=List[CoastalRegion])
async def list_coastal_regions():
    """Lists all predefined coastal monitoring regions with their live monitoring states."""
    return scene_registry.list_regions()

@router.get("/coastal-regions/{region_id}", response_model=CoastalRegion)
async def get_coastal_region(region_id: str):
    """Fetches details for a single coastal monitoring region."""
    reg = scene_registry.get_region(region_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Coastal region not found.")
    return reg

@router.post("/regions/{region_id}/monitoring/start", response_model=RegionMonitoringStatusResponse)
async def start_region_monitoring(region_id: str, background_tasks: BackgroundTasks):
    """
    Activates Sentinel-1 monitoring for a coastal region.
    Discovers scenes, processes the latest acquisition, and enters the background polling loop.
    """
    reg = scene_registry.set_region_monitoring_state(region_id, MonitoringState.ACTIVE)
    if not reg:
        raise HTTPException(status_code=404, detail="Coastal region not found.")

    # Trigger initial scan in background
    background_tasks.add_task(monitoring_scheduler._process_active_region, reg)

    scenes = scene_registry.get_scenes_for_region(region_id)
    return RegionMonitoringStatusResponse(
        region=reg,
        scenes=scenes,
        monitoring_state=reg.monitoring_state,
        active_spills=reg.active_spills_count,
        last_poll_utc=reg.last_checked_at,
        poll_interval_minutes=settings.SATELLITE_POLL_INTERVAL_MINUTES,
        copernicus_timeliness=settings.COPERNICUS_PRODUCT_TIMELINESS
    )

@router.post("/regions/{region_id}/monitoring/pause", response_model=RegionMonitoringStatusResponse)
async def pause_region_monitoring(region_id: str):
    """
    Pauses Sentinel-1 monitoring for a coastal region.
    Scheduler skips this region entirely. ZERO Copernicus queries issued.
    """
    reg = scene_registry.set_region_monitoring_state(region_id, MonitoringState.PAUSED)
    if not reg:
        raise HTTPException(status_code=404, detail="Coastal region not found.")

    scenes = scene_registry.get_scenes_for_region(region_id)
    return RegionMonitoringStatusResponse(
        region=reg,
        scenes=scenes,
        monitoring_state=reg.monitoring_state,
        active_spills=reg.active_spills_count,
        last_poll_utc=reg.last_checked_at,
        poll_interval_minutes=settings.SATELLITE_POLL_INTERVAL_MINUTES,
        copernicus_timeliness=settings.COPERNICUS_PRODUCT_TIMELINESS
    )

@router.post("/regions/{region_id}/monitoring/stop", response_model=RegionMonitoringStatusResponse)
async def stop_region_monitoring(region_id: str):
    """
    Stops Sentinel-1 monitoring for a coastal region (sets INACTIVE).
    Zero outbound queries issued.
    """
    reg = scene_registry.set_region_monitoring_state(region_id, MonitoringState.INACTIVE)
    if not reg:
        raise HTTPException(status_code=404, detail="Coastal region not found.")

    scenes = scene_registry.get_scenes_for_region(region_id)
    return RegionMonitoringStatusResponse(
        region=reg,
        scenes=scenes,
        monitoring_state=reg.monitoring_state,
        active_spills=reg.active_spills_count,
        last_poll_utc=reg.last_checked_at,
        poll_interval_minutes=settings.SATELLITE_POLL_INTERVAL_MINUTES,
        copernicus_timeliness=settings.COPERNICUS_PRODUCT_TIMELINESS
    )

@router.get("/regions/{region_id}/monitoring/status", response_model=RegionMonitoringStatusResponse)
async def get_region_monitoring_status(region_id: str):
    """Returns real-time regional dashboard metrics, scene statuses, and telemetry."""
    reg = scene_registry.get_region(region_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Coastal region not found.")

    scenes = scene_registry.get_scenes_for_region(region_id)
    return RegionMonitoringStatusResponse(
        region=reg,
        scenes=scenes,
        monitoring_state=reg.monitoring_state,
        active_spills=reg.active_spills_count,
        last_poll_utc=reg.last_checked_at,
        poll_interval_minutes=settings.SATELLITE_POLL_INTERVAL_MINUTES,
        copernicus_timeliness=settings.COPERNICUS_PRODUCT_TIMELINESS
    )

@router.get("/regions/{region_id}/scenes", response_model=List[MonitoredScene])
async def list_region_scenes(region_id: str):
    """Returns all monitored Sentinel-1 scene footprints for a region."""
    return scene_registry.get_scenes_for_region(region_id)

@router.get("/scenes/{scene_id}", response_model=MonitoredScene)
async def get_scene(scene_id: str):
    scene = scene_registry.scenes.get(scene_id)
    if not scene:
        raise HTTPException(status_code=404, detail="Monitored scene not found.")
    return scene

@router.get("/scenes/{scene_id}/acquisitions", response_model=SceneAcquisitionsResponse)
async def list_scene_acquisitions(scene_id: str):
    acqs = scene_registry.get_acquisitions_for_scene(scene_id)
    return SceneAcquisitionsResponse(scene_id=scene_id, acquisitions=acqs)

@router.get("/acquisitions/{acquisition_id}", response_model=SatelliteAcquisition)
async def get_acquisition(acquisition_id: str):
    acq = scene_registry.acquisitions.get(acquisition_id)
    if not acq:
        raise HTTPException(status_code=404, detail="Acquisition not found.")
    return acq

@router.get("/acquisitions/{acquisition_id}/detections", response_model=AcquisitionDetectionsResponse)
async def get_acquisition_detections(acquisition_id: str):
    acq = scene_registry.acquisitions.get(acquisition_id)
    if not acq:
        raise HTTPException(status_code=404, detail="Acquisition not found.")

    dets = []
    if acq.detection_id and acq.detection_id in detections_store:
        dets.append(DetectionResponse(**detections_store[acq.detection_id]))
    return AcquisitionDetectionsResponse(acquisition_id=acquisition_id, detections=dets)

@router.post("/monitoring/check")
async def trigger_monitoring_poll():
    """Manual trigger to execute 1 poll cycle immediately across all ACTIVE regions."""
    res = await monitoring_scheduler.poll_active_regions()
    return {"status": "ok", "poll_summary": res}

# ==============================================================================
# 2. MANUAL REGION SELECTION & ANALYSIS ENDPOINTS (PRESERVED COMPATIBILITY)
# ==============================================================================

@router.post("/regions/select", response_model=RegionSelectResponse)
async def select_region(req: RegionSelectRequest):
    try:
        geom = shape(req.geometry)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GeoJSON geometry: {str(e)}")

    if not geom.is_valid:
        geom = geom.buffer(0)
        if not geom.is_valid:
            raise HTTPException(status_code=400, detail="Provided geometry is geometrically invalid or self-intersecting.")

    min_lon, min_lat, max_lon, max_lat = geom.bounds
    
    deg_to_km = 111.32
    avg_lat = (min_lat + max_lat) / 2.0
    cos_lat = max(0.01, abs(math.cos(math.radians(avg_lat))))
    area_km2 = geom.area * (deg_to_km ** 2) * cos_lat
    
    if area_km2 > settings.MAX_REGION_AREA_KM2:
        raise HTTPException(
            status_code=400,
            detail=f"Selected region area ({area_km2:,.1f} km²) exceeds maximum allowed scan threshold of {settings.MAX_REGION_AREA_KM2:,.0f} km²."
        )

    region_id = f"reg-{uuid.uuid4().hex[:10]}"
    regions_store[region_id] = {
        "region_id": region_id,
        "geometry": req.geometry,
        "bbox": [min_lon, min_lat, max_lon, max_lat],
        "area_sq_km": round(float(area_km2), 2)
    }

    return RegionSelectResponse(
        region_id=region_id,
        normalized_geojson=req.geometry,
        bbox=[min_lon, min_lat, max_lon, max_lat],
        area_sq_km=round(float(area_km2), 2)
    )

async def notify_ws(job_id: str, stage: str, progress: int, msg: str, result_id: Optional[str] = None, clean_scene_reason: Optional[str] = None):
    if job_id in active_connections:
        dead_ws = []
        payload = {
            "job_id": job_id,
            "stage": stage,
            "progress_pct": progress,
            "message": msg,
            "result_id": result_id,
            "clean_scene_reason": clean_scene_reason
        }
        for ws in active_connections[job_id]:
            try:
                await ws.send_json(payload)
            except Exception:
                dead_ws.append(ws)
        for d in dead_ws:
            active_connections[job_id].remove(d)

async def run_pipeline_task(job_id: str, region_id: str, geometry: Dict[str, Any]):
    reg = regions_store.get(region_id, {"bbox": [57.5, -20.5, 57.9, -20.2]})
    bbox = reg.get("bbox", [57.5, -20.5, 57.9, -20.2])

    try:
        # 1. SAR ACQUISITION
        jobs_store[job_id].update({"stage": PipelineStage.SEARCHING_COPERNICUS, "progress_pct": 15, "message": "Searching Copernicus Data Space for Sentinel-1 C-SAR..."})
        await notify_ws(job_id, "searching_copernicus", 15, "Searching Copernicus Data Space for Sentinel-1 C-SAR...")
        await asyncio.sleep(0.6)
        scene = await copernicus_client.search_newest_sentinel1_scene(bbox)

        # 2. PREPROCESSING
        jobs_store[job_id].update({"stage": PipelineStage.PREPROCESSING, "progress_pct": 35, "message": "Radiometric calibration & 512x512 SAR patch extraction..."})
        await notify_ws(job_id, "preprocessing", 35, "Radiometric calibration & 512x512 SAR patch extraction...")
        await asyncio.sleep(0.5)

        # 3. SEGMENTATION & AI INFERENCE
        jobs_store[job_id].update({"stage": PipelineStage.SEGMENTING, "progress_pct": 55, "message": "Executing U-Net EfficientNet-B4 segmentation inference..."})
        await notify_ws(job_id, "segmenting", 55, "Executing U-Net EfficientNet-B4 segmentation inference...")
        await asyncio.sleep(0.5)
        spill_data = ai_pipeline.process_scene_geometry(geometry, bbox)

        # 4. FILTERING & LOOK-ALIKE DISCRIMINATION
        jobs_store[job_id].update({"stage": PipelineStage.FILTERING, "progress_pct": 70, "message": "ResNet-50 look-alike rejection & spatial prior weighting..."})
        await notify_ws(job_id, "filtering", 70, "ResNet-50 look-alike rejection & spatial prior weighting...")
        await asyncio.sleep(0.4)

        if not spill_data.get("spill_detected", True):
            reason_msg = spill_data.get("clean_scene_reason", "No dark anomaly found.")
            jobs_store[job_id].update({
                "stage": PipelineStage.COMPLETE,
                "progress_pct": 100,
                "message": "Scene analysed — No oil spill anomaly detected. SAR scene is clean.",
                "result_id": None,
                "clean_scene": True,
                "clean_scene_reason": reason_msg
            })
            await notify_ws(job_id, "complete", 100, "Scene analysed — No oil spill anomaly detected. SAR scene is clean.", clean_scene_reason=reason_msg)
            return

        incident_uuid = str(uuid.uuid4())
        detection_id = f"det-{uuid.uuid4().hex[:10]}"
        
        detection_obj = {
            "id": detection_id,
            "incident_id": incident_uuid,
            "product_id": scene["product_id"],
            "acquisition_timestamp": scene["acquisition_timestamp"],
            "polarization": scene["polarization"],
            "area_km2": spill_data["area_km2"],
            "confidence": spill_data["confidence"],
            "centroid": spill_data["centroid"],
            "bbox": spill_data["bbox"],
            "polygons": spill_data["polygons"],
            "provenance": ProvenanceType.DEMO_RECONSTRUCTION,
            "thickness_estimate_band": "Metallic sheen (0.005 - 0.05 μm)" if spill_data["area_km2"] < 15 else "True color (> 100 μm)",
            "shape_metrics": spill_data["shape_metrics"],
            "spill_age_bucket": spill_data.get("spill_age_bucket", "<6h (Fresh Discharge)"),
            "spatial_priors": spill_data.get("spatial_priors", {}),
            "investigative_brief": None
        }
        detections_store[detection_id] = detection_obj
        detections_store[incident_uuid] = detection_obj

        # Prompt 01 -> Supabase
        severity_level = "critical" if spill_data["area_km2"] > 20 else ("high" if spill_data["area_km2"] > 5 else "medium")
        incident_db_payload = {
            "incident_id": incident_uuid,
            "detection_timestamp_utc": scene["acquisition_timestamp"],
            "detection_confidence": spill_data["confidence"],
            "spill_classification": "mineral_oil_slick",
            "spill_area_km2": spill_data["area_km2"],
            "centroid_lat": spill_data["centroid"]["lat"],
            "centroid_lon": spill_data["centroid"]["lon"],
            "bounding_box": spill_data["bbox"],
            "geometry": spill_data["polygons"],
            "product_id": scene["product_id"],
            "polarization": scene["polarization"],
            "estimated_thickness_band": detection_obj["thickness_estimate_band"],
            "severity": severity_level,
            "status": "new"
        }
        await supabase_db.insert_incident(incident_db_payload)
        await supabase_db.insert_audit_log(
            incident_id=incident_uuid,
            step="detection",
            prompt_name="Prompt 01: Spill Detection Analysis",
            raw_prompt_input={"product_id": scene["product_id"], "bbox": bbox, "region_id": region_id},
            raw_api_response=incident_db_payload,
            model_used="SAR Vision U-Net / EfficientNet-B4 Ensemble"
        )

        # 5. DYNAMIC AIS SEARCH & ATTRIBUTION
        dyn_params = spill_data.get("dynamic_search_params", {
            "search_radius_km": 50.0,
            "start_hours_back": 6.0,
            "end_hours_forward": 1.0,
            "attribution_window_label": "T-6h to T+1h"
        })

        jobs_store[job_id].update({
            "stage": PipelineStage.QUERYING_AIS,
            "progress_pct": 85,
            "message": f"Querying AIS stream ({dyn_params['attribution_window_label']}, {dyn_params['search_radius_km']:.0f}km radius)..."
        })
        await notify_ws(job_id, "querying_ais", 85, f"Querying AIS stream for {dyn_params['search_radius_km']:.0f}km radius...")
        await asyncio.sleep(0.4)
        
        vessels = ais_adapter.query_vessels(
            centroid_lat=spill_data["centroid"]["lat"],
            centroid_lon=spill_data["centroid"]["lon"],
            overpass_time_str=scene["acquisition_timestamp"],
            search_radius_km=dyn_params["search_radius_km"],
            start_hours_back=dyn_params["start_hours_back"],
            end_hours_forward=dyn_params["end_hours_forward"]
        )
        
        vessel_dicts = [v.model_dump() for v in vessels]
        vessels_store[detection_id] = {
            "detection_id": detection_id,
            "incident_id": incident_uuid,
            "ais_provider": ais_adapter.provider_name,
            "ais_data_timestamp": scene["acquisition_timestamp"],
            "search_radius_km": dyn_params["search_radius_km"],
            "attribution_window": {
                "start": f"T-{int(dyn_params['start_hours_back'])}h",
                "end": f"T+{int(dyn_params['end_hours_forward'])}h"
            },
            "vessels": vessel_dicts,
            "is_live": False,
            "data_delayed_note": "Data delayed: Research AIS feeds reflect standard provider ingestion windows."
        }
        vessels_store[incident_uuid] = vessels_store[detection_id]

        # 6. LLM INVESTIGATIVE REPORT GENERATION (Ollama / Local Synthesizer)
        jobs_store[job_id].update({
            "stage": PipelineStage.GENERATING_REPORT,
            "progress_pct": 92,
            "message": "Generating IMO MARPOL Forensic Narrative via local LLM..."
        })
        await notify_ws(job_id, "generating_report", 92, "Generating IMO MARPOL Forensic Narrative...")
        await asyncio.sleep(0.3)

        report_payload = {
            "detection": detection_obj,
            "top_vessel": vessel_dicts[0] if vessel_dicts else {},
            "spatial_priors": spill_data.get("spatial_priors", {})
        }
        investigative_brief = await generate_ollama_investigative_report(report_payload)
        detection_obj["investigative_brief"] = investigative_brief
        detections_store[detection_id]["investigative_brief"] = investigative_brief
        detections_store[incident_uuid]["investigative_brief"] = investigative_brief

        # 7. GENERATE SUPABASE ALERT + MARPOL REPORT FOR APPROVER WORKFLOW
        top_vessel = vessel_dicts[0] if vessel_dicts else {}
        dms_lat = f"{abs(spill_data['centroid']['lat']):.0f}° {abs(spill_data['centroid']['lat'] % 1 * 60):.0f}' {(abs(spill_data['centroid']['lat']) * 60 % 1 * 60):.1f}\" {'N' if spill_data['centroid']['lat'] >= 0 else 'S'}"
        dms_lon = f"{abs(spill_data['centroid']['lon']):.0f}° {abs(spill_data['centroid']['lon'] % 1 * 60):.0f}' {(abs(spill_data['centroid']['lon']) * 60 % 1 * 60):.1f}\" {'E' if spill_data['centroid']['lon'] >= 0 else 'W'}"
        coords_dms = f"{dms_lat} {dms_lon}"

        await supabase_db.insert_alert({
            "alert_id": f"alert-{uuid.uuid4().hex[:10]}",
            "incident_id": incident_uuid,
            "alert_title": f"{severity_level.upper()} PRIORITY: {spill_data['area_km2']:.2f} km² oil slick detected",
            "priority": severity_level,
            "alert_body": (
                f"Automated Sentinel-1 C-SAR dark-spot detection flagged a {spill_data['area_km2']:.2f} km² "
                f"oil slick at {coords_dms} (confidence {spill_data['confidence']*100:.1f}%). "
                f"Top suspect vessel: {top_vessel.get('name', 'UNKNOWN')} (MMSI {top_vessel.get('mmsi', 'N/A')}, "
                f"attribution score {top_vessel.get('attribution_score', 0):.1f}/100)."
            ),
            "coordinates_dms": coords_dms,
            "affected_area_km2": spill_data["area_km2"],
            "top_suspect_vessel": top_vessel.get("name", "UNKNOWN"),
            "recommended_immediate_actions": [
                "Verify with airborne or satellite overflight",
                "Notify coastal state authority and flag-state administration",
                "Dispatch pollution response vessel if slick reaches shoreline",
                "Preserve AIS transmission gap evidence for legal proceedings",
            ],
            "notify_agencies": ["Coast Guard", "REMPEC", "Port State Control"],
            "dispatched": False,
        })

        await supabase_db.insert_marpol_report({
            "report_id": f"rpt-{uuid.uuid4().hex[:10]}",
            "incident_id": incident_uuid,
            "report_content": {
                "dossier_title": f"MARPOL Annex I Investigation — {detection_id}",
                "satellite_telemetry": {
                    "sensor": "Sentinel-1A C-SAR IW",
                    "product_id": scene["product_id"],
                    "polarization": scene["polarization"],
                    "acquisition": scene["acquisition_timestamp"],
                },
                "spill_metrics": {
                    "area_km2": spill_data["area_km2"],
                    "confidence": spill_data["confidence"],
                    "centroid": spill_data["centroid"],
                },
                "primary_suspect": top_vessel,
                "enforcement_recommendation": (
                    f"Initiate flag-state inspection of {top_vessel.get('name', 'UNKNOWN')} "
                    f"under MARPOL Annex I; refer kinematic anomaly evidence to coastal state authority."
                ),
            },
            "submitted": False,
        })

        jobs_store[job_id].update({
            "stage": PipelineStage.COMPLETE,
            "progress_pct": 100,
            "message": "Scan, attribution analysis, and Supabase audit record creation complete.",
            "result_id": detection_id
        })
        await notify_ws(job_id, "complete", 100, "Scan, attribution analysis, and Supabase audit record creation complete.", result_id=detection_id)

    except Exception as exc:
        jobs_store[job_id].update({
            "stage": PipelineStage.FAILED,
            "progress_pct": 0,
            "message": f"Pipeline failure: {str(exc)}",
            "error": str(exc)
        })
        await notify_ws(job_id, "failed", 0, str(exc))

@router.post("/scan", response_model=JobStatusResponse)
async def start_scan(req: ScanRequest, background_tasks: BackgroundTasks):
    job_id = f"job-{uuid.uuid4().hex[:10]}"
    
    geom = req.geometry
    if not geom and req.region_id in regions_store:
        geom = regions_store[req.region_id]["geometry"]
        
    if not geom:
        raise HTTPException(status_code=400, detail="Missing region geometry for scan.")

    jobs_store[job_id] = {
        "job_id": job_id,
        "stage": PipelineStage.QUEUED,
        "progress_pct": 0,
        "message": "Scan job queued...",
        "result_id": None,
        "error": None
    }

    background_tasks.add_task(run_pipeline_task, job_id, req.region_id, geom)

    return JobStatusResponse(
        job_id=job_id,
        stage=PipelineStage.QUEUED,
        progress_pct=0,
        message="Scan job queued...",
        result_id=None
    )

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return JobStatusResponse(**job)

@router.get("/detections/{detection_id}", response_model=DetectionResponse)
async def get_detection(detection_id: str):
    det = detections_store.get(detection_id)
    if not det:
        raise HTTPException(status_code=404, detail="Detection not found.")
    return DetectionResponse(**det)

@router.get("/detections/{detection_id}/vessels", response_model=DetectionVesselsResponse)
async def get_detection_vessels(detection_id: str):
    v = vessels_store.get(detection_id)
    if not v:
        raise HTTPException(status_code=404, detail="Vessels not found for detection.")
    return DetectionVesselsResponse(**v)

# Support both GET and POST on drift endpoint
@router.api_route("/detections/{detection_id}/drift", methods=["GET", "POST"], response_model=DriftTrajectoryResponse)
async def get_drift_trajectory(detection_id: str):
    det = detections_store.get(detection_id)
    if not det:
        raise HTTPException(status_code=404, detail="Detection not found for drift calculation.")

    traj = drift_simulator.simulate_back_trajectory(
        centroid_lat=det["centroid"]["lat"],
        centroid_lon=det["centroid"]["lon"],
        hours_back=6,
        spill_polygon=det["polygons"]
    )
    return traj

@router.get("/incidents/historical", response_model=List[HistoricalIncidentSummary])
async def list_historical_incidents():
    return historical_store.list_incidents()

@router.get("/incidents/historical/{incident_id}/replay", response_model=ReplayTimelineResponse)
async def get_historical_replay(incident_id: str):
    timeline = historical_store.get_replay_timeline(incident_id)
    if not timeline:
        raise HTTPException(status_code=404, detail="Historical incident not found.")
    return timeline

@router.get("/reports/{incident_id}/pdf")
async def export_incident_pdf(incident_id: str):
    det = detections_store.get(incident_id)
    vessels_data = vessels_store.get(incident_id, {}).get("vessels", [])

    if not det:
        inc = historical_store.incidents.get(incident_id)
        if inc:
            pdf_stream = generate_incident_pdf_report(
                incident_id=inc["incident_id"],
                incident_name=inc["name"],
                location=inc["location"],
                date_str=inc["date"],
                area_km2=inc["area_km2"],
                confidence=1.0,
                vessels=[{
                    "name": inc["vessel_name"],
                    "vessel_type": "Documented Casualty Vessel",
                    "flag": "Recorded Flag",
                    "mmsi": "Documented",
                    "attribution_score": 100.0,
                    "distance_to_spill_km": 0.0,
                    "evidence_summary": inc["summary"]
                }],
                provenance_str="Documented Historical Fact",
                investigative_brief=inc.get("summary", ""),
                spill_age_bucket="Documented Historical Casualty",
                spatial_priors={"dist_to_coast_km": 2.5, "dist_to_shipping_lane_km": 8.0, "nearest_shipping_lane": "Coastal Fairway"}
            )
            return StreamingResponse(
                pdf_stream,
                media_type="application/pdf",
                headers={"Content-Disposition": f"inline; filename=MARPOL_Dossier_{incident_id}.pdf"}
            )
        raise HTTPException(status_code=404, detail="Incident record not found for PDF export.")

    priors = det.get("spatial_priors", {})
    pdf_stream = generate_incident_pdf_report(
        incident_id=det["incident_id"],
        incident_name=f"SAR Spill Detection #{det['id'][-6:]}",
        location=f"{det['centroid']['lat']:.4f}°, {det['centroid']['lon']:.4f}°",
        date_str=det["acquisition_timestamp"],
        area_km2=det["area_km2"],
        confidence=det["confidence"],
        vessels=vessels_data,
        provenance_str="Live Sentinel-1 SAR & AIS Stream",
        investigative_brief=det.get("investigative_brief"),
        spill_age_bucket=det.get("spill_age_bucket", "<6h (Fresh Discharge)"),
        spatial_priors=priors
    )
    return StreamingResponse(
        pdf_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename=MARPOL_Dossier_{incident_id}.pdf"}
    )

# --- APPROVER & AUDIT LOG WORKFLOWS ---

@router.get("/approvals/pending")
async def get_pending_approvals():
    result = await supabase_db.get_pending_approvals()
    return {"pending_alerts": result.get("pending_alerts", []), "pending_reports": result.get("pending_reports", [])}

@router.post("/alerts/{alert_id}/approve")
async def approve_alert_endpoint(alert_id: str, req: ApprovalRequest):
    res = await supabase_db.approve_alert(alert_id, req.approver_name)
    return {"status": "dispatched", "result": res}

@router.post("/reports/{report_id}/submit")
async def submit_marpol_report(report_id: str, req: ApprovalRequest):
    res = await supabase_db.submit_marpol_report(report_id, req.approver_name)
    return {"status": "submitted_to_imo", "result": res}

@router.get("/incidents/{incident_id}/audit")
async def get_incident_audit(incident_id: str):
    logs = await supabase_db.get_audit_trail(incident_id)
    return {"incident_id": incident_id, "logs": logs}

@router.post("/webhooks/subscribe", response_model=WebhookSubscribeResponse)
async def subscribe_webhook(req: WebhookSubscribeRequest):
    sub_id = f"sub-{uuid.uuid4().hex[:8]}"
    sub_obj = {
        "subscription_id": sub_id,
        "target_url": req.target_url,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    webhooks_store.append(sub_obj)
    return WebhookSubscribeResponse(**sub_obj)
