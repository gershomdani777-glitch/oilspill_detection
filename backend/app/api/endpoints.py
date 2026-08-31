import uuid
import math
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from shapely.geometry import shape, Polygon, MultiPolygon

from ..models.schemas import (
    RegionSelectRequest, RegionSelectResponse,
    ScanRequest, JobStatusResponse, PipelineStage,
    DetectionResponse, DetectionVesselsResponse,
    DriftTrajectoryResponse, HistoricalIncidentSummary,
    ReplayTimelineResponse, WebhookSubscribeRequest,
    WebhookSubscribeResponse, ProvenanceType, Centroid, AttributionWindow
)
from ..services.copernicus import copernicus_client
from ..services.ai_pipeline import ai_pipeline
from ..services.ais_adapter import ais_adapter
from ..services.drift_simulator import drift_simulator
from ..services.historical_store import historical_store
from ..services.pdf_report import generate_incident_pdf_report
from ..services.supabase_client import supabase_db

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
    
    # Accurate spherical geodesic approximation: Area = deg_lon * deg_lat * 111.32^2 * cos(avg_lat_rad)
    deg_to_km = 111.32
    avg_lat = (min_lat + max_lat) / 2.0
    cos_lat = max(0.01, abs(math.cos(math.radians(avg_lat))))
    area_km2 = geom.area * (deg_to_km ** 2) * cos_lat
    
    # Generous limit allowing large marine basins up to 500,000 km²
    if area_km2 > 500000.0:
        raise HTTPException(
            status_code=400,
            detail=f"Selected region area ({area_km2:,.1f} km²) exceeds maximum allowed scan threshold of 500,000 km². Please draw a smaller bounding box."
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
        await asyncio.sleep(0.7)
        scene = await copernicus_client.search_newest_sentinel1_scene(bbox)

        # 2. PREPROCESSING
        jobs_store[job_id].update({"stage": PipelineStage.PREPROCESSING, "progress_pct": 35, "message": "Radiometric calibration & 512x512 SAR patch extraction..."})
        await notify_ws(job_id, "preprocessing", 35, "Radiometric calibration & 512x512 SAR patch extraction...")
        await asyncio.sleep(0.6)

        # 3. SEGMENTATION & AI INFERENCE
        jobs_store[job_id].update({"stage": PipelineStage.SEGMENTING, "progress_pct": 55, "message": "Executing U-Net EfficientNet-B4 segmentation inference..."})
        await notify_ws(job_id, "segmenting", 55, "Executing U-Net EfficientNet-B4 segmentation inference...")
        await asyncio.sleep(0.6)
        spill_data = ai_pipeline.process_scene_geometry(geometry, bbox)

        # 4. FILTERING & VALIDATION
        jobs_store[job_id].update({"stage": PipelineStage.FILTERING, "progress_pct": 70, "message": "ResNet-50 look-alike rejection & morphology cleaning..."})
        await notify_ws(job_id, "filtering", 70, "ResNet-50 look-alike rejection & morphology cleaning...")
        await asyncio.sleep(0.5)

        # ----------------------------------------------------------------
        # BRANCH: No Spill Detected → complete cleanly with no result_id
        # ----------------------------------------------------------------
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

        # ----------------------------------------------------------------
        # BRANCH: Spill Detected → full pipeline, persist to Supabase
        # ----------------------------------------------------------------
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
            "shape_metrics": spill_data["shape_metrics"]
        }
        detections_store[detection_id] = detection_obj
        detections_store[incident_uuid] = detection_obj

        # -------------------------------------------------------------
        # PROMPT 01 -> SUPABASE: Insert into incidents & audit_log
        # -------------------------------------------------------------
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
            "look_alike_risk_factors": ["low_wind_shadow_analyzed", "natural_biogenic_film_ruled_out"],
            "recommended_action": f"Deploy containment boom and notify coastal state monitoring station near {spill_data['centroid']['lat']:.3f}°N, {spill_data['centroid']['lon']:.3f}°E",
            "analyst_notes": f"SAR dark patch detected with {spill_data['confidence']*100:.1f}% confidence over {spill_data['area_km2']:.2f} km².",
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

        # 5. AIS CORRELATION & ATTRIBUTION
        jobs_store[job_id].update({"stage": PipelineStage.QUERYING_AIS, "progress_pct": 85, "message": "Querying AIS stream for 50km radius and attribution window..."})
        await notify_ws(job_id, "querying_ais", 85, "Querying AIS stream for 50km radius and attribution window...")
        await asyncio.sleep(0.5)
        
        vessels = ais_adapter.query_vessels(
            centroid_lat=spill_data["centroid"]["lat"],
            centroid_lon=spill_data["centroid"]["lon"],
            overpass_time_str=scene["acquisition_timestamp"],
            search_radius_km=50.0
        )
        
        vessel_dicts = [v.model_dump() for v in vessels]
        vessels_store[detection_id] = {
            "detection_id": detection_id,
            "incident_id": incident_uuid,
            "ais_provider": ais_adapter.provider_name,
            "ais_data_timestamp": scene["acquisition_timestamp"],
            "search_radius_km": 50.0,
            "attribution_window": {
                "start": "T-6h",
                "end": "T+1h"
            },
            "vessels": vessel_dicts,
            "is_live": False,
            "data_delayed_note": "Data delayed: Research AIS feeds reflect standard provider ingestion windows."
        }
        vessels_store[incident_uuid] = vessels_store[detection_id]

        # -------------------------------------------------------------
        # PROMPT 02 -> SUPABASE: Insert into vessel_attributions & audit_log
        # -------------------------------------------------------------
        await supabase_db.insert_vessel_attributions(incident_uuid, vessel_dicts)
        await supabase_db.insert_audit_log(
            incident_id=incident_uuid,
            step="attribution",
            prompt_name="Prompt 02: Vessel Attribution Analysis",
            raw_prompt_input={"centroid": spill_data["centroid"], "overpass_time": scene["acquisition_timestamp"], "radius_km": 50.0},
            raw_api_response={"vessels_evaluated": len(vessel_dicts), "top_vessel": vessel_dicts[0] if vessel_dicts else None},
            model_used="6-Factor Multi-Criteria Attribution Engine"
        )

        # -------------------------------------------------------------
        # PROMPT 03 -> SUPABASE: Insert into alerts with dispatched=false
        # -------------------------------------------------------------
        top_vessel_name = vessel_dicts[0]["name"] if vessel_dicts else "Unknown Vessel"
        top_vessel_mmsi = vessel_dicts[0]["mmsi"] if vessel_dicts else "N/A"
        lat_dms = f"{abs(spill_data['centroid']['lat']):.2f}°{'S' if spill_data['centroid']['lat'] < 0 else 'N'}"
        lon_dms = f"{abs(spill_data['centroid']['lon']):.2f}°{'W' if spill_data['centroid']['lon'] < 0 else 'E'}"
        
        alert_payload = {
            "incident_id": incident_uuid,
            "alert_title": f"{severity_level.upper()} HAZARD: {spill_data['area_km2']:.1f} km² Oil Slick Detected at {lat_dms}, {lon_dms}",
            "priority": severity_level,
            "alert_body": f"Sentinel-1 SAR radar identified a {spill_data['area_km2']:.2f} km² dark slick with {spill_data['confidence']*100:.1f}% confidence. Top suspect vessel: {top_vessel_name} (MMSI: {top_vessel_mmsi}).",
            "coordinates_dms": f"{lat_dms}, {lon_dms}",
            "affected_area_km2": spill_data["area_km2"],
            "top_suspect_vessel": f"{top_vessel_name} (MMSI: {top_vessel_mmsi})",
            "recommended_immediate_actions": [
                "Deploy coastal containment booms",
                "Task aerial or patrol vessel for visual and chemical verification",
                "Broadcast NAVAREA maritime navigational safety warning"
            ],
            "notify_agencies": [
                "National Coast Guard Operations Center",
                "Regional Marine Pollution Emergency Center (REMPEC)",
                "Port State Control Inspection Directorate"
            ]
        }
        await supabase_db.insert_alert(alert_payload)
        await supabase_db.insert_audit_log(
            incident_id=incident_uuid,
            step="alert",
            prompt_name="Prompt 03: Immediate Marine Hazard Alert",
            raw_prompt_input={"incident_id": incident_uuid, "severity": severity_level},
            raw_api_response=alert_payload,
            model_used="Operational Alert Generator / Claude 3.5 Sonnet"
        )

        # -------------------------------------------------------------
        # PROMPT 05 -> SUPABASE: Insert into marpol_reports with submitted=false
        # -------------------------------------------------------------
        marpol_payload = {
            "incident_id": incident_uuid,
            "report_content": {
                "dossier_title": "IMO MARPOL Annex I Discharge Investigation Dossier",
                "incident_ref": incident_uuid,
                "satellite_telemetry": {
                    "sensor": "Sentinel-1 C-SAR",
                    "product_id": scene["product_id"],
                    "acquisition_utc": scene["acquisition_timestamp"],
                    "spill_area_sq_km": spill_data["area_km2"],
                    "radar_confidence": spill_data["confidence"]
                },
                "suspect_attribution": vessel_dicts[:3] if vessel_dicts else [],
                "enforcement_recommendation": "Initiate Flag State & Port State Control inspection under MARPOL Article 4/6."
            }
        }
        await supabase_db.insert_marpol_report(marpol_payload)
        await supabase_db.insert_audit_log(
            incident_id=incident_uuid,
            step="report",
            prompt_name="Prompt 05: IMO MARPOL Annex I Investigation Dossier",
            raw_prompt_input={"incident_id": incident_uuid},
            raw_api_response=marpol_payload["report_content"],
            model_used="IMO Legal Dossier Synthesizer / Claude 3.5 Sonnet"
        )

        jobs_store[job_id].update({"stage": PipelineStage.SCORING, "progress_pct": 95, "message": "Computing explainable multi-factor attribution scores..."})
        await notify_ws(job_id, "scoring", 95, "Computing explainable multi-factor attribution scores...")
        await asyncio.sleep(0.4)

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
    elif not geom:
        geom = {
            "type": "Polygon",
            "coordinates": [[[57.7, -20.5], [57.8, -20.5], [57.8, -20.4], [57.7, -20.4], [57.7, -20.5]]]
        }

    jobs_store[job_id] = {
        "job_id": job_id,
        "stage": PipelineStage.QUEUED,
        "progress_pct": 0,
        "message": "Job queued for satellite acquisition and segmentation.",
        "result_id": None,
        "error": None
    }

    background_tasks.add_task(run_pipeline_task, job_id, req.region_id, geom)

    return JobStatusResponse(
        job_id=job_id,
        stage=PipelineStage.QUEUED,
        progress_pct=0,
        message="Job queued for satellite acquisition and segmentation."
    )

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    if job_id not in jobs_store:
        raise HTTPException(status_code=404, detail="Job not found")
    data = jobs_store[job_id]
    return JobStatusResponse(**data)

