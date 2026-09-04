from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
from enum import Enum

class ProvenanceType(str, Enum):
    LIVE_SATELLITE = 'live_satellite'
    HISTORICAL_RECORD = 'historical_record'
    DEMO_RECONSTRUCTION = 'demo_reconstruction'
    DOCUMENTED_FACT = 'documented_fact'
    MODEL_RECONSTRUCTION = 'model_reconstruction'
    DEMO_DATA = 'demo_data'

class PipelineStage(str, Enum):
    QUEUED = 'queued'
    SEARCHING_COPERNICUS = 'searching_copernicus'
    PREPROCESSING = 'preprocessing'
    SEGMENTING = 'segmenting'
    FILTERING = 'filtering'
    QUERYING_AIS = 'querying_ais'
    SCORING = 'scoring'
    GENERATING_REPORT = 'generating_report'
    COMPLETE = 'complete'
    FAILED = 'failed'

# --- SENTINEL-1 UPGRADE & AUTOMATED MONITORING ENUMS ---

class MonitoringState(str, Enum):
    INACTIVE = 'INACTIVE'
    ACTIVE = 'ACTIVE'
    PAUSED = 'PAUSED'
    ERROR = 'ERROR'

class SceneStatus(str, Enum):
    NOT_MONITORED = 'NOT_MONITORED'
    MONITORING = 'MONITORING'
    NEW_ACQUISITION = 'NEW_ACQUISITION'
    PROCESSING = 'PROCESSING'
    PROCESSED = 'PROCESSED'
    SPILL_DETECTED = 'SPILL_DETECTED'
    ERROR = 'ERROR'

class AcquisitionStatus(str, Enum):
    AVAILABLE = 'AVAILABLE'
    INGESTED = 'INGESTED'
    PROCESSING = 'PROCESSING'
    PROCESSED = 'PROCESSED'
    FAILED = 'FAILED'
    ARCHIVED = 'ARCHIVED'

class ProcessingJobType(str, Enum):
    SCENE_DISCOVERY = 'SCENE_DISCOVERY'
    SAR_INGESTION = 'SAR_INGESTION'
    AI_INFERENCE = 'AI_INFERENCE'
    AIS_ATTRIBUTION = 'AIS_ATTRIBUTION'

class ProcessingJobStatus(str, Enum):
    PENDING = 'PENDING'
    RUNNING = 'RUNNING'
    COMPLETED = 'COMPLETED'
    FAILED = 'FAILED'

class GeoPolygon(BaseModel):
    type: str = 'Polygon'
    coordinates: List[List[List[float]]]

class GeoMultiPolygon(BaseModel):
    type: str = 'MultiPolygon'
    coordinates: List[List[List[List[float]]]]

class RegionSelectRequest(BaseModel):
    geometry: Dict[str, Any]

class RegionSelectResponse(BaseModel):
    region_id: str
    normalized_geojson: Dict[str, Any]
    bbox: List[float]  # [min_lon, min_lat, max_lon, max_lat]
    area_sq_km: float

class ScanRequest(BaseModel):
    region_id: str
    geometry: Optional[Dict[str, Any]] = None

class JobStatusResponse(BaseModel):
    job_id: str
    stage: PipelineStage
    progress_pct: int
    message: str
    result_id: Optional[str] = None
    clean_scene: Optional[bool] = False
    clean_scene_reason: Optional[str] = None
    error: Optional[str] = None

class Centroid(BaseModel):
    lat: float
    lon: float

class DetectionResponse(BaseModel):
    id: str
    incident_id: Optional[str] = None
    product_id: str
    acquisition_timestamp: str
    polarization: str
    area_km2: float
    confidence: float
    centroid: Centroid
    bbox: List[float]
    polygons: Dict[str, Any]  # GeoJSON MultiPolygon
    provenance: ProvenanceType
    thickness_estimate_band: Optional[str] = None
    shape_metrics: Optional[Dict[str, Any]] = None
    spill_age_bucket: Optional[str] = None
    spatial_priors: Optional[Dict[str, Any]] = None
    investigative_brief: Optional[str] = None

class VesselPositionPoint(BaseModel):
    lat: float
    lon: float
    timestamp: str
    course: Optional[float] = 0.0
    speed: Optional[float] = 0.0

class ScoreBreakdown(BaseModel):
    proximity: float
    ais_gap: float
    vessel_type: float
    trajectory_alignment: float
    cargo_port_correlation: float
    historical_violation: float

class VesselAttribution(BaseModel):
    mmsi: str
    imo: str
    name: str
    vessel_type: str
    flag: str
    cargo: str
    distance_to_spill_km: float
    position_history: List[VesselPositionPoint]
    ais_gap_severity: int = Field(ge=0, le=3)
    attribution_score: float = Field(ge=0, le=100)
    score_breakdown: ScoreBreakdown
    evidence_summary: str
    provenance: ProvenanceType = ProvenanceType.DEMO_RECONSTRUCTION
    kinematic_anomalies: Optional[Dict[str, Any]] = None

