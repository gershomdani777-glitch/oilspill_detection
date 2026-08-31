import React, { useState } from 'react';
import { VesselAttribution } from '../../types';
import { useStore } from '../../store/useStore';
import { ScoreFactorChart } from './ScoreFactorChart';
import { ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

interface VesselRankListProps {
  vessels: VesselAttribution[];
}

export const VesselRankList: React.FC<VesselRankListProps> = ({ vessels }) => {
  const { selectedVesselMmsi, setSelectedVesselMmsi } = useStore();
  const [expandedMmsi, setExpandedMmsi] = useState<string | null>(vessels[0]?.mmsi || null);

  const toggleExpand = (mmsi: string) => {
    setExpandedMmsi(expandedMmsi === mmsi ? null : mmsi);
    setSelectedVesselMmsi(mmsi);
  };

  const getGapSeverityBadge = (sev: number) => {
    switch (sev) {
      case 3:
        return { label: 'GAP > 6h' };
      case 2:
        return { label: 'GAP 2-6h' };
      case 1:
        return { label: 'GAP < 2h' };
      default:
        return { label: 'CONTINUOUS' };
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-[11px] font-mono text-mute-gray uppercase tracking-wider">
        <span>TOP-5 SUSPECT RANKING</span>
        <span>SCORE (0-100)</span>
      </div>

      <div className="flex flex-col gap-2">
        {vessels.map((vessel, index) => {
          const isExpanded = expandedMmsi === vessel.mmsi;
          const isSelected = selectedVesselMmsi === vessel.mmsi;
          const rank = index + 1;
          const gapInfo = getGapSeverityBadge(vessel.ais_gap_severity);

          return (
            <div
              key={vessel.mmsi}
              className={`rounded-[8px] border transition-all ${
                isSelected
                  ? 'bg-recess-black border-bone-white'
                  : 'bg-recess-black/60 border-wire-gray hover:border-mute-gray'
              }`}
            >
              <button
                onClick={() => toggleExpand(vessel.mmsi)}
                className="w-full p-3 flex items-start justify-between text-left gap-2"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-console-charcoal border border-wire-gray flex items-center justify-center text-[11px] font-mono font-bold text-bone-white flex-shrink-0 mt-0.5">
                    #{rank}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-bone-white tracking-tight">
                        {vessel.name}
                      </span>
                      <span className="text-[11px] font-sans text-mute-gray">
                        ({vessel.flag})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                      <span className="text-off-white font-mono">MMSI {vessel.mmsi}</span>
                      <span className="text-ash">•</span>
                      <span className="text-mute-gray">{vessel.vessel_type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex flex-col items-end">
                    <span className="text-[15px] font-mono font-bold text-bone-white">
                      {vessel.attribution_score.toFixed(1)}
                    </span>
                    <span className="text-[10px] font-mono text-mute-gray px-1 py-0.2 rounded border border-wire-gray/40">
                      {gapInfo.label}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-mute-gray stroke-[1.5] mt-1" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-mute-gray stroke-[1.5] mt-1" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-wire-gray/30 flex flex-col gap-3 text-[12px]">
                  <div className="p-2.5 rounded-[6px] bg-console-charcoal border border-wire-gray/60">
                    <div className="text-[10px] font-mono text-mute-gray uppercase tracking-wider mb-1 flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 stroke-[1.5]" />
                      <span>ANALYTICAL EVIDENCE SUMMARY:</span>
                    </div>
                    <p className="text-off-white font-sans text-[12px] leading-relaxed">
                      {vessel.evidence_summary}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-off-white">
                    <div className="flex flex-col">
                      <span className="text-ash">DISTANCE TO SPILL:</span>
                      <span className="font-bold">{vessel.distance_to_spill_km.toFixed(1)} km</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-ash">IMO NUMBER:</span>
                      <span className="font-bold">{vessel.imo || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col col-span-2">
                      <span className="text-ash">REPORTED CARGO:</span>
                      <span className="font-medium text-bone-white truncate">{vessel.cargo || 'Unstated'}</span>
                    </div>
                  </div>

                  <ScoreFactorChart breakdown={vessel.score_breakdown} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};