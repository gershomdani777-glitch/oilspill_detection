import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { ScanEngine } from '../services/scanEngine';
import { EvidencePanel } from '../components/evidence/EvidencePanel';
import { DetectionFeedSidebar } from '../components/evidence/DetectionFeedSidebar';
import { StopStartScanButton } from '../components/ui/StopStartScanButton';

export const LiveMonitoringView: React.FC = () => {
  const {
    selectedCoastalRegionId,
    coastalRegions,
    scanningStatus,
    setScanningStatus,
    detectionFeed,
    addDetectionToFeed,
    setScanningCycleCount,
    activeDetection,
    detectionDetailToken,
    setActiveDetection,
    setActiveVesselsData,
    setDriftTrajectory,
    setIsEvidenceOpen,
  } = useStore();

  const scanEngineRef = useRef<ScanEngine | null>(null);

  // Start/stop scanning when region changes or scanning status changes
  useEffect(() => {
    const selectedRegion = coastalRegions.find((r) => r.id === selectedCoastalRegionId);

    if (!selectedRegion) {
      // No region selected, stop scanning
      if (scanEngineRef.current) {
        scanEngineRef.current.stop();
        scanEngineRef.current = null;
      }
      return;
    }

    // Region is selected
    if (scanningStatus === 'scanning' && selectedRegion) {
      // Start or resume scanning
      if (!scanEngineRef.current) {
        // Create new engine
        scanEngineRef.current = new ScanEngine({
          regionId: selectedCoastalRegionId!,
          bbox: selectedRegion.bbox,
          geometry: selectedRegion.geometry,
          intervalSeconds: 8,
          onDetection: (detection) => {
            console.log('[LiveMonitoringView] Detection received:', detection.id);
            addDetectionToFeed(detection);
          },
          onCleanScene: (reason) => {
            console.log('[LiveMonitoringView] Clean scene:', reason);
          },
          onError: (error) => {
            console.error('[LiveMonitoringView] Scan error:', error);
            setScanningStatus('stopped');
          },
        });
        scanEngineRef.current.start().then(() => {
          // Update cycle count display
          const updateCycleCount = setInterval(() => {
            const status = scanEngineRef.current?.getStatus();
            if (status) {
              setScanningCycleCount(status.cycleCount);
            }
          }, 500);
          return () => clearInterval(updateCycleCount);
        });
      } else if (!scanEngineRef.current.getStatus().isRunning) {
        // Resume existing engine
        scanEngineRef.current.start();
      }
    } else if (scanningStatus === 'stopped') {
      // Stop scanning
      if (scanEngineRef.current) {
        scanEngineRef.current.stop();
      }
    }

    return () => {
      // Cleanup on unmount or when dependencies change
      if (scanEngineRef.current && scanningStatus === 'stopped') {
        // Don't stop here if status is stopped, just let it remain stopped
      }
    };
  }, [selectedCoastalRegionId, coastalRegions, scanningStatus, addDetectionToFeed, setScanningStatus, setScanningCycleCount]);

  // Fetch vessel and drift data when a detection is clicked from feed
  useEffect(() => {
    if (!activeDetection) return;

    // Open panel immediately so user always sees the dossier, even if
    // vessel/drift fetches fail or are still in-flight.
    setIsEvidenceOpen(true);

    const fetchDetectionDetails = async () => {
      try {
        const vRes = await api.getDetectionVessels(activeDetection.id);
        setActiveVesselsData(vRes.vessels, {
          ais_provider: vRes.ais_provider,
          ais_data_timestamp: vRes.ais_data_timestamp,
          search_radius_km: vRes.search_radius_km,
        });
      } catch (err) {
        console.warn('Vessel attribution not available yet:', err);
      }

      try {
        const driftRes = await api.getDriftTrajectory(activeDetection.id);
        setDriftTrajectory(driftRes);
      } catch (dErr) {
        console.warn('Drift trajectory not available:', dErr);
      }
    };

    fetchDetectionDetails();
  }, [activeDetection, detectionDetailToken, setActiveVesselsData, setDriftTrajectory, setIsEvidenceOpen]);

  const selectedRegion = coastalRegions.find((r) => r.id === selectedCoastalRegionId);
  const hasFeed = detectionFeed.length > 0;

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      {/* Coastal Region Controls Panel (replaces old left panel) */}
      {selectedRegion && (
        <div className="absolute bottom-8 left-6 z-[400] flex flex-col gap-3 max-w-[360px] pointer-events-auto">
          {/* Stop/Start Button */}
          <StopStartScanButton />
        </div>
      )}

      {/* Detection Feed Sidebar — right side */}
      {hasFeed && (
        <div className="pointer-events-auto">
          <DetectionFeedSidebar isOpen={hasFeed} />
        </div>
      )}

      {/* Evidence & Attribution Dossier Panel */}
      {activeDetection && (
        <div className="pointer-events-auto">
          <EvidencePanel />
        </div>
      )}
    </div>
  );
};