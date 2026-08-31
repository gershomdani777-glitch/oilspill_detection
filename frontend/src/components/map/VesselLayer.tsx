import React from 'react';
import { Marker, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { VesselAttribution } from '../../types';
import { useStore } from '../../store/useStore';

interface VesselLayerProps {
  vessels: VesselAttribution[];
  historicalVessels?: { mmsi: string; name: string; lat: number; lon: number; course: number; speed: number }[];
}

export const VesselLayer: React.FC<VesselLayerProps> = ({ vessels, historicalVessels }) => {
  const { selectedVesselMmsi, setSelectedVesselMmsi, setIsEvidenceOpen } = useStore();

  if (historicalVessels && historicalVessels.length > 0) {
    return (
      <>
        {historicalVessels.map((v, idx) => {
          const icon = L.divIcon({
            className: 'custom-vessel-marker',
            html: `
              <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
                <div style="position: absolute; width: 26px; height: 26px; border: 1.5px dashed #5c5c61; border-radius: 9999px;"></div>
                <div style="width: 18px; height: 18px; background: #181818; border: 2px solid #fafafa; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 10px; color: #fafafa;">
                  #1
                </div>
              </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          });

          return (
            <Marker key={`hist-vessel-${idx}`} position={[v.lat, v.lon]} icon={icon}>
              <Tooltip sticky className="bg-console-charcoal text-bone-white border border-wire-gray rounded-[8px] p-2 font-mono text-xs">
                <div>
                  <div className="font-bold text-bone-white">{v.name}</div>
                  <div className="text-[11px] text-mute-gray">Speed: {v.speed} kn | Course: {v.course}°</div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </>
    );
  }

  return (
    <>
      {vessels.map((vessel, index) => {
        const isSelected = selectedVesselMmsi === vessel.mmsi;
        const isTopSuspect = index === 0;
        const rank = index + 1;

        const latestPos = vessel.position_history[vessel.position_history.length - 1] || {
          lat: 0,
          lon: 0,
        };

        const iconHtml = `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            ${
              isTopSuspect || isSelected
                ? '<div style="position: absolute; inset: 0px; border: 1.5px dashed #fafafa; border-radius: 9999px; animation: spin 8s linear infinite;"></div>'
                : '<div style="position: absolute; inset: 2px; border: 1px solid #5c5c61; border-radius: 9999px;"></div>'
            }
            <div style="width: 20px; height: 20px; background: #181818; border: 2px solid #fafafa; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-family: monospace; font-size: 11px; font-weight: 700; color: #fafafa;">
              ${rank}
            </div>
          </div>
        `;

        const icon = L.divIcon({
          className: 'vessel-pin-marker',
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const trackCoordinates = vessel.position_history.map(
          (p) => [p.lat, p.lon] as [number, number]
        );

        return (
          <React.Fragment key={vessel.mmsi}>
            {trackCoordinates.length > 1 && (
              <Polyline
                positions={trackCoordinates}
                pathOptions={{
                  color: isSelected ? '#fafafa' : '#5c5c61',
                  weight: isSelected ? 2 : 1,
                  dashArray: '4, 4',
                  opacity: isSelected ? 0.9 : 0.5,
                }}
              />
            )}
            <Marker
              position={[latestPos.lat, latestPos.lon]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  setSelectedVesselMmsi(vessel.mmsi);
                  setIsEvidenceOpen(true);
                },
              }}
            >
              <Tooltip sticky className="bg-console-charcoal text-bone-white border border-wire-gray rounded-[12px] p-3">
                <div className="space-y-1 font-sans">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[11px] font-mono text-mute-gray uppercase tracking-wider">
                      RANK #{rank} SUSPECT VESSEL
                    </span>
                    <span className="text-[12px] font-mono font-bold text-bone-white bg-recess-black px-1.5 py-0.5 rounded-[4px] border border-wire-gray">
                      Score: {vessel.attribution_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="font-bold text-[14px] text-bone-white">{vessel.name}</div>
                  <div className="text-[12px] text-mute-gray">
                    {vessel.vessel_type} • {vessel.flag}
                  </div>
                  <div className="text-[11px] font-mono text-ash pt-1 border-t border-wire-gray/40">
                    {vessel.distance_to_spill_km.toFixed(1)} km from spill centroid
                  </div>
                </div>
              </Tooltip>
            </Marker>
          </React.Fragment>
        );
      })}
    </>
  );
};