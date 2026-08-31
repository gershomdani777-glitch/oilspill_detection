import {
  Detection,
  DetectionVesselsResponse,
  DriftTrajectoryResponse,
  HistoricalIncidentSummary,
  ReplayTimelineResponse,
} from '../types';

const API_BASE = '/api/v1';

export const api = {
  selectRegion: async (geometry: any): Promise<{ region_id: string; bbox: number[]; area_sq_km: number }> => {
    const res = await fetch(`${API_BASE}/regions/select`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ geometry }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to select region');
    }
    return res.json();
  },

  startScan: async (region_id: string, geometry?: any): Promise<{ job_id: string; stage: string; progress_pct: number }> => {
    const res = await fetch(`${API_BASE}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region_id, geometry }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to initiate scan job');
    }
    return res.json();
  },

  getJobStatus: async (job_id: string): Promise<{
    job_id: string;
    stage: string;
    progress_pct: number;
    message: string;
    result_id?: string;
    error?: string;
  }> => {
    const res = await fetch(`${API_BASE}/jobs/${job_id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch job status');
    }
    return res.json();
  },

  getDetection: async (detection_id: string): Promise<Detection> => {
    const res = await fetch(`${API_BASE}/detections/${detection_id}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch detection');
    }
    return res.json();
  },

  getDetectionVessels: async (detection_id: string): Promise<DetectionVesselsResponse> => {
    const res = await fetch(`${API_BASE}/detections/${detection_id}/vessels`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch vessel attribution');
    }
    return res.json();
  },

  getDriftTrajectory: async (detection_id: string): Promise<DriftTrajectoryResponse> => {
    const res = await fetch(`${API_BASE}/detections/${detection_id}/drift`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch drift simulation');
    }
    return res.json();
  },

  getHistoricalIncidents: async (): Promise<HistoricalIncidentSummary[]> => {
    const res = await fetch(`${API_BASE}/incidents/historical`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch historical incidents');
    }
    return res.json();
  },

  getHistoricalReplay: async (incident_id: string): Promise<ReplayTimelineResponse> => {
    const res = await fetch(`${API_BASE}/incidents/historical/${incident_id}/replay`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch historical replay');
    }
    return res.json();
  },

  getReportPdfUrl: (incident_id: string): string => {
    return `${API_BASE}/incidents/${incident_id}/report.pdf`;
  },
};