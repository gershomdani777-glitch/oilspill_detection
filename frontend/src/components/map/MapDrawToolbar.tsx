import React from 'react';
import { useStore } from '../../store/useStore';
import { Crosshair, AlertCircle, MousePointerClick, Square, RotateCcw } from 'lucide-react';
import { api } from '../../services/api';

const PRESET_REGIONS = [
  {
    name: 'Mauritius Coast (Wakashio Zone)',
    coords: [
      [57.65, -20.55],
      [57.85, -20.55],
      [57.85, -20.35],
      [57.65, -20.35],
      [57.65, -20.55],
    ],
  },
  {
    name: 'Strait of Malacca (Heavy Traffic)',
    coords: [
      [101.8, 2.3],
      [102.2, 2.3],
      [102.2, 2.6],
      [101.8, 2.6],
      [101.8, 2.3],
    ],
  },
  {
    name: 'Gulf of Mexico (Drilling Basin)',
    coords: [
      [-88.5, 28.6],
      [-88.1, 28.6],
      [-88.1, 28.9],
      [-88.5, 28.9],
      [-88.5, 28.6],
    ],
  },
  {
    name: 'Persian Gulf / Hormuz Corridor',
    coords: [
      [56.1, 26.2],
      [56.6, 26.2],
      [56.6, 26.6],
      [56.1, 26.6],
      [56.1, 26.2],
    ],
  },
];

interface MapDrawToolbarProps {
  isDrawingMode: boolean;
  setIsDrawingMode: (val: boolean) => void;
}

export const MapDrawToolbar: React.FC<MapDrawToolbarProps> = ({
  isDrawingMode,
  setIsDrawingMode,
}) => {
  const {
    selectedRegion,
    setSelectedRegion,
    regionError,
    setRegionError,
    pipelineStage,
    currentMode,
    activeDetection,
    setActiveDetection,
    setActiveVesselsData,
    setCleanSceneResult,
    resetLiveScan,
  } = useStore();

  if (currentMode !== 'live') return null;

  const handleSelectPreset = async (preset: (typeof PRESET_REGIONS)[0]) => {
    try {
      setActiveDetection(null);
      setCleanSceneResult(null);
      setActiveVesselsData([], null as any);

      const geometry = {
        type: 'Polygon',
        coordinates: [preset.coords],
      };
      const res = await api.selectRegion(geometry);
      setSelectedRegion({
        region_id: res.region_id,
        geometry,
        bbox: res.bbox,
        area_sq_km: res.area_sq_km,
      });
      setRegionError(null);
      setIsDrawingMode(false);
    } catch (err: any) {
      setRegionError(err.message || 'Invalid region geometry.');
    }
  };

  const isScanning = Boolean(pipelineStage && pipelineStage !== 'complete' && pipelineStage !== 'failed');

  return (
    <div className="absolute top-6 left-6 z-[400] flex flex-col gap-2 max-w-[360px]">
      <div className="bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[12px] p-3.5 shadow-none flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-bone-white stroke-[1.5]" />
            <span className="text-[13px] font-semibold text-bone-white tracking-tight">
              SAR Region Selection
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-recess-black text-mute-gray border border-wire-gray">
            FR-01
          </span>
        </div>

        {/* Primary Interactive Map Drawing Button */}
        {!activeDetection && (
          <button
            disabled={isScanning}
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`w-full py-2 px-3 rounded-[6px] border flex items-center justify-center gap-2 text-[12px] font-mono font-medium transition-all ${
              isDrawingMode
                ? 'bg-bone-white text-nav-ink border-bone-white animate-pulse'
                : 'bg-recess-black text-bone-white border-wire-gray hover:border-bone-white'
            }`}
          >
            {isDrawingMode ? (
              <>
                <MousePointerClick className="w-3.5 h-3.5 stroke-[2]" />
                <span>CLICK & DRAG BOX ON MAP</span>
              </>
            ) : (
              <>
                <Square className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>DRAW CUSTOM AREA ON MAP</span>
              </>
            )}
          </button>
        )}

        {isDrawingMode && (
          <div className="p-2 rounded-[4px] bg-recess-black border border-dashed border-wire-gray text-[11px] font-mono text-mute-gray text-center">
            Click & drag your cursor across any ocean area to set the SAR radar bounding box.
          </div>
        )}

        {/* Preset Hotspots */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-wire-gray/40">
          <span className="text-[11px] font-mono text-mute-gray">OR PICK A MARITIME HOTSPOT:</span>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_REGIONS.map((preset) => (
              <button
                key={preset.name}
                disabled={isScanning}
                onClick={() => handleSelectPreset(preset)}
                className="text-left px-2.5 py-1.5 text-[11px] font-sans rounded-[4px] bg-recess-black border border-wire-gray/60 hover:border-bone-white text-off-white hover:text-bone-white transition-colors truncate"
              >
                {preset.name.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Region Readout */}
        {selectedRegion && (
          <div className="pt-2 border-t border-wire-gray/40 flex items-center justify-between text-[11px] font-mono">
            <div className="flex flex-col">
              <span className="text-mute-gray">Selected Area:</span>
              <span className="text-bone-white font-bold">{selectedRegion.area_sq_km?.toFixed(1)} km²</span>
            </div>
            {!activeDetection && (
              <button
                onClick={resetLiveScan}
                className="text-ash hover:text-off-white flex items-center gap-1 text-[10px]"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Validation Error Banner */}
      {regionError && (
        <div className="bg-recess-black/95 border border-wire-gray rounded-[8px] p-3 text-[12px] text-off-white flex items-start gap-2 backdrop-blur-md">
          <AlertCircle className="w-4 h-4 text-mute-gray flex-shrink-0 mt-0.5 stroke-[1.5]" />
          <span>{regionError}</span>
        </div>
      )}
    </div>
  );
};