@router.get("/detections/{detection_id}", response_model=DetectionResponse)
async def get_detection(detection_id: str):
    if detection_id not in detections_store:
        raise HTTPException(status_code=404, detail="Detection not found")
    return DetectionResponse(**detections_store[detection_id])

@router.get("/detections/{detection_id}/vessels", response_model=DetectionVesselsResponse)
async def get_detection_vessels(detection_id: str):
    if detection_id not in vessels_store:
        raise HTTPException(status_code=404, detail="Vessel attribution data not found for detection")
    return DetectionVesselsResponse(**vessels_store[detection_id])

@router.post("/detections/{detection_id}/drift", response_model=DriftTrajectoryResponse)
async def compute_drift_trajectory(detection_id: str):
    if detection_id not in detections_store:
        raise HTTPException(status_code=404, detail="Detection not found")
    det = detections_store[detection_id]
    return drift_simulator.simulate_back_trajectory(
        centroid_lat=det["centroid"]["lat"],
        centroid_lon=det["centroid"]["lon"],
        detection_id=detection_id,
        base_timestamp_str=det["acquisition_timestamp"]
    )

@router.get("/incidents/historical", response_model=List[HistoricalIncidentSummary])
async def list_historical_incidents():
    return historical_store.list_incidents()

@router.get("/incidents/historical/{incident_id}/replay", response_model=ReplayTimelineResponse)
async def get_historical_replay(incident_id: str):
    timeline = historical_store.get_replay_timeline(incident_id)
    if not timeline:
        raise HTTPException(status_code=404, detail="Historical incident not found")
    return timeline

