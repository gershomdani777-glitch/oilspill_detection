import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  SupabaseIncident,
  SupabaseVesselAttribution,
  SupabaseAlert,
  SupabaseMarpolReport,
  SupabaseAuditLog,
} from '../types';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://qgvxjnlwtvgsdjixglvv.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseAnonKey.includes('your_')
);

// Instantiate Supabase client (fallback to dummy key if not yet configured)
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// ------------------------------------------------------------------------------
// SUPABASE DATA ACCESS & MUTATION SERVICE
// ------------------------------------------------------------------------------
export const supabaseService = {
  // Fetch incidents directly from Supabase
  async getIncidents(): Promise<SupabaseIncident[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('detection_timestamp_utc', { ascending: false });

      if (error) {
        console.warn('Supabase getIncidents error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
      return [];
    }
  },

  // Fetch vessel attributions for an incident
  async getVesselAttributions(incidentId: string): Promise<SupabaseVesselAttribution[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('vessel_attributions')
        .select('*')
        .eq('incident_id', incidentId)
        .order('rank', { ascending: true });

      if (error) {
        console.warn('Supabase getVesselAttributions error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
      return [];
    }
  },

  // Fetch alerts
  async getAlerts(incidentId?: string): Promise<SupabaseAlert[]> {
    if (!isSupabaseConfigured) return [];
    try {
      let query = supabase.from('alerts').select('*').order('created_at', { ascending: false });
      if (incidentId) {
        query = query.eq('incident_id', incidentId);
      }
      const { data, error } = await query;
      if (error) {
        console.warn('Supabase getAlerts error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
      return [];
    }
  },

  // Fetch audit trail
  async getAuditLogs(incidentId: string): Promise<SupabaseAuditLog[]> {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('incident_id', incidentId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.warn('Supabase getAuditLogs error:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
      return [];
    }
  },

  // Approve alert (Approver role)
  async approveAlert(alertId: string, approverName: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('alerts')
          .update({
            dispatched: true,
            approved_by: approverName,
            approved_at: new Date().toISOString(),
          })
          .eq('alert_id', alertId);

        if (!error) return true;
      }

      // Backend fallback endpoint
      const res = await fetch(`/api/v1/alerts/${alertId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: approverName }),
      });
      return res.ok;
    } catch (err) {
      console.error('Approve alert failed:', err);
      return false;
    }
  },

  // Submit MARPOL report (Approver role)
  async submitMarpolReport(reportId: string, submitterName: string): Promise<boolean> {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('marpol_reports')
          .update({
            submitted: true,
            submitted_by: submitterName,
            submitted_at: new Date().toISOString(),
          })
          .eq('report_id', reportId);

        if (!error) return true;
      }

      // Backend fallback endpoint
      const res = await fetch(`/api/v1/reports/${reportId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_name: submitterName }),
      });
      return res.ok;
    } catch (err) {
      console.error('Submit report failed:', err);
      return false;
    }
  },

  // Real-time subscription to new incident detections
  subscribeToIncidents(onNewIncident: (incident: SupabaseIncident) => void) {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase
      .channel('realtime_incidents')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          onNewIncident(payload.new as SupabaseIncident);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  // Real-time subscription to alerts (approvals & dispatch)
  subscribeToAlerts(onAlertUpdate: (alert: SupabaseAlert) => void) {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase
      .channel('realtime_alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          onAlertUpdate(payload.new as SupabaseAlert);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
