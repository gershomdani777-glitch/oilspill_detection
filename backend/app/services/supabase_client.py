import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import httpx
from ..config import settings

logger = logging.getLogger("supabase_client")

class SupabaseClient:
    """
    Robust Supabase PostgREST & Auth client for the Python backend.
    Uses service_role_key for authorized system operations and falls back to
    in-memory storage gracefully when Supabase credentials are not yet populated.
    """
    def __init__(self):
        self.url = settings.SUPABASE_URL.rstrip('/')
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_KEY
        self.rest_url = f"{self.url}/rest/v1" if self.url else ""
        self.is_configured = bool(self.url and self.key and "your_" not in self.key)

        # In-memory mirror for local offline development / fallback
        self._local_incidents: Dict[str, Dict[str, Any]] = {}
        self._local_vessel_attributions: Dict[str, List[Dict[str, Any]]] = {}
        self._local_alerts: Dict[str, Dict[str, Any]] = {}
        self._local_marpol_reports: Dict[str, Dict[str, Any]] = {}
        self._local_audit_logs: List[Dict[str, Any]] = []

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }

    async def insert_incident(self, incident_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert a validated detection incident into Supabase."""
        incident_id = incident_data.get("incident_id") or str(uuid.uuid4())
        record = {
            "incident_id": incident_id,
            "detection_timestamp_utc": incident_data.get("detection_timestamp_utc") or datetime.now(timezone.utc).isoformat(),
            "detection_confidence": float(incident_data.get("detection_confidence", 0.95)),
            "spill_classification": incident_data.get("spill_classification", "mineral_oil_slick"),
            "spill_area_km2": float(incident_data.get("spill_area_km2", 0.0)),
            "centroid_lat": float(incident_data.get("centroid_lat", 0.0)),
            "centroid_lon": float(incident_data.get("centroid_lon", 0.0)),
            "bounding_box": incident_data.get("bounding_box", []),
            "geometry": incident_data.get("geometry", {}),
            "product_id": incident_data.get("product_id", "SENTINEL-1-SAR"),
            "polarization": incident_data.get("polarization", "VV/VH"),
            "estimated_thickness_band": incident_data.get("estimated_thickness_band"),
            "severity": incident_data.get("severity", "medium"),
            "look_alike_risk_factors": incident_data.get("look_alike_risk_factors", []),
            "recommended_action": incident_data.get("recommended_action", "Alert coastal monitoring authority"),
            "analyst_notes": incident_data.get("analyst_notes", "Automated SAR detection"),
            "status": incident_data.get("status", "new"),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self._local_incidents[incident_id] = record

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{self.rest_url}/incidents",
                        headers=self._headers(),
                        json=record
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return data[0] if isinstance(data, list) and data else record
                    logger.warning(f"Supabase insert_incident returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Failed to insert incident to Supabase: {e}")

        return record

    async def insert_vessel_attributions(self, incident_id: str, vessels: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Insert ranked vessel attributions linked to an incident."""
        records = []
        for idx, v in enumerate(vessels):
            record = {
                "attribution_id": v.get("attribution_id") or str(uuid.uuid4()),
                "incident_id": incident_id,
                "rank": v.get("rank", idx + 1),
                "mmsi": str(v.get("mmsi", "000000000")),
                "vessel_name": v.get("vessel_name") or v.get("name") or "Unknown Vessel",
                "flag_state": v.get("flag_state") or v.get("flag") or "Unknown",
                "vessel_type": v.get("vessel_type") or "Cargo / Tanker",
                "attribution_score": float(v.get("attribution_score", 50.0)),
                "distance_at_t0_km": float(v.get("distance_at_t0_km") or v.get("distance_to_spill_km") or 0.0),
                "ais_gap_detected": bool(v.get("ais_gap_detected", (v.get("ais_gap_severity", 0) > 0))),
                "ais_gap_duration_minutes": int(v.get("ais_gap_duration_minutes", 0)),
                "trajectory_alignment": float(v.get("trajectory_alignment", 0.85)),
                "score_breakdown": v.get("score_breakdown", {}),
                "key_evidence": v.get("key_evidence") or [v.get("evidence_summary", "AIS track correlation")],
                "suspicion_level": v.get("suspicion_level", "medium"),
                "position_history": v.get("position_history", []),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            records.append(record)

        self._local_vessel_attributions[incident_id] = records

        if self.is_configured and records:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{self.rest_url}/vessel_attributions",
                        headers=self._headers(),
                        json=records
                    )
                    if resp.status_code in (200, 201):
                        return resp.json()
                    logger.warning(f"Supabase insert_vessel_attributions returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Failed to insert vessel attributions to Supabase: {e}")

        return records

    async def insert_alert(self, alert_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert generated marine hazard alert with dispatched=false."""
        alert_id = alert_data.get("alert_id") or str(uuid.uuid4())
        record = {
            "alert_id": alert_id,
            "incident_id": alert_data["incident_id"],
            "alert_title": alert_data.get("alert_title", "Marine Hazard Alert"),
            "priority": alert_data.get("priority", "high"),
            "alert_body": alert_data.get("alert_body", "Potential oil slick detected by satellite."),
            "coordinates_dms": alert_data.get("coordinates_dms", ""),
            "affected_area_km2": float(alert_data.get("affected_area_km2", 0.0)),
            "top_suspect_vessel": alert_data.get("top_suspect_vessel", "Under Investigation"),
            "recommended_immediate_actions": alert_data.get("recommended_immediate_actions", []),
            "notify_agencies": alert_data.get("notify_agencies", []),
            "alert_expiry_utc": alert_data.get("alert_expiry_utc") or (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "approved_by": None,
            "approved_at": None,
            "dispatched": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self._local_alerts[alert_id] = record

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{self.rest_url}/alerts",
                        headers=self._headers(),
                        json=record
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return data[0] if isinstance(data, list) and data else record
                    logger.warning(f"Supabase insert_alert returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Failed to insert alert to Supabase: {e}")

        return record

    async def insert_marpol_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Insert generated MARPOL report with submitted=false."""
        report_id = report_data.get("report_id") or str(uuid.uuid4())
        record = {
            "report_id": report_id,
            "incident_id": report_data["incident_id"],
            "report_content": report_data.get("report_content", {}),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "submitted": False,
            "submitted_at": None,
            "submitted_by": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        self._local_marpol_reports[report_id] = record

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.post(
                        f"{self.rest_url}/marpol_reports",
                        headers=self._headers(),
                        json=record
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return data[0] if isinstance(data, list) and data else record
                    logger.warning(f"Supabase insert_marpol_report returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.error(f"Failed to insert MARPOL report to Supabase: {e}")

        return record

    async def insert_audit_log(
        self,
        incident_id: Optional[str],
        step: str,
        prompt_name: str,
        raw_prompt_input: Any,
        raw_api_response: Any,
        model_used: str = "Claude 3.5 Sonnet (Maritime SAR Vision)"
    ) -> Dict[str, Any]:
        """Log LLM prompt execution into audit_log table."""
        record = {
            "log_id": str(uuid.uuid4()),
            "incident_id": incident_id,
            "step": step,
            "prompt_name": prompt_name,
            "raw_prompt_input": raw_prompt_input if isinstance(raw_prompt_input, (dict, list)) else {"text": str(raw_prompt_input)},
            "raw_api_response": raw_api_response if isinstance(raw_api_response, (dict, list)) else {"text": str(raw_api_response)},
            "model_used": model_used,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        self._local_audit_logs.append(record)

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.post(
                        f"{self.rest_url}/audit_log",
                        headers=self._headers(),
                        json=record
                    )
                    if resp.status_code in (200, 201):
                        data = resp.json()
                        return data[0] if isinstance(data, list) and data else record
            except Exception as e:
                logger.error(f"Failed to log audit event to Supabase: {e}")

        return record

    async def approve_alert(self, alert_id: str, approver_name: str) -> Optional[Dict[str, Any]]:
        """Approve and mark alert as dispatched."""
        update_data = {
            "dispatched": True,
            "approved_by": approver_name,
            "approved_at": datetime.now(timezone.utc).isoformat(),
        }

        if alert_id in self._local_alerts:
            self._local_alerts[alert_id].update(update_data)

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.patch(
                        f"{self.rest_url}/alerts?alert_id=eq.{alert_id}",
                        headers=self._headers(),
                        json=update_data
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data[0] if isinstance(data, list) and data else self._local_alerts.get(alert_id)
            except Exception as e:
                logger.error(f"Failed to update alert in Supabase: {e}")

        return self._local_alerts.get(alert_id)

    async def submit_marpol_report(self, report_id: str, submitter_name: str) -> Optional[Dict[str, Any]]:
        """Mark MARPOL report as submitted."""
        update_data = {
            "submitted": True,
            "submitted_by": submitter_name,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }

        if report_id in self._local_marpol_reports:
            self._local_marpol_reports[report_id].update(update_data)

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.patch(
                        f"{self.rest_url}/marpol_reports?report_id=eq.{report_id}",
                        headers=self._headers(),
                        json=update_data
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        return data[0] if isinstance(data, list) and data else self._local_marpol_reports.get(report_id)
            except Exception as e:
                logger.error(f"Failed to update MARPOL report in Supabase: {e}")

        return self._local_marpol_reports.get(report_id)

    async def get_pending_approvals(self) -> Dict[str, Any]:
        """Fetch all alerts and reports waiting for approval."""
        alerts = []
        reports = []

        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    a_resp = await client.get(
                        f"{self.rest_url}/alerts?dispatched=eq.false&order=created_at.desc",
                        headers=self._headers()
                    )
                    if a_resp.status_code == 200:
                        alerts = a_resp.json()

                    r_resp = await client.get(
                        f"{self.rest_url}/marpol_reports?submitted=eq.false&order=created_at.desc",
                        headers=self._headers()
                    )
                    if r_resp.status_code == 200:
                        reports = r_resp.json()
            except Exception as e:
                logger.error(f"Error fetching pending approvals from Supabase: {e}")

        if not alerts:
            alerts = [a for a in self._local_alerts.values() if not a.get("dispatched")]
        if not reports:
            reports = [r for r in self._local_marpol_reports.values() if not r.get("submitted")]

        return {
            "pending_alerts": alerts,
            "pending_reports": reports,
            "total_pending": len(alerts) + len(reports),
        }

    async def get_audit_trail(self, incident_id: str) -> List[Dict[str, Any]]:
        """Get complete audit trail for a specific incident."""
        if self.is_configured:
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    resp = await client.get(
                        f"{self.rest_url}/audit_log?incident_id=eq.{incident_id}&order=timestamp.asc",
                        headers=self._headers()
                    )
                    if resp.status_code == 200:
                        return resp.json()
            except Exception as e:
                logger.error(f"Error fetching audit trail from Supabase: {e}")

        return [log for log in self._local_audit_logs if log.get("incident_id") == incident_id]

supabase_db = SupabaseClient()
