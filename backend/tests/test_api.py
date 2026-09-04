import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_region_selection_valid():
    payload = {
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[57.7, -20.5], [57.8, -20.5], [57.8, -20.4], [57.7, -20.4], [57.7, -20.5]]]
        }
    }
    res = client.post("/api/v1/regions/select", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "region_id" in data
    assert "bbox" in data
    assert data["area_sq_km"] > 0

def test_region_selection_oversized_rejected():
    # Huge region across 100 degrees
    payload = {
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[-50.0, -50.0], [50.0, -50.0], [50.0, 50.0], [-50.0, 50.0], [-50.0, -50.0]]]
        }
    }
    res = client.post("/api/v1/regions/select", json=payload)
    assert res.status_code == 400
    assert "exceeds maximum allowed" in res.json()["detail"]

def test_historical_incidents_list():
    res = client.get("/api/v1/incidents/historical")
    assert res.status_code == 200
    incidents = res.json()
    assert len(incidents) >= 5
    assert any(i["incident_id"] == "inc-wakashio-2020" for i in incidents)

def test_historical_replay():
    res = client.get("/api/v1/incidents/historical/inc-wakashio-2020/replay")
    assert res.status_code == 200
    timeline = res.json()
    assert "timeline" in timeline
    assert len(timeline["timeline"]) >= 6

def test_historical_pdf_report():
    res = client.get("/api/v1/reports/inc-wakashio-2020/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert len(res.content) > 1000

