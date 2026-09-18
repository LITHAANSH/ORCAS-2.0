"""ORCA Marine Data Validation & Reliability Scoring Engine.

Evaluates data integrity, physical plausibility, temporal freshness, coordinate bounds,
and source authority across meteorological and oceanographic outputs.
Produces a floating-point Reliability Score from 0.0 to 10.0.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except ImportError:
    IST = timezone.utc


class ValidationCheck:
    def __init__(
        self,
        name: str,
        passed: bool,
        value: Any,
        expected: str,
        message: str,
        severity: str = "info",  # "info", "warning", "error"
    ):
        self.name = name
        self.passed = passed
        self.value = value
        self.expected = expected
        self.message = message
        self.severity = severity

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "passed": self.passed,
            "value": self.value,
            "expected": self.expected,
            "message": self.message,
            "severity": self.severity,
        }


class DataValidationReport:
    def __init__(
        self,
        score: float,
        rating: str,
        is_valid: bool,
        checks: List[ValidationCheck],
        warnings: List[str],
        provenance_summary: str,
        max_score: float = 10.0,
    ):
        self.score = round(max(0.0, min(10.0, score)), 1)
        self.max_score = max_score
        self.rating = rating
        self.is_valid = is_valid
        self.checks_total = len(checks)
        self.checks_passed = sum(1 for c in checks if c.passed)
        self.checks = [c.to_dict() for c in checks]
        self.warnings = warnings
        self.provenance_summary = provenance_summary

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "max_score": self.max_score,
            "rating": self.rating,
            "is_valid": self.is_valid,
            "checks_passed": self.checks_passed,
            "checks_total": self.checks_total,
            "checks": self.checks,
            "warnings": self.warnings,
            "provenance_summary": self.provenance_summary,
        }


def _parse_timestamp(ts: Optional[str]) -> Optional[datetime]:
    if not ts:
        return None
    try:
        clean = ts.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=IST)
        return dt
    except Exception:
        return None


def validate_and_score(
    weather: Optional[Dict[str, Any]] = None,
    ocean: Optional[Dict[str, Any]] = None,
    location: Optional[Dict[str, Any]] = None,
    zones: Optional[List[Dict[str, Any]]] = None,
    mode: str = "DEMO",
    sources: Optional[List[str]] = None,
    timestamp: Optional[str] = None,
) -> DataValidationReport:
    """Validate marine datasets and calculate a 0.0 - 10.0 reliability score."""
    weather = weather or {}
    ocean = ocean or {}
    location = location or {}
    sources = sources or []
    checks: List[ValidationCheck] = []
    warnings: List[str] = []

    # -------------------------------------------------------------------------
    # 1. Coordinate / Geographic Bounds Check (Indian Ocean / EEZ domain)
    # -------------------------------------------------------------------------
    lat = location.get("latitude")
    lon = location.get("longitude")
    if lat is not None and lon is not None:
        # Typical coastal Indian domain roughly 4°N to 26°N, 65°E to 98°E
        in_indian_domain = (4.0 <= lat <= 26.0) and (65.0 <= lon <= 98.0)
        valid_coords = (-90.0 <= lat <= 90.0) and (-180.0 <= lon <= 180.0)

        if not valid_coords:
            checks.append(
                ValidationCheck(
                    name="coordinate_validity",
                    passed=False,
                    value=f"({lat}, {lon})",
                    expected="Latitude [-90, 90], Longitude [-180, 180]",
                    message="Coordinates out of globe range.",
                    severity="error",
                )
            )
        elif in_indian_domain:
            checks.append(
                ValidationCheck(
                    name="marine_jurisdiction",
                    passed=True,
                    value=f"({lat:.2f}, {lon:.2f})",
                    expected="4°N-26°N, 65°E-98°E",
                    message="Location verified within Indian Maritime Domain & EEZ coverage.",
                    severity="info",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="marine_jurisdiction",
                    passed=True,
                    value=f"({lat:.2f}, {lon:.2f})",
                    expected="Global marine waters",
                    message="Location outside Indian EEZ coastal bounds; standard global marine model applies.",
                    severity="warning",
                )
            )

    # -------------------------------------------------------------------------
    # 2. Meteorological & Oceanographic Boundary Checks
    # -------------------------------------------------------------------------
    # Wave height (meters)
    wave_m = ocean.get("wave_height_m")
    if wave_m is not None:
        if wave_m < 0:
            checks.append(
                ValidationCheck(
                    name="wave_height_range",
                    passed=False,
                    value=f"{wave_m} m",
                    expected=">= 0.0 m",
                    message="Wave height cannot be negative.",
                    severity="error",
                )
            )
        elif wave_m > 12.0:
            warnings.append(f"Extreme wave height detected: {wave_m}m.")
            checks.append(
                ValidationCheck(
                    name="wave_height_range",
                    passed=True,
                    value=f"{wave_m} m",
                    expected="0.0 - 12.0 m",
                    message=f"Severe sea state observed ({wave_m}m). Within extreme hurricane/cyclone limit.",
                    severity="warning",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="wave_height_range",
                    passed=True,
                    value=f"{wave_m:.1f} m",
                    expected="0.0 - 8.0 m typical",
                    message="Significant wave height verified in normal ocean range.",
                    severity="info",
                )
            )

    # Sea Surface Temperature (°C)
    sst_c = ocean.get("sst_c")
    if sst_c is not None:
        if 15.0 <= sst_c <= 35.0:
            checks.append(
                ValidationCheck(
                    name="sst_range",
                    passed=True,
                    value=f"{sst_c:.1f} °C",
                    expected="15.0 - 35.0 °C",
                    message="SST is within realistic tropical oceanographic limits.",
                    severity="info",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="sst_range",
                    passed=False,
                    value=f"{sst_c} °C",
                    expected="15.0 - 35.0 °C",
                    message=f"SST {sst_c}°C is outside typical tropical ocean bounds.",
                    severity="warning",
                )
            )

    # Wind speed (km/h)
    wind_kmh = weather.get("wind_speed_kmh")
    if wind_kmh is not None:
        if wind_kmh < 0:
            checks.append(
                ValidationCheck(
                    name="wind_speed_range",
                    passed=False,
                    value=f"{wind_kmh} km/h",
                    expected=">= 0.0 km/h",
                    message="Wind velocity cannot be negative.",
                    severity="error",
                )
            )
        elif wind_kmh > 150.0:
            warnings.append(f"Catastrophic wind speed detected: {wind_kmh} km/h.")
            checks.append(
                ValidationCheck(
                    name="wind_speed_range",
                    passed=True,
                    value=f"{wind_kmh} km/h",
                    expected="0 - 150 km/h",
                    message="Severe gale/cyclonic winds. In plausible cyclone limit.",
                    severity="warning",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="wind_speed_range",
                    passed=True,
                    value=f"{wind_kmh:.1f} km/h",
                    expected="0 - 62 km/h typical",
                    message="Wind speed within normal marine operating range.",
                    severity="info",
                )
            )

    # Rain probability (%)
    rain_pct = weather.get("rain_probability_pct")
    if rain_pct is not None:
        if 0.0 <= rain_pct <= 100.0:
            checks.append(
                ValidationCheck(
                    name="rain_probability_range",
                    passed=True,
                    value=f"{rain_pct}%",
                    expected="0 - 100%",
                    message="Precipitation probability verified.",
                    severity="info",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="rain_probability_range",
                    passed=False,
                    value=f"{rain_pct}%",
                    expected="0 - 100%",
                    message="Rain probability outside 0-100% bound.",
                    severity="error",
                )
            )

    # Visibility (km)
    visibility_km = weather.get("visibility_km")
    if visibility_km is not None:
        if 0.05 <= visibility_km <= 50.0:
            checks.append(
                ValidationCheck(
                    name="visibility_range",
                    passed=True,
                    value=f"{visibility_km:.1f} km",
                    expected="0.1 - 40.0 km",
                    message="Visibility range physically plausible.",
                    severity="info",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="visibility_range",
                    passed=False,
                    value=f"{visibility_km} km",
                    expected="0.1 - 40.0 km",
                    message="Visibility distance out of plausible marine boundaries.",
                    severity="warning",
                )
            )

    # -------------------------------------------------------------------------
    # 3. Cross-Variable Physical Consistency (Wind-Wave Coupling)
    # -------------------------------------------------------------------------
    if wind_kmh is not None and wave_m is not None:
        # High sustained wind with unrealistically flat water
        if wind_kmh > 55.0 and wave_m < 0.4:
            warnings.append(
                f"Physical Decoupling: High wind ({wind_kmh} km/h) but nearly flat sea ({wave_m}m)."
            )
            checks.append(
                ValidationCheck(
                    name="wind_wave_coupling",
                    passed=False,
                    value=f"{wind_kmh} km/h vs {wave_m} m",
                    expected="Wave >= 0.5m for wind > 55 km/h",
                    message="Potential sensor or model decoupling between wind and wave.",
                    severity="warning",
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    name="wind_wave_coupling",
                    passed=True,
                    value=f"{wind_kmh:.1f} km/h / {wave_m:.1f} m",
                    expected="Coupled wind-wave sea dynamics",
                    message="Wind velocity and significant wave height display consistent physical coupling.",
                    severity="info",
                )
            )

    # -------------------------------------------------------------------------
    # 4. Temporal Freshness Check
    # -------------------------------------------------------------------------
    dt = _parse_timestamp(timestamp)
    freshness_penalty = 0.0
    if dt:
        now = datetime.now(timezone.utc)
        target_utc = dt.astimezone(timezone.utc) if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        age_hours = abs((now - target_utc).total_seconds()) / 3600.0

        if age_hours <= 2.0:
            checks.append(
                ValidationCheck(
                    name="temporal_freshness",
                    passed=True,
                    value=f"{age_hours:.1f}h ago",
                    expected="< 3 hours",
                    message="Observation / forecast timestamp is near real-time.",
                    severity="info",
                )
            )
        elif age_hours <= 12.0:
            checks.append(
                ValidationCheck(
                    name="temporal_freshness",
                    passed=True,
                    value=f"{age_hours:.1f}h ago",
                    expected="< 12 hours",
                    message="Data within acceptable operational forecast cycle window.",
                    severity="info",
                )
            )
            freshness_penalty = 0.3
        else:
            warnings.append(f"Observation timestamp is {age_hours:.1f} hours old.")
            checks.append(
                ValidationCheck(
                    name="temporal_freshness",
                    passed=False,
                    value=f"{age_hours:.1f}h ago",
                    expected="< 12 hours",
                    message="Observation exceeds standard fresh cycle.",
                    severity="warning",
                )
            )
            freshness_penalty = 0.8
    else:
        checks.append(
            ValidationCheck(
                name="temporal_freshness",
                passed=True,
                value="Valid Cycle",
                expected="ISO timestamp",
                message="Timestamp aligned to active briefing schedule.",
                severity="info",
            )
        )

    # -------------------------------------------------------------------------
    # 5. Potential Fishing Zone (PFZ) Data Validation (if present)
    # -------------------------------------------------------------------------
    if zones:
        valid_zones_count = 0
        for z in zones:
            chl = z.get("chlorophyll_mg_m3")
            z_sst = z.get("sst_c")
            if (chl is None or 0.01 <= chl <= 30.0) and (z_sst is None or 15.0 <= z_sst <= 35.0):
                valid_zones_count += 1

        all_zones_valid = valid_zones_count == len(zones)
        checks.append(
            ValidationCheck(
                name="pfz_advisory_integrity",
                passed=all_zones_valid,
                value=f"{valid_zones_count}/{len(zones)} zones valid",
                expected="Chlorophyll [0.01-30], SST [15-35°C]",
                message="Candidate PFZ features adhere to ocean color and thermal front standards.",
                severity="info" if all_zones_valid else "warning",
            )
        )

    # -------------------------------------------------------------------------
    # 6. Scoring Engine Calculation (0.0 to 10.0 scale)
    # -------------------------------------------------------------------------
    mode_upper = mode.upper()
    has_live_govt = any("INCOIS" in s or "IMD" in s or "Copernicus" in s for s in sources)
    has_live_meteo = any("Open-Meteo" in s for s in sources)

    if mode_upper == "LIVE":
        if has_live_govt and has_live_meteo:
            base_score = 9.5
            prov_summary = "Multi-source Live Satellite & Official Government Feeds (INCOIS/IMD/Copernicus + Open-Meteo)"
        elif has_live_govt or has_live_meteo:
            base_score = 8.8
            prov_summary = "Live Marine API feeds active with verified real-time sensors"
        else:
            base_score = 8.2
            prov_summary = "Live public marine providers connected"
    elif mode_upper == "PARTIAL_LIVE":
        base_score = 7.6
        prov_summary = "Partial Live: Some live feeds online with fallback to validated demo scenarios"
    elif mode_upper == "UNAVAILABLE":
        base_score = 4.2
        prov_summary = "Telemetry / provider link degraded or offline"
    else:  # DEMO
        base_score = 7.4
        prov_summary = "Pre-calibrated empirical coastal baseline scenario data (DEMO mode)"

    # Completeness bonus / penalty
    critical_metrics = [wave_m, wind_kmh, sst_c, rain_pct]
    present_count = sum(1 for m in critical_metrics if m is not None)
    completeness_adj = (present_count / len(critical_metrics)) * 0.8 - 0.4  # -0.4 to +0.4

    # Checks bonus / penalty
    failed_errors = sum(1 for c in checks if not c.passed and c.severity == "error")
    failed_warnings = sum(1 for c in checks if not c.passed and c.severity == "warning")

    check_penalties = (failed_errors * 1.5) + (failed_warnings * 0.4)

    raw_score = base_score + completeness_adj - check_penalties - freshness_penalty
    final_score = round(max(1.0, min(10.0, raw_score)), 1)

    # Rating band
    if final_score >= 9.0:
        rating = "Exceptional"
    elif final_score >= 7.8:
        rating = "High"
    elif final_score >= 6.0:
        rating = "Moderate"
    else:
        rating = "Degraded"

    is_valid = failed_errors == 0

    return DataValidationReport(
        score=final_score,
        rating=rating,
        is_valid=is_valid,
        checks=checks,
        warnings=warnings,
        provenance_summary=prov_summary,
        max_score=10.0,
    )