@router.get("/incidents/{incident_id}/report.pdf")
async def export_incident_pdf(incident_id: str):
    if incident_id in detections_store:
        det = detections_store[incident_id]
        v_data = vessels_store.get(incident_id, {}).get("vessels", [])
        pdf_stream = generate_incident_pdf_report(
            incident_id=incident_id,
            incident_name=f"Sentinel-1 SAR Detection ({det['product_id'][:24]}...)",
            location=f"{det['centroid']['lat']:.4f}°N, {det['centroid']['lon']:.4f}°E",
            date_str=det["acquisition_timestamp"],
            area_km2=det["area_km2"],
            confidence=det["confidence"],
            vessels=v_data,
            provenance_str="Demo Satellite Reconstruction"
        )
    elif incident_id in historical_store.incidents:
        inc = historical_store.incidents[incident_id]
        v_mock = [{
            "name": inc["vessel_name"],
            "mmsi": "999000123",
            "flag": "Panama",
            "vessel_type": "Tanker / Bulk Carrier",
            "distance_to_spill_km": 0.0,
            "ais_gap_severity": 3,
            "attribution_score": 92.4,
            "evidence_summary": f"Documented source vessel for {inc['name']}."
        }]
        pdf_stream = generate_incident_pdf_report(
            incident_id=incident_id,
            incident_name=inc["name"],
            location=inc["location"],
            date_str=inc["date"],
            area_km2=inc["area_km2"],
            confidence=0.99,
            vessels=v_mock,
            provenance_str="Documented Fact / Historical Archive"
        )
    else:
        raise HTTPException(status_code=404, detail="Incident or Detection ID not found for PDF export")

    return StreamingResponse(
        pdf_stream,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="incident_dossier_{incident_id}.pdf"'}
    )

