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
    COMPLETE = 'complete'
    FAILED = 'failed'

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
    error: Optional[str] = None

class Centroid(BaseModel):
    lat: float
    lon: float

class DetectionResponse(BaseModel):
    id: str
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
    shape_metrics: Optional[Dict[str, float]] = None

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

class AttributionWindow(BaseModel):
    start: str
    end: str

class DetectionVesselsResponse(BaseModel):
    detection_id: str
    ais_provider: str
    ais_data_timestamp: str
    search_radius_km: float = 50.0
    attribution_window: AttributionWindow
    vessels: List[VesselAttribution]
    is_live: bool = False
    data_delayed_note: Optional[str] = 'Data delayed: Global Fishing Watch & AIS research feeds reflect standard provider ingestion windows.'

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
