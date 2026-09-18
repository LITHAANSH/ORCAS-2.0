"""ORCA 2.0 Comprehensive End-to-End (E2E) Test Suite

Runs a complete validation pass against the live ORCA 2.0 server (http://127.0.0.1:8001).
Tests:
1. PWA & Static Asset Pipeline (Index, Manifest, Icons, Service Worker)
2. System Health, Version & Config Verification
3. SOS Distress Dispatch & Geodesic Coast Guard Collaborator Routing (Mumbai, Goa, Kochi)
4. Species-Specific Catch Modeling (Mackerel, Pomfret, Vernacular translations, Adjusted Economics)
5. Coastal Tides & Astronomical Lunar Intelligence (Phase, Illumination, Spring/Neap, High/Low curve)
6. ML Incident Risk Classifier vs Rule-Based Safety Law Ensemble
7. Multilingual AI Maritime Chat Engine (English, Hindi, Kannada)
8. Emergency Evacuation Route Planner
9. Authority Maritime Operations Dashboard
"""
import json
import os
import sys
import time
import urllib.request
import urllib.parse
from typing import Any, Dict, Tuple

# Default to running port 8000, support CLI URL or env var
BASE_URL = os.environ.get("ORCA_URL", "http://127.0.0.1:8000")
SKIP_SMS = True  # Default to skipping real SMS transmission for safe e2e testing

for a in sys.argv[1:]:
    if a.startswith("http"):
        BASE_URL = a
    elif a in ("--include-sms", "--send-sms"):
        SKIP_SMS = False
    elif a in ("--skip-sms", "--no-sms"):
        SKIP_SMS = True

passed_count = 0
failed_count = 0
results_log = []

def run_step(category: str, name: str, fn):
    global passed_count, failed_count
    t0 = time.perf_counter()
    try:
        fn()
        dt_ms = (time.perf_counter() - t0) * 1000
        passed_count += 1
        print(f"[PASS] {category} -> {name} ({dt_ms:.1f}ms)")
        results_log.append((True, category, name, dt_ms, ""))
    except Exception as e:
        dt_ms = (time.perf_counter() - t0) * 1000
        failed_count += 1
        print(f"[FAIL] {category} -> {name} ({dt_ms:.1f}ms): {e}")
        results_log.append((False, category, name, dt_ms, str(e)))

def http_get(path: str) -> Tuple[int, Any, Dict[str, str]]:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "ORCA-E2E-Tester"})
    with urllib.request.urlopen(req, timeout=10) as res:
        status = res.status
        headers = dict(res.headers)
        body = res.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return status, parsed, headers

def http_post(path: str, data: Dict[str, Any]) -> Tuple[int, Any, Dict[str, str]]:
    url = f"{BASE_URL}{path}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "ORCA-E2E-Tester"}
    )
    with urllib.request.urlopen(req, timeout=12) as res:
        status = res.status
        headers = dict(res.headers)
        body = res.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = body
        return status, parsed, headers

print("\n==================================================================")
print("     ORCA 2.0 — Comprehensive End-to-End (E2E) Test Suite")
print("==================================================================\n")

# --------------------------------------------------------------------------
# 1. PWA & Static Delivery
# --------------------------------------------------------------------------
def test_pwa_index():
    status, body, _ = http_get("/")
    assert status == 200, f"Expected 200, got {status}"
    assert "manifest.webmanifest" in body, "Index missing manifest.webmanifest link"
    assert "sw.js" in body, "Index missing sw.js service worker registration"
    assert "orca-icon.svg" in body, "Index missing vector icon"

run_step("1. PWA & Static", "Root index.html serves PWA hooks", test_pwa_index)

