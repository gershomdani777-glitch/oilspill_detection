import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { supabaseService } from '../../services/supabase';
import {
  ShieldCheck,
  X,
  AlertTriangle,
  FileText,
  CheckCircle2,
  Clock,
  Send,
  Building,
  Anchor,
  UserCheck,
  Lock,
} from 'lucide-react';

export const ApprovalModal: React.FC = () => {
  const { isApprovalModalOpen, setIsApprovalModalOpen, userRole, setPendingApprovalsCount } =
    useStore();

  const [pendingAlerts, setPendingAlerts] = useState<any[]>([]);
  const [pendingReports, setPendingReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/approvals/pending');
      if (res.ok) {
        const data = await res.json();
        setPendingAlerts(data.pending_alerts || []);
        setPendingReports(data.pending_reports || []);
        setPendingApprovalsCount(
          (data.pending_alerts?.length || 0) + (data.pending_reports?.length || 0)
        );
      }
    } catch (err) {
      console.warn('Error loading pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isApprovalModalOpen) {
      fetchApprovals();
    }
  }, [isApprovalModalOpen]);

  if (!isApprovalModalOpen) return null;

  const isApprover = userRole === 'approver';

  const handleApproveAlert = async (alertId: string) => {
    const success = await supabaseService.approveAlert(
      alertId,
      'Authorized Environmental Officer (Approver)'
    );
    if (success) {
      setActionSuccess(`Alert ${alertId.slice(0, 8)} approved and dispatched via NAVAREA.`);
      fetchApprovals();
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const handleSubmitReport = async (reportId: string) => {
    const success = await supabaseService.submitMarpolReport(
      reportId,
      'Chief Maritime Legal Inspector (Approver)'
    );
    if (success) {
      setActionSuccess(`MARPOL Report ${reportId.slice(0, 8)} signed and transmitted to IMO.`);
      fetchApprovals();
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-console-charcoal border border-wire-gray rounded-[16px] w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-wire-gray/60 flex items-center justify-between bg-recess-black/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[8px] bg-bone-white/10 border border-wire-gray text-bone-white">
              <ShieldCheck className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-bone-white tracking-tight">
                  Supabase Approver Authorization Center
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-recess-black border border-wire-gray text-mute-gray uppercase">
                  Role: {userRole}
                </span>
              </div>
              <p className="text-[12px] text-mute-gray font-mono">
                Review, sign, and dispatch operational alerts & IMO MARPOL dossiers
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsApprovalModalOpen(false)}
            className="p-1.5 rounded-[6px] text-mute-gray hover:text-bone-white hover:bg-wire-gray/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Notice Banner */}
        {!isApprover && (
          <div className="px-4 py-2.5 bg-recess-black border-b border-wire-gray/40 flex items-center gap-2 text-[12px] text-mute-gray font-mono">
            <Lock className="w-4 h-4 text-mute-gray flex-shrink-0" />
            <span>
              You are currently viewing as <strong className="text-off-white">{userRole}</strong>.
              Only <strong className="text-bone-white">approver</strong> role accounts can sign and
              dispatch records. Switch roles in the top bar to test actions.
            </span>
          </div>
        )}

        {/* Action Success Toast */}
        {actionSuccess && (
          <div className="mx-4 mt-3 p-3 rounded-[8px] bg-bone-white/10 border border-bone-white text-bone-white text-[12px] font-mono flex items-center gap-2 animate-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-bone-white flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-6 flex-1 text-[13px]">
          {/* Section 1: Pending Alerts */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono text-mute-gray tracking-wider uppercase flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-bone-white" />
                Pending Operational Alerts ({pendingAlerts.length})
              </span>
            </div>

            {pendingAlerts.length === 0 ? (
              <div className="p-4 rounded-[8px] bg-recess-black border border-wire-gray/40 text-center text-mute-gray text-[12px] font-mono">
                No alerts pending dispatch approval.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingAlerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className="p-4 rounded-[10px] bg-recess-black border border-wire-gray/70 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-[4px] bg-bone-white/10 text-bone-white font-mono text-[10px] uppercase font-bold border border-wire-gray">
                            {alert.priority} PRIORITY
                          </span>
                          <span className="text-[11px] font-mono text-mute-gray">
                            ID: {alert.alert_id.slice(0, 8)}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-semibold text-bone-white mt-1">
                          {alert.alert_title}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-mute-gray flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <p className="text-[12px] text-off-white/90 leading-relaxed font-sans">
                      {alert.alert_body}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-console-charcoal/60 p-2.5 rounded-[6px] border border-wire-gray/40">
                      <div className="flex items-center gap-1.5 text-mute-gray">
                        <Anchor className="w-3.5 h-3.5 text-bone-white" />
                        <span>Suspect: <strong className="text-bone-white">{alert.top_suspect_vessel}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-mute-gray">
                        <Building className="w-3.5 h-3.5 text-bone-white" />
                        <span>Agencies: <strong className="text-bone-white">Coast Guard, REMPEC</strong></span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end pt-1 gap-2">
                      <button
                        disabled={!isApprover}
                        onClick={() => handleApproveAlert(alert.alert_id)}
                        className={`px-3.5 py-1.5 rounded-[6px] text-[12px] font-mono font-bold flex items-center gap-1.5 transition-colors ${
                          isApprover
                            ? 'bg-bone-white text-nav-ink hover:bg-off-white cursor-pointer'
                            : 'bg-wire-gray/20 text-mute-gray cursor-not-allowed border border-wire-gray/40'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        Approve & Dispatch Alert (RLS)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Pending MARPOL Reports */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono text-mute-gray tracking-wider uppercase flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-bone-white" />
                Pending IMO MARPOL Annex I Dossiers ({pendingReports.length})
              </span>
            </div>

            {pendingReports.length === 0 ? (
              <div className="p-4 rounded-[8px] bg-recess-black border border-wire-gray/40 text-center text-mute-gray text-[12px] font-mono">
                No MARPOL investigation dossiers pending submission.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingReports.map((report) => (
                  <div
                    key={report.report_id}
                    className="p-4 rounded-[10px] bg-recess-black border border-wire-gray/70 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-[4px] bg-wire-gray/30 text-off-white font-mono text-[10px] border border-wire-gray">
                            IMO Annex I Dossier
                          </span>
                          <span className="text-[11px] font-mono text-mute-gray">
                            ID: {report.report_id.slice(0, 8)}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-semibold text-bone-white mt-1">
                          {report.report_content?.dossier_title || 'MARPOL Annex I Investigation'}
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono text-mute-gray flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {new Date(report.generated_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-[6px] bg-console-charcoal/60 border border-wire-gray/40 text-[11px] font-mono text-mute-gray">
                      <div>Sensor: {report.report_content?.satellite_telemetry?.sensor || 'Sentinel-1 C-SAR'}</div>
                      <div>Product Ref: {report.report_content?.satellite_telemetry?.product_id || 'SAR_OVERPASS_TELEMETRY'}</div>
                      <div className="mt-1 text-off-white">Recommendation: {report.report_content?.enforcement_recommendation || 'Initiate Flag State inspection'}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end pt-1 gap-2">
                      <button
                        disabled={!isApprover}
                        onClick={() => handleSubmitReport(report.report_id)}
                        className={`px-3.5 py-1.5 rounded-[6px] text-[12px] font-mono font-bold flex items-center gap-1.5 transition-colors ${
                          isApprover
                            ? 'bg-bone-white text-nav-ink hover:bg-off-white cursor-pointer'
                            : 'bg-wire-gray/20 text-mute-gray cursor-not-allowed border border-wire-gray/40'
                        }`}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Sign & Transmit to IMO (RLS)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-recess-black/90 border-t border-wire-gray/60 flex items-center justify-between text-[11px] font-mono text-mute-gray">
          <span>Row Level Security: Enforced via Supabase RLS Policies</span>
          <button
            onClick={fetchApprovals}
            className="text-off-white hover:text-bone-white underline"
          >
            Refresh Pending List
          </button>
        </div>
      </div>
    </div>
  );
};
