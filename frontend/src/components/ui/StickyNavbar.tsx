import React, { useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Radar, Clock, RotateCcw, FileText, ShieldCheck, ScrollText, User } from 'lucide-react';
import { GhostOutlineButton } from './GhostOutlineButton';
import { PrimaryPillCTA } from './PrimaryPillCTA';
import { api } from '../../services/api';
import { UserRole } from '../../types';

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
  } = useStore();

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
    <header className="sticky top-0 z-50 w-full h-[56px] bg-nav-ink border-b border-console-charcoal px-6 flex items-center justify-between select-none">
      {/* Brand & Status */}
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-[4px] bg-recess-black border border-wire-gray flex items-center justify-center">
          <Radar className="w-4 h-4 text-bone-white stroke-[1.5] animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-bone-white tracking-tight">
              SAR MARITIME RADAR
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 text-mute-gray border border-wire-gray rounded-[3px]">
              SUPABASE RLS ENABLED
            </span>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center bg-recess-black p-1 rounded-[9999px] border border-wire-gray/60">
        <button
          onClick={() => setCurrentMode('live')}
          className={`flex items-center gap-2 px-4 py-1 text-[13px] font-medium rounded-[9999px] transition-all ${
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
          className={`flex items-center gap-2 px-4 py-1 text-[13px] font-medium rounded-[9999px] transition-all ${
            currentMode === 'historical'
              ? 'bg-bone-white text-nav-ink shadow-pill font-bold'
              : 'text-mute-gray hover:text-off-white'
          }`}
        >
          <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
          <span>Historical Archive</span>
        </button>
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
          className="relative px-3 py-1.5 rounded-[6px] bg-console-charcoal border border-wire-gray/80 hover:border-bone-white text-bone-white text-[12px] font-mono flex items-center gap-1.5 transition-colors"
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

        {/* Audit Trail Button */}
        <button
          onClick={handleOpenAudit}
          className="px-3 py-1.5 rounded-[6px] bg-console-charcoal border border-wire-gray/80 hover:border-bone-white text-mute-gray hover:text-bone-white text-[12px] font-mono flex items-center gap-1.5 transition-colors"
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
  );
};