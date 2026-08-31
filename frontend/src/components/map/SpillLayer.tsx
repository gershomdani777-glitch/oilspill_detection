import React from 'react';
import { Polygon, Tooltip, Popup, CircleMarker } from 'react-leaflet';
import { Detection } from '../../types';
import { useStore } from '../../store/useStore';
import { Satellite, Anchor, AlertTriangle, ShieldCheck, ScrollText, MapPin } from 'lucide-react';

interface SpillLayerProps {
  detection: Detection | null;
  historicalSpillState?: { type: string; coordinates: number[][][] } | null;
}

export const SpillLayer: React.FC<SpillLayerProps> = ({ detection, historicalSpillState }) => {
  const {
    currentMode,
    replayTimeline,
    currentReplayStepIndex,
    activeVessels,
    setIsEvidenceOpen,
    setIsAuditModalOpen,
    setSelectedAuditIncidentId,
  } = useStore();

  // ----------------------------------------------------------------------------
  // HISTORICAL REPLAY SPILL LAYER
  // ----------------------------------------------------------------------------
  if (currentMode === 'historical' && historicalSpillState && historicalSpillState.coordinates) {
    const latLngs = historicalSpillState.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);
    const centroidLat = latLngs.reduce((acc, curr) => acc + curr[0], 0) / latLngs.length;
    const centroidLon = latLngs.reduce((acc, curr) => acc + curr[1], 0) / latLngs.length;

    const currentStep = replayTimeline?.timeline?.[currentReplayStepIndex];
    const vesselName =
      currentStep?.vessel_positions?.[0]?.name ||
      replayTimeline?.vessel_name ||
      'Documented Source Vessel';
    const areaDisplay = replayTimeline?.area_km2
      ? `${replayTimeline.area_km2.toLocaleString()} km²`
      : 'Documented Slick';

    return (
      <>
        {/* Core Dark SAR Slick Polygon */}
        <Polygon
          positions={latLngs}
          pathOptions={{
            fillColor: '#0a0a0d',
            fillOpacity: 0.82,
            color: '#fafafa',
            weight: 2.5,
            dashArray: '5 5',
          }}
        >
          <Tooltip
            sticky
            className="bg-console-charcoal text-bone-white border border-wire-gray rounded-[8px] p-2.5 text-xs font-mono shadow-xl"
          >
            <div className="font-sans">
              <div className="text-[10px] font-mono text-mute-gray uppercase tracking-wider flex items-center gap-1">
                <Satellite className="w-3.5 h-3.5 text-bone-white" />
                SATELLITE OIL SPILL SLICK
              </div>
              <div className="font-bold text-bone-white text-[13px] mt-0.5">
                {replayTimeline?.name || 'Historical Disaster'}
              </div>
              <div className="text-[11px] text-off-white font-mono mt-0.5">
                Area: <strong className="text-bone-white">{areaDisplay}</strong> &bull; Suspect: <strong className="text-bone-white">{vesselName.split(' (')[0]}</strong>
              </div>
              <div className="text-[10px] text-mute-gray font-mono mt-1 border-t border-wire-gray/40 pt-1">
                Click slick polygon to view full details
              </div>
            </div>
          </Tooltip>

          {/* Interactive Historical Spill Popup */}
          <Popup className="custom-popup" maxWidth={360}>
            <div className="p-3.5 bg-console-charcoal border border-wire-gray rounded-[12px] text-bone-white font-sans space-y-3 shadow-2xl">
              <div className="flex items-center justify-between border-b border-wire-gray/40 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-bone-white" />
                  <span className="text-[13px] font-bold text-bone-white">
                    {replayTimeline?.name || 'Oil Spill Anomaly'}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-recess-black border border-wire-gray text-mute-gray uppercase">
                  DOCUMENTED
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-recess-black/70 p-2.5 rounded-[8px] border border-wire-gray/40">
                <div>
                  <div className="text-mute-gray text-[10px]">SPILL COVERAGE</div>
                  <div className="text-bone-white font-bold text-[14px]">
                    {areaDisplay}
                  </div>
                </div>
                <div>
                  <div className="text-mute-gray text-[10px]">INCIDENT DATE</div>
                  <div className="text-off-white font-medium text-[12px] truncate">
                    {replayTimeline?.date || 'Historical Archive'}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-[11px] font-mono bg-recess-black/50 p-2.5 rounded-[8px] border border-wire-gray/40">
                <div className="flex items-center gap-1.5 text-mute-gray">
                  <Anchor className="w-3.5 h-3.5 text-bone-white flex-shrink-0" />
                  <span>Primary Suspect Vessel:</span>
                </div>
                <div className="text-bone-white font-bold pl-5 text-[12px]">
                  {vesselName}
                </div>
                <div className="text-mute-gray pl-5 text-[10px]">
                  Status: Source Vessel &bull; Current Step: {currentStep?.step_label || 'Active'}
                </div>
              </div>

              <div className="text-[11px] text-off-white/80 leading-relaxed font-sans pt-1 flex items-start gap-1">
                <MapPin className="w-3.5 h-3.5 text-mute-gray flex-shrink-0 mt-0.5" />
                <span>{replayTimeline?.location || 'Maritime Incident Area'}</span>
              </div>
            </div>
          </Popup>
        </Polygon>

        {/* Pulse center marker */}
        <CircleMarker
          center={[centroidLat, centroidLon]}
          radius={7}
          pathOptions={{
            fillColor: '#fafafa',
            fillOpacity: 0.95,
            color: '#000000',
            weight: 2,
          }}
        />
      </>
    );
  }

  // ----------------------------------------------------------------------------
  // LIVE MODE SATELLITE SPILL LAYER
  // ----------------------------------------------------------------------------
  if (!detection || !detection.polygons) return null;

  const topVessel = activeVessels?.[0];

  return (
    <>
      {detection.polygons.coordinates.map((polyCoords, idx) => {
        const latLngs = polyCoords[0].map(([lon, lat]) => [lat, lon] as [number, number]);
        return (
          <Polygon
            key={`spill-poly-${idx}`}
            positions={latLngs}
            pathOptions={{
              fillColor: '#0a0a0c',
              fillOpacity: 0.82,
              color: '#fafafa',
              weight: 2.5,
              dashArray: '5 5',
            }}
          >
            {/* Tooltip on Hover */}
            <Tooltip
              sticky
              className="bg-console-charcoal text-bone-white border border-wire-gray rounded-[10px] p-2.5 shadow-xl font-sans"
            >
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-mute-gray uppercase tracking-wider flex items-center gap-1">
                  <Satellite className="w-3 h-3 text-bone-white" />
                  SENTINEL-1 SAR SATELLITE SPILL
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-mono font-bold text-bone-white">
                    {detection.area_km2.toFixed(2)} km²
                  </span>
                  <span className="text-[11px] font-mono text-mute-gray">
                    ({Math.round(detection.confidence * 100)}% confidence)
                  </span>
                </div>
                <div className="text-[10px] font-mono text-off-white pt-1 border-t border-wire-gray/40">
                  Click to inspect suspect vessel & actions &rarr;
                </div>
              </div>
            </Tooltip>

            {/* Click Popup with Suspect & Spill Information */}
            <Popup className="custom-popup" maxWidth={360}>
              <div className="p-3.5 bg-console-charcoal border border-wire-gray rounded-[12px] text-bone-white font-sans space-y-3 shadow-2xl">
                <div className="flex items-center justify-between border-b border-wire-gray/40 pb-2">
                  <div className="flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-bone-white" />
                    <span className="text-[13px] font-bold text-bone-white">
                      SAR Dark Slick Detected
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-recess-black border border-wire-gray text-bone-white font-bold">
                    {(detection.confidence * 100).toFixed(0)}% CONF
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-recess-black/70 p-2.5 rounded-[8px] border border-wire-gray/40">
                  <div>
                    <div className="text-mute-gray text-[10px]">SLICK AREA</div>
                    <div className="text-bone-white font-bold text-[15px]">
                      {detection.area_km2.toFixed(2)} km²
                    </div>
                  </div>
                  <div>
                    <div className="text-mute-gray text-[10px]">POLARIZATION</div>
                    <div className="text-off-white font-medium text-[12px]">
                      Sentinel-1A ({detection.polarization})
                    </div>
                  </div>
                </div>

                {topVessel && (
                  <div className="space-y-1.5 text-[11px] font-mono bg-recess-black/70 p-2.5 rounded-[8px] border border-wire-gray/40">
                    <div className="flex items-center justify-between text-mute-gray">
                      <span className="flex items-center gap-1.5">
                        <Anchor className="w-3.5 h-3.5 text-bone-white" />
                        Top Suspect Vessel:
                      </span>
                      <span className="text-bone-white font-bold">
                        {topVessel.attribution_score.toFixed(1)}% Score
                      </span>
                    </div>
                    <div className="text-bone-white font-bold pl-5 text-[13px]">
                      {topVessel.name}
                    </div>
                    <div className="text-mute-gray pl-5 text-[10px]">
                      MMSI: {topVessel.mmsi} &bull; Type: {topVessel.vessel_type}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-wire-gray/40 flex items-center gap-2">
                  <button
                    onClick={() => setIsEvidenceOpen(true)}
                    className="flex-1 py-1.5 px-2.5 rounded-[6px] bg-bone-white text-nav-ink font-mono font-bold text-[11px] hover:bg-off-white transition-colors flex items-center justify-center gap-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Evidence Dossier
                  </button>
                  <button
                    onClick={() => {
                      setSelectedAuditIncidentId(detection.incident_id || detection.id);
                      setIsAuditModalOpen(true);
                    }}
                    className="py-1.5 px-2.5 rounded-[6px] bg-recess-black border border-wire-gray hover:border-bone-white text-mute-gray hover:text-bone-white font-mono text-[11px] transition-colors flex items-center justify-center gap-1"
                  >
                    <ScrollText className="w-3.5 h-3.5" />
                    Audit Log
                  </button>
                </div>
              </div>
            </Popup>
          </Polygon>
        );
      })}

      {/* Centroid Point */}
      <CircleMarker
        center={[detection.centroid.lat, detection.centroid.lon]}
        radius={7}
        pathOptions={{
          fillColor: '#fafafa',
          fillOpacity: 0.95,
          color: '#000000',
          weight: 2,
        }}
      />
    </>
  );
};