class AttributionWindow(BaseModel):
    start: str
    end: str

class DetectionVesselsResponse(BaseModel):
    detection_id: str
    incident_id: Optional[str] = None
    ais_provider: str
    ais_data_timestamp: str
    search_radius_km: float = 50.0
    attribution_window: AttributionWindow
    vessels: List[VesselAttribution]
    is_live: bool = False
    data_delayed_note: Optional[str] = 'Data delayed: Research AIS feeds reflect standard provider ingestion windows.'

class DriftStep(BaseModel):
    step_label: str
    timestamp: str
    polygon: Dict[str, Any]

class DriftTrajectoryResponse(BaseModel):
    detection_id: str
    origin_polygons: Optional[List[DriftStep]] = None
    unavailable_reason: Optional[str] = None
    forcing_sources: Optional[Dict[str, str]] = None

class HistoricalIncidentSummary(BaseModel):
    incident_id: str
    name: str
    date: str
    location: str
    summary: str
    provenance: ProvenanceType
    coordinates: List[float]
    area_km2: float
    vessel_name: str

class ReplayStep(BaseModel):
    step_label: str
    timestamp: str
    spill_state: Optional[Dict[str, Any]] = None
    vessel_positions: List[Dict[str, Any]]

class ReplayTimelineResponse(BaseModel):
    incident_id: str
    name: str
    date: str
    location: str
    provenance: ProvenanceType
    area_km2: Optional[float] = None
    vessel_name: Optional[str] = None
    timeline: List[ReplayStep]

class WebhookSubscribeRequest(BaseModel):
    target_url: str
    events: List[str] = ['incident.detected', 'attribution.completed']
    secret: Optional[str] = None

class WebhookSubscribeResponse(BaseModel):
    subscription_id: str
    target_url: str
    status: str
    created_at: str

# --- AUTOMATED COASTAL REGIONS & MONITORED SCENES SCHEMAS ---

class CoastalRegion(BaseModel):
    id: str
    name: str
    country_scope: str
    geometry: Dict[str, Any]  # GeoJSON Polygon / MultiPolygon
    bbox: List[float]
    area_sq_km: float
    enabled: bool = True
    monitoring_state: MonitoringState = MonitoringState.INACTIVE
    monitoring_started_at: Optional[str] = None
    monitoring_stopped_at: Optional[str] = None
    last_checked_at: Optional[str] = None
    active_spills_count: int = 0
    total_scenes_count: int = 0
    processed_scenes_count: int = 0
    newest_acquisition_time: Optional[str] = None
    last_error_message: Optional[str] = None

class MonitoredScene(BaseModel):
    id: str
    region_id: str
    relative_orbit: int
    orbit_direction: str = 'DESCENDING'
    footprint: Dict[str, Any]  # GeoJSON Polygon
    polarization: str = 'VV+VH'
    acquisition_mode: str = 'IW'
    status: SceneStatus = SceneStatus.MONITORING
    last_checked_at: Optional[str] = None
    latest_acquisition_id: Optional[str] = None
    last_processed_timestamp: Optional[str] = None
    latest_detection_id: Optional[str] = None

class SatelliteAcquisition(BaseModel):
    id: str
    scene_id: str
    region_id: str
    product_id: str
    sensing_start: str
    sensing_end: str
    publication_time: Optional[str] = None
    footprint: Dict[str, Any]
    processing_level: str = 'LEVEL-1_GRD'
    status: AcquisitionStatus = AcquisitionStatus.PROCESSED
    raw_product_ref: Optional[str] = None
    retained_until: Optional[str] = None
    clean_scene: bool = False
    clean_scene_reason: Optional[str] = None
    detection_id: Optional[str] = None

class ProcessingJob(BaseModel):
    id: str
    region_id: str
    scene_id: Optional[str] = None
    acquisition_id: Optional[str] = None
    job_type: ProcessingJobType
    status: ProcessingJobStatus
    progress_pct: int = 0
    started_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None

class RegionMonitoringStatusResponse(BaseModel):
    region: CoastalRegion
    scenes: List[MonitoredScene]
    monitoring_state: MonitoringState
    active_spills: int
    last_poll_utc: Optional[str] = None
    next_poll_utc: Optional[str] = None
    poll_interval_minutes: int
    copernicus_timeliness: str

class SceneAcquisitionsResponse(BaseModel):
    scene_id: str
    acquisitions: List[SatelliteAcquisition]

class AcquisitionDetectionsResponse(BaseModel):
    acquisition_id: str
    detections: List[DetectionResponse]