def test_pwa_manifest():
    status, manifest, _ = http_get("/manifest.webmanifest")
    assert status == 200, f"Expected 200, got {status}"
    assert isinstance(manifest, dict), "Manifest is not valid JSON"
    assert "ORCA" in manifest.get("name", ""), f"Unexpected name: {manifest.get('name')}"
    assert manifest.get("display") == "standalone", f"Expected standalone display mode"
    assert len(manifest.get("icons", [])) > 0, "Manifest has no icons defined"

run_step("1. PWA & Static", "PWA WebManifest JSON schema & icons", test_pwa_manifest)

def test_pwa_sw():
    status, sw_code, headers = http_get("/sw.js")
    assert status == 200, f"Expected 200, got {status}"
    assert "CACHE_NAME" in sw_code, "Service worker missing CACHE_NAME"
    assert "fetch" in sw_code, "Service worker missing fetch listener"

run_step("1. PWA & Static", "Offline Service Worker (sw.js)", test_pwa_sw)

def test_pwa_svg_icon():
    status, svg, _ = http_get("/orca-icon.svg")
    assert status == 200, f"Expected 200, got {status}"
    assert "<svg" in svg and "</svg>" in svg, "Valid SVG graphic delivered"

run_step("1. PWA & Static", "Vector App Icon (orca-icon.svg)", test_pwa_svg_icon)


# --------------------------------------------------------------------------
# 2. Health & Config Engine
# --------------------------------------------------------------------------
def test_health():
    status, health, _ = http_get("/api/health")
    assert status == 200, f"Expected 200, got {status}"
    assert health.get("status") == "ok", "Health status not ok"
    assert "agents" in health and len(health["agents"]) >= 10, "Missing full intelligence agent crew"

run_step("2. Core Health", "GET /api/health agent crew readiness", test_health)

def test_config():
    status, cfg, _ = http_get("/api/config")
    assert status == 200, f"Expected 200, got {status}"
    assert "risk_weights" in cfg, "Config missing risk_weights"
    assert "deterministic_overrides" in cfg, "Config missing deterministic_overrides"
    assert cfg["deterministic_overrides"].get("severe_warning_floor") == 92, "Severe floor != 92"

run_step("2. Core Health", "GET /api/config safety floors and weights", test_config)


# --------------------------------------------------------------------------
# 3. SOS Distress & Coast Guard Dispatch Routing
# --------------------------------------------------------------------------
def test_sos_gateway_status():
    status, s, _ = http_get("/api/sos/status")
    assert status == 200, f"Expected 200, got {status}"
    assert s.get("ok") is True, "SOS status not ok"
    gw = s.get("gateway", {})
    assert "TextBee" in gw.get("active_provider", ""), f"Expected TextBee in active_provider, got {gw.get('active_provider')}"
    assert s.get("stations_count") == 11, f"Expected 11 Coast Guard stations, got {s.get('stations_count')}"
    assert len(gw.get("admin_recipients", [])) > 0, "Admin recipients missing from gateway"

run_step("3. SOS Gateway", "GET /api/sos/status live provider verification", test_sos_gateway_status)

def test_sos_mumbai_routing():
    payload = {
        "latitude": 18.9220,
        "longitude": 72.8340,
        "risk": {"category": "EXTREME", "score": 88},
        "hazards": ["Engine failure", "Wave height 3.2m"],
        "message": "Engine failure 12nm west of Sassoon Dock Mumbai",
        "language": "en"
    }
    status, res, _ = http_post("/api/sos", payload)
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("ok") is True, "SOS call returned not ok"
    cg = res.get("nearest_coast_guard", {})
    assert cg.get("code") in ("ICG-MUMBAI", "ICG_MUMBAI"), f"Expected Mumbai CG, got {cg.get('code')}"
    recipients = res.get("recipients", {})
    all_disp = recipients.get("all_dispatched", [])
    assert "+917483271232" in all_disp, "Admin recipient missing from dispatch"
    assert "+918792178758" in all_disp, "Mumbai CG phone override missing from dispatch"
    sms = res.get("sms", "")
    assert "https://maps.google.com/?q=18.922000,72.834000" in sms, "SMS missing Google Maps URL"
    assert "18.9220" in sms and "72.8340" in sms, "SMS missing exact coordinates"

