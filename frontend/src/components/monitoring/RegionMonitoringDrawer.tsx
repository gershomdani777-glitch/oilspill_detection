import React, { useState } from 'react';
import { CoastalRegion, MonitoredScene } from '../../types';
import { api } from '../../services/api';
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  Satellite,
  ShieldCheck,
  AlertTriangle,
  Radio,
  Clock,
  Compass,
  Layers,
} from 'lucide-react';

interface RegionMonitoringDrawerProps {
  region: CoastalRegion | null;
  scenes: MonitoredScene[];
  onRegionUpdated: (updatedRegion: CoastalRegion, scenes: MonitoredScene[]) => void;
  onClose: () => void;
}

export const RegionMonitoringDrawer: React.FC<RegionMonitoringDrawerProps> = ({
  region,
  scenes,
  onRegionUpdated,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!region) return null;

  const handleStart = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.startRegionMonitoring(region.id);
      onRegionUpdated(res.region, res.scenes);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to start monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.pauseRegionMonitoring(region.id);
      onRegionUpdated(res.region, res.scenes);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to pause monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.stopRegionMonitoring(region.id);
      onRegionUpdated(res.region, res.scenes);
    } catch (e: any) {
      setErrorMessage(e.message || 'Failed to stop monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualPoll = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await api.triggerMonitoringCheck();
      const statusRes = await api.getRegionMonitoringStatus(region.id);
      onRegionUpdated(statusRes.region, statusRes.scenes);
    } catch (e: any) {
      setErrorMessage(e.message || 'Manual poll failed');
    } finally {
      setIsLoading(false);
    }
  };

  const isMonitoringActive = region.monitoring_state === 'ACTIVE';
  const isMonitoringPaused = region.monitoring_state === 'PAUSED';

  return (
    <div className="p-4 rounded-[10px] bg-console-charcoal/95 border border-wire-gray backdrop-blur-md flex flex-col gap-3.5 shadow-2xl font-sans w-full text-bone-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-wire-gray/40 pb-2.5">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isMonitoringActive ? 'text-emerald-400 animate-pulse' : 'text-mute-gray'}`} />
            <h2 className="text-[14px] font-bold tracking-tight text-bone-white">{region.name}</h2>
          </div>
          <span className="text-[10px] font-mono text-mute-gray">{region.country_scope}</span>
        </div>

        {/* State Badge */}
        <div
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase border ${
            isMonitoringActive
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
              : isMonitoringPaused
              ? 'bg-yellow-500/10 border-yellow-500/40 text-yellow-400'
              : 'bg-slate-500/10 border-slate-500/40 text-slate-400'
          }`}
        >
          {region.monitoring_state}
        </div>
      </div>

      {/* Control Switch Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleStart}
          disabled={isLoading || isMonitoringActive}
          className={`py-2 px-2.5 rounded-[6px] text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all border ${
            isMonitoringActive
              ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 cursor-pointer shadow-md'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Start</span>
        </button>

        <button
          onClick={handlePause}
          disabled={isLoading || !isMonitoringActive}
          className={`py-2 px-2.5 rounded-[6px] text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all border ${
            isMonitoringPaused
              ? 'bg-yellow-600/30 text-yellow-300 border-yellow-500/50 cursor-default'
              : 'bg-console-charcoal hover:bg-recess-black text-mute-gray hover:text-bone-white border-wire-gray cursor-pointer'
          }`}
        >
          <Pause className="w-3.5 h-3.5" />
          <span>Pause</span>
        </button>

        <button
          onClick={handleStop}
          disabled={isLoading || region.monitoring_state === 'INACTIVE'}
          className="py-2 px-2.5 rounded-[6px] text-[11px] font-mono flex items-center justify-center gap-1.5 transition-all border bg-console-charcoal hover:bg-red-950/40 text-mute-gray hover:text-red-300 border-wire-gray hover:border-red-500/40 cursor-pointer"
        >
          <Square className="w-3.5 h-3.5" />
          <span>Stop</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-2 rounded bg-red-950/40 border border-red-800 text-[11px] text-red-300 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-recess-black/60 p-2.5 rounded-[6px] border border-wire-gray/40">
        <div>
          <span className="text-ash block text-[10px]">MONITORED AREA:</span>
          <span className="font-bold text-bone-white">{region.area_sq_km.toLocaleString()} km²</span>
        </div>
        <div>
          <span className="text-ash block text-[10px]">ACTIVE SPILLS:</span>
          <span className={`font-bold ${region.active_spills_count > 0 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
            {region.active_spills_count} Detected
          </span>
        </div>
        <div>
          <span className="text-ash block text-[10px]">SCENE COVERAGE:</span>
          <span className="font-bold text-bone-white">
            {scenes.length} Scenes ({region.processed_scenes_count} Processed)
          </span>
        </div>
        <div>
          <span className="text-ash block text-[10px]">LAST CATALOG CHECK:</span>
          <span className="font-bold text-bone-white truncate block">
            {region.last_checked_at ? new Date(region.last_checked_at).toLocaleTimeString() : 'Awaiting Check'}
          </span>
        </div>
      </div>

      {/* Monitored Scenes Registry List */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[11px] font-mono text-mute-gray">
          <span className="flex items-center gap-1">
            <Satellite className="w-3 h-3 text-sky-400" />
            <span>Sentinel-1 Scene Registry ({scenes.length})</span>
          </span>
          <button
            onClick={handleManualPoll}
            disabled={isLoading}
            className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Poll Now</span>
          </button>
        </div>

        <div className="max-h-[160px] overflow-y-auto pr-1 flex flex-col gap-1.5 font-mono text-[10px]">
          {scenes.length > 0 ? (
            scenes.map((scene, idx) => (
              <div
                key={scene.id}
                className="p-2 rounded bg-recess-black border border-wire-gray/40 flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-off-white font-bold">
                    <span>Scene #{idx + 1}</span>
                    <span className="text-mute-gray font-normal">({scene.orbit_direction})</span>
                  </div>
                  <span className="text-mute-gray text-[9px]">Rel Orbit: {scene.relative_orbit} • Mode: {scene.acquisition_mode}</span>
                </div>
                <div
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    scene.status === 'SPILL_DETECTED'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                      : scene.status === 'PROCESSING'
                      ? 'bg-orange-500/20 text-orange-400'
                      : scene.status === 'PROCESSED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-slate-500/20 text-slate-300'
                  }`}
                >
                  {scene.status}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-mute-gray bg-recess-black/40 rounded border border-dashed border-wire-gray/40">
              No scenes registered yet. Click <b>Start</b> to auto-discover Copernicus acquisitions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
