import pytest
from app.services.scene_registry import SceneRegistry
from app.models.schemas import SceneStatus

def test_scene_matching_high_overlap_same_orbit():
    """Two products with same relative orbit and 80%+ overlap MUST match the same scene."""
    reg = SceneRegistry()
    region_id = "reg-mauritius-01"

    footprint1 = {
        "type": "Polygon",
        "coordinates": [[
            [57.5, -20.6],
            [57.9, -20.6],
            [57.9, -20.2],
            [57.5, -20.2],
            [57.5, -20.6]
        ]]
    }

    # Slightly shifted footprint (90% overlap)
    footprint2 = {
        "type": "Polygon",
        "coordinates": [[
            [57.52, -20.58],
            [57.88, -20.58],
            [57.88, -20.22],
            [57.52, -20.22],
            [57.52, -20.58]
        ]]
    }

    scene1, is_new1 = reg.match_or_create_scene(
        region_id=region_id,
        relative_orbit=154,
        footprint=footprint1,
        orbit_direction="DESCENDING"
    )
    assert is_new1 is True

    scene2, is_new2 = reg.match_or_create_scene(
        region_id=region_id,
        relative_orbit=154,
        footprint=footprint2,
        orbit_direction="DESCENDING"
    )
    assert is_new2 is False
    assert scene1.id == scene2.id

def test_scene_matching_low_overlap_same_orbit_creates_new_scene():
    """Same relative orbit but < 70% overlap MUST create a new scene."""
    reg = SceneRegistry()
    region_id = "reg-mauritius-01"

    footprint1 = {
        "type": "Polygon",
        "coordinates": [[
            [57.5, -20.6],
            [57.9, -20.6],
            [57.9, -20.2],
            [57.5, -20.2],
            [57.5, -20.6]
        ]]
    }

    # Displaced footprint with only ~30% overlap
    footprint2 = {
        "type": "Polygon",
        "coordinates": [[
            [57.8, -20.6],
            [58.2, -20.6],
            [58.2, -20.2],
            [57.8, -20.2],
            [57.8, -20.6]
        ]]
    }

    scene1, is_new1 = reg.match_or_create_scene(
        region_id=region_id,
        relative_orbit=154,
        footprint=footprint1
    )
    assert is_new1 is True

    scene2, is_new2 = reg.match_or_create_scene(
        region_id=region_id,
        relative_orbit=154,
        footprint=footprint2
    )
    assert is_new2 is True
    assert scene1.id != scene2.id

def test_scene_matching_different_orbit_creates_new_scene():
    """Identical footprint but different relative orbit MUST create a new scene."""
    reg = SceneRegistry()
    region_id = "reg-mauritius-01"

    footprint = {
        "type": "Polygon",
        "coordinates": [[
            [57.5, -20.6],
            [57.9, -20.6],
            [57.9, -20.2],
            [57.5, -20.2],
            [57.5, -20.6]
        ]]
    }

    scene1, _ = reg.match_or_create_scene(region_id=region_id, relative_orbit=154, footprint=footprint)
    scene2, is_new2 = reg.match_or_create_scene(region_id=region_id, relative_orbit=81, footprint=footprint)

    assert is_new2 is True
    assert scene1.id != scene2.id
