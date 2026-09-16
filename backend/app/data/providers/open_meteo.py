import threading
import time
from datetime import datetime
from typing import Dict, Optional, Tuple

import httpx

from ...config import LIVE_TIMEOUT_SECONDS
from ...schemas import ProviderMetadata, ProviderResponse
from . import BaseProvider

class OpenMeteoProvider(BaseProvider):
    """Weather and marine data from Open-Meteo APIs."""

    MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
    CACHE_TTL_OK = 600.0
    CACHE_TTL_FAIL = 60.0
    CACHE_MAX_ENTRIES = 256

    def __init__(self):
        self._cache: Dict[Tuple[str, float, float], Tuple[float, Optional[Dict]]] = {}
        self._lock = threading.Lock()
        self._client: Optional[httpx.Client] = None

    def _http(self) -> httpx.Client:
        if self._client is None:
            with self._lock:
                if self._client is None:
                    self._client = httpx.Client(timeout=LIVE_TIMEOUT_SECONDS)
        return self._client

    def _series(self, kind: str, url: str, hourly_fields: str, lat: float, lon: float,
                extra: Optional[Dict] = None) -> Optional[Dict]:
        key = (kind, round(lat, 2), round(lon, 2))
        now = time.monotonic()
        with self._lock:
            hit = self._cache.get(key)
            if hit and hit[0] > now:
                return hit[1]

        data: Optional[Dict] = None
        try:
            r = self._http().get(
                url,
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "hourly": hourly_fields,
                    "forecast_days": 3,
                    "timezone": "Asia/Kolkata",
                    **(extra or {}),
                },
            )
            r.raise_for_status()
            hourly = r.json().get("hourly") or {}
            if hourly.get("time"):
                data = hourly
        except httpx.TimeoutException:
            print(f"[ORCA][LIVE][{kind.upper()}] Open-Meteo TIMEOUT")
            data = None
        except httpx.HTTPStatusError as e:
            print(f"[ORCA][LIVE][{kind.upper()}] Open-Meteo HTTP {e.response.status_code}")
            data = None
        except Exception as e:
            print(f"[ORCA][LIVE][{kind.upper()}] Open-Meteo ERROR: {e}")
            data = None

        with self._lock:
            if len(self._cache) >= self.CACHE_MAX_ENTRIES:
                expired = [k for k, (exp, _) in self._cache.items() if exp <= now]
                for k in expired or [next(iter(self._cache))]:
                    self._cache.pop(k, None)
            self._cache[key] = (now + (self.CACHE_TTL_OK if data else self.CACHE_TTL_FAIL), data)
        return data

    def _pick_hour_index(self, times: list, target: datetime) -> int:
        stamp = target.strftime("%Y-%m-%dT%H:00")
        if stamp in times:
            return times.index(stamp)
        hour_suffix = target.strftime("T%H:00")
        for i, t in enumerate(times):
            if t.endswith(hour_suffix):
                return i
        return 0

    def fetch_marine(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        h = self._series("marine", self.MARINE_URL,
                         "wave_height,wave_period,sea_surface_temperature", lat, lon)
        if not h:
            return None
        times = h.get("time") or []
        i = self._pick_hour_index(times, when)

        def at(key: str):
            series = h.get(key) or []
            return series[i] if i < len(series) else None

        valid_time = times[i] if times else when.isoformat()
        return ProviderResponse(
            data={
                "wave_height_m": at("wave_height"),
                "wave_period_s": at("wave_period"),
                "sst_c": at("sea_surface_temperature"),
            },
            metadata=ProviderMetadata(
                source="Open-Meteo Marine",
                valid_time=valid_time,
                mode="LIVE"
            ),
            timestamp=datetime.now().isoformat()
        )

    def fetch_weather(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        h = self._series("forecast", self.FORECAST_URL,
                         ("temperature_2m,wind_speed_10m,wind_direction_10m,"
                          "precipitation_probability,visibility"),
                         lat, lon, extra={"wind_speed_unit": "kmh"})
        if not h:
            return None
        times = h.get("time") or []
        i = self._pick_hour_index(times, when)

        def at(key: str):
            series = h.get(key) or []
            return series[i] if i < len(series) else None

        visibility_m = at("visibility")
        valid_time = times[i] if times else when.isoformat()
        return ProviderResponse(
            data={
                "temperature_c": at("temperature_2m"),
                "wind_speed_kmh": at("wind_speed_10m"),
                "wind_direction_deg": at("wind_direction_10m"),
                "rain_probability_pct": at("precipitation_probability"),
                "visibility_km": round(visibility_m / 1000.0, 1) if visibility_m is not None else None,
            },
            metadata=ProviderMetadata(
                source="Open-Meteo",
                valid_time=valid_time,
                mode="LIVE"
            ),
            timestamp=datetime.now().isoformat()
        )

    def fetch(self, lat: float, lon: float, when: datetime) -> Optional[ProviderResponse]:
        return self.fetch_weather(lat, lon, when)

open_meteo_provider = OpenMeteoProvider()
