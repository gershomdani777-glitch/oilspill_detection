-- ==============================================================================
-- MARITIME OIL SPILL DETECTION & ATTRIBUTION PLATFORM
-- Supabase Schema & Row-Level Security Migration
-- Version: 20260830000000_maritime_oil_spill_schema.sql
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. USER PROFILES & ROLES
-- Roles: 'analyst', 'approver', 'viewer'
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('analyst', 'approver', 'viewer')) DEFAULT 'analyst',
    organization TEXT DEFAULT 'Maritime Safety & Environmental Authority',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Helper function to fetch current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'viewer'
  );
$$;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'analyst')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 2. INCIDENTS TABLE
-- One row per SAR satellite detection event
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_timestamp_utc TIMESTAMPTZ NOT NULL,
    detection_confidence DOUBLE PRECISION NOT NULL CHECK (detection_confidence >= 0.0 AND detection_confidence <= 1.0),
    spill_classification TEXT NOT NULL, -- e.g. 'mineral_oil_slick', 'heavy_crude', 'bilge_discharge'
    spill_area_km2 DOUBLE PRECISION NOT NULL CHECK (spill_area_km2 >= 0.0),
    centroid_lat DOUBLE PRECISION NOT NULL,
    centroid_lon DOUBLE PRECISION NOT NULL,
    bounding_box JSONB, -- [min_lon, min_lat, max_lon, max_lat]
    geometry JSONB, -- GeoJSON MultiPolygon of the spill slick
    product_id TEXT, -- Sentinel-1 product ID or satellite catalog reference
    polarization TEXT DEFAULT 'VV/VH',
    estimated_thickness_band TEXT, -- e.g. 'Metallic sheen (0.005 - 0.05 μm)', 'True color (> 100 μm)'
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    look_alike_risk_factors JSONB DEFAULT '[]'::jsonb, -- e.g. ["low_wind_shadow", "algal_bloom_ruled_out"]
    recommended_action TEXT,
    analyst_notes TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'under_review', 'confirmed', 'dismissed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON public.incidents (detection_timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents (severity);

