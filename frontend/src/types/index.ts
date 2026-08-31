export type ProvenanceType =
  | 'live_satellite'
  | 'historical_record'
  | 'demo_reconstruction'
  | 'documented_fact'
  | 'model_reconstruction'
  | 'demo_data';

export type PipelineStage =
  | 'queued'
  | 'searching_copernicus'
  | 'preprocessing'
  | 'segmenting'
  | 'filtering'
  | 'querying_ais'
  | 'scoring'
  | 'complete'
  | 'failed';

export type UserRole = 'analyst' | 'approver' | 'viewer';

export interface Centroid {
  lat: number;
  lon: number;
}

export interface Detection {
  id: string;
  incident_id?: string;
  product_id: string;
  acquisition_timestamp: string;
  polarization: string;
  area_km2: number;
  confidence: number;
  centroid: Centroid;
  bbox: number[];
  polygons: {
    type: string;
    coordinates: number[][][][];
  };
  provenance: ProvenanceType;
  thickness_estimate_band: string | null;
  shape_metrics?: {
    elongation: number;
    compactness: number;
    wind_colocation_ms: number;
  };
}

export interface VesselPositionPoint {
  lat: number;
  lon: number;
  timestamp: string;
  course?: number;
  speed?: number;
}

export interface ScoreBreakdown {
  proximity: number;
  ais_gap: number;
  vessel_type: number;
  trajectory_alignment: number;
  cargo_port_correlation: number;
  historical_violation: number;
}

export interface VesselAttribution {
  mmsi: string;
  imo?: string;
  name: string;
  vessel_type: string;
  flag: string;
  cargo?: string;
  distance_to_spill_km: number;
  position_history: VesselPositionPoint[];
  ais_gap_severity: number;
  attribution_score: number;
  score_breakdown: ScoreBreakdown;
  evidence_summary: string;
  provenance: ProvenanceType;
}

export interface DetectionVesselsResponse {
  detection_id: string;
  incident_id?: string;
  ais_provider: string;
  ais_data_timestamp: string;
  search_radius_km: number;
  attribution_window: { start: string; end: string };
  vessels: VesselAttribution[];
  is_live: boolean;
  data_delayed_note?: string;
}

export interface DriftStep {
  step_label: string;
  timestamp: string;
  polygon: {
    type: string;
    coordinates: number[][][];
  };
}

export interface DriftTrajectoryResponse {
  detection_id: string;
  origin_polygons: DriftStep[] | null;
  unavailable_reason: string | null;
  forcing_sources?: Record<string, string>;
}

export interface HistoricalIncidentSummary {
  incident_id: string;
  name: string;
  date: string;
  location: string;
  summary: string;
  provenance: ProvenanceType;
  coordinates: [number, number];
  area_km2: number;
  vessel_name: string;
}

export interface ReplayStep {
  step_label: string;
  timestamp: string;
  spill_state: { type: string; coordinates: number[][][] } | null;
  vessel_positions: {
    mmsi: string;
    name: string;
    lat: number;
    lon: number;
    course: number;
    speed: number;
  }[];
}

export interface ReplayTimelineResponse {
  incident_id: string;
  name: string;
  date: string;
  location: string;
  provenance: ProvenanceType;
  area_km2?: number;
  vessel_name?: string;
  timeline: ReplayStep[];
}

// ------------------------------------------------------------------------------
// SUPABASE DATABASE TYPES
// ------------------------------------------------------------------------------
export interface SupabaseIncident {
  incident_id: string;
  detection_timestamp_utc: string;
  detection_confidence: number;
  spill_classification: string;
  spill_area_km2: number;
  centroid_lat: number;
  centroid_lon: number;
  bounding_box: number[];
  geometry?: any;
  product_id?: string;
  polarization?: string;
  estimated_thickness_band?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  look_alike_risk_factors?: string[];
  recommended_action?: string;
  analyst_notes?: string;
  status: 'new' | 'under_review' | 'confirmed' | 'dismissed';
  created_at: string;
}

export interface SupabaseVesselAttribution {
  attribution_id: string;
  incident_id: string;
  rank: number;
  mmsi: string;
  vessel_name: string;
  flag_state: string;
  vessel_type: string;
  attribution_score: number;
  distance_at_t0_km: number;
  ais_gap_detected: boolean;
  ais_gap_duration_minutes: number;
  trajectory_alignment: number;
  score_breakdown?: any;
  key_evidence: string[];
  suspicion_level: 'high' | 'medium' | 'low' | 'unlikely';
  position_history?: any[];
  created_at: string;
}

export interface SupabaseAlert {
  alert_id: string;
  incident_id: string;
  alert_title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  alert_body: string;
  coordinates_dms: string;
  affected_area_km2: number;
  top_suspect_vessel: string;
  recommended_immediate_actions: string[];
  notify_agencies: string[];
  alert_expiry_utc?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  dispatched: boolean;
  rejection_reason?: string | null;
  created_at: string;
}

export interface SupabaseMarpolReport {
  report_id: string;
  incident_id: string;
  report_content: any;
  generated_at: string;
  submitted: boolean;
  submitted_at?: string | null;
  submitted_by?: string | null;
  created_at: string;
}

export interface SupabaseAuditLog {
  log_id: string;
  incident_id?: string;
  step: 'detection' | 'attribution' | 'alert' | 'report' | 'drift' | 'review';
  prompt_name: string;
  raw_prompt_input: any;
  raw_api_response: any;
  model_used: string;
  timestamp: string;
}
