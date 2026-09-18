"""Unit tests for Roadmap Upgrades: Species Catch Modeling, Coastal Tides & Lunar Cycles, and ML Risk Ensemble."""
from __future__ import annotations

from datetime import datetime, timezone
import pytest

from app.services.species import (
    calculate_species_suitability,
    adjust_trip_economics,
    get_species,
    list_species,
)
from app.services.tides import get_lunar_phase, get_coastal_tides
from app.services.risk_ml import IncidentRiskClassifier, compare_models


def test_species_catalog_and_suitability():
    catalog = list_species()
    assert len(catalog) >= 5
    ids = [s["id"] for s in catalog]
    assert "mackerel" in ids
    assert "sardine" in ids
    assert "pomfret" in ids
    assert "tuna" in ids
    assert "hilsa" in ids

    # Pomfret optimal SST is 25.5 - 28.0
    suit_optimal = calculate_species_suitability("pomfret", sst=27.0, chlorophyll=1.2)
    assert suit_optimal["suitability"] >= 0.8
    assert suit_optimal["status"] == "Optimal Habitat"

    # Pomfret in 32 C (unfavourable warm water)
    suit_warm = calculate_species_suitability("pomfret", sst=32.0, chlorophyll=0.2)
    assert suit_warm["suitability"] < suit_optimal["suitability"]

    # Vernacular names present
    pomfret_meta = get_species("pomfret")
    assert "पापलेट" in pomfret_meta["vernacular"]["hi"]
    assert "ಮಾನಂಜಿ" in pomfret_meta["vernacular"]["kn"]


def test_species_trip_economics():
    base = {
        "fuel_litres": 14.5,
        "fuel_cost_inr": 1450,
        "catch_band": "35-50 kg",
        "catch_kg": 45,
        "gross_revenue_inr": 6300,
        "net_profit_inr": 4850,
    }
    # Silver Pomfret has high market value (₹480/kg)
    adjusted = adjust_trip_economics(base, "pomfret")
    assert adjusted["price_per_kg"] == 480
    assert adjusted["gross_revenue_inr"] == 45 * 480
    assert adjusted["net_profit_inr"] == (45 * 480) - 1450
    assert "Silver Pomfret" in adjusted["target_species"]["name"]


def test_lunar_phase_and_spring_neap():
    # Test reference date
    now = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    lunar = get_lunar_phase(now)
    assert 0 <= lunar["moon_age_days"] <= 30.0
    assert 0 <= lunar["illumination_pct"] <= 100.0
    assert "phase_name" in lunar
    assert "solunar_rating" in lunar
    assert isinstance(lunar["is_spring_tide"], bool)


def test_coastal_tides_schedule():
    now = datetime(2026, 9, 17, 12, 0, 0, tzinfo=timezone.utc)
    # Mumbai coordinates
    tides = get_coastal_tides(18.92, 72.83, now)
    assert tides["current_state"] in ("Rising (Flood)", "Falling (Ebb)", "Slack High", "Slack Low")
    assert tides["current_height_m"] > 0
    assert tides["tidal_range_m"] > 1.0
    assert "time" in tides["next_high_tide"]
    assert "time" in tides["next_low_tide"]
    assert len(tides["hourly_curve"]) == 13


def test_ml_risk_classifier_and_ensemble():
    # Calm sea conditions
    calm = IncidentRiskClassifier.predict(
        wave_height_m=0.8,
        wind_speed_kmh=12.0,
        rain_probability_pct=5.0,
        distance_shore_km=2.0,
        rule_score=15,
    )
    assert calm["ml_category"] in ("LOW", "MODERATE")
    assert calm["ml_score"] < 40
    assert "Concordance" in calm["ensemble_status"] or "Agreement" in calm["ensemble_status"]

    # Extreme storm conditions
    storm = IncidentRiskClassifier.predict(
        wave_height_m=4.8,
        wind_speed_kmh=75.0,
        official_warning=True,
        rule_score=92,
    )
    assert storm["ml_category"] in ("HIGH", "EXTREME")
    assert storm["ml_score"] >= 75
    assert len(storm["top_drivers"]) >= 2

    # Model comparison helper
    comp = compare_models(wave_height_m=1.8, wind_speed_kmh=26.0, rule_score=40)
    assert "rule_engine" in comp
    assert "ml_model" in comp
    assert "ensemble_agreement" in comp
