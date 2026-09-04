import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from shapely.geometry import shape, Polygon

from ..config import settings
from ..models.schemas import (
    CoastalRegion, MonitoredScene, SatelliteAcquisition,
    MonitoringState, SceneStatus, AcquisitionStatus,
    ProcessingJob, ProcessingJobType, ProcessingJobStatus
)

logger = logging.getLogger("scene_registry")

# Predefined high-risk coastal monitoring corridors
DEFAULT_COASTAL_REGIONS: List[Dict[str, Any]] = [
    {
        "id": "reg-mauritius-01",
        "name": "Mauritius Coast (Wakashio Zone)",
        "country_scope": "Mauritius / Indian Ocean",
        "bbox": [57.5, -20.6, 57.9, -20.2],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [57.5, -20.6],
                [57.9, -20.6],
                [57.9, -20.2],
                [57.5, -20.2],
                [57.5, -20.6]
            ]]
        },
        "area_sq_km": 1950.0,
    },
    {
        "id": "reg-malacca-02",
        "name": "Strait of Malacca (Heavy Traffic Corridor)",
        "country_scope": "Malaysia / Indonesia / Singapore",
        "bbox": [101.6, 2.1, 102.4, 2.8],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [101.6, 2.1],
                [102.4, 2.1],
                [102.4, 2.8],
                [101.6, 2.8],
                [101.6, 2.1]
            ]]
        },
        "area_sq_km": 6800.0,
    },
    {
        "id": "reg-gom-03",
        "name": "Gulf of Mexico (Deepwater Drilling Basin)",
        "country_scope": "United States / International Waters",
        "bbox": [-88.8, 28.3, -87.8, 29.2],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-88.8, 28.3],
                [-87.8, 28.3],
                [-87.8, 29.2],
                [-88.8, 29.2],
                [-88.8, 28.3]
            ]]
        },
        "area_sq_km": 9400.0,
    },
    {
        "id": "reg-hormuz-04",
        "name": "Persian Gulf / Strait of Hormuz",
        "country_scope": "Oman / Iran / UAE",
        "bbox": [55.8, 25.8, 56.9, 26.8],
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [55.8, 25.8],
                [56.9, 25.8],
                [56.9, 26.8],
                [55.8, 26.8],
                [55.8, 25.8]
            ]]
        },
        "area_sq_km": 11500.0,
    }
]

