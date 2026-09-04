import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_list_coastal_regions():
    res = client.get("/api/v1/coastal-regions")
    assert res.status_code == 200
    regions = res.json()
    assert len(regions) >= 4
    assert any(r["id"] == "reg-mauritius-01" for r in regions)

def test_get_single_coastal_region():
    res = client.get("/api/v1/coastal-regions/reg-mauritius-01")
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Mauritius Coast (Wakashio Zone)"
    assert "bbox" in data

def test_region_monitoring_lifecycle_endpoints():
    region_id = "reg-mauritius-01"

    # 1. Start Monitoring
    res_start = client.post(f"/api/v1/regions/{region_id}/monitoring/start")
    assert res_start.status_code == 200
    assert res_start.json()["monitoring_state"] == "ACTIVE"

    # 2. Status check
    res_status = client.get(f"/api/v1/regions/{region_id}/monitoring/status")
    assert res_status.status_code == 200
    assert res_status.json()["monitoring_state"] == "ACTIVE"

    # 3. Pause Monitoring
    res_pause = client.post(f"/api/v1/regions/{region_id}/monitoring/pause")
    assert res_pause.status_code == 200
    assert res_pause.json()["monitoring_state"] == "PAUSED"

    # 4. Stop Monitoring
    res_stop = client.post(f"/api/v1/regions/{region_id}/monitoring/stop")
    assert res_stop.status_code == 200
    assert res_stop.json()["monitoring_state"] == "INACTIVE"

def test_manual_monitoring_check_endpoint():
    res = client.post("/api/v1/monitoring/check")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
