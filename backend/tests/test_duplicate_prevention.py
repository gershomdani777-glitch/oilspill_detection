import asyncio
from unittest.mock import AsyncMock, patch
from app.services.scene_registry import SceneRegistry
from app.services.monitoring_scheduler import MonitoringScheduler

def test_duplicate_acquisition_prevention():
    """Processing a product once, then polling again MUST result in NO_NEW_ACQUISITION with zero new jobs."""
    async def _run():
        reg = SceneRegistry()
        region_id = "reg-mauritius-01"
        
        footprint = {
            "type": "Polygon",
            "coordinates": [[[57.5, -20.6], [57.9, -20.6], [57.9, -20.2], [57.5, -20.2], [57.5, -20.6]]]
        }
        
        scene, _ = reg.match_or_create_scene(region_id, 154, footprint)
        product_id = "S1A_IW_GRDH_1SDV_20260831T061422_CDSE_TEST01"

        # 1. Register product as ingested
        acq = reg.register_acquisition(
            scene_id=scene.id,
            region_id=region_id,
            product_id=product_id,
            sensing_start="2026-08-31T06:14:22Z",
            sensing_end="2026-08-31T06:14:47Z",
            footprint=footprint,
            clean_scene=True,
            clean_scene_reason="Clean scene"
        )

        assert reg.is_product_ingested(product_id) is True
        assert scene.latest_acquisition_id == acq.id

        # 2. Simulate second scheduler query returning identical product_id
        mock_copernicus = AsyncMock(return_value={
            "product_id": product_id,
            "acquisition_timestamp": "2026-08-31T06:14:22Z",
            "footprint": footprint,
            "polarization": "VV+VH"
        })

        scheduler = MonitoringScheduler()
        with patch("app.services.monitoring_scheduler.copernicus_client.search_newest_sentinel1_scene", mock_copernicus), \
             patch("app.services.monitoring_scheduler.scene_registry", reg):
            
            region = reg.get_region(region_id)
            result = await scheduler._process_monitored_scene(region, scene)
            
            assert result["new_acquisition"] is False
            assert result["status"] == "NO_NEW_ACQUISITION"

    asyncio.run(_run())
