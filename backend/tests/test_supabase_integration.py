import asyncio
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.services.supabase_client import supabase_db

client = TestClient(app)

def test_supabase_incident_lifecycle():
    async def _run():
        incident_id = str(uuid.uuid4())
        payload = {
            "incident_id": incident_id,
            "detection_timestamp_utc": "2026-08-30T10:00:00Z",
            "detection_confidence": 0.96,
            "spill_classification": "mineral_oil_slick",
            "spill_area_km2": 18.5,
            "centroid_lat": -20.44,
            "centroid_lon": 57.74,
            "bounding_box": [57.65, -20.55, 57.85, -20.35],
            "geometry": {"type": "MultiPolygon", "coordinates": []},
            "severity": "critical",
            "status": "new"
        }

        # 1. Insert Incident (Prompt 01)
        record = await supabase_db.insert_incident(payload)
        assert record["incident_id"] == incident_id
        assert record["detection_confidence"] == 0.96
        assert record["status"] == "new"

        # 2. Insert Vessel Attribution (Prompt 02)
        vessels = [{
            "rank": 1,
            "mmsi": "371917000",
            "vessel_name": "MV WAKASHIO",
            "flag_state": "Panama",
            "vessel_type": "Bulk Carrier",
            "attribution_score": 96.8,
            "distance_at_t0_km": 0.08,
            "ais_gap_detected": True,
            "ais_gap_duration_minutes": 184,
            "key_evidence": ["Track intersects spill at T-0"],
            "suspicion_level": "high"
        }]
        vessel_records = await supabase_db.insert_vessel_attributions(incident_id, vessels)
        assert len(vessel_records) == 1
        assert vessel_records[0]["mmsi"] == "371917000"

        # 3. Insert Alert (Prompt 03)
        alert = await supabase_db.insert_alert({
            "incident_id": incident_id,
            "alert_title": "Critical SAR Hazard",
            "priority": "critical",
            "alert_body": "Large oil slick confirmed.",
            "affected_area_km2": 18.5,
            "top_suspect_vessel": "MV WAKASHIO"
        })
        alert_id = alert["alert_id"]
        assert alert["dispatched"] is False

        # 4. Insert Audit Log
        log = await supabase_db.insert_audit_log(
            incident_id=incident_id,
            step="detection",
            prompt_name="Prompt 01: Spill Detection Analysis",
            raw_prompt_input={"bbox": payload["bounding_box"]},
            raw_api_response=payload,
            model_used="SAR Vision U-Net"
        )
        assert log["incident_id"] == incident_id

        # 5. Test Approver Endpoint
        app_res = client.post(f"/api/v1/alerts/{alert_id}/approve", json={"approver_name": "Senior Officer"})
        assert app_res.status_code == 200
        assert app_res.json()["status"] == "dispatched"
        assert app_res.json()["alert"]["dispatched"] is True

        # 6. Query Audit Trail
        audit_res = client.get(f"/api/v1/incidents/{incident_id}/audit")
        assert audit_res.status_code == 200
        trail = audit_res.json()
        assert len(trail) >= 1
        assert trail[0]["prompt_name"] == "Prompt 01: Spill Detection Analysis"

    asyncio.run(_run())
