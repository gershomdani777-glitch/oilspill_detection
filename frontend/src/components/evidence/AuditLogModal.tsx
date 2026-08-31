import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { supabaseService } from '../../services/supabase';
import { SupabaseAuditLog } from '../../types';
import { ScrollText, X, Cpu, Clock, ChevronDown, ChevronRight, CheckCircle2 } from 'lucide-react';

export const AuditLogModal: React.FC = () => {
  const {
    isAuditModalOpen,
    setIsAuditModalOpen,
    selectedAuditIncidentId,
    activeDetection,
  } = useStore();

  const [logs, setLogs] = useState<SupabaseAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const incidentId = selectedAuditIncidentId || activeDetection?.id || activeDetection?.incident_id;

  useEffect(() => {
    if (isAuditModalOpen && incidentId) {
      setLoading(true);
      // Fetch via Supabase or backend fallback
      (async () => {
        try {
          const directLogs = await supabaseService.getAuditLogs(incidentId);
          if (directLogs && directLogs.length > 0) {
            setLogs(directLogs);
          } else {
            const res = await fetch(`/api/v1/incidents/${incidentId}/audit`);
            if (res.ok) {
              const data = await res.json();
              setLogs(data || []);
            }
          }
        } catch (err) {
          console.warn('Error loading audit trail:', err);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isAuditModalOpen, incidentId]);

  if (!isAuditModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-console-charcoal border border-wire-gray rounded-[16px] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-wire-gray/60 flex items-center justify-between bg-recess-black/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-[8px] bg-bone-white/10 border border-wire-gray text-bone-white">
              <ScrollText className="w-5 h-5 stroke-[1.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold text-bone-white tracking-tight">
                  Supabase LLM Audit Trail & Prompt Provenance
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] bg-recess-black border border-wire-gray text-mute-gray">
                  Incident: {incidentId?.slice(0, 10) || 'Active'}
                </span>
              </div>
              <p className="text-[12px] text-mute-gray font-mono">
                Immutable audit log for Prompts 01 - 05 execution & validation payloads
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAuditModalOpen(false)}
            className="p-1.5 rounded-[6px] text-mute-gray hover:text-bone-white hover:bg-wire-gray/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 text-[13px]">
          {loading ? (
            <div className="py-12 text-center text-mute-gray font-mono text-[12px]">
              Loading prompt execution records from Supabase...
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-mute-gray font-mono text-[12px]">
              No audit logs recorded yet for this incident. Run a scan to generate Prompt 01–05 logs.
            </div>
          ) : (
            logs.map((log) => {
              const isExpanded = expandedLogId === log.log_id;
              return (
                <div
                  key={log.log_id}
                  className="rounded-[10px] bg-recess-black border border-wire-gray/70 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedLogId(isExpanded ? null : log.log_id)}
                    className="w-full p-3.5 flex items-center justify-between hover:bg-console-charcoal/40 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-bone-white flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-mute-gray flex-shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-[4px] bg-bone-white/10 text-bone-white border border-wire-gray uppercase">
                            {log.step}
                          </span>
                          <span className="text-[13px] font-semibold text-bone-white">
                            {log.prompt_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-mute-gray mt-0.5">
                          <span className="flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-off-white" />
                            {log.model_used}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(log.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono text-mute-gray bg-console-charcoal px-2 py-1 rounded-[4px] border border-wire-gray/40">
                      {isExpanded ? 'Collapse' : 'Inspect JSON'}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="p-3.5 border-t border-wire-gray/50 bg-console-charcoal/50 space-y-3 font-mono text-[11px]">
                      <div>
                        <div className="text-mute-gray mb-1 text-[10px] uppercase font-bold tracking-wider">
                          Raw Prompt Input:
                        </div>
                        <pre className="p-2.5 rounded-[6px] bg-recess-black border border-wire-gray/60 text-off-white overflow-x-auto max-h-48">
                          {JSON.stringify(log.raw_prompt_input, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="text-mute-gray mb-1 text-[10px] uppercase font-bold tracking-wider">
                          Validated API Response / Database Row:
                        </div>
                        <pre className="p-2.5 rounded-[6px] bg-recess-black border border-wire-gray/60 text-bone-white overflow-x-auto max-h-56">
                          {JSON.stringify(log.raw_api_response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-recess-black/90 border-t border-wire-gray/60 flex items-center justify-between text-[11px] font-mono text-mute-gray">
          <span>Schema: `public.audit_log` (UUID keys, immutable append-only)</span>
          <span className="text-bone-white flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-bone-white" /> Schema Validated
          </span>
        </div>
      </div>
    </div>
  );
};
