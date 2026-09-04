import React from 'react';
import { useStore } from '../../store/useStore';
import { Detection } from '../../types';
import { ChevronRight, Clock, AlertTriangle, TrendingUp, Crosshair, MapPin, CheckCircle2 } from 'lucide-react';

const getSeverityTag = (confidence: number, areaKm2: number): { label: string; bgColor: string; textColor: string } => {
  if (confidence >= 85 && areaKm2 >= 2) return { label: 'CRITICAL', bgColor: 'bg-red-950/60', textColor: 'text-red-300' };
  if (confidence >= 75 && areaKm2 >= 1.5) return { label: 'HIGH', bgColor: 'bg-amber-950/60', textColor: 'text-amber-300' };
  if (confidence >= 60) return { label: 'MEDIUM', bgColor: 'bg-yellow-950/60', textColor: 'text-yellow-300' };
  return { label: 'LOW', bgColor: 'bg-slate-950/60', textColor: 'text-slate-300' };
};

const getRelativeTime = (isoString: string): string => {
  const now = new Date();
  const detTime = new Date(isoString);
  const diffMs = now.getTime() - detTime.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return detTime.toLocaleDateString();
};

const dmsFromDecimal = (value: number, isLat: boolean): string => {
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(1);
  const hemi = isLat ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  return `${deg}° ${min}' ${sec}" ${hemi}`;
};

interface DetectionFeedSidebarProps {
  isOpen?: boolean;
}

export const DetectionFeedSidebar: React.FC<DetectionFeedSidebarProps> = ({ isOpen = true }) => {
  const {
    currentMode,
    detectionFeed,
    selectedCoastalRegionId,
    coastalRegions,
    activeDetection,
    setActiveDetection,
  } = useStore();

  if (currentMode !== 'live' || !isOpen || detectionFeed.length === 0) {
    return null;
  }

  const selectedRegion = coastalRegions.find((r) => r.id === selectedCoastalRegionId);
  const regionName = selectedRegion?.name || 'Unknown Region';

  const handleDetectionClick = (detection: Detection) => {
    setActiveDetection(detection);
  };

  return (
    <div className="absolute top-6 right-6 z-[350] w-[340px] bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[12px] shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex-shrink-0 p-3.5 border-b border-wire-gray/40">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-bone-white">
            All Spills in <span className="text-sky-300">{regionName}</span>
          </h3>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-[3px] bg-recess-black text-bone-white border border-wire-gray font-bold">
            {detectionFeed.length}
          </span>
        </div>
        <p className="text-[11px] text-mute-gray flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Newest first &bull; Click any to fly-to &amp; open details
        </p>
      </div>

      {/* Detections List */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-wire-gray/20">
          {detectionFeed.map((detection, index) => {
            const severity = getSeverityTag(detection.confidence, detection.area_km2);
            const relTime = getRelativeTime(detection.acquisition_timestamp);
            const isActive = activeDetection?.id === detection.id;
            const dms = `${dmsFromDecimal(detection.centroid.lat, true)} ${dmsFromDecimal(detection.centroid.lon, false)}`;

            return (
              <button
                key={detection.id}
                onClick={() => handleDetectionClick(detection)}
                className={`w-full text-left px-3 py-2.5 transition-colors text-bone-white focus:outline-none border-l-2 ${
                  isActive
                    ? 'bg-sky-500/15 border-sky-400'
                    : 'hover:bg-sky-500/10 border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-mono font-bold text-bone-white truncate">
                        Spill #{index + 1}
                      </span>
                      <span className="text-[10px] font-mono text-mute-gray truncate">
                        · {detection.id?.slice(-8) || 'det'}
                      </span>
                      {isActive && (
                        <CheckCircle2 className="w-3 h-3 text-sky-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[3px] flex-shrink-0 ${severity.bgColor} ${severity.textColor} font-bold`}
                  >
                    {severity.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-[11px] mb-1.5">
                  <div className="flex items-center gap-1 text-mute-gray">
                    <TrendingUp className="w-3 h-3" />
                    <span>{detection.area_km2?.toFixed(2)} km²</span>
                  </div>
                  <div className="flex items-center gap-1 text-mute-gray">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{Math.round(detection.confidence)}%</span>
                  </div>
                </div>

                {/* Location (always visible) */}
                <div className="text-[10px] font-mono text-off-white bg-recess-black/70 border border-wire-gray/40 rounded-[4px] px-2 py-1 mb-1.5 flex items-start gap-1">
                  <Crosshair className="w-3 h-3 text-mute-gray flex-shrink-0 mt-0.5" />
                  <span className="break-all">{dms}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-mute-gray">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {relTime}
                  </div>
                  <ChevronRight className={`w-3 h-3 ${isActive ? 'text-sky-400' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Note */}
      <div className="flex-shrink-0 p-2.5 border-t border-wire-gray/40 bg-recess-black/40">
        <p className="text-[10px] text-mute-gray text-center font-mono">
          Continuous scanning &middot; Active polygon on map = selected
        </p>
      </div>
    </div>
  );
};