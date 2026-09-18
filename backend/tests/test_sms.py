"""Unit tests for TextBee SMS Gateway, Nearest Coast Guard Routing, and Emergency SOS Formatting."""
from __future__ import annotations

import os
from unittest.mock import MagicMock, patch
import pytest

from app.services.coast_guard import find_nearest_coast_guard, list_coast_guard_stations
from app.services.sms import (
    dispatch_distress_sms,
    get_admin_recipients,
    get_gateway_status,
    normalize_phone_number,
    send_via_textbee,
)
from app.api.sos import SosRequest, SosRisk, SosRoute, send_sos


def test_phone_number_normalization():
    assert normalize_phone_number("9876543210") == "+919876543210"
    assert normalize_phone_number("+919876543210") == "+919876543210"
    assert normalize_phone_number("919876543210") == "+919876543210"
    assert normalize_phone_number("  98765 43210 ") == "+919876543210"


def test_find_nearest_coast_guard():
    # Mumbai offshore coordinates
    mumbai_cg = find_nearest_coast_guard(18.95, 72.80)
    assert mumbai_cg["code"] == "ICG-MUMBAI"
    assert "Mumbai" in mumbai_cg["name"]
    assert mumbai_cg["distance_km"] < 25.0

    # Goa offshore coordinates
    goa_cg = find_nearest_coast_guard(15.50, 73.80)
    assert goa_cg["code"] == "ICG-GOA"
    assert "Goa" in goa_cg["name"]

    # Kochi offshore coordinates
    kochi_cg = find_nearest_coast_guard(9.90, 76.20)
    assert kochi_cg["code"] == "ICG-KOCHI"
    assert "Kochi" in kochi_cg["name"]

    # Paradip offshore coordinates
    paradip_cg = find_nearest_coast_guard(20.30, 86.70)
    assert paradip_cg["code"] == "ICG-PARADIP"
    assert "Paradip" in paradip_cg["name"]


def test_list_coast_guard_stations():
    stations = list_coast_guard_stations()
    assert len(stations) >= 10
    codes = [s["code"] for s in stations]
    assert "ICG-MUMBAI" in codes
    assert "ICG-GOA" in codes
    assert "ICG-KOCHI" in codes
    assert "ICG-CHENNAI" in codes


def test_sos_message_content_and_gmaps():
    req = SosRequest(
        latitude=18.922000,
        longitude=72.834700,
        risk=SosRisk(category="HIGH", score=75),
        hazards=["High Swell (2.8m)", "Squall Warning"],
        message="Vessel rudder jammed. Request immediate towing.",
        language="en",
    )
    result = send_sos(req)
    assert result["ok"] is True
    assert result["latitude"] == 18.922000
    assert result["longitude"] == 72.834700

    # Verify Google Maps link
    expected_maps = "https://maps.google.com/?q=18.922000,72.834700"
    assert result["google_maps_url"] == expected_maps
    assert expected_maps in result["sms"]

    # Verify coordinates in SMS body
    assert "Lat: 18.922000° N" in result["sms"]
    assert "Lon: 72.834700° E" in result["sms"]

    # Verify nearest Coast Guard responder is highlighted
    assert "Indian Coast Guard Station Mumbai" in result["sms"]
    assert result["nearest_coast_guard"]["code"] == "ICG-MUMBAI"

    # Verify recipients contain both Admin and Coast Guard
    dispatched = result["recipients"]["all_dispatched"]
    assert len(dispatched) >= 2


def test_textbee_request_formatting():
    with patch("httpx.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.is_success = True
        mock_resp.content = b'{"id": "msg-textbee-12345"}'
        mock_resp.json.return_value = {"id": "msg-textbee-12345"}
        mock_post.return_value = mock_resp

        with patch.dict(os.environ, {
            "TEXTBEE_API_KEY": "test-key-abc",
            "TEXTBEE_DEVICE_ID": "device-xyz"
        }):
            recipients = ["+919876543210", "+919339698196"]
            msg = "Test SOS message"
            ok, status, provider_id = send_via_textbee(recipients, msg)

            assert ok is True
            assert provider_id == "msg-textbee-12345"
            assert "dispatched via textbee" in status.lower()

            mock_post.assert_called_once()
            call_kwargs = mock_post.call_args.kwargs
            assert call_kwargs["headers"]["x-api-key"] == "test-key-abc"
            assert call_kwargs["json"]["recipients"] == recipients
            assert call_kwargs["json"]["message"] == msg
            assert call_kwargs["json"]["deviceId"] == "device-xyz"


def test_dispatch_simulation_mode():
    with patch.dict(os.environ, {"TEXTBEE_API_KEY": "", "ORCA_SMS_ACCOUNT_SID": ""}):
        result = dispatch_distress_sms(15.49, 73.82, "Simulated test alert")
        assert result["ok"] is True
        assert result["delivered"] is True
        assert "Simulated" in result["provider"]
        assert "TB-SIM-" in result["provider_id"]
        assert result["recipients"]["nearest_coast_guard"]["code"] == "ICG-GOA"