if not SKIP_SMS:
    run_step("3. SOS Gateway", "POST /api/sos Mumbai routing & collaborator override", test_sos_mumbai_routing)
    run_step("3. SOS Gateway", "POST /api/sos Goa routing & collaborator override", test_sos_goa_routing)
    run_step("3. SOS Gateway", "POST /api/sos Kochi routing & collaborator override", test_sos_kochi_routing)
else:
    print("[SKIP] 3. SOS Gateway -> Skipping real outbound SMS transmissions (--skip-sms active)")


# --------------------------------------------------------------------------
# 4. Species Catalog & Catch Intelligence
# --------------------------------------------------------------------------
def test_species_catalog():
    status, body, _ = http_get("/api/fishing/species")
    assert status == 200, f"Expected 200, got {status}"
    assert body.get("ok") is True, "Catalog not ok"
    species_list = body.get("species", [])
    assert len(species_list) == 5, f"Expected 5 species, got {len(species_list)}"
    ids = [s["id"] for s in species_list]
    for expected in ["mackerel", "sardine", "pomfret", "tuna", "hilsa"]:
        assert expected in ids, f"Missing species {expected}"
    m = next(s for s in species_list if s["id"] == "mackerel")
    assert "Bangda" in m["vernacular"]["hi"], "Hindi vernacular missing Bangda"
    assert "Bangude" in m["vernacular"]["kn"], "Kannada vernacular missing Bangude"

run_step("4. Species Engine", "GET /api/fishing/species 5 commercial species catalog", test_species_catalog)

def test_targeted_fishing_mackerel():
    status, out, _ = http_get("/api/fishing?lat=18.922&lon=72.834&species=mackerel")
    assert status == 200, f"Expected 200, got {status}"
    assert out.get("target_species", {}).get("id") == "mackerel", "Target species not returned as mackerel"
    zones = out.get("areas", [])
    assert len(zones) > 0, "No fishing zones returned"
    for z in zones:
        suit = z.get("species_suitability")
        assert suit is not None, "Zone missing species_suitability"
        assert suit.get("species_id") == "mackerel", "Suitability species_id != mackerel"
        assert 0.0 <= suit.get("suitability", 0.0) <= 1.0, "Suitability out of range [0, 1]"
    econ = out.get("economics", {})
    assert "Mackerel" in econ.get("assumptions", ""), f"Economics assumptions missing Mackerel: {econ.get('assumptions')}"

run_step("4. Species Engine", "GET /api/fishing?species=mackerel zone suitability & economics", test_targeted_fishing_mackerel)

def test_targeted_fishing_pomfret():
    status, out, _ = http_get("/api/fishing?lat=18.922&lon=72.834&species=pomfret")
    assert status == 200, f"Expected 200, got {status}"
    assert out.get("target_species", {}).get("id") == "pomfret", "Target species != pomfret"
    econ = out.get("economics", {})
    assert "Pomfret" in econ.get("assumptions", ""), "Assumptions missing Pomfret"
    assert econ.get("revenue_inr", 0) > 0, "Revenue should be positive"

run_step("4. Species Engine", "GET /api/fishing?species=pomfret premium economics adjustment", test_targeted_fishing_pomfret)


