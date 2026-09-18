"""SMS Gateway Service for ORCA SOS Distress Transmissions.

Integrates the TextBee.dev Android SMS Gateway as primary delivery channel,
with automatic Admin broadcast, nearest Coast Guard collaborator routing,
Twilio fallback, and truthful offline/demo simulation.
"""
from __future__ import annotations

import os
import uuid
from typing import Dict, List, Optional, Tuple

import httpx

from .coast_guard import find_nearest_coast_guard

TEXTBEE_GATEWAY_URL = os.getenv(
    "TEXTBEE_GATEWAY_URL", "https://api.textbee.dev/api/v1/gateway/send-sms"
)


def normalize_phone_number(value: str) -> str:
    """Normalize phone numbers into international E.164 format.

    Indian 10-digit mobile numbers are automatically prefixed with +91.
    """
    clean = value.strip()
    if not clean:
        return ""
    digits = "".join(ch for ch in clean if ch.isdigit())
    if len(digits) == 10:
        return f"+91{digits}"
    if len(digits) == 12 and digits.startswith("91"):
        return f"+{digits}"
    return f"+{digits}" if digits else clean


def get_admin_recipients() -> List[str]:
    """Get the list of Central Admin / Operations Command recipients."""
    raw = (
        os.getenv("ORCA_ADMIN_PHONES")
        or os.getenv("ORCA_ADMIN_PHONE")
        or os.getenv("ORCA_SMS_TO")
        or "9876543210"
    )
    phones = []
    for item in raw.split(","):
        norm = normalize_phone_number(item)
        if norm and norm not in phones:
            phones.append(norm)
    return phones or ["+919876543210"]


def get_active_provider_name() -> str:
    """Detect which provider is configured."""
    textbee_key = (
        os.getenv("TEXTBEE_API_KEY", "").strip()
        or os.getenv("ORCA_TEXTBEE_API_KEY", "").strip()
    )
    if textbee_key:
        return "TextBee Gateway"

    twilio_sid = os.getenv("ORCA_SMS_ACCOUNT_SID", "").strip()
    twilio_token = os.getenv("ORCA_SMS_AUTH_TOKEN", "").strip()
    twilio_from = os.getenv("ORCA_SMS_FROM", "").strip()
    if all((twilio_sid, twilio_token, twilio_from)):
        return "Twilio"

    return "Simulated (TextBee Demo Mode)"


def send_via_textbee(
    recipients: List[str], message: str
) -> Tuple[bool, str, Optional[str]]:
    """Send SMS via TextBee.dev Android Gateway."""
    api_key = (
        os.getenv("TEXTBEE_API_KEY", "").strip()
        or os.getenv("ORCA_TEXTBEE_API_KEY", "").strip()
    )
    device_id = (
        os.getenv("TEXTBEE_DEVICE_ID", "").strip()
        or os.getenv("ORCA_TEXTBEE_DEVICE_ID", "").strip()
    )

    if not api_key:
        return False, "TextBee API key is not configured.", None

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json",
    }
    payload: Dict = {
        "recipients": recipients,
        "message": message,
    }
    if device_id:
        payload["deviceId"] = device_id

    try:
        response = httpx.post(
            TEXTBEE_GATEWAY_URL,
            json=payload,
            headers=headers,
            timeout=12.0,
        )
        if response.is_success:
            data = response.json() if response.content else {}
            provider_id = (
                data.get("id")
                or data.get("batchId")
                or data.get("smsBatchId")
                or f"tb-{uuid.uuid4().hex[:8]}"
            )
            return True, f"Emergency SMS dispatched via TextBee to {len(recipients)} recipient(s).", str(provider_id)

        error_msg = f"TextBee gateway returned status {response.status_code}"
        try:
            err_data = response.json()
            if "message" in err_data:
                error_msg += f": {err_data['message']}"
        except Exception:
            pass
        return False, error_msg, None

    except httpx.TimeoutException:
        return False, "TextBee gateway timed out. Please verify device connectivity.", None
    except httpx.HTTPError as exc:
        return False, f"TextBee connection error: {exc}", None


