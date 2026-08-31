import React from 'react';
import { ScoreBreakdown } from '../../types';

interface ScoreFactorChartProps {
  breakdown: ScoreBreakdown;
}

const FACTOR_CONFIG: { key: keyof ScoreBreakdown; label: string; weight: string }[] = [
  { key: 'proximity', label: 'Spatial Proximity', weight: '30%' },
  { key: 'ais_gap', label: 'AIS Silence / Gap', weight: '25%' },
  { key: 'vessel_type', label: 'Vessel Risk Profile', weight: '15%' },
  { key: 'trajectory_alignment', label: 'Track & Spill Axis Align', weight: '15%' },
  { key: 'cargo_port_correlation', label: 'Petroleum Cargo Manifest', weight: '10%' },
  { key: 'historical_violation', label: 'Historical Prior Record', weight: '5%' },
];

export const ScoreFactorChart: React.FC<ScoreFactorChartProps> = ({ breakdown }) => {
  return (
    <div className="flex flex-col gap-2 pt-2 border-t border-wire-gray/40 font-sans">
      <div className="text-[11px] font-mono text-mute-gray flex justify-between uppercase tracking-wider">
        <span>FACTOR BREAKDOWN</span>
        <span>CONTRIBUTION</span>
      </div>

      <div className="flex flex-col gap-2">
        {FACTOR_CONFIG.map((factor) => {
          const val = breakdown[factor.key] || 0;
          return (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-off-white font-medium">
                  {factor.label}{' '}
                  <span className="text-[10px] text-ash font-mono">({factor.weight})</span>
                </span>
                <span className="font-mono text-bone-white font-semibold">{val.toFixed(1)}</span>
              </div>
              <div className="w-full h-1.5 bg-recess-black rounded-[2px] overflow-hidden border border-wire-gray/40">
                <div
                  className="h-full bg-bone-white transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, val))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};