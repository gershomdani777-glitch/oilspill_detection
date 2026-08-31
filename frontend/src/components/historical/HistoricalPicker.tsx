import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { useStore } from '../../store/useStore';
import { DarkCardSurface } from '../ui/DarkCardSurface';
import { ProvenanceTag } from '../ui/ProvenanceTag';
import { Clock } from 'lucide-react';

export const HistoricalPicker: React.FC = () => {
  const {
    selectedHistoricalIncidentId,
    setSelectedHistoricalIncidentId,
    setReplayTimeline,
    setCurrentReplayStepIndex,
  } = useStore();

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['historical-incidents'],
    queryFn: () => api.getHistoricalIncidents(),
  });

  const handleSelectIncident = async (id: string) => {
    setSelectedHistoricalIncidentId(id);
    const timeline = await api.getHistoricalReplay(id);
    setReplayTimeline(timeline);
    // Find the "Spill" step index (or default to index 4) so the oil spill is immediately visible!
    const spillIdx = timeline.timeline.findIndex((s) => s.step_label === 'Spill');
    setCurrentReplayStepIndex(spillIdx >= 0 ? spillIdx : 4);
  };

  return (
    <div className="absolute top-6 left-6 z-[400] w-[360px] flex flex-col gap-2 pointer-events-auto">
      <DarkCardSurface padding="p-3.5" className="backdrop-blur-md bg-console-charcoal/95 border-wire-gray">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-wire-gray/40">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-bone-white stroke-[1.5]" />
            <span className="text-[13px] font-semibold text-bone-white tracking-tight">
              Historical Incident Archive
            </span>
          </div>
          <span className="text-[10px] font-mono text-mute-gray px-1.5 py-0.5 rounded bg-recess-black border border-wire-gray">
            FR-06
          </span>
        </div>

        {isLoading ? (
          <div className="py-6 text-center text-mute-gray text-[12px] font-mono">
            Loading historical archive...
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {incidents?.map((inc) => {
              const isSelected = selectedHistoricalIncidentId === inc.incident_id;
              return (
                <button
                  key={inc.incident_id}
                  onClick={() => handleSelectIncident(inc.incident_id)}
                  className={`p-3 rounded-[8px] border text-left transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-recess-black border-bone-white ring-1 ring-bone-white/30'
                      : 'bg-recess-black/50 border-wire-gray/60 hover:border-mute-gray'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-bone-white tracking-tight truncate">
                      {inc.name}
                    </span>
                    <ProvenanceTag provenance={inc.provenance} />
                  </div>

                  <div className="flex items-center gap-2 text-[11px] font-mono text-ash">
                    <span>{inc.date}</span>
                    <span>•</span>
                    <span className="truncate">{inc.location.split(' (')[0]}</span>
                  </div>

                  <p className="text-[11px] font-sans text-mute-gray line-clamp-2 leading-relaxed">
                    {inc.summary}
                  </p>

                  <div className="pt-1.5 border-t border-wire-gray/30 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-off-white font-medium">Vessel: {inc.vessel_name.split(' (')[0]}</span>
                    <span className="text-bone-white font-bold">{inc.area_km2.toLocaleString()} km²</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DarkCardSurface>
    </div>
  );
};