# --------------------------------------------------------------------------
# 5. Coastal Tides & Astronomical Lunar Intelligence
# --------------------------------------------------------------------------
def test_tides_and_lunar():
    status, out, _ = http_get("/api/fishing?lat=18.922&lon=72.834")
    assert status == 200, f"Expected 200, got {status}"
    tide = out.get("tide")
    assert tide is not None, "Fishing outlook missing tide data"
    assert "current_height_m" in tide, "Tide missing current_height_m"
    assert "next_high_tide" in tide, "Tide missing next_high_tide"
    assert "next_low_tide" in tide, "Tide missing next_low_tide"
    assert len(tide.get("hourly_curve", [])) >= 12, "Hourly curve missing points"

    lunar = out.get("lunar")
    assert lunar is not None, "Fishing outlook missing lunar data"
    assert lunar.get("phase_name") is not None, "Lunar missing phase_name"
    assert lunar.get("phase_icon") is not None, "Lunar missing phase_icon"
    assert 0 <= lunar.get("illumination_pct", -1) <= 100, "Illumination % out of bounds"
    assert len(lunar.get("solunar_rating", "")) > 0, "Missing solunar rating"
    assert 0 <= lunar.get("solunar_score", -1) <= 100, "Solunar score out of bounds"

run_step("5. Tides & Lunar", "Astronomical lunar cycles & semi-diurnal tidal curves", test_tides_and_lunar)


# --------------------------------------------------------------------------
# 6. ML Risk Incident Estimator vs Safety Law Ensemble
# --------------------------------------------------------------------------
def test_ml_risk_comparison():
    status, res, _ = http_get("/api/risk/ml-compare?lat=18.922&lon=72.834")
    assert status == 200, f"Expected 200, got {status}"
    cmp = res.get("comparison", {})
    assert "rule_engine" in cmp, "Missing rule_engine in ML comparison"
    assert "ml_model" in cmp, "Missing ml_model in ML comparison"
    ml = cmp["ml_model"]
    assert "probability" in ml, "Missing incident probability in ML model"
    assert "drivers" in ml, "Missing drivers in ML model"
    assert "ensemble_agreement" in cmp, "Missing ensemble_agreement"
    assert "variance" in cmp, "Missing variance in ensemble"

run_step("6. ML Risk Ensemble", "GET /api/risk/ml-compare model vs deterministic safety law", test_ml_risk_comparison)


# --------------------------------------------------------------------------
# 7. Conversational Multilingual AI
# --------------------------------------------------------------------------
def test_chat_english():
    payload = {
        "message": "Can I go fishing near Mumbai Sassoon dock today?",
        "latitude": 18.922,
        "longitude": 72.834,
        "location_name": "Mumbai - Sassoon Dock"
    }
    status, res, _ = http_post("/api/chat", payload)
    assert status == 200, f"Expected 200, got {status}"
    answer = res.get("answer", "")
    assert len(answer) > 15, "Answer too short"
    assert res.get("language") == "en", f"Expected en language, got {res.get('language')}"

run_step("7. Multilingual AI", "POST /api/chat English maritime query", test_chat_english)

def test_chat_hindi():
    payload = {
        "message": "क्या आज मुंबई में मछली पकड़ने के लिए समुद्र शांत है?",
        "latitude": 18.922,
        "longitude": 72.834,
        "location_name": "Mumbai - Sassoon Dock"
    }
    status, res, _ = http_post("/api/chat", payload)
    assert status == 200, f"Expected 200, got {status}"
    answer = res.get("answer", "")
    assert len(answer) > 10, "Answer too short"
    assert res.get("language") == "hi", f"Expected hi language, got {res.get('language')}"

run_step("7. Multilingual AI", "POST /api/chat Hindi vernacular query", test_chat_hindi)

def test_chat_kannada():
    payload = {
        "message": "ಇಂದು ಮುಂಬೈ ಬಳಿ ಸಮುದ್ರದ ಅಲೆಗಳು ಹೇಗಿವೆ?",
        "latitude": 18.922,
        "longitude": 72.834,
        "location_name": "Mumbai - Sassoon Dock"
    }
    status, res, _ = http_post("/api/chat", payload)
    assert status == 200, f"Expected 200, got {status}"
    answer = res.get("answer", "")
    assert len(answer) > 10, "Answer too short"
    assert res.get("language") == "kn", f"Expected kn language, got {res.get('language')}"

