import React from 'react';
import { Polygon, Tooltip } from 'react-leaflet';
import { DriftTrajectoryResponse } from '../../types';

interface DriftLayerProps {
  driftTrajectory: DriftTrajectoryResponse | null;
  visible: boolean;
}

export const DriftLayer: React.FC<DriftLayerProps> = ({ driftTrajectory, visible }) => {
  if (!visible || !driftTrajectory || !driftTrajectory.origin_polygons) return null;

  return (
    <>
      {driftTrajectory.origin_polygons.map((step, idx) => {
        const latLngs = step.polygon.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);
        return (
          <Polygon
            key={`drift-${step.step_label}-${idx}`}
            positions={latLngs}
            pathOptions={{
              fillColor: '#a1a1aa',
              fillOpacity: 0.15,
              color: '#5c5c61',
              weight: 1.5,
              dashArray: '3, 5',
            }}
          >
            <Tooltip sticky className="bg-console-charcoal text-bone-white border border-wire-gray rounded-[8px] p-2 font-mono text-xs">
              <div>
                <div className="text-mute-gray text-[10px]">DRIFT BACK-TRAJECTORY ORIGIN</div>
                <div className="text-bone-white font-bold">{step.step_label} Estimate</div>
                <div className="text-ash text-[10px]">{step.timestamp}</div>
              </div>
            </Tooltip>
          </Polygon>
        );
      })}
    </>
  );
};