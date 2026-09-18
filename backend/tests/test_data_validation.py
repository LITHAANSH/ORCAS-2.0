"""Unit tests for Data Validation & 0.0-10.0 Reliability Scoring Engine."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.validation import validate_and_score


@pytest.fixture
def client():
    return TestClient(app)


def test_validation_engine_healthy_live():
    """Live multi-source feeds with physical values produce high reliability score >= 8.5/10."""
    now_str = datetime.now(timezone.utc).isoformat()
    report = validate_and_score(
        weather={
            "wind_speed_kmh": 22.0,
            "wind_direction_deg": 240,
            "rain_probability_pct": 10.0,
            "visibility_km": 15.0,
            "temperature_c": 29.5,
        },
        ocean={
            "wave_height_m": 1.4,
            "wave_period_s": 8.0,
            "sst_c": 28.2,
        },
        location={"latitude": 15.49, "longitude": 73.82, "name": "Goa"},
        mode="LIVE",
        sources=["INCOIS", "IMD", "Open-Meteo Marine"],
        timestamp=now_str,
    )
    assert isinstance(report.score, float)
    assert 8.5 <= report.score <= 10.0
    assert report.is_valid is True
    assert report.rating in ("High", "Exceptional")
    assert report.checks_passed >= 5
    assert "Live" in report.provenance_summary


def test_validation_engine_demo_mode():
    """DEMO mode provides calibrated baseline reliability score ~ 7.0 - 7.9."""
    report = validate_and_score(
        weather={
            "wind_speed_kmh": 18.0,
            "rain_probability_pct": 5.0,
            "visibility_km": 20.0,
        },
        ocean={
            "wave_height_m": 1.1,
            "sst_c": 27.5,
        },
        location={"latitude": 18.92, "longitude": 72.83, "name": "Mumbai"},
        mode="DEMO",
        sources=["DEMO"],
    )
    assert isinstance(report.score, float)
    assert 6.5 <= report.score <= 8.0
    assert report.is_valid is True
    assert "DEMO" in report.provenance_summary


def test_validation_engine_physical_errors():
    """Negative wave height is a fatal physical error and fails validity."""
    report = validate_and_score(
        weather={"wind_speed_kmh": 20.0},
        ocean={"wave_height_m": -2.5, "sst_c": 28.0},
        location={"latitude": 15.49, "longitude": 73.82},
        mode="LIVE",
    )
    assert report.is_valid is False
    assert any(c["name"] == "wave_height_range" and not c["passed"] for c in report.checks)
    # Penalized score
    assert report.score < 8.0


def test_validation_engine_wind_wave_coupling():
    """Unrealistic decouple (65 km/h wind with 0.2m wave) triggers decoupling warning."""
    report = validate_and_score(
        weather={"wind_speed_kmh": 65.0},
        ocean={"wave_height_m": 0.2, "sst_c": 28.0},
        location={"latitude": 15.49, "longitude": 73.82},
        mode="LIVE",
    )
    coupling_check = next((c for c in report.checks if c["name"] == "wind_wave_coupling"), None)
    assert coupling_check is not None
    assert coupling_check["passed"] is False
    assert any("Decoupling" in w for w in report.warnings)


def test_validation_engine_stale_timestamp():
    """Data older than 24 hours triggers freshness warning and penalizes score."""
    old_time = (datetime.now(timezone.utc) - timedelta(hours=36)).isoformat()
    report = validate_and_score(
        weather={"wind_speed_kmh": 20.0},
        ocean={"wave_height_m": 1.2, "sst_c": 28.0},
        location={"latitude": 15.49, "longitude": 73.82},
        mode="LIVE",
        timestamp=old_time,
    )
    fresh_check = next((c for c in report.checks if c["name"] == "temporal_freshness"), None)
    assert fresh_check is not None
    assert fresh_check["passed"] is False


def test_validation_score_clamping():
    """Score must strictly stay between 0.0 and 10.0 even under compounding penalties."""
    report = validate_and_score(
        weather={"wind_speed_kmh": -50.0, "rain_probability_pct": 250.0},
        ocean={"wave_height_m": -10.0, "sst_c": -10.0},
        location={"latitude": 999.0, "longitude": 999.0},
        mode="UNAVAILABLE",
    )
    assert isinstance(report.score, float)
    assert 0.0 <= report.score <= 10.0


def test_api_validate_endpoint(client):
    """GET /api/validate returns HTTP 200 with score and validation structure."""
    resp = client.get("/api/validate?lat=15.49&lon=73.82")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert "reliability_score" in data
    assert isinstance(data["reliability_score"], float)
    assert "validation" in data
    assert "checks" in data["validation"]
    assert len(data["validation"]["checks"]) > 0


def test_api_fishing_endpoint_includes_reliability(client):
    """GET /api/fishing includes reliability_score and validation."""
    resp = client.get("/api/fishing?lat=15.49&lon=73.82")
    assert resp.status_code == 200
    data = resp.json()
    assert "reliability_score" in data
    assert isinstance(data["reliability_score"], float)
    assert 0.0 <= data["reliability_score"] <= 10.0
    assert "validation" in data
    assert data["validation"]["max_score"] == 10.0