run_step("7. Multilingual AI", "POST /api/chat Kannada vernacular query", test_chat_kannada)


# --------------------------------------------------------------------------
# 8. Emergency Evacuation Route Planner
# --------------------------------------------------------------------------
def test_emergency_route():
    payload = {"latitude": 18.800, "longitude": 72.700}
    status, res, _ = http_post("/api/emergency-route", payload)
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("available") is True, "Emergency route not available"
    dest = res.get("destination", {})
    assert dest.get("name") is not None, "Destination name missing"
    assert res.get("distance_km", 0) > 0, "Distance should be positive"
    assert res.get("eta_minutes", 0) > 0, "ETA should be positive"
    assert len(res.get("waypoints", [])) >= 2, "Waypoints should have at least origin & destination"

run_step("8. Evacuation Routing", "POST /api/emergency-route safe haven pathfinding", test_emergency_route)


# --------------------------------------------------------------------------
# 9. Authority Safety Command Board
# --------------------------------------------------------------------------
def test_authority_dashboard():
    status, res, _ = http_get("/api/authority/dashboard")
    assert status == 200, f"Expected 200, got {status}"
    assert "summary" in res, "Missing summary in dashboard"
    assert "locations" in res, "Missing locations in dashboard"
    assert res["summary"].get("monitored", 0) > 0, "Monitored locations count <= 0"

run_step("9. Authority Board", "GET /api/authority/dashboard fleet overview", test_authority_dashboard)


# --------------------------------------------------------------------------
# 10. Live Data Validation & Reliability Scoring Engine
# --------------------------------------------------------------------------
def test_data_validation_endpoint():
    status, res, _ = http_get("/api/validate?lat=18.922&lon=72.834")
    assert status == 200, f"Expected 200, got {status}"
    assert res.get("ok") is True, "Validate response ok is not True"
    assert "reliability_score" in res, "Missing reliability_score in /api/validate response"
    score = res["reliability_score"]
    assert isinstance(score, (int, float)), f"Reliability score is not numeric: {score}"
    assert 0.0 <= score <= 10.0, f"Reliability score out of bounds: {score}"
    val = res.get("validation", {})
    assert "rating" in val, "Missing rating in /api/validate"
    assert "checks" in val and len(val["checks"]) > 0, "Missing validation checks"
    assert "provenance_summary" in val, "Missing provenance_summary"

run_step("10. Data Validation", "GET /api/validate point conditions & 0-10 reliability score", test_data_validation_endpoint)

def test_fishing_reliability_integration():
    status, out, _ = http_get("/api/fishing?lat=18.922&lon=72.834")
    assert status == 200, f"Expected 200, got {status}"
    assert "reliability_score" in out, "Missing reliability_score in fishing outlook"
    score = out["reliability_score"]
    assert isinstance(score, (int, float)), f"Fishing reliability score is not numeric: {score}"
    assert 0.0 <= score <= 10.0, f"Fishing reliability score out of bounds: {score}"
    assert "validation" in out, "Missing validation metadata in fishing outlook"
    val = out["validation"]
    assert val.get("rating") is not None, "Missing validation rating"

run_step("10. Data Validation", "GET /api/fishing integrated reliability score & validation metadata", test_fishing_reliability_integration)


# --------------------------------------------------------------------------
# Summary Report
# --------------------------------------------------------------------------
print("\n==================================================================")
print("               ORCA 2.0 E2E TEST SUMMARY")
print("==================================================================")
print(f"Total Steps Executed: {passed_count + failed_count}")
print(f"Passed: {passed_count}")
print(f"Failed: {failed_count}")

if failed_count == 0:
    print("\n>>> ALL END-TO-END ACCEPTANCE TESTS PASSED! <<<\n")
    sys.exit(0)
else:
    print("\n>>> SOME END-TO-END ACCEPTANCE TESTS FAILED. <<<\n")
    sys.exit(1)
