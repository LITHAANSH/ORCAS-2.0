"""Tide schedule and astronomical lunar phase modeling for Indian coastal fisheries.

Calculates:
1. Lunar synodic phase (New Moon, Waxing, Full Moon, Waning) and illumination percentage.
2. Spring vs Neap tide cycles (highest tidal flow during New & Full Moon).
3. Coastal semi-diurnal tidal curves (Flood, Ebb, Slack, High & Low tide schedule).
4. Solunar feeding activity rating (Peak, High, Moderate, Low).
"""
from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Tuple

# Synodic lunar month in days
LUNAR_SYNODIC_DAYS = 29.53058867
# Known Reference New Moon: 2024-01-11 11:57:00 UTC
REF_NEW_MOON_UTC = datetime(2024, 1, 11, 11, 57, 0, tzinfo=timezone.utc)

# Semi-diurnal lunar tide period (12h 25m)
TIDE_PERIOD_HOURS = 12.4206


def get_lunar_phase(when: datetime) -> Dict:
    """Compute precise astronomical lunar phase, age, and illumination."""
    if when.tzinfo is None:
        when = when.replace(tzinfo=timezone.utc)
    delta_days = (when - REF_NEW_MOON_UTC).total_seconds() / 86400.0
    moon_age = delta_days % LUNAR_SYNODIC_DAYS
    fraction = moon_age / LUNAR_SYNODIC_DAYS

    # Illumination %
    illumination = round((1.0 - math.cos(2 * math.pi * fraction)) / 2.0 * 100, 1)

    # Phase categorization
    if moon_age < 1.84 or moon_age >= 27.68:
        phase_name = "New Moon"
        phase_icon = "🌑"
        is_spring_tide = True
    elif moon_age < 7.38:
        phase_name = "Waxing Crescent"
        phase_icon = "🌒"
        is_spring_tide = False
    elif moon_age < 9.23:
        phase_name = "First Quarter"
        phase_icon = "🌓"
        is_spring_tide = False
    elif moon_age < 13.84:
        phase_name = "Waxing Gibbous"
        phase_icon = "🌔"
        is_spring_tide = False
    elif moon_age < 15.69:
        phase_name = "Full Moon"
        phase_icon = "🌕"
        is_spring_tide = True
    elif moon_age < 20.30:
        phase_name = "Waning Gibbous"
        phase_icon = "🌖"
        is_spring_tide = False
    elif moon_age < 22.15:
        phase_name = "Last Quarter"
        phase_icon = "🌗"
        is_spring_tide = False
    else:
        phase_name = "Waning Crescent"
        phase_icon = "🌘"
        is_spring_tide = False

    # Solunar activity: Spring tides & full/new moons create peak nutrient displacement
    if is_spring_tide:
        solunar_rating = "Peak (Spring Tide)"
        solunar_score = 95
    elif phase_name in ("Waxing Gibbous", "Waning Gibbous"):
        solunar_rating = "High Activity"
        solunar_score = 80
    elif phase_name in ("First Quarter", "Last Quarter"):
        solunar_rating = "Moderate (Neap Tide)"
        solunar_score = 60
    else:
        solunar_rating = "Normal"
        solunar_score = 70

    return {
        "phase_name": phase_name,
        "phase_icon": phase_icon,
        "moon_age_days": round(moon_age, 1),
        "illumination_pct": illumination,
        "is_spring_tide": is_spring_tide,
        "tide_cycle": "Spring Tide (Strong currents)" if is_spring_tide else "Neap Tide (Moderate currents)",
        "solunar_rating": solunar_rating,
        "solunar_score": solunar_score,
    }


def get_coastal_tides(lat: float, lon: float, when: datetime) -> Dict:
    """Compute coastal semi-diurnal tidal height, state, and next high/low schedule."""
    lunar = get_lunar_phase(when)

    # Base tidal range varies along Indian coast:
    # Gujarat/Maharashtra has 3-4.5m range; South/Goa/Kerala has 1-2m range; Bengal/Odisha has 2.5-4m
    if lat > 18.0 and lon < 74.0:
        mean_range = 3.6  # North-West / Gulf of Khambhat
    elif lat > 19.0 and lon > 84.0:
        mean_range = 3.2  # North-East / Bengal
    else:
        mean_range = 1.8  # South / Malabar / Coromandel

    # Spring tides amplify range by ~25%, Neap tides dampen by ~20%
    spring_factor = 1.25 if lunar["is_spring_tide"] else 0.82
    actual_range = round(mean_range * spring_factor, 2)
    mean_level = round(actual_range / 2.0 + 0.4, 2)

    # Calculate tidal phase offset from epoch
    epoch_hours = when.timestamp() / 3600.0
    # Longitude gives ~4 min per degree spatial phase progression
    lon_offset_hours = (lon - 72.8) * (24.0 / 360.0)
    cycle_time = (epoch_hours + lon_offset_hours) % TIDE_PERIOD_HOURS
    phase_rad = 2.0 * math.pi * (cycle_time / TIDE_PERIOD_HOURS)

    # Current height (sinusoidal semi-diurnal model)
    current_height = round(mean_level + (actual_range / 2.0) * math.cos(phase_rad), 2)

    # Current state
    slope = -math.sin(phase_rad)
    if abs(slope) < 0.2:
        state = "Slack High" if math.cos(phase_rad) > 0 else "Slack Low"
    elif slope > 0:
        state = "Rising (Flood)"
    else:
        state = "Falling (Ebb)"

    # Compute next high and low tide times
    hours_to_high = (TIDE_PERIOD_HOURS - cycle_time) % TIDE_PERIOD_HOURS
    next_high_dt = when + timedelta(hours=hours_to_high)

    hours_to_low = (TIDE_PERIOD_HOURS / 2.0 - cycle_time) % TIDE_PERIOD_HOURS
    if hours_to_low < 0:
        hours_to_low += TIDE_PERIOD_HOURS
    next_low_dt = when + timedelta(hours=hours_to_low)

    # 12-hour hourly forecast points
    hourly_curve: List[Dict] = []
    for h in range(13):
        h_when = when + timedelta(hours=h)
        h_epoch = h_when.timestamp() / 3600.0
        h_cycle = (h_epoch + lon_offset_hours) % TIDE_PERIOD_HOURS
        h_rad = 2.0 * math.pi * (h_cycle / TIDE_PERIOD_HOURS)
        h_height = round(mean_level + (actual_range / 2.0) * math.cos(h_rad), 2)
        hourly_curve.append({
            "hour_offset": h,
            "time": h_when.strftime("%H:%M"),
            "height_m": h_height,
        })

    return {
        "current_state": state,
        "current_height_m": current_height,
        "tidal_range_m": actual_range,
        "next_high_tide": {
            "time": next_high_dt.strftime("%H:%M"),
            "height_m": round(mean_level + actual_range / 2.0, 2),
        },
        "next_low_tide": {
            "time": next_low_dt.strftime("%H:%M"),
            "height_m": round(max(0.1, mean_level - actual_range / 2.0), 2),
        },
        "hourly_curve": hourly_curve,
        "lunar": lunar,
    }
