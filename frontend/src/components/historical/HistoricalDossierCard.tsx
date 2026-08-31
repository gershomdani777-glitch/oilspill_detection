import React from 'react';
import { useStore } from '../../store/useStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { ProvenanceTag } from '../ui/ProvenanceTag';
import {
  AlertTriangle,
  Anchor,
  FileText,
  Clock,
  Layers,
  MapPin,
} from 'lucide-react';

export const HistoricalDossierCard: React.FC = () => {
  const { selectedHistoricalIncidentId, replayTimeline, currentReplayStepIndex } = useStore();

  const { data: incidents } = useQuery({
    queryKey: ['historical-incidents'],
    queryFn: () => api.getHistoricalIncidents(),
  });

  const selectedIncident = incidents?.find(
    (i) => i.incident_id === selectedHistoricalIncidentId
  );

  if (!selectedIncident || !replayTimeline) return null;

  const currentStep = replayTimeline.timeline[currentReplayStepIndex];

  const handleExportPdf = () => {
    window.open(api.getReportPdfUrl(selectedIncident.incident_id), '_blank');
  };

  return (
    <div className="absolute top-6 right-6 z-[400] w-[380px] flex flex-col gap-3 font-sans pointer-events-auto">
      <div className="bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[12px] p-4 flex flex-col gap-3 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-wire-gray/40 pb-2.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-bone-white" />
            <span className="text-[14px] font-bold text-bone-white tracking-tight">
              Satellite Oil Spill Dossier
            </span>
          </div>
          <ProvenanceTag provenance={selectedIncident.provenance} />
        </div>

        {/* Incident Name & Location */}
        <div>
          <h3 className="text-[15px] font-bold text-bone-white leading-snug">
            {selectedIncident.name}
          </h3>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-mute-gray mt-1">
            <MapPin className="w-3.5 h-3.5 text-ash flex-shrink-0" />
            <span className="truncate">{selectedIncident.location}</span>
          </div>
        </div>

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 bg-recess-black/70 p-3 rounded-[8px] border border-wire-gray/40">
          <div>
            <div className="text-[10px] font-mono text-mute-gray">ESTIMATED SLICK AREA</div>
            <div className="text-[17px] font-mono font-bold text-bone-white">
              {selectedIncident.area_km2.toLocaleString()} <span className="text-[12px] font-normal text-mute-gray">km²</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-mute-gray">INCIDENT DATE</div>
            <div className="text-[13px] font-mono font-bold text-bone-white mt-0.5">
              {selectedIncident.date}
            </div>
          </div>
        </div>

        {/* Suspect / Responsible Vessel Card */}
        <div className="p-3 rounded-[8px] bg-recess-black/90 border border-wire-gray/60 space-y-1.5 font-mono text-[11px]">
          <div className="flex items-center justify-between text-mute-gray">
            <span className="flex items-center gap-1.5 text-off-white font-semibold">
              <Anchor className="w-3.5 h-3.5 text-bone-white" />
              Primary Source Vessel:
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-console-charcoal border border-wire-gray text-bone-white font-bold">
              ATTRIBUTED
            </span>
          </div>
          <div className="text-bone-white font-bold text-[13px]">
            {selectedIncident.vessel_name}
          </div>
          <div className="text-mute-gray text-[10px] flex items-center gap-2">
            <span>Coordinates: {selectedIncident.coordinates[0].toFixed(3)}°, {selectedIncident.coordinates[1].toFixed(3)}°</span>
          </div>
        </div>

        {/* Incident Summary */}
        <div className="text-[12px] font-sans text-off-white/90 leading-relaxed bg-recess-black/40 p-2.5 rounded-[6px] border border-wire-gray/30">
          {selectedIncident.summary}
        </div>

        {/* Current Replay Step Status */}
        {currentStep && (
          <div className="flex items-center justify-between text-[11px] font-mono text-mute-gray pt-1 border-t border-wire-gray/40">
            <span className="flex items-center gap-1 text-off-white">
              <Clock className="w-3.5 h-3.5 text-bone-white" />
              Step: <strong className="text-bone-white">{currentStep.step_label}</strong>
            </span>
            <span className="flex items-center gap-1 text-off-white">
              <Layers className="w-3.5 h-3.5 text-bone-white" />
              Slick Status: <strong className={currentStep.spill_state ? 'text-bone-white' : 'text-mute-gray'}>
                {currentStep.spill_state ? 'ACTIVE DISCHARGE' : 'NO SLICK'}
              </strong>
            </span>
          </div>
        )}

        {/* Export PDF Button */}
        <button
          onClick={handleExportPdf}
          className="w-full py-2 px-3 rounded-[6px] bg-bone-white text-nav-ink hover:bg-off-white font-mono font-bold text-[12px] flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
        >
          <FileText className="w-4 h-4 text-true-black" />
          <span>Export IMO MARPOL PDF Dossier</span>
        </button>
      </div>
    </div>
  );
};
