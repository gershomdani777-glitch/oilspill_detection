import React from 'react';
import { DarkCardSurface } from '../ui/DarkCardSurface';
import { useStore } from '../../store/useStore';
import { Eye, EyeOff } from 'lucide-react';

export const MapLegend: React.FC = () => {
  const { currentMode, driftTrajectory, showDrift, setShowDrift } = useStore();

  return (
    <div className="absolute bottom-6 left-6 z-[400]">
      <DarkCardSurface padding="p-3.5" className="max-w-[280px] backdrop-blur-md bg-console-charcoal/95">
        <div className="flex flex-col gap-2.5 text-[12px] font-sans">
          <div className="text-[11px] font-mono text-mute-gray uppercase tracking-wider border-b border-wire-gray/40 pb-1">
            MAP INSTRUMENT LEGEND
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-[3px] bg-bone-white/40 border border-bone-white flex-shrink-0"></div>
            <span className="text-off-white">SAR Oil Slick Delineation</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full border border-dashed border-bone-white bg-recess-black flex items-center justify-center text-[9px] font-mono font-bold text-bone-white flex-shrink-0">
              #1
            </div>
            <span className="text-off-white">Ranked Suspect Vessel</span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-4 border-t border-dashed border-wire-gray flex-shrink-0"></div>
            <span className="text-mute-gray">AIS Track (T-6h to T+1h)</span>
          </div>

          {driftTrajectory && (
            <button
              onClick={() => setShowDrift(!showDrift)}
              className="flex items-center justify-between pt-2 border-t border-wire-gray/40 text-[11px] text-mute-gray hover:text-bone-white transition-colors"
            >
              <div className="flex items-center gap-1.5">
                {showDrift ? <Eye className="w-3 h-3 stroke-[1.5]" /> : <EyeOff className="w-3 h-3 stroke-[1.5]" />}
                <span>CMEMS Back-Drift Envelope</span>
              </div>
              <span className="font-mono text-[10px] text-ash">{showDrift ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <div className="text-[10px] font-mono text-ash pt-1 border-t border-wire-gray/30">
            {currentMode === 'live'
              ? 'Mode: Near-Real-Time Sentinel-1 (C-SAR)'
              : 'Mode: Historical Archive / Replay'}
          </div>
        </div>
      </DarkCardSurface>
    </div>
  );
};