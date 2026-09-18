"""Emergency message formatting and multi-recipient routing for the ORCA SOS flow.

Integrates TextBee.dev Android SMS Gateway to broadcast distress alerts to:
1. Central Operations Admin (all signals)
2. Nearest Indian Coast Guard collaborator station (resolved dynamically from vessel lat/lon)
3. Optional custom emergency recipient

Ensures exact Lat/Lon and direct Google Maps links are prominently featured.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..schemas import Language
from ..services.coast_guard import find_nearest_coast_guard, list_coast_guard_stations
from ..services.sms import dispatch_distress_sms, get_gateway_status, normalize_phone_number

router = APIRouter(prefix="/api", tags=["sos"])


class SosRisk(BaseModel):
    category: str
    score: int


class SosRoute(BaseModel):
    available: bool = False
    destination: Optional[dict] = None
    distance_km: Optional[float] = None
    eta_minutes: Optional[int] = None
    risk_score: Optional[int] = None
    risk_category: Optional[str] = None


class SosRequest(BaseModel):
    latitude: float
    longitude: float
    risk: SosRisk
    hazards: List[str] = Field(default_factory=list)
    route: Optional[SosRoute] = None
    message: str = "Engine failure. Unable to return to shore."
    language: Language = "en"
    recipient: Optional[str] = None


def _duration(minutes: int) -> str:
    hours, remainder = divmod(minutes, 60)
    return f"{hours}h {remainder}m" if hours else f"{remainder}m"


@router.get("/sos/status")
def sos_status() -> dict:
    """Return status of SMS gateway, admin dispatch lists, and Coast Guard stations."""
    gw_status = get_gateway_status()
    stations = list_coast_guard_stations()
    return {
        "ok": True,
        "gateway": gw_status,
        "stations_count": len(stations),
        "stations": stations,
    }


@router.post("/sos")
def send_sos(req: SosRequest) -> dict:
    """Create and dispatch emergency distress alert via TextBee SMS Gateway."""
    # 1. Resolve Nearest Coast Guard collaborator station
    nearest_cg = find_nearest_coast_guard(req.latitude, req.longitude)

    # 2. Localized labels
    labels = {
        "en": {
            "title": "🚨 ORCA SOS DISTRESS ALERT 🚨",
            "vessel_loc": "VESSEL IN DISTRESS",
            "gmaps": "Google Maps",
            "cg_responder": "ASSIGNED COAST GUARD RESPONDER",
            "station": "Station",
            "distance": "Distance",
            "risk_title": "CURRENT RISK",
            "hazards_title": "ACTIVE HAZARDS",
            "route_title": "SAFEST ROUTE TO LAND",
            "destination": "Destination",
            "eta": "ETA",
            "route_risk": "Route Risk",
            "unavailable": "Safe return route unavailable from current position.",
            "message_title": "EMERGENCY MESSAGE",
            "dispatch_notice": "RECIPIENTS NOTIFIED: Central Admin Command + Coast Guard First Responder",
            "none": "None reported",
        },
        "hi": {
            "title": "🚨 ORCA SOS आपातकालीन संकट चेतावनी 🚨",
            "vessel_loc": "संकट में नाव का स्थान",
            "gmaps": "गूगल मैप्स",
            "cg_responder": "नियुक्त तटरक्षक बल (Coast Guard)",
            "station": "स्टेशन",
            "distance": "दूरी",
            "risk_title": "वर्तमान जोखिम",
            "hazards_title": "सक्रिय खतरे",
            "route_title": "भूमि तक सबसे सुरक्षित मार्ग",
            "destination": "गंतव्य",
            "eta": "अनुमानित समय",
            "route_risk": "मार्ग जोखिम",
            "unavailable": "सुरक्षित वापसी मार्ग उपलब्ध नहीं है।",
            "message_title": "आपातकालीन संदेश",
            "dispatch_notice": "प्राप्तकर्ता: केंद्रीय व्यवस्थापक + निकटतम तटरक्षक बल",
            "none": "कोई नहीं",
        },
        "kn": {
            "title": "🚨 ORCA SOS ತುರ್ತು ಆಪತ್ತು ಎಚ್ಚರಿಕೆ 🚨",
            "vessel_loc": "ಆಪತ್ತಿನಲ್ಲಿರುವ ದೋಣಿಯ ಸ್ಥಳ",
            "gmaps": "ಗೂಗಲ್ ನಕ್ಷೆಗಳು",
            "cg_responder": "ನಿಯೋಜಿತ ಕೋಸ್ಟ್ ಗಾರ್ಡ್ ಪ್ರತಿಸ್ಪಂದಕ",
            "station": "ನಿಲ್ದಾಣ",
            "distance": "ದೂರ",
            "risk_title": "ಪ್ರಸ್ತುತ ಅಪಾಯ",
            "hazards_title": "ಸಕ್ರಿಯ ಅಪಾಯಗಳು",
            "route_title": "ಭೂಮಿಗೆ ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ",
            "destination": "ಗಮ್ಯಸ್ಥಾನ",
            "eta": "ಅಂದಾಜು ಸಮಯ",
            "route_risk": "ಮಾರ್ಗದ ಅಪಾಯ",
            "unavailable": "ಸುರಕ್ಷಿತ ಹಿಂದಿರುಗುವ ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ.",
            "message_title": "ತುರ್ತು ಸಂದೇಶ",
            "dispatch_notice": "ಸ್ವೀಕರಿಸುವವರು: ಕೇಂದ್ರ ನಿರ್ವಾಹಕರು + ಸಮೀಪದ ಕೋಸ್ಟ್ ಗಾರ್ಡ್",
            "none": "ಯಾವುದೂ ಇಲ್ಲ",
        },
    }.get(req.language, {})
    labels = labels or {
        "title": "🚨 ORCA SOS DISTRESS ALERT 🚨",
        "vessel_loc": "VESSEL IN DISTRESS",
        "gmaps": "Google Maps",
        "cg_responder": "ASSIGNED COAST GUARD RESPONDER",
        "station": "Station",
        "distance": "Distance",
        "risk_title": "CURRENT RISK",
        "hazards_title": "ACTIVE HAZARDS",
        "route_title": "SAFEST ROUTE TO LAND",
        "destination": "Destination",
        "eta": "ETA",
        "route_risk": "Route Risk",
        "unavailable": "Safe return route unavailable from current position.",
        "message_title": "EMERGENCY MESSAGE",
        "dispatch_notice": "RECIPIENTS NOTIFIED: Central Admin Command + Coast Guard First Responder",
        "none": "None reported",
    }

    gmaps_url = f"https://maps.google.com/?q={req.latitude:.6f},{req.longitude:.6f}"

    # 3. Construct the comprehensive, high-priority emergency distress SMS
    lines = [
        labels["title"],
        "",
        labels["vessel_loc"] + ":",
        f"Lat: {req.latitude:.6f}° N",
        f"Lon: {req.longitude:.6f}° E",
        f"{labels['gmaps']}: {gmaps_url}",
        "",
        labels["cg_responder"] + ":",
        f"{labels['station']}: {nearest_cg['name']}",
        f"{labels['distance']}: {nearest_cg['distance_km']} km offshore ({nearest_cg['region']})",
        "",
        labels["risk_title"] + ":",
        f"{req.risk.category} ({req.risk.score}/100)",
        "",
        labels["hazards_title"] + ":",
    ]
    lines.extend(f"- {hazard}" for hazard in req.hazards or [labels["none"]])

    lines.extend(["", labels["route_title"] + ":"])
    if req.route and req.route.available:
        destination = req.route.destination or {}
        lines.extend([
            f"{labels['destination']}: {destination.get('name', 'Safe Shore')}",
            f"{labels['distance']}: {req.route.distance_km:g} km" if req.route.distance_km is not None else f"{labels['distance']}: unavailable",
            f"{labels['eta']}: {_duration(req.route.eta_minutes)}" if req.route.eta_minutes is not None else f"{labels['eta']}: unavailable",
            f"{labels['route_risk']}: {req.route.risk_category} ({req.route.risk_score})",
        ])
    else:
        lines.append(labels["unavailable"])

    lines.extend([
        "",
        labels["message_title"] + ":",
        req.message.strip(),
        "",
        labels["dispatch_notice"],
    ])

    sms_body = "\n".join(lines)

    # 4. Dispatch through SMS Gateway service (Admin + Nearest Coast Guard + Custom)
    dispatch_result = dispatch_distress_sms(
        lat=req.latitude,
        lon=req.longitude,
        body=sms_body,
        custom_recipient=req.recipient,
    )

    return {
        "ok": True,
        "message": dispatch_result["message"],
        "delivered": dispatch_result["delivered"],
        "provider": dispatch_result["provider"],
        "provider_id": dispatch_result["provider_id"],
        "recipients": dispatch_result["recipients"],
        "latitude": req.latitude,
        "longitude": req.longitude,
        "google_maps_url": gmaps_url,
        "nearest_coast_guard": nearest_cg,
        "sms": sms_body,
    }