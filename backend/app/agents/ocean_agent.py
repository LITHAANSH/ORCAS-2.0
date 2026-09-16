"""Ocean agent — wave height/period, sea state, SST, surface current."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from ..data import demo_store
from ..data.providers.copernicus import copernicus_provider
from ..data.providers.open_meteo import open_meteo_provider
from ..schemas import AgentResult, Location
from .base import live_enabled, measurement, timed


@timed
def run(location: Location, when: datetime) -> AgentResult:
    unavailable = []
    
    if not live_enabled():
        cond = demo_store.conditions(location.name, when)
        wave = cond["wave"]
        period = cond["period"]
        sst = cond["sst"]
        current = cond["current"]
        chl = cond["chl"]
        stamp = when.isoformat(timespec="seconds")
        
        return AgentResult(
            agent="ocean",
            ok=True,
            location=location,
            data={
                "wave_height_m": round(float(wave), 2),
                "wave_period_s": None if period is None else round(float(period), 1),
                "sea_state": demo_store.sea_state(float(wave)),
                "sst_c": None if sst is None else round(float(sst), 1),
                "current_speed_ms": round(float(current), 2),
                "chlorophyll_mg_m3": round(float(chl), 2),
            },
            measurements={
                "wave_height": measurement(round(float(wave), 2), "m", "Wave height", "DEMO", stamp, "DEMO"),
                "wave_period": measurement(None if period is None else round(float(period), 1),
                                           "s", "Wave period", "DEMO", stamp, "DEMO"),
                "sst": measurement(None if sst is None else round(float(sst), 1),
                                   "deg C", "Sea surface temperature", "DEMO", stamp, "DEMO"),
            },
            unavailable=[],
            source="DEMO",
            timestamp=stamp,
            mode="DEMO"
        )
    
    # LIVE mode - call providers
    marine_result = open_meteo_provider.fetch_marine(location.latitude, location.longitude, when)
    current_result = copernicus_provider.fetch_current(location.latitude, location.longitude, when)
    chlorophyll_result = copernicus_provider.fetch_chlorophyll(location.latitude, location.longitude, when)
    
    data: Dict[str, Any] = {}
    sources = []
    modes = []
    
    if marine_result:
        data.update(marine_result.data)
        sources.append(marine_result.metadata.source)
        modes.append(marine_result.metadata.mode)
    else:
        unavailable.append("Wave data unavailable from Open-Meteo")
        
    if current_result:
        data.update(current_result.data)
        sources.append(current_result.metadata.source)
        modes.append(current_result.metadata.mode)
    else:
        unavailable.append("Current data unavailable from Copernicus")
        
    if chlorophyll_result:
        data.update(chlorophyll_result.data)
        sources.append(chlorophyll_result.metadata.source)
        modes.append(chlorophyll_result.metadata.mode)
    else:
        unavailable.append("Chlorophyll data unavailable from Copernicus")
        
    if not data:
        return AgentResult(
            agent="ocean",
            ok=False,
            error="All ocean data providers unavailable",
            mode="UNAVAILABLE"
        )
        
    aggregated_mode = "CACHE" if "CACHE" in modes else "LIVE"
    aggregated_source = ", ".join(dict.fromkeys(sources))
    stamp = when.isoformat(timespec="seconds")
    
    wave = data.get("wave_height_m")
    if wave is not None:
        data["sea_state"] = demo_store.sea_state(float(wave))
        
    return AgentResult(
        agent="ocean",
        ok=True,
        location=location,
        data=data,
        unavailable=unavailable,
        source=aggregated_source,
        mode=aggregated_mode, # type: ignore[arg-type]
        timestamp=stamp
    )
