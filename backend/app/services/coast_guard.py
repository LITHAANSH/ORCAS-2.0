"""Indian Coast Guard (ICG) collaborator registry and nearest-station routing.

Maps coastal regions, district headquarters (DHQ), and stations to geospatial
coordinates, jurisdiction details, and contact numbers. When an emergency distress
signal is transmitted from a vessel, the system dynamically identifies the nearest
Coast Guard collaborator station using geodesic haversine proximity.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

from ..data.geo import haversine_km

# Default / fallback Indian Coast Guard emergency contact
DEFAULT_CG_PHONE = os.getenv("ORCA_COAST_GUARD_DEFAULT_PHONE", "+919339698196")

# Registry of Indian Coast Guard District Headquarters (DHQ) & Stations
COAST_GUARD_STATIONS: List[Dict] = [
    {
        "code": "ICG-MUMBAI",
        "name": "Indian Coast Guard Station Mumbai (DHQ-2)",
        "region": "RHQ (West)",
        "state": "Maharashtra",
        "lat": 18.9220,
        "lon": 72.8347,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_MUMBAI_PHONE",
    },
    {
        "code": "ICG-GOA",
        "name": "Indian Coast Guard Station Goa (DHQ-11)",
        "region": "RHQ (West)",
        "state": "Goa",
        "lat": 15.4909,
        "lon": 73.8278,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_GOA_PHONE",
    },
    {
        "code": "ICG-RATNAGIRI",
        "name": "Indian Coast Guard Station Ratnagiri",
        "region": "RHQ (West)",
        "state": "Maharashtra",
        "lat": 16.9902,
        "lon": 73.3120,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_RATNAGIRI_PHONE",
    },
    {
        "code": "ICG-VERAVAL",
        "name": "Indian Coast Guard Station Veraval",
        "region": "RHQ (North-West)",
        "state": "Gujarat",
        "lat": 20.9070,
        "lon": 70.3679,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_VERAVAL_PHONE",
    },
    {
        "code": "ICG-MANGALORE",
        "name": "Indian Coast Guard Station Mangalore (DHQ-3)",
        "region": "RHQ (West)",
        "state": "Karnataka",
        "lat": 12.9141,
        "lon": 74.8560,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_MANGALORE_PHONE",
    },
    {
        "code": "ICG-KOCHI",
        "name": "Indian Coast Guard Station Kochi (DHQ-4)",
        "region": "RHQ (West)",
        "state": "Kerala",
        "lat": 9.9312,
        "lon": 76.2673,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_KOCHI_PHONE",
    },
    {
        "code": "ICG-CHENNAI",
        "name": "Indian Coast Guard Station Chennai (DHQ-5)",
        "region": "RHQ (East)",
        "state": "Tamil Nadu",
        "lat": 13.0827,
        "lon": 80.2707,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_CHENNAI_PHONE",
    },
    {
        "code": "ICG-VIZAG",
        "name": "Indian Coast Guard Station Visakhapatnam (DHQ-6)",
        "region": "RHQ (East)",
        "state": "Andhra Pradesh",
        "lat": 17.6868,
        "lon": 83.2185,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_VIZAG_PHONE",
    },
    {
        "code": "ICG-PARADIP",
        "name": "Indian Coast Guard Station Paradip (DHQ-7)",
        "region": "RHQ (North-East)",
        "state": "Odisha",
        "lat": 20.2648,
        "lon": 86.6947,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_PARADIP_PHONE",
    },
    {
        "code": "ICG-HALDIA",
        "name": "Indian Coast Guard Station Haldia / Digha (DHQ-8)",
        "region": "RHQ (North-East)",
        "state": "West Bengal",
        "lat": 21.6270,
        "lon": 87.5090,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_HALDIA_PHONE",
    },
    {
        "code": "ICG-PORTBLAIR",
        "name": "Indian Coast Guard Station Port Blair (DHQ-9)",
        "region": "RHQ (A&N)",
        "state": "Andaman & Nicobar",
        "lat": 11.6234,
        "lon": 92.7265,
        "default_phone": "+919339698196",
        "env_var": "ORCA_CG_PORTBLAIR_PHONE",
    },
]


def get_station_phone(station: Dict) -> str:
    """Get the active phone number for a Coast Guard station, checking env overrides."""
    env_name = station.get("env_var")
    if env_name and os.getenv(env_name, "").strip():
        return os.getenv(env_name, "").strip()
    default_cg = os.getenv("ORCA_COAST_GUARD_DEFAULT_PHONE", "").strip()
    if default_cg:
        return default_cg
    return station.get("default_phone", DEFAULT_CG_PHONE)


def find_nearest_coast_guard(lat: float, lon: float) -> Dict:
    """Find the nearest Indian Coast Guard station to vessel coordinates."""
    scored: List[Tuple[float, Dict]] = []
    for station in COAST_GUARD_STATIONS:
        dist = haversine_km((lat, lon), (station["lat"], station["lon"]))
        scored.append((dist, station))

    scored.sort(key=lambda item: item[0])
    closest_dist, closest_station = scored[0]

    phone = get_station_phone(closest_station)

    return {
        "code": closest_station["code"],
        "name": closest_station["name"],
        "region": closest_station["region"],
        "state": closest_station["state"],
        "distance_km": round(closest_dist, 1),
        "phone": phone,
        "station_lat": closest_station["lat"],
        "station_lon": closest_station["lon"],
    }


def list_coast_guard_stations() -> List[Dict]:
    """List all registered Coast Guard stations with active contact numbers."""
    return [
        {
            "code": s["code"],
            "name": s["name"],
            "region": s["region"],
            "state": s["state"],
            "lat": s["lat"],
            "lon": s["lon"],
            "phone": get_station_phone(s),
        }
        for s in COAST_GUARD_STATIONS
    ]