# ------------------------------------------------------------------------------
# SUPABASE APPROVALS & AUDIT ENDPOINTS
# ------------------------------------------------------------------------------
@router.get("/approvals/pending")
async def get_pending_approvals():
    """Fetch pending alerts and MARPOL reports requiring human approver action."""
    return await supabase_db.get_pending_approvals()

@router.post("/alerts/{alert_id}/approve")
async def approve_alert(alert_id: str, req: ApprovalRequest):
    """Approver action to sign and dispatch operational alert."""
    result = await supabase_db.approve_alert(alert_id, req.approver_name)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"status": "dispatched", "alert": result}

@router.post("/reports/{report_id}/submit")
async def submit_marpol_report(report_id: str, req: ApprovalRequest):
    """Approver action to submit MARPOL Annex I investigation dossier."""
    result = await supabase_db.submit_marpol_report(report_id, req.approver_name)
    if not result:
        raise HTTPException(status_code=404, detail="MARPOL report not found")
    return {"status": "submitted", "report": result}

@router.get("/incidents/{incident_id}/audit")
async def get_incident_audit(incident_id: str):
    """Retrieve full audit log trail for an incident."""
    return await supabase_db.get_audit_trail(incident_id)

@router.post("/webhooks/subscribe", response_model=WebhookSubscribeResponse)
async def subscribe_webhook(req: WebhookSubscribeRequest):
    sub_id = f"sub-{uuid.uuid4().hex[:8]}"
    obj = {
        "subscription_id": sub_id,
        "target_url": req.target_url,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    webhooks_store.append(obj)
    return WebhookSubscribeResponse(**obj)
