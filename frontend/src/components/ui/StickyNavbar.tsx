import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { Radar, Clock, RotateCcw, FileText, ShieldCheck, ScrollText, User, AlertTriangle, X, MapPin, Crosshair, ChevronRight, TrendingUp } from 'lucide-react';
import { GhostOutlineButton } from './GhostOutlineButton';
import { PrimaryPillCTA } from './PrimaryPillCTA';
import { api } from '../../services/api';
import { UserRole, Detection } from '../../types';
import { DarkCardSurface } from './DarkCardSurface';

const getSeverityTag = (confidence: number, areaKm2: number) => {
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

export const StickyNavbar: React.FC = () => {
  const {
    currentMode,
    setCurrentMode,
    activeDetection,
    selectedHistoricalIncidentId,
    resetLiveScan,
    userRole,
    setUserRole,
    setIsApprovalModalOpen,
    setIsAuditModalOpen,
    setSelectedAuditIncidentId,
    pendingApprovalsCount,
    setPendingApprovalsCount,
    detectionFeed,
    selectedCoastalRegionId,
    coastalRegions,
    setActiveDetection,
  } = useStore();

  const [isSpillListOpen, setIsSpillListOpen] = useState(false);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch('/api/v1/approvals/pending');
        if (res.ok) {
          const data = await res.json();
          setPendingApprovalsCount(data.total_pending || 0);
        }
      } catch (e) {
        // silent fallback
      }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 10000);
    return () => clearInterval(interval);
  }, [setPendingApprovalsCount]);

  const handleExportPdf = () => {
    const targetId =
      currentMode === 'live'
        ? activeDetection?.id
        : selectedHistoricalIncidentId;
    if (!targetId) return;
    window.open(api.getReportPdfUrl(targetId), '_blank');
  };

  const handleOpenAudit = () => {
    const targetId =
      currentMode === 'live'
        ? activeDetection?.incident_id || activeDetection?.id
        : selectedHistoricalIncidentId;
    if (targetId) setSelectedAuditIncidentId(targetId);
    setIsAuditModalOpen(true);
  };

  return (
    <>
    <header className="sticky top-0 z-50 w-full h-[56px] bg-nav-ink border-b border-console-charcoal px-6 flex items-center justify-between select-none">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-[4px] bg-recess-black border border-wire-gray flex items-center justify-center">
          <Radar className="w-4 h-4 text-sky-400 stroke-[1.5] animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-bone-white tracking-tight">
              SENTINEL-1 MARITIME RADAR
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 rounded-[3px]">
              v2.0 NRT MONITORING
            </span>
          </div>
        </div>
      </div>

      {/* Mode & Surface Switchers */}
      <div className="flex items-center gap-3">
        {/* Live vs Historical Mode */}
        <div className="flex items-center bg-recess-black p-1 rounded-[9999px] border border-wire-gray/60">
          <button
            onClick={() => setCurrentMode('live')}
            className={`flex items-center gap-2 px-3.5 py-1 text-[12px] font-medium rounded-[9999px] transition-all cursor-pointer ${
              currentMode === 'live'
                ? 'bg-bone-white text-nav-ink shadow-pill font-bold'
                : 'text-mute-gray hover:text-off-white'
            }`}
          >
            <Radar className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Live Monitoring</span>
          </button>
          <button
            onClick={() => setCurrentMode('historical')}
            className={`flex items-center gap-2 px-3.5 py-1 text-[12px] font-medium rounded-[9999px] transition-all cursor-pointer ${
              currentMode === 'historical'
                ? 'bg-bone-white text-nav-ink shadow-pill font-bold'
                : 'text-mute-gray hover:text-off-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Historical Archive</span>
          </button>
        </div>

      </div>

      {/* Role Switcher & Approvals & Export */}
      <div className="flex items-center gap-2.5">
        {/* Role Selector */}
        <div className="flex items-center bg-recess-black border border-wire-gray/60 rounded-[6px] px-2 py-1 gap-1.5 text-[11px] font-mono">
          <User className="w-3 h-3 text-mute-gray" />
          <span className="text-mute-gray">Role:</span>
          <select
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
            className="bg-transparent text-bone-white font-bold cursor-pointer focus:outline-none text-[11px]"
          >
            <option value="approver" className="bg-console-charcoal text-bone-white">
              Approver (Sign/Dispatch)
            </option>
            <option value="analyst" className="bg-console-charcoal text-bone-white">
              Analyst (Scan/Review)
            </option>
            <option value="viewer" className="bg-console-charcoal text-bone-white">
              Viewer (Read-only)
            </option>
          </select>
        </div>

        {/* Approvals Action Button */}
        <button
          onClick={() => setIsApprovalModalOpen(true)}
          className="relative px-3 py-1.5 rounded-[6px] bg-console-charcoal border border-wire-gray/80 hover:border-bone-white text-bone-white text-[12px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Open Supabase Approver Dispatch Center"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-bone-white" />
          <span>Approvals</span>
          {pendingApprovalsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-bone-white text-nav-ink text-[10px] font-bold">
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        {/* Spill Details Button — opens modal listing all spills in current region */}
        {currentMode === 'live' && (
          <button
            onClick={() => setIsSpillListOpen(true)}
            className="relative px-3 py-1.5 rounded-[6px] bg-bone-white text-nav-ink hover:bg-off-white text-[12px] font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="View all oil spills detected in the current coastal region"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Spill Details</span>
            {detectionFeed.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold">
                {detectionFeed.length}
              </span>
            )}
          </button>
        )}

        {/* Audit Trail Button */}
        <button
          onClick={handleOpenAudit}
          className="px-3 py-1.5 rounded-[6px] bg-console-charcoal border border-wire-gray/80 hover:border-bone-white text-mute-gray hover:text-bone-white text-[12px] font-mono flex items-center gap-1.5 transition-colors cursor-pointer"
          title="View LLM Prompt 01-05 Audit Logs"
        >
          <ScrollText className="w-3.5 h-3.5" />
          <span>Audit Log</span>
        </button>

        {currentMode === 'live' && activeDetection && (
          <GhostOutlineButton
            icon={<RotateCcw className="w-3.5 h-3.5 stroke-[1.5]" />}
            onClick={resetLiveScan}
          >
            Reset
          </GhostOutlineButton>
        )}

        {(activeDetection || currentMode === 'historical') && (
          <PrimaryPillCTA
            icon={<FileText className="w-3.5 h-3.5 text-true-black stroke-[1.5]" />}
            onClick={handleExportPdf}
          >
            Export Dossier
          </PrimaryPillCTA>
        )}
      </div>
    </header>

    {/* ---------------- Spill Details Modal ---------------- */}
    {isSpillListOpen && currentMode === 'live' && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 font-sans">
        <DarkCardSurface
          padding="p-0"
          className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden bg-console-charcoal border border-wire-gray"
        >
          {/* Header */}
          <div className="p-4 border-b border-wire-gray/60 flex items-center justify-between bg-recess-black/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-[8px] bg-bone-white/10 border border-wire-gray text-bone-white">
                <AlertTriangle className="w-5 h-5 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-[15px] font-semibold text-bone-white tracking-tight">
                  Spill Details — {coastalRegions.find((r) => r.id === selectedCoastalRegionId)?.name || 'Current Region'}
                </h2>
                <p className="text-[12px] text-mute-gray font-mono">
                  {detectionFeed.length} spill{detectionFeed.length === 1 ? '' : 's'} detected &middot; Click any row to fly-to on the map and open its dossier
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSpillListOpen(false)}
              className="p-1.5 rounded-[6px] text-mute-gray hover:text-bone-white hover:bg-wire-gray/20 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto flex-1">
            {detectionFeed.length === 0 ? (
              <div className="p-8 text-center rounded-[8px] bg-recess-black border border-dashed border-wire-gray/40 text-mute-gray">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-mute-gray" />
                <p className="text-[13px] font-medium text-off-white">No oil spills detected in this region yet</p>
                <p className="text-[11px] mt-1 font-mono">Start a scan and wait for the next 8-second cycle</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {detectionFeed.map((det: Detection, idx: number) => {
                  const severity = getSeverityTag(det.confidence, det.area_km2);
                  const relTime = getRelativeTime(det.acquisition_timestamp);
                  const dms = `${dmsFromDecimal(det.centroid.lat, true)} ${dmsFromDecimal(det.centroid.lon, false)}`;
                  const isActive = activeDetection?.id === det.id;
                  return (
                    <button
                      key={det.id}
                      onClick={() => {
                        setActiveDetection(det);
                        setIsSpillListOpen(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-[10px] border transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-500/15 border-sky-400'
                          : 'bg-recess-black border-wire-gray hover:border-bone-white hover:bg-recess-black/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-[13px] font-mono font-bold text-bone-white">
                            Spill #{idx + 1}
                          </span>
                          <span className="text-[10px] font-mono text-mute-gray truncate">
                            ID: {det.id?.slice(-10) || 'det'}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded-[3px] flex-shrink-0 ${severity.bgColor} ${severity.textColor} font-bold`}
                        >
                          {severity.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px] font-mono mb-2">
                        <div className="bg-console-charcoal/60 border border-wire-gray/40 rounded-[4px] p-2">
                          <div className="text-mute-gray text-[9px] uppercase">Area</div>
                          <div className="text-bone-white font-bold">{det.area_km2?.toFixed(2)} km²</div>
                        </div>
                        <div className="bg-console-charcoal/60 border border-wire-gray/40 rounded-[4px] p-2">
                          <div className="text-mute-gray text-[9px] uppercase">Confidence</div>
                          <div className="text-bone-white font-bold">{Math.round(det.confidence * 100)}%</div>
                        </div>
                        <div className="bg-console-charcoal/60 border border-wire-gray/40 rounded-[4px] p-2">
                          <div className="text-mute-gray text-[9px] uppercase">Polarization</div>
                          <div className="text-bone-white font-bold">{det.polarization}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono text-off-white">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <Crosshair className="w-3 h-3 text-mute-gray flex-shrink-0" />
                          <span className="truncate">{dms}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className="text-mute-gray">{relTime}</span>
                          <ChevronRight className="w-3 h-3 text-sky-400" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 bg-recess-black/90 border-t border-wire-gray/60 flex items-center justify-between text-[11px] font-mono text-mute-gray">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              Sorted newest first
            </span>
            <button
              onClick={() => setIsSpillListOpen(false)}
              className="text-off-white hover:text-bone-white underline"
            >
              Close
            </button>
          </div>
        </DarkCardSurface>
      </div>
    )}
    </>
  );
};