class SceneRegistry:
    """
    Central registry for coastal regions, monitored Sentinel-1 scenes,
    acquisitions, and idempotency tracking.
    """
    def __init__(self):
        self.regions: Dict[str, CoastalRegion] = {}
        self.scenes: Dict[str, MonitoredScene] = {}
        self.acquisitions: Dict[str, SatelliteAcquisition] = {}
        self.jobs: Dict[str, ProcessingJob] = {}
        self._product_to_acq_id: Dict[str, str] = {}
        self._init_default_regions()

    def _init_default_regions(self):
        for r_def in DEFAULT_COASTAL_REGIONS:
            region = CoastalRegion(
                id=r_def["id"],
                name=r_def["name"],
                country_scope=r_def["country_scope"],
                geometry=r_def["geometry"],
                bbox=r_def["bbox"],
                area_sq_km=r_def["area_sq_km"],
                enabled=True,
                monitoring_state=MonitoringState.INACTIVE,
                active_spills_count=0,
                total_scenes_count=0,
                processed_scenes_count=0
            )
            self.regions[region.id] = region

    def list_regions(self) -> List[CoastalRegion]:
        return list(self.regions.values())

    def get_region(self, region_id: str) -> Optional[CoastalRegion]:
        return self.regions.get(region_id)

    def set_region_monitoring_state(self, region_id: str, state: MonitoringState) -> Optional[CoastalRegion]:
        region = self.regions.get(region_id)
        if not region:
            return None
        
        now_str = datetime.now(timezone.utc).isoformat()
        region.monitoring_state = state
        if state == MonitoringState.ACTIVE:
            region.monitoring_started_at = now_str
            region.monitoring_stopped_at = None
        elif state in (MonitoringState.PAUSED, MonitoringState.INACTIVE):
            region.monitoring_stopped_at = now_str

        # Update scene status according to region state
        for scene in self.scenes.values():
            if scene.region_id == region_id:
                if state == MonitoringState.ACTIVE:
                    if scene.status == SceneStatus.NOT_MONITORED:
                        scene.status = SceneStatus.MONITORING
                elif state == MonitoringState.PAUSED:
                    if scene.status not in (SceneStatus.PROCESSING, SceneStatus.SPILL_DETECTED):
                        scene.status = SceneStatus.NOT_MONITORED

        logger.info(f"Region {region_id} ({region.name}) monitoring state changed to {state.value}")
        return region

    def compute_footprint_overlap(self, geom1_dict: Dict[str, Any], geom2_dict: Dict[str, Any]) -> float:
        """
        Computes the Intersection-over-Union (IoU) overlap ratio between two footprint GeoJSONs.
        Returns float 0.0 to 1.0.
        """
        try:
            poly1 = shape(geom1_dict)
            poly2 = shape(geom2_dict)
            if not poly1.is_valid:
                poly1 = poly1.buffer(0)
            if not poly2.is_valid:
                poly2 = poly2.buffer(0)

            if poly1.is_empty or poly2.is_empty:
                return 0.0

            intersection_area = poly1.intersection(poly2).area
            min_area = min(poly1.area, poly2.area)
            if min_area <= 0:
                return 0.0
            
            # Intersection over smaller polygon gives strict footprint alignment
            overlap = float(intersection_area / min_area)
            return min(1.0, max(0.0, overlap))
        except Exception as e:
            logger.warning(f"Error computing footprint overlap: {e}")
            return 0.0

    def match_or_create_scene(
        self,
        region_id: str,
        relative_orbit: int,
        footprint: Dict[str, Any],
        orbit_direction: str = 'DESCENDING',
        polarization: str = 'VV+VH',
        acquisition_mode: str = 'IW'
    ) -> Tuple[MonitoredScene, bool]:
        """
        Deterministic Scene Identity Algorithm:
        A new product matches an EXISTING monitored_scene if:
          1. relative_orbit is identical
          2. footprint overlap ratio >= SCENE_MATCH_OVERLAP_THRESHOLD (default 0.70)
        Otherwise, registers a NEW monitored_scene.
        Returns (scene, is_newly_created).
        """
        threshold = settings.SCENE_MATCH_OVERLAP_THRESHOLD
        best_match: Optional[MonitoredScene] = None
        highest_overlap = 0.0

        for scene in self.scenes.values():
            if scene.region_id == region_id and scene.relative_orbit == relative_orbit:
                overlap = self.compute_footprint_overlap(footprint, scene.footprint)
                logger.info(
                    f"Evaluating scene match: candidate scene={scene.id}, orbit={relative_orbit}, "
                    f"overlap={overlap:.3f}, required_threshold={threshold:.2f}"
                )
                if overlap >= threshold and overlap > highest_overlap:
                    highest_overlap = overlap
                    best_match = scene

        if best_match:
            logger.info(f"MATCH CONFIRMED: Acquisition mapped to existing scene {best_match.id} (overlap {highest_overlap:.2f})")
            return best_match, False

        # Create new MonitoredScene
        new_scene_id = f"scn-{uuid.uuid4().hex[:8]}"
        new_scene = MonitoredScene(
            id=new_scene_id,
            region_id=region_id,
            relative_orbit=relative_orbit,
            orbit_direction=orbit_direction,
            footprint=footprint,
            polarization=polarization,
            acquisition_mode=acquisition_mode,
            status=SceneStatus.MONITORING,
            last_checked_at=datetime.now(timezone.utc).isoformat()
        )
        self.scenes[new_scene_id] = new_scene
        
        # Update region scene counts
        reg = self.regions.get(region_id)
        if reg:
            reg.total_scenes_count = len([s for s in self.scenes.values() if s.region_id == region_id])

        logger.info(f"NEW SCENE REGISTERED: Created scene {new_scene_id} in region {region_id} (orbit {relative_orbit})")
        return new_scene, True

    def is_product_ingested(self, product_id: str) -> bool:
        """Idempotency check: returns True if product_id has already been processed."""
        return product_id in self._product_to_acq_id

    def register_acquisition(
        self,
        scene_id: str,
        region_id: str,
        product_id: str,
        sensing_start: str,
        sensing_end: str,
        footprint: Dict[str, Any],
        raw_product_ref: Optional[str] = None,
        clean_scene: bool = False,
        clean_scene_reason: Optional[str] = None,
        detection_id: Optional[str] = None
    ) -> SatelliteAcquisition:
        """Registers a newly acquired Sentinel-1 product with retention timestamp."""
        acq_id = f"acq-{uuid.uuid4().hex[:10]}"
        retained_until = (datetime.now(timezone.utc) + timedelta(days=settings.RAW_PRODUCT_RETENTION_DAYS)).isoformat()
        
        acq = SatelliteAcquisition(
            id=acq_id,
            scene_id=scene_id,
            region_id=region_id,
            product_id=product_id,
            sensing_start=sensing_start,
            sensing_end=sensing_end,
            publication_time=datetime.now(timezone.utc).isoformat(),
            footprint=footprint,
            status=AcquisitionStatus.PROCESSED,
            raw_product_ref=raw_product_ref,
            retained_until=retained_until,
            clean_scene=clean_scene,
            clean_scene_reason=clean_scene_reason,
            detection_id=detection_id
        )

        self.acquisitions[acq_id] = acq
        self._product_to_acq_id[product_id] = acq_id

        # Update scene
        scene = self.scenes.get(scene_id)
        if scene:
            scene.latest_acquisition_id = acq_id
            scene.last_processed_timestamp = sensing_start
            scene.last_checked_at = datetime.now(timezone.utc).isoformat()
            scene.latest_detection_id = detection_id
            if detection_id:
                scene.status = SceneStatus.SPILL_DETECTED
            else:
                scene.status = SceneStatus.PROCESSED

        # Update region
        reg = self.regions.get(region_id)
        if reg:
            reg.last_checked_at = datetime.now(timezone.utc).isoformat()
            reg.newest_acquisition_time = sensing_start
            reg.processed_scenes_count = len([s for s in self.scenes.values() if s.region_id == region_id and s.status in (SceneStatus.PROCESSED, SceneStatus.SPILL_DETECTED)])
            if detection_id:
                reg.active_spills_count = len([s for s in self.scenes.values() if s.region_id == region_id and s.status == SceneStatus.SPILL_DETECTED])

        logger.info(f"Registered acquisition {acq_id} for product {product_id} in scene {scene_id}")
        return acq

    def get_scenes_for_region(self, region_id: str) -> List[MonitoredScene]:
        return [s for s in self.scenes.values() if s.region_id == region_id]

    def get_acquisitions_for_scene(self, scene_id: str) -> List[SatelliteAcquisition]:
        return [a for a in self.acquisitions.values() if a.scene_id == scene_id]

    def purge_expired_raw_products(self) -> int:
        """
        Enforces RAW_PRODUCT_RETENTION_DAYS.
        Purges raw product byte references while indefinitely keeping derived GeoJSON and detection records.
        """
        now = datetime.now(timezone.utc)
        purged = 0
        for acq in self.acquisitions.values():
            if acq.raw_product_ref and acq.retained_until:
                try:
                    expiry = datetime.fromisoformat(acq.retained_until.replace("Z", "+00:00"))
                    if now > expiry:
                        acq.raw_product_ref = None
                        acq.status = AcquisitionStatus.ARCHIVED
                        purged += 1
                except Exception:
                    pass
        if purged > 0:
            logger.info(f"Retention policy pruned {purged} expired raw Sentinel-1 product files.")
        return purged

scene_registry = SceneRegistry()
