import React from 'react';
import { Detection } from '../../types';
import { ProvenanceTag } from '../ui/ProvenanceTag';
import { Satellite, ScrollText, Clock, Navigation, Compass } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface SpillSummaryCardProps {
  detection: Detection;
}

export const SpillSummaryCard: React.FC<SpillSummaryCardProps> = ({ detection }) => {
  const { setIsAuditModalOpen, setSelectedAuditIncidentId } = useStore();

  const handleOpenAudit = () => {
    setSelectedAuditIncidentId(detection.incident_id || detection.id);
    setIsAuditModalOpen(true);
  };

  const priors = detection.spatial_priors;

  return (
    <div className="p-3.5 rounded-[8px] bg-recess-black border border-wire-gray flex flex-col gap-3 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Satellite className="w-4 h-4 text-bone-white stroke-[1.5]" />
          <span className="text-[13px] font-semibold text-bone-white tracking-tight">
            SAR Detection Dossier
          </span>
        </div>
        <ProvenanceTag provenance={detection.provenance} />
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-ash">ESTIMATED SLICK AREA</span>
          <span className="font-mono font-bold text-[16px] text-bone-white">
            {detection.area_km2.toFixed(2)} <span className="text-[12px] font-normal text-mute-gray">km²</span>
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-mono text-ash">MODEL CONFIDENCE</span>
          <span className="font-mono font-bold text-[16px] text-bone-white">
            {(detection.confidence * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Spill Age Classification Badge (Component 3) */}
      {detection.spill_age_bucket && (
        <div className="p-2 rounded-[6px] bg-console-charcoal border border-wire-gray/60 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center gap-1.5 text-mute-gray">
            <Clock className="w-3.5 h-3.5 text-bone-white flex-shrink-0" />
            <span>Spill Age Profile:</span>
          </div>
          <span className="text-bone-white font-bold px-1.5 py-0.5 rounded bg-recess-black border border-wire-gray">
            {detection.spill_age_bucket}
          </span>
        </div>
      )}

      {/* Spatial Priors Proximity Box (Component 2) */}
      {priors && (
        <div className="p-2 rounded-[6px] bg-console-charcoal/80 border border-wire-gray/40 flex flex-col gap-1 text-[10px] font-mono">
          <div className="flex items-center justify-between text-off-white">
            <span className="flex items-center gap-1 text-ash">
              <Compass className="w-3 h-3 text-bone-white" />
              Nearest Coast:
            </span>
            <span className="font-bold text-bone-white">{priors.dist_to_coast_km.toFixed(1)} km</span>
          </div>
          <div className="flex items-center justify-between text-off-white">
            <span className="flex items-center gap-1 text-ash">
              <Navigation className="w-3 h-3 text-bone-white" />
              Shipping Corridor:
            </span>
            <span className="font-bold text-bone-white">{priors.dist_to_shipping_lane_km.toFixed(1)} km</span>
          </div>
          <div className="text-[9px] text-mute-gray truncate pt-0.5 border-t border-wire-gray/30">
            Lane: {priors.nearest_shipping_lane}
          </div>
        </div>
      )}

      {/* Telemetry Details */}
      <div className="pt-2 border-t border-wire-gray/40 flex flex-col gap-1.5 text-[11px] font-mono text-mute-gray">
        <div className="flex items-center justify-between">
          <span className="text-ash">OVERPASS ACQUISITION:</span>
          <span className="text-bone-white">{detection.acquisition_timestamp}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ash">SATELLITE / POL:</span>
          <span className="text-bone-white">Sentinel-1A ({detection.polarization})</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ash">PRODUCT ID:</span>
          <span className="text-off-white truncate max-w-[180px]">{detection.product_id}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ash">CENTROID COORDS:</span>
          <span className="text-off-white">
            {detection.centroid.lat.toFixed(4)}°, {detection.centroid.lon.toFixed(4)}°
          </span>
        </div>
      </div>

      <button
        onClick={handleOpenAudit}
        className="w-full py-1.5 px-3 mt-1 rounded-[6px] bg-console-charcoal border border-wire-gray/60 hover:border-bone-white text-mute-gray hover:text-bone-white text-[11px] font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
      >
        <ScrollText className="w-3.5 h-3.5" />
        <span>View Supabase Prompt Audit Trail (01-05)</span>
      </button>
    </div>
  );
};