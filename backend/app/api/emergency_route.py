"""Dedicated boat-to-shore emergency routing."""
from __future__ import annotations

from fastapi import APIRouter

from ..agents import ocean_agent, risk_agent, weather_agent
from ..data.demo_store import now_ist
from ..data.geo import nearest_port
from ..schemas import EmergencyRouteRequest, EmergencyRouteResponse, Location
from ..services.route_optimizer import plan_emergency_route

router = APIRouter(prefix="/api", tags=["emergency-route"])


@router.post("/emergency-route", response_model=EmergencyRouteResponse)
def emergency_route(req: EmergencyRouteRequest) -> EmergencyRouteResponse:
    if not (-90 <= req.latitude <= 90 and -180 <= req.longitude <= 180):
        return EmergencyRouteResponse(available=False, notes="Invalid boat coordinates.")

    port = nearest_port(req.latitude, req.longitude)
    location = Location(name=port["name"], latitude=req.latitude, longitude=req.longitude, state=port["state"])
    now = now_ist()
    weather = weather_agent.run(location, now)
    ocean = ocean_agent.run(location, now)
    risk = risk_agent.run(
        location, now, weather=weather.data, ocean=ocean.data,
        cyclone={}, gis={}, sources=[weather.source, ocean.source], mode=weather.mode,
    ).data
    result = plan_emergency_route(
        (req.latitude, req.longitude),
        wave_m=ocean.data.get("wave_height_m"),
        wind_kmh=weather.data.get("wind_speed_kmh"),
        risk_score=int(risk.get("score", 40)),
        risk_category=risk.get("category", "MODERATE"),
    )
    if not result:
        return EmergencyRouteResponse(available=False, notes="No safe reachable shore destination was found.")
    return EmergencyRouteResponse(available=True, **result)