def send_via_twilio(
    recipients: List[str], message: str
) -> Tuple[bool, str, Optional[str]]:
    """Fallback delivery through Twilio."""
    account_sid = os.getenv("ORCA_SMS_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("ORCA_SMS_AUTH_TOKEN", "").strip()
    sender = os.getenv("ORCA_SMS_FROM", "").strip()
    if not all((account_sid, auth_token, sender)):
        return False, "Twilio provider is not configured.", None

    endpoint = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    last_sid = None
    sent_count = 0

    try:
        for to_num in recipients:
            response = httpx.post(
                endpoint,
                data={"From": sender, "To": to_num, "Body": message},
                auth=(account_sid, auth_token),
                timeout=10.0,
            )
            if response.is_success:
                sent_count += 1
                last_sid = response.json().get("sid")

        if sent_count > 0:
            return True, f"Emergency SMS sent via Twilio to {sent_count} recipient(s).", last_sid
        return False, "Twilio rejected all recipient messages.", None
    except httpx.HTTPError:
        return False, "Twilio service could not be reached.", None


def dispatch_distress_sms(
    lat: float,
    lon: float,
    body: str,
    custom_recipient: Optional[str] = None,
) -> Dict:
    """Route and dispatch the emergency distress message.

    Resolves:
    1. Admin phone(s) (always notified)
    2. Nearest Coast Guard collaborator station (nearest to lat, lon)
    3. Any custom recipient provided in the request
    """
    nearest_cg = find_nearest_coast_guard(lat, lon)
    admins = get_admin_recipients()

    all_recipients: List[str] = []
    for num in admins:
        if num and num not in all_recipients:
            all_recipients.append(num)

    cg_phone = normalize_phone_number(nearest_cg.get("phone", ""))
    if cg_phone and cg_phone not in all_recipients:
        all_recipients.append(cg_phone)

    if custom_recipient:
        custom_norm = normalize_phone_number(custom_recipient)
        if custom_norm and custom_norm not in all_recipients:
            all_recipients.append(custom_norm)

    active_provider = get_active_provider_name()
    delivered = False
    provider_id = None
    status_message = ""

    if active_provider == "TextBee Gateway":
        delivered, status_message, provider_id = send_via_textbee(all_recipients, body)
        if not delivered and os.getenv("ORCA_SMS_ACCOUNT_SID"):
            # Secondary fallback to Twilio if TextBee failed
            fallback_ok, fallback_msg, fallback_id = send_via_twilio(all_recipients, body)
            if fallback_ok:
                delivered = True
                status_message = f"TextBee failed ({status_message}); fallback delivered via Twilio."
                provider_id = fallback_id
                active_provider = "Twilio (Fallback)"

    elif active_provider == "Twilio":
        delivered, status_message, provider_id = send_via_twilio(all_recipients, body)

    else:
        # Simulated demo delivery
        sim_id = f"TB-SIM-{uuid.uuid4().hex[:8].upper()}"
        delivered = True
        status_message = (
            f"[DEMO SIMULATION] Emergency distress SMS routed to {len(all_recipients)} recipient(s): "
            f"Admin ({', '.join(admins)}) + Nearest Coast Guard ({nearest_cg['name']} - {cg_phone}). "
            f"Configure TEXTBEE_API_KEY in .env for live transmission."
        )
        provider_id = sim_id

    return {
        "ok": True,
        "delivered": delivered,
        "provider": active_provider,
        "provider_id": provider_id,
        "message": status_message,
        "recipients": {
            "admins": admins,
            "nearest_coast_guard": nearest_cg,
            "custom": normalize_phone_number(custom_recipient) if custom_recipient else None,
            "all_dispatched": all_recipients,
        },
    }


def get_gateway_status() -> Dict:
    """Return status report of the SMS gateway and collaborator network."""
    provider = get_active_provider_name()
    textbee_key = (
        os.getenv("TEXTBEE_API_KEY", "").strip()
        or os.getenv("ORCA_TEXTBEE_API_KEY", "").strip()
    )
    device_id = (
        os.getenv("TEXTBEE_DEVICE_ID", "").strip()
        or os.getenv("ORCA_TEXTBEE_DEVICE_ID", "").strip()
    )
    masked_key = f"{textbee_key[:4]}...{textbee_key[-4:]}" if len(textbee_key) > 8 else ("Configured" if textbee_key else "Not set")

    return {
        "active_provider": provider,
        "is_live": provider == "TextBee Gateway" or provider == "Twilio",
        "textbee_configured": bool(textbee_key),
        "textbee_masked_key": masked_key,
        "textbee_device_id": device_id or "default-device",
        "admin_recipients": get_admin_recipients(),
        "default_coast_guard_phone": os.getenv("ORCA_COAST_GUARD_DEFAULT_PHONE", "+919339698196"),
    }
