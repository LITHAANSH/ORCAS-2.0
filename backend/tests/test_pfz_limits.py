from datetime import datetime
from unittest.mock import patch

import pytest

from app.agents import explanation_agent, pfz_agent
from app.config import get_data_mode, set_data_mode
from app.schemas import Intent, Location, PFZZone


@pytest.fixture(autouse=True)
def restore_data_mode():
    previous = get_data_mode()
    yield
    set_data_mode(previous)


def _candidate(index: int, *, distance: float | None = None) -> dict:
    return {
        "lat": 15.0 + index * 0.01,
        "lon": 72.0 + index * 0.01,
        "latitude": 15.0 + index * 0.01,
        "longitude": 72.0 + index * 0.01,
        "distance_km": distance if distance is not None else float(index + 1),
        "bearing": "E",
        "sst_c": 27.0,
        "chlorophyll_mg_m3": float(10 - index),
        "wave_height_m": 1.0,
        "confidence": 0.8,
        "rationale": "test",
        "source": "INCOIS_WFS",
    }


def _run_demo(candidates):
    set_data_mode("DEMO")
    location = Location(name="Test", latitude=15.0, longitude=72.0)
    with patch.object(pfz_agent.demo_store, "pfz_zones", return_value=candidates):
        return pfz_agent.run(location, datetime.now())


def test_six_valid_pfz_candidates_are_returned():
    result = _run_demo([_candidate(i) for i in range(6)])

    assert len(result.data["zones"]) == 6
    assert [zone["rank"] for zone in result.data["zones"]] == list(range(1, 7))


def test_eight_valid_pfz_candidates_are_limited_to_top_six():
    result = _run_demo([_candidate(i) for i in range(8)])

    assert len(result.data["zones"]) == 6
    assert [zone["latitude"] for zone in result.data["zones"]] == [15.0 + i * 0.01 for i in range(6)]


def test_fewer_than_six_valid_pfz_candidates_are_all_returned():
    result = _run_demo([_candidate(i) for i in range(4)])

    assert len(result.data["zones"]) == 4


def test_restricted_candidates_are_removed_before_six_zone_limit():
    candidates = [_candidate(i) for i in range(8)]
    with patch.object(
        pfz_agent, "_blocking_zone",
        side_effect=[{"name": "restricted", "zone_type": "marine"}, None, None, None, None, None, None, None],
    ):
        result = _run_demo(candidates)

    assert len(result.data["zones"]) == 6
    assert result.data["excluded_count"] == 1
    assert result.data["zones"][0]["latitude"] == 15.01


def test_live_provider_failure_remains_unavailable():
    location = Location(name="Test", latitude=15.0, longitude=72.0)
    set_data_mode("LIVE")
    with patch.object(pfz_agent.incois_provider, "fetch_pfz_zones", return_value=None):
        result = pfz_agent.run(location, datetime.now())

    assert result.mode == "UNAVAILABLE"
    assert result.ok is False
    assert result.data["zones"] == []


def test_demo_mode_still_returns_demo_pfz_data():
    result = _run_demo([_candidate(0)])

    assert result.mode == "DEMO"
    assert result.source == "DEMO"
    assert len(result.data["zones"]) == 1


def test_pfz_explanation_lists_multiple_ranked_zones():
    zones = [PFZZone(**_candidate(i), rank=i + 1, timestamp="2026-09-16T00:00:00") for i in range(3)]
    intent = Intent(intent="find_pfz", language="en")
    result = explanation_agent.run(
        intent=intent, risk=None, pfz=zones, routes=[], geofence=[], weather={}, ocean={},
        cyclone={}, gis={}, agents={}, mode="DEMO", when=datetime.now(), chat_mode="OFFLINE",
    )

    answer = result.data["answer"]
    assert "Found 3 potential fishing zones" in answer
    assert "#1" in answer and "#2" in answer and "#3" in answer
    assert "ORCA ranked" in answer


def test_unrelated_explanation_does_not_dump_pfz_zones():
    zones = [PFZZone(**_candidate(i), rank=i + 1, timestamp="2026-09-16T00:00:00") for i in range(3)]
    intent = Intent(intent="weather", language="en")
    result = explanation_agent.run(
        intent=intent, risk=None, pfz=zones, routes=[], geofence=[], weather={}, ocean={},
        cyclone={}, gis={}, agents={}, mode="DEMO", when=datetime.now(), chat_mode="OFFLINE",
    )

    answer = result.data["answer"]
    assert "potential fishing zones" not in answer
    assert "#1" not in answer