-- ------------------------------------------------------------------------------
-- 3. VESSEL ATTRIBUTIONS TABLE
-- Explaining suspect vessels identified near the spill at time T0
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vessel_attributions (
    attribution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(incident_id) ON DELETE CASCADE,
    rank INT NOT NULL,
    mmsi TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    flag_state TEXT,
    vessel_type TEXT,
    attribution_score DOUBLE PRECISION NOT NULL CHECK (attribution_score >= 0.0 AND attribution_score <= 100.0),
    distance_at_t0_km DOUBLE PRECISION,
    ais_gap_detected BOOLEAN NOT NULL DEFAULT false,
    ais_gap_duration_minutes INT DEFAULT 0,
    trajectory_alignment DOUBLE PRECISION, -- 0.0 to 1.0 or angle alignment
    score_breakdown JSONB DEFAULT '{}'::jsonb, -- proximity, ais_gap, vessel_type, trajectory, cargo, history
    key_evidence JSONB DEFAULT '[]'::jsonb, -- list of structured bullet points
    suspicion_level TEXT CHECK (suspicion_level IN ('high', 'medium', 'low', 'unlikely')),
    position_history JSONB DEFAULT '[]'::jsonb, -- timestamped track points
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_vessel_attributions_incident_id ON public.vessel_attributions (incident_id);
CREATE INDEX IF NOT EXISTS idx_vessel_attributions_score ON public.vessel_attributions (attribution_score DESC);
CREATE INDEX IF NOT EXISTS idx_vessel_attributions_mmsi ON public.vessel_attributions (mmsi);

-- ------------------------------------------------------------------------------
-- 4. ALERTS TABLE
-- Operational Marine Hazard Alerts with Approver Dispatch Flow
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(incident_id) ON DELETE CASCADE,
    alert_title TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    alert_body TEXT NOT NULL,
    coordinates_dms TEXT, -- e.g. 20°26'24"S, 57°44'24"E
    affected_area_km2 DOUBLE PRECISION,
    top_suspect_vessel TEXT,
    recommended_immediate_actions JSONB DEFAULT '[]'::jsonb,
    notify_agencies JSONB DEFAULT '[]'::jsonb,
    alert_expiry_utc TIMESTAMPTZ,
    approved_by TEXT,
    approved_at TIMESTAMPTZ,
    dispatched BOOLEAN NOT NULL DEFAULT false,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_alerts_incident_id ON public.alerts (incident_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dispatched ON public.alerts (dispatched);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON public.alerts (priority);

-- ------------------------------------------------------------------------------
-- 5. MARPOL REPORTS TABLE
-- IMO MARPOL Annex I Investigation Dossiers
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marpol_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(incident_id) ON DELETE CASCADE,
    report_content JSONB NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    submitted BOOLEAN NOT NULL DEFAULT false,
    submitted_at TIMESTAMPTZ,
    submitted_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_marpol_reports_incident_id ON public.marpol_reports (incident_id);
CREATE INDEX IF NOT EXISTS idx_marpol_reports_submitted ON public.marpol_reports (submitted);

-- ------------------------------------------------------------------------------
-- 6. AUDIT LOG TABLE
-- Complete LLM and pipeline audit trail (Prompt 01 - 05 logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID,
    step TEXT NOT NULL CHECK (step IN ('detection', 'attribution', 'alert', 'report', 'drift', 'review')),
    prompt_name TEXT NOT NULL,
    raw_prompt_input JSONB,
    raw_api_response JSONB,
    model_used TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_audit_log_incident_id ON public.audit_log (incident_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_step ON public.audit_log (step);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log (timestamp DESC);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessel_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marpol_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- PROFILES POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Profiles viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- INCIDENTS POLICIES
-- Viewer: Read-only
-- Analyst: SELECT, INSERT, UPDATE (notes & under_review)
-- Approver: Full access
-- Service Role: Full access
-- ------------------------------------------------------------------------------
CREATE POLICY "Incidents viewable by all roles and anon"
  ON public.incidents FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Analysts and Approvers can insert incidents"
  ON public.incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_role() IN ('analyst', 'approver')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Analysts can update notes and review status"
  ON public.incidents FOR UPDATE
  TO authenticated
  USING (
    public.get_current_role() IN ('analyst', 'approver')
    OR auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- VESSEL ATTRIBUTIONS POLICIES
-- ------------------------------------------------------------------------------
CREATE POLICY "Vessel attributions viewable by all roles"
  ON public.vessel_attributions FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Analysts and Approvers can insert vessel attributions"
  ON public.vessel_attributions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_role() IN ('analyst', 'approver')
    OR auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- ALERTS POLICIES
-- Viewer: SELECT
-- Analyst: SELECT, INSERT (pending approval)
-- Approver: SELECT, INSERT, UPDATE (approval and dispatch)
-- ------------------------------------------------------------------------------
CREATE POLICY "Alerts viewable by all roles"
  ON public.alerts FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Analysts and Approvers can create alerts"
  ON public.alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_role() IN ('analyst', 'approver')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Only Approvers can approve and dispatch alerts"
  ON public.alerts FOR UPDATE
  TO authenticated
  USING (
    public.get_current_role() = 'approver'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_current_role() = 'approver'
    OR auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- MARPOL REPORTS POLICIES
-- Viewer: SELECT
-- Analyst: SELECT, INSERT
-- Approver: SELECT, INSERT, UPDATE (mark submitted)
-- ------------------------------------------------------------------------------
CREATE POLICY "MARPOL reports viewable by all roles"
  ON public.marpol_reports FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Analysts and Approvers can create MARPOL reports"
  ON public.marpol_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_current_role() IN ('analyst', 'approver')
    OR auth.role() = 'service_role'
  );

CREATE POLICY "Only Approvers can mark MARPOL reports submitted"
  ON public.marpol_reports FOR UPDATE
  TO authenticated
  USING (
    public.get_current_role() = 'approver'
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    public.get_current_role() = 'approver'
    OR auth.role() = 'service_role'
  );

-- ------------------------------------------------------------------------------
-- AUDIT LOG POLICIES
-- Viewable by analysts and approvers; Insertable by pipeline/service
-- ------------------------------------------------------------------------------
CREATE POLICY "Audit logs viewable by analysts and approvers"
  ON public.audit_log FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Audit logs insertable by all authorized system flows"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- ENABLE SUPABASE REALTIME REPLICATION
-- ------------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vessel_attributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.marpol_reports;
