import { api } from './api';
import { Detection } from '../types';

export type ScanEngineCallback = (detection: Detection) => void;
export type CleanSceneCallback = (reason: string) => void;

interface ScanEngineConfig {
  regionId: string;
  bbox: number[];
  geometry?: any; // GeoJSON geometry
  intervalSeconds?: number;
  onDetection?: ScanEngineCallback;
  onCleanScene?: CleanSceneCallback;
  onError?: (error: Error) => void;
}

export class ScanEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private jobId: string | null = null;
  private config: Required<Omit<ScanEngineConfig, 'onDetection' | 'onCleanScene' | 'onError'>>;
  private onDetection: ScanEngineCallback;
  private onCleanScene: CleanSceneCallback;
  private onError: (error: Error) => void;
  private isRunning = false;
  private cycleCount = 0;
  private lastDetectionIds: Set<string> = new Set();
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private maxCycles: number | null = null;
  private isPolling = false;

  constructor(config: ScanEngineConfig) {
    this.config = {
      regionId: config.regionId,
      bbox: config.bbox,
      geometry: config.geometry,
      intervalSeconds: config.intervalSeconds || 8,
    } as Required<Omit<ScanEngineConfig, 'onDetection' | 'onCleanScene' | 'onError'>>;
    this.onDetection = config.onDetection || (() => {});
    this.onCleanScene = config.onCleanScene || (() => {});
    this.onError = config.onError || console.error;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('ScanEngine is already running');
      return;
    }

    this.isRunning = true;
    this.cycleCount = 0;
    this.lastDetectionIds.clear();

    // Trigger first scan immediately
    await this.runScanCycle();

    // Then schedule subsequent scans
    this.intervalId = setInterval(async () => {
      if (this.maxCycles && this.cycleCount >= this.maxCycles) {
        this.stop();
        return;
      }
      await this.runScanCycle();
    }, this.config.intervalSeconds * 1000);
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.jobId = null;
    this.isPolling = false;
  }

  private async runScanCycle(): Promise<void> {
    try {
      this.cycleCount++;
      console.log(`[ScanEngine] Cycle ${this.cycleCount} started for region ${this.config.regionId}`);

      // Initiate a new scan
      const job = await api.startScan(this.config.regionId, this.config.geometry);
      this.jobId = job.job_id;

      // Poll for job completion
      await this.pollJobUntilComplete();
    } catch (err) {
      this.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private pollJobUntilComplete(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.jobId) {
        resolve();
        return;
      }

      this.isPolling = true;
      const pollStart = Date.now();
      const maxPollTime = 120000; // 2 minutes max per scan

      this.pollInterval = setInterval(async () => {
        if (!this.isRunning || !this.jobId) {
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.isPolling = false;
          resolve();
          return;
        }

        if (Date.now() - pollStart > maxPollTime) {
          console.warn(`[ScanEngine] Scan job ${this.jobId} exceeded max poll time`);
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.isPolling = false;
          resolve();
          return;
        }

        try {
          const status = await api.getJobStatus(this.jobId!);
          console.log(`[ScanEngine] Job ${this.jobId} status: ${status.stage}`);

          if (status.stage === 'complete' || status.stage === 'failed') {
            if (this.pollInterval) clearInterval(this.pollInterval);
            this.isPolling = false;

            if (status.stage === 'complete') {
              if (status.result_id && !this.lastDetectionIds.has(status.result_id)) {
                // New detection found
                try {
                  const detection = await api.getDetection(status.result_id);
                  this.lastDetectionIds.add(status.result_id);
                  this.onDetection(detection);
                  console.log(`[ScanEngine] New detection: ${status.result_id}`);
                } catch (detErr) {
                  console.error('Failed to fetch detection:', detErr);
                }
              } else if (status.clean_scene && status.clean_scene_reason) {
                // Clean scene - no spill
                this.onCleanScene(status.clean_scene_reason);
                console.log(`[ScanEngine] Clean scene: ${status.clean_scene_reason}`);
              }
            }

            resolve();
          }
        } catch (err) {
          console.error('[ScanEngine] Error polling job:', err);
          if (this.pollInterval) clearInterval(this.pollInterval);
          this.isPolling = false;
          resolve();
        }
      }, 700);
    });
  }

  setMaxCycles(max: number | null): void {
    this.maxCycles = max;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      cycleCount: this.cycleCount,
      currentJobId: this.jobId,
      isPolling: this.isPolling,
    };
  }
}
