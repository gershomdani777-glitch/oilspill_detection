import asyncio
from unittest.mock import AsyncMock, patch
from app.services.scene_registry import SceneRegistry
from app.services.monitoring_scheduler import MonitoringScheduler
from app.models.schemas import MonitoringState

def test_paused_and_stopped_regions_generate_zero_copernicus_calls():
    """
    NON-NEGOTIABLE REQUIREMENT:
    When a region is PAUSED or STOPPED (INACTIVE), the scheduler MUST issue ZERO
    outbound Copernicus queries across poll cycles.
    """
    async def _run():
        reg = SceneRegistry()
        scheduler = MonitoringScheduler()

        # Ensure all regions are set to PAUSED or INACTIVE
        for r in reg.list_regions():
            reg.set_region_monitoring_state(r.id, MonitoringState.PAUSED)

        mock_copernicus = AsyncMock()

        with patch("app.services.monitoring_scheduler.copernicus_client.search_newest_sentinel1_scene", mock_copernicus), \
             patch("app.services.monitoring_scheduler.scene_registry", reg):
            
            # Run 3 consecutive poll cycles
            for _ in range(3):
                res = await scheduler.poll_active_regions()
                assert len(res["processed_regions"]) == 0

            # Assert ZERO calls were made to Copernicus catalog
            assert mock_copernicus.call_count == 0

    asyncio.run(_run())

def test_active_region_triggers_copernicus_call():
    """An ACTIVE region MUST trigger Copernicus scene search on poll cycle."""
    async def _run():
        reg = SceneRegistry()
        scheduler = MonitoringScheduler()

        # Set only Mauritius to ACTIVE
        reg.set_region_monitoring_state("reg-mauritius-01", MonitoringState.ACTIVE)
        for r in reg.list_regions():
            if r.id != "reg-mauritius-01":
                reg.set_region_monitoring_state(r.id, MonitoringState.INACTIVE)

        mock_copernicus = AsyncMock(return_value={
            "product_id": "S1A_IW_GRDH_ACTIVE_TEST",
            "satellite": "Sentinel-1A",
            "instrument": "C-SAR",
            "mode": "IW",
            "polarization": "VV+VH",
            "resolution_m": 10.0,
            "acquisition_timestamp": "2026-08-31T06:14:22Z",
            "footprint": {"type": "Polygon", "coordinates": [[[57.5, -20.6], [57.9, -20.6], [57.9, -20.2], [57.5, -20.2], [57.5, -20.6]]]},
            "orbit_direction": "DESCENDING",
            "relative_orbit": 154
        })

        with patch("app.services.monitoring_scheduler.copernicus_client.search_newest_sentinel1_scene", mock_copernicus), \
             patch("app.services.monitoring_scheduler.scene_registry", reg):
            
            res = await scheduler.poll_active_regions()
            assert len(res["processed_regions"]) == 1
            assert res["processed_regions"][0]["region_id"] == "reg-mauritius-01"
            assert mock_copernicus.call_count >= 1

    asyncio.run(_run())
