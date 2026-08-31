import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { HistoricalPicker } from '../components/historical/HistoricalPicker';
import { TimeSliderBar } from '../components/historical/TimeSliderBar';
import { HistoricalDossierCard } from '../components/historical/HistoricalDossierCard';

export const HistoricalView: React.FC = () => {
  const {
    selectedHistoricalIncidentId,
    setReplayTimeline,
    setCurrentReplayStepIndex,
  } = useStore();

  useEffect(() => {
    if (selectedHistoricalIncidentId) {
      api.getHistoricalReplay(selectedHistoricalIncidentId).then((timeline) => {
        setReplayTimeline(timeline);
        const spillIdx = timeline.timeline.findIndex((s) => s.step_label === 'Spill');
        setCurrentReplayStepIndex(spillIdx >= 0 ? spillIdx : 4);
      });
    }
  }, [selectedHistoricalIncidentId, setReplayTimeline, setCurrentReplayStepIndex]);

  return (
    <>
      <HistoricalPicker />
      <HistoricalDossierCard />
      <TimeSliderBar />
    </>
  );
};