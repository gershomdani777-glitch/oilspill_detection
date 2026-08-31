import React from 'react';
import { useStore } from '../../store/useStore';
import { DarkCardSurface } from '../ui/DarkCardSurface';
import { SpillSummaryCard } from './SpillSummaryCard';
import { VesselRankList } from './VesselRankList';
import { PrimaryPillCTA } from '../ui/PrimaryPillCTA';
import { api } from '../../services/api';
import { X, FileText } from 'lucide-react';

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

  return (
    <div className="absolute top-6 right-6 bottom-6 z-[500] w-[380px] max-w-[30vw] flex flex-col pointer-events-auto transition-all">
      <DarkCardSurface
        padding="p-4"
        className="h-full flex flex-col justify-between overflow-hidden shadow-none backdrop-blur-md bg-console-charcoal/98 border-wire-gray"
      >
        <div className="flex items-center justify-between pb-3 border-b border-wire-gray/40 flex-shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-semibold text-bone-white tracking-tight">
                Evidence & Attribution Dossier
              </span>
            </div>
            <span className="text-[11px] font-mono text-mute-gray">
              SATELLITE + AIS CORRELATION (FR-07)
            </span>
          </div>
          <button
            onClick={() => setIsEvidenceOpen(false)}
            className="p-1.5 rounded-[4px] text-mute-gray hover:text-bone-white hover:bg-recess-black transition-colors"
          >
            <X className="w-4 h-4 stroke-[1.5]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 my-3 flex flex-col gap-4">
          <SpillSummaryCard detection={activeDetection} />

          {vesselMetadata && (
            <div className="p-2.5 rounded-[6px] bg-recess-black border border-wire-gray/40 text-[11px] font-mono text-mute-gray flex flex-col gap-1">
              <div className="flex justify-between">
                <span className="text-ash">AIS PROVIDER:</span>
                <span className="text-off-white">{vesselMetadata.ais_provider}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ash">DATA TIMESTAMP:</span>
                <span className="text-off-white">{vesselMetadata.ais_data_timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ash">SEARCH RADIUS:</span>
                <span className="text-off-white">{vesselMetadata.search_radius_km} km</span>
              </div>
            </div>
          )}

          {activeVessels.length > 0 ? (
            <VesselRankList vessels={activeVessels} />
          ) : (
            <div className="p-4 text-center rounded-[8px] bg-recess-black text-mute-gray text-[12px]">
              No suspect vessels identified within search radius.
            </div>
          )}

          <div className="p-3 rounded-[6px] bg-recess-black/60 border border-wire-gray/40 text-[10px] text-ash leading-relaxed font-sans">
            <span className="font-semibold text-mute-gray uppercase tracking-wider block mb-1">
              Analytical Screening Disclaimer:
            </span>
            Attribution scores are analytical signals only. Vessels are designated as "suspects" or "potentially associated vessels" and must not be interpreted as definitive legal proof of guilt or discharge.
          </div>
        </div>

        <div className="pt-3 border-t border-wire-gray/40 flex items-center justify-between gap-3 flex-shrink-0">
          <PrimaryPillCTA
            icon={<FileText className="w-3.5 h-3.5 stroke-[1.5]" />}
            onClick={handleExport}
            className="w-full"
          >
            Export PDF Report
          </PrimaryPillCTA>
        </div>
      </DarkCardSurface>
    </div>
  );
};