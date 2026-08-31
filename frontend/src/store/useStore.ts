import { create } from 'zustand';
import {
  Detection,
  VesselAttribution,
  DriftTrajectoryResponse,
  ReplayTimelineResponse,
  PipelineStage,
  UserRole,
} from '../types';

interface AppState {
  currentMode: 'live' | 'historical';
  setCurrentMode: (mode: 'live' | 'historical') => void;

  // Supabase Auth & Role Management (analyst, approver, viewer)
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;

  // Approver Workflow & Modal State
  isApprovalModalOpen: boolean;
  setIsApprovalModalOpen: (open: boolean) => void;
  isAuditModalOpen: boolean;
  setIsAuditModalOpen: (open: boolean) => void;
  selectedAuditIncidentId: string | null;
  setSelectedAuditIncidentId: (id: string | null) => void;
  pendingApprovalsCount: number;
  setPendingApprovalsCount: (count: number) => void;

  selectedRegion: {
    region_id?: string;
    geometry?: any;
    bbox?: number[];
    area_sq_km?: number;
  } | null;
  setSelectedRegion: (region: any) => void;
  regionError: string | null;
  setRegionError: (err: string | null) => void;

  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  pipelineStage: PipelineStage | null;
  pipelineProgress: number;
  pipelineMessage: string;
  setPipelineStatus: (stage: PipelineStage | null, progress: number, message: string) => void;

  activeDetection: Detection | null;
  setActiveDetection: (det: Detection | null) => void;

  activeVessels: VesselAttribution[];
  vesselMetadata: {
    ais_provider: string;
    ais_data_timestamp: string;
    search_radius_km: number;
  } | null;
  setActiveVesselsData: (
    vessels: VesselAttribution[],
    meta: { ais_provider: string; ais_data_timestamp: string; search_radius_km: number }
  ) => void;

  driftTrajectory: DriftTrajectoryResponse | null;
  setDriftTrajectory: (drift: DriftTrajectoryResponse | null) => void;
  showDrift: boolean;
  setShowDrift: (show: boolean) => void;

  isEvidenceOpen: boolean;
  setIsEvidenceOpen: (open: boolean) => void;
  selectedVesselMmsi: string | null;
  setSelectedVesselMmsi: (mmsi: string | null) => void;

  cleanSceneResult: { reason: string } | null;
  setCleanSceneResult: (result: { reason: string } | null) => void;

  // Historical replay state
  selectedHistoricalIncidentId: string | null;
  setSelectedHistoricalIncidentId: (id: string | null) => void;
  replayTimeline: ReplayTimelineResponse | null;
  setReplayTimeline: (timeline: ReplayTimelineResponse | null) => void;
  currentReplayStepIndex: number;
  setCurrentReplayStepIndex: (idx: number) => void;
  isPlayingReplay: boolean;
  setIsPlayingReplay: (playing: boolean) => void;
  replaySpeed: number;
  setReplaySpeed: (speed: number) => void;

  resetLiveScan: () => void;
}

export const useStore = create<AppState>((set) => ({
  currentMode: 'live',
  setCurrentMode: (mode) => set({ currentMode: mode }),

  userRole: 'approver', // Default to approver so user has immediate access to testing all workflows
  setUserRole: (role) => set({ userRole: role }),

  isApprovalModalOpen: false,
  setIsApprovalModalOpen: (open) => set({ isApprovalModalOpen: open }),
  isAuditModalOpen: false,
  setIsAuditModalOpen: (open) => set({ isAuditModalOpen: open }),
  selectedAuditIncidentId: null,
  setSelectedAuditIncidentId: (id) => set({ selectedAuditIncidentId: id }),
  pendingApprovalsCount: 0,
  setPendingApprovalsCount: (count) => set({ pendingApprovalsCount: count }),

  selectedRegion: null,
  setSelectedRegion: (region) => set({ selectedRegion: region, regionError: null }),
  regionError: null,
  setRegionError: (err) => set({ regionError: err }),

  activeJobId: null,
  setActiveJobId: (id) => set({ activeJobId: id }),
  pipelineStage: null,
  pipelineProgress: 0,
  pipelineMessage: '',
  setPipelineStatus: (stage, progress, message) =>
    set({ pipelineStage: stage, pipelineProgress: progress, pipelineMessage: message }),

  activeDetection: null,
  setActiveDetection: (det) => set({ activeDetection: det }),

  activeVessels: [],
  vesselMetadata: null,
  setActiveVesselsData: (vessels, meta) =>
    set({ activeVessels: vessels, vesselMetadata: meta, selectedVesselMmsi: vessels[0]?.mmsi || null }),

  driftTrajectory: null,
  setDriftTrajectory: (drift) => set({ driftTrajectory: drift }),
  showDrift: false,
  setShowDrift: (show) => set({ showDrift: show }),

  isEvidenceOpen: false,
  setIsEvidenceOpen: (open) => set({ isEvidenceOpen: open }),
  selectedVesselMmsi: null,
  setSelectedVesselMmsi: (mmsi) => set({ selectedVesselMmsi: mmsi }),

  cleanSceneResult: null,
  setCleanSceneResult: (result) => set({ cleanSceneResult: result }),

  selectedHistoricalIncidentId: 'inc-wakashio-2020',
  setSelectedHistoricalIncidentId: (id) => set({ selectedHistoricalIncidentId: id }),
  replayTimeline: null,
  setReplayTimeline: (timeline) => set({ replayTimeline: timeline, currentReplayStepIndex: 0 }),
  currentReplayStepIndex: 0,
  setCurrentReplayStepIndex: (idx) => set({ currentReplayStepIndex: idx }),
  isPlayingReplay: false,
  setIsPlayingReplay: (playing) => set({ isPlayingReplay: playing }),
  replaySpeed: 1,
  setReplaySpeed: (speed) => set({ replaySpeed: speed }),

  resetLiveScan: () =>
    set({
      selectedRegion: null,
      regionError: null,
      activeJobId: null,
      pipelineStage: null,
      pipelineProgress: 0,
      pipelineMessage: '',
      activeDetection: null,
      activeVessels: [],
      vesselMetadata: null,
      driftTrajectory: null,
      isEvidenceOpen: false,
      selectedVesselMmsi: null,
      cleanSceneResult: null,
    }),
}));
