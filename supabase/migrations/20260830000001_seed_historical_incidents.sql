-- ==============================================================================
-- MARITIME OIL SPILL DETECTION & ATTRIBUTION PLATFORM
-- Benchmark Incident Seeds & Initial Demonstrations
-- Version: 20260830000001_seed_historical_incidents.sql
-- ==============================================================================

-- 1. MV Wakashio Grounding & Fuel Oil Spill
INSERT INTO public.incidents (
    incident_id,
    detection_timestamp_utc,
    detection_confidence,
    spill_classification,
    spill_area_km2,
    centroid_lat,
    centroid_lon,
    bounding_box,
    geometry,
    product_id,
    polarization,
    estimated_thickness_band,
    severity,
    look_alike_risk_factors,
    recommended_action,
    analyst_notes,
    status
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2020-08-06T06:14:00Z',
    0.985,
    'heavy_fuel_oil_slick',
    28.4,
    -20.4400,
    57.7400,
    '[57.65, -20.55, 57.85, -20.35]'::jsonb,
    '{"type":"MultiPolygon","coordinates":[[[[57.71,-20.45],[57.76,-20.46],[57.78,-20.42],[57.72,-20.41],[57.71,-20.45]]]]}'::jsonb,
    'S1A_IW_GRDH_1SDV_20200806T061422_MAURITIUS_SAR',
    'VV/VH',
    'True color (> 100 μm)',
    'critical',
    '["coral_reef_proximity", "high_ecological_vulnerability"]'::jsonb,
    'Deploy tier-3 containment booms and issue emergency coastal protection alert to Mauritius Coast Guard.',
    'Benchmark grounding incident at Pointe d''Esny. High confidence radar signature with severe coral lagoon exposure.',
    'confirmed'
) ON CONFLICT (incident_id) DO NOTHING;

-- 1b. Vessel attribution for Wakashio
INSERT INTO public.vessel_attributions (
    attribution_id,
    incident_id,
    rank,
    mmsi,
    vessel_name,
    flag_state,
    vessel_type,
    attribution_score,
    distance_at_t0_km,
    ais_gap_detected,
    ais_gap_duration_minutes,
    trajectory_alignment,
    score_breakdown,
    key_evidence,
    suspicion_level
) VALUES (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    1,
    '371917000',
    'MV WAKASHIO',
    'Panama (PA)',
    'Capesize Bulk Carrier',
    96.8,
    0.08,
    true,
    184,
    0.98,
    '{"proximity": 38.5, "ais_gap": 25.0, "vessel_type": 15.0, "trajectory_alignment": 13.3, "cargo_port_correlation": 5.0}'::jsonb,
    '["Vessel track directly intersects Point of Origin at T-0", "Complete AIS transponder blackout for 184 minutes prior to reef impact", "SAR radar anomaly originates precisely from grounded vessel coordinates"]'::jsonb,
    'high'
) ON CONFLICT (attribution_id) DO NOTHING;

-- 1c. Alert for Wakashio
INSERT INTO public.alerts (
    alert_id,
    incident_id,
    alert_title,
    priority,
    alert_body,
    coordinates_dms,
    affected_area_km2,
    top_suspect_vessel,
    recommended_immediate_actions,
    notify_agencies,
    dispatched,
    approved_by,
    approved_at
) VALUES (
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c33',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'CRITICAL: Heavy Fuel Oil Discharge — Pointe d''Esny Coral Lagoon',
    'critical',
    'Sentinel-1 C-SAR radar confirms a 28.4 km² continuous dark slick centered at Pointe d''Esny. Grounded bulk carrier MV WAKASHIO (MMSI 371917000) identified as primary source with 96.8% attribution certainty.',
    '20°26''24"S, 57°44''24"E',
    28.4,
    'MV WAKASHIO (MMSI 371917000)',
    '["Activate National Oil Spill Contingency Plan (NOSCP)", "Deploy containment boom barrier across Blue Bay Marine Park entrance", "Mobilize skimmer vessels to reef boundary"]'::jsonb,
    '["Mauritius Coast Guard", "Ministry of Environment", "REMPEC Regional Center", "IMO Secretariat"]'::jsonb,
    true,
    'Chief Environmental Officer (Approver)',
    '2020-08-06T07:00:00Z'
) ON CONFLICT (alert_id) DO NOTHING;

-- 1d. Audit Log for Wakashio
INSERT INTO public.audit_log (
    incident_id,
    step,
    prompt_name,
    raw_prompt_input,
    raw_api_response,
    model_used,
    timestamp
) VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'detection',
    'Prompt 01: Spill Detection Analysis',
    '{"product_id": "S1A_IW_GRDH_1SDV_20200806T061422_MAURITIUS_SAR", "bbox": [57.65, -20.55, 57.85, -20.35]}'::jsonb,
    '{"status": "detected", "area_km2": 28.4, "confidence": 0.985, "spill_classification": "heavy_fuel_oil_slick"}'::jsonb,
    'Claude 3.5 Sonnet / SAR U-Net Ensemble',
    '2020-08-06T06:15:00Z'
) ON CONFLICT (log_id) DO NOTHING;
