import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Callable

from ..config import settings
from ..models.schemas import (
    MonitoringState, SceneStatus, PipelineStage,
    ProvenanceType, ProcessingJob, ProcessingJobType, ProcessingJobStatus
)
from .scene_registry import scene_registry
from .copernicus import copernicus_client
from .ai_pipeline import ai_pipeline
from .ais_adapter import ais_adapter
from .ollama_report import generate_ollama_investigative_report
from .supabase_client import supabase_db

logger = logging.getLogger("monitoring_scheduler")

class MonitoringScheduler:
    """
    Automated Sentinel-1 Coastal Monitoring Scheduler.
    - Periodically polls active coastal regions for new Sentinel-1 acquisitions.
    - Strict per-region state checking: Paused/Stopped regions trigger ZERO outbound Copernicus requests.
    - Concurrency bounded: Dedicated GPU semaphore for U-Net/ResNet model inference.
    - Fault tolerant: Isolated failure in one scene never blocks sibling scenes.
    """
    def __init__(self):
        self._is_running = False
        self._poll_task: Optional[asyncio.Task] = None
        self._gpu_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_GPU_JOBS)
        self._job_semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_PROCESSING_JOBS)
        self._ws_notifiers: List[Callable] = []
        self._active_jobs: Dict[str, ProcessingJob] = {}

    def register_ws_notifier(self, callback: Callable):
        self._ws_notifiers.append(callback)

    async def _notify_ws(self, event_type: str, payload: Dict[str, Any]):
        for cb in self._ws_notifiers:
            try:
                await cb(event_type, payload)
            except Exception as e:
                logger.debug(f"WS notification callback failed: {e}")

    async def start(self):
        """Starts the background monitoring loop if not already running."""
        if self._is_running:
            return
        self._is_running = True
        self._poll_task = asyncio.create_task(self._poll_loop())
        logger.info(f"Sentinel-1 Automated Monitoring Scheduler started (Interval: {settings.SATELLITE_POLL_INTERVAL_MINUTES} min, Timeliness: {settings.COPERNICUS_PRODUCT_TIMELINESS})")

    async def stop(self):
        """Stops the background monitoring loop."""
        self._is_running = False
        if self._poll_task:
            self._poll_task.cancel()
            try:
                await self._poll_task
            except asyncio.CancelledError:
                pass
        logger.info("Sentinel-1 Automated Monitoring Scheduler stopped.")

    async def _poll_loop(self):
        while self._is_running:
            try:
                await self.poll_active_regions()
            except Exception as e:
                logger.error(f"Error in monitoring scheduler poll cycle: {e}", exc_info=True)

            # Wait for next poll cycle
            await asyncio.sleep(settings.SATELLITE_POLL_INTERVAL_MINUTES * 60)

    async def poll_active_regions(self) -> Dict[str, Any]:
        """
        Executes one full catalog polling cycle across all ACTIVE coastal regions.
        Enforces: Zero network calls for PAUSED or INACTIVE regions.
        """
        logger.info("--- Starting Sentinel-1 Coastal Monitoring Poll Cycle ---")
        poll_utc = datetime.now(timezone.utc).isoformat()
        results: Dict[str, Any] = {"poll_utc": poll_utc, "processed_regions": []}

        # 1. Purge expired raw products according to retention policy
        scene_registry.purge_expired_raw_products()

        # 2. Iterate through regions and filter for ACTIVE only
        for region in scene_registry.list_regions():
            # STRICT CHECK: Only active regions are queried
            if region.monitoring_state != MonitoringState.ACTIVE:
                logger.info(f"Skipping region {region.id} ({region.name}): state is {region.monitoring_state.value} (ZERO Copernicus calls issued)")
                continue

            region_res = await self._process_active_region(region)
            results["processed_regions"].append(region_res)

        logger.info("--- Completed Sentinel-1 Coastal Monitoring Poll Cycle ---")
        return results

    async def _process_active_region(self, region) -> Dict[str, Any]:
        logger.info(f"Scanning active region {region.id} ({region.name}) for Sentinel-1 acquisitions...")
        region.last_checked_at = datetime.now(timezone.utc).isoformat()

        # Step A: Discover scenes if not yet discovered
        existing_scenes = scene_registry.get_scenes_for_region(region.id)
        if not existing_scenes:
            logger.info(f"Initializing scene discovery for region {region.id}...")
            scene_data = await copernicus_client.search_newest_sentinel1_scene(region.bbox)
            scene, _ = scene_registry.match_or_create_scene(
                region_id=region.id,
                relative_orbit=scene_data.get("relative_orbit", 154),
                footprint=scene_data.get("footprint", region.geometry),
                orbit_direction=scene_data.get("orbit_direction", "DESCENDING"),
                polarization=scene_data.get("polarization", "VV+VH"),
                acquisition_mode=scene_data.get("mode", "IW")
            )
            existing_scenes = [scene]

        region_summary = {
            "region_id": region.id,
            "scenes_evaluated": len(existing_scenes),
            "new_acquisitions": 0,
            "spills_detected": 0,
            "errors": 0
        }

        # Step B: Process each scene with isolated error handling
        for scene in existing_scenes:
            try:
                # Guard with overall processing semaphore
                async with self._job_semaphore:
                    acq_res = await self._process_monitored_scene(region, scene)
                    if acq_res.get("new_acquisition"):
                        region_summary["new_acquisitions"] += 1
                    if acq_res.get("spill_detected"):
                        region_summary["spills_detected"] += 1
            except Exception as exc:
                # ISOLATED FAILURE: Sibling scenes in the same region proceed unaffected
                logger.error(f"Error processing scene {scene.id} in region {region.id}: {exc}", exc_info=True)
                scene.status = SceneStatus.ERROR
                region.last_error_message = str(exc)
                region_summary["errors"] += 1

        return region_summary

    async def _process_monitored_scene(self, region, scene) -> Dict[str, Any]:
        """
        Queries Copernicus catalog for a specific scene, checks for new acquisitions,
        and triggers the GPU inference pipeline if a new product is found.
        """
        scene.last_checked_at = datetime.now(timezone.utc).isoformat()
        min_lon, min_lat, max_lon, max_lat = region.bbox
        
        # 1. Query Copernicus Catalog for newest scene metadata
        scene_meta = await copernicus_client.search_newest_sentinel1_scene([min_lon, min_lat, max_lon, max_lat])
        product_id = scene_meta["product_id"]

        # 2. Idempotency Check: Don't reprocess an already-ingested product
        if scene_registry.is_product_ingested(product_id) and scene.latest_acquisition_id:
            logger.info(f"Scene {scene.id}: Product {product_id} already ingested. Normal state: NO_NEW_ACQUISITION.")
            scene.status = SceneStatus.PROCESSED if scene.status != SceneStatus.SPILL_DETECTED else SceneStatus.SPILL_DETECTED
            return {"new_acquisition": False, "status": "NO_NEW_ACQUISITION"}

        logger.info(f"Scene {scene.id}: New Sentinel-1 acquisition discovered ({product_id}). Enqueuing pipeline job...")
        scene.status = SceneStatus.PROCESSING
        
        # 3. Model Inference (Guarded by dedicated GPU Concurrency Semaphore)
        async with self._gpu_semaphore:
            logger.info(f"Executing GPU inference pipeline for scene {scene.id} (semaphore acquired)...")
            spill_data = ai_pipeline.process_scene_geometry(scene.footprint, region.bbox)

        # 4. Handle Detection or Clean Scene
        if not spill_data.get("spill_detected", True):
            reason = spill_data.get("clean_scene_reason", "SAR scene is clean.")
            acq = scene_registry.register_acquisition(
                scene_id=scene.id,
                region_id=region.id,
                product_id=product_id,
                sensing_start=scene_meta["acquisition_timestamp"],
                sensing_end=scene_meta["acquisition_timestamp"],
                footprint=scene_meta["footprint"],
                clean_scene=True,
                clean_scene_reason=reason
            )
            logger.info(f"Scene {scene.id} processed cleanly: {reason}")
            return {"new_acquisition": True, "spill_detected": False, "acquisition_id": acq.id}

        # 5. Full Attribution Pipeline when Spill Detected
        incident_uuid = str(uuid.uuid4())
        detection_id = f"det-{uuid.uuid4().hex[:10]}"
        
        detection_obj = {
            "id": detection_id,
            "incident_id": incident_uuid,
            "product_id": product_id,
            "acquisition_timestamp": scene_meta["acquisition_timestamp"],
            "polarization": scene_meta["polarization"],
            "area_km2": spill_data["area_km2"],
            "confidence": spill_data["confidence"],
            "centroid": spill_data["centroid"],
            "bbox": spill_data["bbox"],
            "polygons": spill_data["polygons"],
            "provenance": ProvenanceType.LIVE_SATELLITE if not settings.COPERNICUS_MOCK_MODE else ProvenanceType.DEMO_RECONSTRUCTION,
            "thickness_estimate_band": "Metallic sheen (0.005 - 0.05 μm)" if spill_data["area_km2"] < 15 else "True color (> 100 μm)",
            "shape_metrics": spill_data.get("shape_metrics"),
            "spill_age_bucket": spill_data.get("spill_age_bucket", "<6h (Fresh Discharge)"),
            "spatial_priors": spill_data.get("spatial_priors", {}),
            "investigative_brief": None
        }

        # Register Acquisition & Link Detection
        acq = scene_registry.register_acquisition(
            scene_id=scene.id,
            region_id=region.id,
            product_id=product_id,
            sensing_start=scene_meta["acquisition_timestamp"],
            sensing_end=scene_meta["acquisition_timestamp"],
            footprint=scene_meta["footprint"],
            clean_scene=False,
            detection_id=detection_id
        )

        # Dynamic AIS search & attribution
        dyn_params = spill_data.get("dynamic_search_params", {
            "search_radius_km": 50.0,
            "start_hours_back": 6.0,
            "end_hours_forward": 1.0
        })
        vessels = ais_adapter.query_vessels(
            centroid_lat=spill_data["centroid"]["lat"],
            centroid_lon=spill_data["centroid"]["lon"],
            overpass_time_str=scene_meta["acquisition_timestamp"],
            search_radius_km=dyn_params["search_radius_km"],
            start_hours_back=dyn_params["start_hours_back"],
            end_hours_forward=dyn_params["end_hours_forward"]
        )
        vessel_dicts = [v.model_dump() for v in vessels]

        # LLM Investigative Narrative
        investigative_brief = await generate_ollama_investigative_report({
            "detection": detection_obj,
            "top_vessel": vessel_dicts[0] if vessel_dicts else {},
            "spatial_priors": spill_data.get("spatial_priors", {})
        })
        detection_obj["investigative_brief"] = investigative_brief

        # Persist Incident & Audit Trail to Supabase
        await supabase_db.insert_incident({
            "incident_id": incident_uuid,
            "detection_timestamp_utc": scene_meta["acquisition_timestamp"],
            "detection_confidence": spill_data["confidence"],
            "spill_classification": "mineral_oil_slick",
            "spill_area_km2": spill_data["area_km2"],
            "centroid_lat": spill_data["centroid"]["lat"],
            "centroid_lon": spill_data["centroid"]["lon"],
            "bounding_box": spill_data["bbox"],
            "geometry": spill_data["polygons"],
            "product_id": product_id,
            "polarization": scene_meta["polarization"],
            "severity": "critical" if spill_data["area_km2"] > 20 else "high",
            "status": "new"
        })

        logger.info(f"SPILL DETECTED in Scene {scene.id} ({spill_data['area_km2']:.2f} km², {spill_data['confidence']*100:.0f}% conf). Detection ID: {detection_id}")
        return {"new_acquisition": True, "spill_detected": True, "detection_id": detection_id, "acquisition_id": acq.id}

monitoring_scheduler = MonitoringScheduler()
