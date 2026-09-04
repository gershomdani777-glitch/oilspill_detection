import React from 'react';
import { useStore } from '../../store/useStore';
import { DarkCardSurface } from '../ui/DarkCardSurface';
import { SpillSummaryCard } from './SpillSummaryCard';
import { VesselRankList } from './VesselRankList';
import { PrimaryPillCTA } from '../ui/PrimaryPillCTA';
import { api } from '../../services/api';
import { X, FileText, Sparkles, ShieldCheck } from 'lucide-react';

export const EvidencePanel: React.FC = () => {
  const {
    isEvidenceOpen,
    setIsEvidenceOpen,
    activeDetection,
    activeVessels,
    vesselMetadata,
  } = useStore();

  if (!isEvidenceOpen || !activeDetection) return null;

  const handleExport = () => {
    window.open(api.getReportPdfUrl(activeDetection.id), '_blank');
  };

  const brief = activeDetection.investigative_brief;

  return (
    <div className="absolute top-6 right-6 bottom-6 z-[500] w-[390px] max-w-[32vw] flex flex-col pointer-events-auto transition-all font-sans">
      <DarkCardSurface
        padding="p-4"
        className="h-full flex flex-col justify-between overflow-hidden shadow-none backdrop-blur-md bg-console-charcoal/98 border-wire-gray"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-wire-gray/40 flex-shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-bone-white tracking-tight">
                Evidence & Attribution Dossier
              </span>
            </div>
            <span className="text-[10px] font-mono text-mute-gray">
              SATELLITE + AIS + LOCAL LLM REASONING
            </span>
          </div>
          <button
            onClick={() => setIsEvidenceOpen(false)}
            className="p-1.5 rounded-[4px] text-mute-gray hover:text-bone-white hover:bg-recess-black transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto pr-1 my-3 flex flex-col gap-3.5">
          {/* 1. Spill Detection Summary */}
          <SpillSummaryCard detection={activeDetection} />

          {/* 2. LLM Investigative Narrative Brief (Component 1: Ollama) */}
          {brief && (
            <div className="p-3.5 rounded-[8px] bg-recess-black border border-wire-gray/70 space-y-2 font-sans">
              <div className="flex items-center justify-between border-b border-wire-gray/40 pb-1.5">
                <div className="flex items-center gap-1.5 text-bone-white">
                  <Sparkles className="w-3.5 h-3.5 text-bone-white stroke-[1.5]" />
                  <span className="text-[12px] font-bold tracking-tight">
                    LLM Investigative Brief (Ollama)
                  </span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-console-charcoal border border-wire-gray text-mute-gray">
                  Llama 3.1 / Qwen2.5
                </span>
              </div>
              <div className="text-[11px] text-off-white/90 leading-relaxed font-sans space-y-2">
                {brief.split("\n\n").map((para, pIdx) => (
                  <p key={`brief-p-${pIdx}`} className="leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* 3. AIS Telemetry Metadata */}
          {vesselMetadata && (
            <div className="p-2.5 rounded-[6px] bg-recess-black border border-wire-gray/40 text-[11px] font-mono text-mute-gray flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-ash">AIS PROVIDER:</span>
                <span className="text-off-white">{vesselMetadata.ais_provider.split(' (')[0]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ash">DATA TIMESTAMP:</span>
                <span className="text-off-white">{vesselMetadata.ais_data_timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ash">DYNAMIC SEARCH RADIUS:</span>
                <span className="text-bone-white font-bold">{vesselMetadata.search_radius_km} km</span>
              </div>
            </div>
          )}

          {/* 4. Suspect Vessel Ranking & Kinematic Breakdown */}
          {activeVessels.length > 0 ? (
            <VesselRankList vessels={activeVessels} />
          ) : (
            <div className="p-4 text-center rounded-[8px] bg-recess-black text-mute-gray text-[12px]">
              No suspect vessels identified within search radius.
            </div>
          )}

          {/* Legal Disclaimer */}
          <div className="p-2.5 rounded-[6px] bg-recess-black/60 border border-wire-gray/40 text-[10px] text-ash leading-relaxed font-sans">
            <span className="font-semibold text-mute-gray uppercase tracking-wider block mb-0.5">
              Analytical Screening Disclaimer:
            </span>
            Attribution scores and kinematic anomaly profiles are screening indicators only. Competent flag or port state authority inspection under IMO MARPOL is required before legal action.
          </div>
        </div>

        {/* Footer Export CTA */}
        <div className="pt-3 border-t border-wire-gray/40 flex items-center justify-between gap-3 flex-shrink-0">
          <PrimaryPillCTA
            icon={<FileText className="w-3.5 h-3.5 stroke-[1.5]" />}
            onClick={handleExport}
            className="w-full"
          >
            Export IMO MARPOL PDF Report
          </PrimaryPillCTA>
        </div>
      </DarkCardSurface>
    </div>
  );
};