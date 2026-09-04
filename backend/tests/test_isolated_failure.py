import asyncio
from unittest.mock import patch
from app.services.scene_registry import SceneRegistry
from app.services.monitoring_scheduler import MonitoringScheduler
from app.models.schemas import MonitoringState, SceneStatus

def test_isolated_scene_failure_does_not_block_siblings():
    """If scene 1 throws a network/download error, it is marked ERROR, but sibling scene 2 proceeds successfully."""
    async def _run():
        reg = SceneRegistry()
        region_id = "reg-mauritius-01"

        footprint1 = {"type": "Polygon", "coordinates": [[[57.5, -20.6], [57.7, -20.6], [57.7, -20.2], [57.5, -20.2], [57.5, -20.6]]]}
        footprint2 = {"type": "Polygon", "coordinates": [[[57.7, -20.6], [57.9, -20.6], [57.9, -20.2], [57.7, -20.2], [57.7, -20.6]]]}

        scene1, _ = reg.match_or_create_scene(region_id, 154, footprint1)
        scene2, _ = reg.match_or_create_scene(region_id, 81, footprint2)

        reg.set_region_monitoring_state(region_id, MonitoringState.ACTIVE)
        region = reg.get_region(region_id)

        scheduler = MonitoringScheduler()

        # Mock scene 1 failing with timeout, scene 2 succeeding
        async def mock_process_scene(r, s):
            if s.id == scene1.id:
                raise ConnectionError("Copernicus CDSE Gateway Timeout (504)")
            return {"new_acquisition": True, "spill_detected": False}

        with patch("app.services.monitoring_scheduler.scene_registry", reg), \
             patch.object(scheduler, "_process_monitored_scene", side_effect=mock_process_scene):
            
            res = await scheduler._process_active_region(region)

            assert res["scenes_evaluated"] == 2
            assert res["errors"] == 1
            assert res["new_acquisitions"] == 1
            assert scene1.status == SceneStatus.ERROR

    asyncio.run(_run())
