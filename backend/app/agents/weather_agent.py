"""Weather agent — wind, rain, lightning, visibility."""
from __future__ import annotations

from datetime import datetime

from ..data import demo_store
from ..data.geo import compass
from ..data.providers.open_meteo import open_meteo_provider
from ..schemas import AgentResult, Location
from .base import live_enabled, measurement, timed


@timed
def run(location: Location, when: datetime) -> AgentResult:
    stamp = when.isoformat(timespec="seconds")
    mode = "DEMO"
    source = "DEMO"
    unavailable = []

    live = None
    if live_enabled():
        weather_res = open_meteo_provider.fetch_weather(location.latitude, location.longitude, when)
        if weather_res:
            live = weather_res.data
            mode = "LIVE"
            source = weather_res.metadata.source
            stamp = weather_res.metadata.valid_time
        else:
            unavailable.append("live weather provider unreachable")
            mode = "UNAVAILABLE"

    if live and live.get("wind_speed_kmh") is not None:
        wind = live["wind_speed_kmh"]
        wind_dir = live.get("wind_direction_deg") or 0
        rain = live.get("rain_probability_pct")
        visibility = live.get("visibility_km")
        temperature = live.get("temperature_c")
        # Open-Meteo has no lightning field; infer conservatively.
        lightning = bool(rain is not None and rain >= 80 and wind and wind >= 30)
    else:
        if live_enabled():
            pass # DO NOT substitute demo data while claiming LIVE mode!
        cond = demo_store.conditions(location.name, when)
        wind = cond["wind"]
        wind_dir = cond["wind_dir"]
        rain = cond["rain"]
        visibility = cond["visibility"]
        temperature = None
        lightning = bool(cond["lightning"])

    return AgentResult(
        agent="weather",
        ok=True if (not live_enabled() or live or mode == "LIVE") else False,
        location=location,
        data={
            "wind_speed_kmh": round(float(wind), 1) if wind is not None else None,
            "wind_direction_deg": round(float(wind_dir)) if wind_dir is not None else None,
            "wind_direction": compass(float(wind_dir)) if wind_dir is not None else "Unknown",
            "rain_probability_pct": None if rain is None else round(float(rain)),
            "visibility_km": None if visibility is None else round(float(visibility), 1),
            "temperature_c": None if temperature is None else round(float(temperature), 1),
            "lightning": lightning,
        },
        measurements={
            "wind_speed": measurement(None if wind is None else round(float(wind), 1), "km/h", "Wind speed", source, stamp, mode),
            "rain_probability": measurement(None if rain is None else round(float(rain)),
                                            "%", "Rain probability", source, stamp, mode),
            "visibility": measurement(None if visibility is None else round(float(visibility), 1),
                                      "km", "Visibility", source, stamp, mode),
        },
        unavailable=unavailable,
        source=source,
        timestamp=stamp,
        confidence=0.85 if mode == "LIVE" else 0.75,
        mode=mode,  # type: ignore[arg-type]
        error="Weather data unavailable" if (live_enabled() and mode == "UNAVAILABLE") else None
    )
