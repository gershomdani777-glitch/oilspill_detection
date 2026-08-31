import React from 'react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import { PrimaryPillCTA } from '../components/ui/PrimaryPillCTA';
import { EvidencePanel } from '../components/evidence/EvidencePanel';
import { Radar, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import { PipelineStage } from '../types';

export const LiveMonitoringView: React.FC = () => {
  const {
    selectedRegion,
    setActiveJobId,
    pipelineStage,
    pipelineProgress,
    setPipelineStatus,
    setActiveDetection,
    setActiveVesselsData,
    setDriftTrajectory,
    setIsEvidenceOpen,
    activeDetection,
    cleanSceneResult,
    setCleanSceneResult,
    resetLiveScan,
  } = useStore();

  const isScanning =
    pipelineStage !== null &&
    pipelineStage !== 'complete' &&
    pipelineStage !== 'failed';

  const handleStartScan = async () => {
    if (!selectedRegion?.region_id) return;

    // Clear any previous result
    setCleanSceneResult(null);

    try {
      setPipelineStatus('searching_copernicus', 15, 'Searching Copernicus Data Space for Sentinel-1 C-SAR...');
      const job = await api.startScan(selectedRegion.region_id, selectedRegion.geometry);
      setActiveJobId(job.job_id);

      let isFinished = false;

      // Handles a completed scan with an oil spill result
      const handleSpillDetected = async (resultId: string) => {
        if (isFinished) return;
        isFinished = true;

        try {
          const det = await api.getDetection(resultId);
          setActiveDetection(det);

          const vRes = await api.getDetectionVessels(resultId);
          setActiveVesselsData(vRes.vessels, {
            ais_provider: vRes.ais_provider,
            ais_data_timestamp: vRes.ais_data_timestamp,
            search_radius_km: vRes.search_radius_km,
          });

          try {
            const driftRes = await api.getDriftTrajectory(resultId);
            setDriftTrajectory(driftRes);
          } catch (dErr) {
            console.warn('Drift trajectory note:', dErr);
          }

          setIsEvidenceOpen(true);
        } catch (e) {
          console.error('Error loading detection details:', e);
        }
      };

      // Handles a completed scan with NO spill (clean SAR scene)
      const handleCleanScene = (status: any) => {
        if (isFinished) return;
        isFinished = true;
        setCleanSceneResult({
          reason: status.clean_scene_reason || 'No dark SAR anomaly detected in this region.',
        });
      };

      // 1. High-frequency Poller
      const pollInterval = setInterval(async () => {
        if (isFinished) {
          clearInterval(pollInterval);
          return;
        }
        try {
          const status = await api.getJobStatus(job.job_id);
          setPipelineStatus(status.stage as PipelineStage, status.progress_pct, status.message);

          if (status.stage === 'complete') {
            clearInterval(pollInterval);
            if (status.result_id) {
              await handleSpillDetected(status.result_id);
            } else {
              handleCleanScene(status);
            }
          } else if (status.stage === 'failed') {
            clearInterval(pollInterval);
            isFinished = true;
          }
        } catch (pErr) {
          // keep polling
        }
      }, 700);

      // 2. WebSocket Streamer for zero-latency updates
      try {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = window.location.host;
        const ws = new WebSocket(`${wsProtocol}//${wsHost}/ws/jobs/${job.job_id}`);

        ws.onmessage = async (event) => {
          try {
            const data = JSON.parse(event.data);
            setPipelineStatus(data.stage as PipelineStage, data.progress_pct, data.message);

            if (data.stage === 'complete') {
              clearInterval(pollInterval);
              try { ws.close(); } catch (_) {}

              if (data.result_id) {
                await handleSpillDetected(data.result_id);
              } else {
                const finalStatus = await api.getJobStatus(job.job_id);
                if (finalStatus.result_id) {
                  await handleSpillDetected(finalStatus.result_id);
                } else {
                  handleCleanScene(finalStatus);
                }
              }
            }
          } catch (e) {
            // fallback to poller
          }
        };

        ws.onerror = () => {
          // poller takes over seamlessly
        };
      } catch (wsErr) {
        // poller takes over
      }
    } catch (err: any) {
      setPipelineStatus('failed', 0, err.message || 'Pipeline execution failed.');
    }
  };

  const getTerminalStageLabel = () => {
    switch (pipelineStage) {
      case 'searching_copernicus':
        return 'SEARCHING COPERNICUS DATA SPACE…';
      case 'preprocessing':
        return 'RADIOMETRIC SAR PREPROCESSING…';
      case 'segmenting':
        return 'U-NET SEGMENTATION INFERENCE…';
      case 'filtering':
        return 'RESNET-50 LOOK-ALIKE FILTERING…';
      case 'querying_ais':
        return 'QUERYING GFW AIS VESSEL STREAM…';
      case 'scoring':
        return 'COMPUTING 6-FACTOR ATTRIBUTION SCORES…';
      default:
        return 'PROCESSING SATELLITE SCENE…';
    }
  };

  // Show the "clean scene" result banner
  const showCleanBanner = pipelineStage === 'complete' && !activeDetection && cleanSceneResult;

  return (
    <>
      {selectedRegion && !activeDetection && !cleanSceneResult && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto">
          {isScanning ? (
            <div className="flex items-center gap-3 px-6 py-2.5 bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[9999px] shadow-pill font-mono text-[13px] text-bone-white select-none">
              <div className="w-2.5 h-2.5 rounded-full bg-bone-white animate-ping"></div>
              <span className="tracking-wider font-semibold">{getTerminalStageLabel()}</span>
              <span className="text-mute-gray">[{pipelineProgress}%]</span>
            </div>
          ) : (
            <PrimaryPillCTA
              onClick={handleStartScan}
              icon={<Radar className="w-4 h-4 stroke-[1.5] text-true-black" />}
              className="px-8 py-3 text-[15px] font-bold tracking-tight uppercase shadow-2xl"
            >
              Scan Selected Region
            </PrimaryPillCTA>
          )}
        </div>
      )}

      {/* ✅ CLEAN SAR SCENE BANNER — no oil spill detected */}
      {showCleanBanner && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto w-full max-w-[580px]">
          <div className="mx-4 bg-console-charcoal/97 backdrop-blur-md border border-wire-gray rounded-[12px] p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-recess-black border border-wire-gray flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-bone-white stroke-[1.5]" />
              </div>
              <div className="flex-1">
                <div className="text-[13px] font-bold text-bone-white tracking-tight">
                  SAR Scene Clean — No Oil Spill Detected
                </div>
                <div className="text-[11px] font-mono text-mute-gray mt-0.5 leading-relaxed">
                  {cleanSceneResult?.reason}
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-off-white/70 bg-recess-black/60 border border-wire-gray/40 rounded-[6px] px-3 py-2">
              Sentinel-1 C-SAR scene analysed • No dark slick anomaly passed the ResNet-50 look-alike discrimination threshold. The selected maritime zone appears free of oil discharge at time of acquisition.
            </div>

            <button
              onClick={resetLiveScan}
              className="flex items-center justify-center gap-2 py-2 px-4 rounded-[6px] bg-recess-black border border-wire-gray hover:border-bone-white text-off-white hover:text-bone-white font-mono text-[11px] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Scan a Different Region
            </button>
          </div>
        </div>
      )}

      {pipelineStage === 'failed' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[500] pointer-events-auto">
          <div className="flex items-center gap-2 px-5 py-2.5 bg-recess-black/95 border border-wire-gray rounded-[8px] text-off-white text-[12px] font-mono shadow-xl">
            <AlertCircle className="w-4 h-4 text-mute-gray" />
            <span>Scan failed. Please select another region and try again.</span>
          </div>
        </div>
      )}

      <EvidencePanel />
    </>
  );
};