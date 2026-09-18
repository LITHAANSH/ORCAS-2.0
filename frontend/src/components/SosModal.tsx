import { useEffect, useState } from "react";
import * as api from "../api";
import type { CoastGuardStation, EmergencyRoute, FishingOutlook, Language, SosGatewayStatus, SosResponse } from "../types";
import { RISK_COLOR } from "./RiskDial";

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins ? `${mins}m` : ""}`.trim() : `${mins}m`;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const DEFAULT_STATIONS: CoastGuardStation[] = [
  { code: "ICG-MUMBAI", name: "Indian Coast Guard Station Mumbai (DHQ-2)", region: "RHQ (West)", state: "Maharashtra", lat: 18.922, lon: 72.8347, phone: "+919339698196" },
  { code: "ICG-GOA", name: "Indian Coast Guard Station Goa (DHQ-11)", region: "RHQ (West)", state: "Goa", lat: 15.4909, lon: 73.8278, phone: "+919339698196" },
  { code: "ICG-KOCHI", name: "Indian Coast Guard Station Kochi (DHQ-4)", region: "RHQ (West)", state: "Kerala", lat: 9.9312, lon: 76.2673, phone: "+919339698196" },
  { code: "ICG-CHENNAI", name: "Indian Coast Guard Station Chennai (DHQ-5)", region: "RHQ (East)", state: "Tamil Nadu", lat: 13.0827, lon: 80.2707, phone: "+919339698196" },
  { code: "ICG-VIZAG", name: "Indian Coast Guard Station Visakhapatnam (DHQ-6)", region: "RHQ (East)", state: "Andhra Pradesh", lat: 17.6868, lon: 83.2185, phone: "+919339698196" },
  { code: "ICG-PARADIP", name: "Indian Coast Guard Station Paradip (DHQ-7)", region: "RHQ (North-East)", state: "Odisha", lat: 20.2648, lon: 86.6947, phone: "+919339698196" },
  { code: "ICG-VERAVAL", name: "Indian Coast Guard Station Veraval", region: "RHQ (North-West)", state: "Gujarat", lat: 20.907, lon: 70.3679, phone: "+919339698196" },
  { code: "ICG-HALDIA", name: "Indian Coast Guard Station Haldia / Digha (DHQ-8)", region: "RHQ (North-East)", state: "West Bengal", lat: 21.627, lon: 87.509, phone: "+919339698196" },
  { code: "ICG-PORTBLAIR", name: "Indian Coast Guard Station Port Blair (DHQ-9)", region: "RHQ (A&N)", state: "Andaman & Nicobar", lat: 11.6234, lon: 92.7265, phone: "+919339698196" },
];

const L: Record<Language, Record<string, string>> = {
  en: {
    title: "SOS EMERGENCY",
    subtitle: "Distress Position & Rescue Report",
    location: "VESSEL DISTRESS LOCATION",
    viewMap: "Open Google Maps",
    risk: "CURRENT RISK",
    hazards: "ACTIVE HAZARDS",
    noHazards: "No active hazards reported",
    calcRisk: "Calculating risk assessment…",
    calcHazards: "Awaiting condition data…",
    route: "SAFE RETURN TO LAND",
    calcRoute: "Calculating safest route to shore…",
    routeUnavail: "Safe return route unavailable from current position.",
    destination: "DESTINATION",
    distance: "DISTANCE",
    eta: "ETA",
    routeRisk: "ROUTE RISK",
    dispatchRecipients: "AUTOMATED DISTRESS RECIPIENTS",
    adminTarget: "Central Admin Ops",
    cgTarget: "Assigned Nearest Coast Guard",
    customTarget: "Custom Recipient Phone (Optional)",
    customPlaceholder: "e.g. 9876543210 (family/boat owner)",
    message: "ADDITIONAL MESSAGE",
    cancel: "Cancel",
    viewRoute: "View Route",
    send: "TRANSMIT SOS DISTRESS",
    sending: "Transmitting via TextBee…",
    disclaimer: "Transmits SMS with coordinates, Google Maps link, and risk to Central Admin & nearest Coast Guard station.",
    successTitle: "SOS TRANSMITTED SUCCESSFULLY",
    failTitle: "TRANSMISSION FAILED",
    failNote: "Keep the location link and contact emergency services directly.",
  },
  hi: {
    title: "SOS आपातकाल",
    subtitle: "संकट स्थान एवं बचाव रिपोर्ट",
    location: "नाव का संकट स्थान",
    viewMap: "गूगल मैप्स खोलें",
    risk: "वर्तमान जोखिम",
    hazards: "सक्रिय खतरे",
    noHazards: "कोई सक्रिय खतरा नहीं",
    calcRisk: "जोखिम की गणना हो रही है…",
    calcHazards: "स्थिति डेटा की प्रतीक्षा…",
    route: "भूमि पर सुरक्षित वापसी",
    calcRoute: "सबसे सुरक्षित मार्ग की गणना हो रही है…",
    routeUnavail: "वर्तमान स्थान से सुरक्षित वापसी मार्ग उपलब्ध नहीं है।",
    destination: "गंतव्य",
    distance: "दूरी",
    eta: "अनुमानित समय",
    routeRisk: "मार्ग जोखिम",
    dispatchRecipients: "स्वचालित संकट प्राप्तकर्ता",
    adminTarget: "केंद्रीय व्यवस्थापक",
    cgTarget: "निकटतम तटरक्षक बल (Coast Guard)",
    customTarget: "अतिरिक्त मोबाइल नंबर (वैकल्पिक)",
    customPlaceholder: "उदा. 9876543210",
    message: "अतिरिक्त संदेश",
    cancel: "रद्द करें",
    viewRoute: "मार्ग देखें",
    send: "SOS संकट संदेश भेजें",
    sending: "TextBee द्वारा प्रेषण जारी…",
    disclaimer: "केंद्रीय व्यवस्थापक और निकटतम तटरक्षक बल को निर्देशांक, गूगल मैप्स लिंक और जोखिम के साथ SMS भेजा जाएगा।",
    successTitle: "SOS सफलतापूर्वक प्रेषित",
    failTitle: "प्रेषण विफल",
    failNote: "स्थान लिंक रखें और सीधे आपातकालीन सेवाओं से संपर्क करें।",
  },
  kn: {
    title: "SOS ತುರ್ತು",
    subtitle: "ಆಪತ್ತು ಸ್ಥಾನ ಮತ್ತು ರಕ್ಷಣಾ ವರದಿ",
    location: "ದೋಣಿಯ ಆಪತ್ತು ಸ್ಥಳ",
    viewMap: "ಗೂಗಲ್ ನಕ್ಷೆಗಳನ್ನು ತೆರೆಯಿರಿ",
    risk: "ಪ್ರಸ್ತುತ ಅಪಾಯ",
    hazards: "ಸಕ್ರಿಯ ಅಪಾಯಗಳು",
    noHazards: "ಯಾವುದೇ ಸಕ್ರಿಯ ಅಪಾಯ ವರದಿಯಾಗಿಲ್ಲ",
    calcRisk: "ಅಪಾಯ ಮೌಲ್ಯಮಾಪನ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ…",
    calcHazards: "ಸ್ಥಿತಿ ಡೇಟಾಕ್ಕಾಗಿ ನಿರೀಕ್ಷಿಸಲಾಗುತ್ತಿದೆ…",
    route: "ಭೂಮಿಗೆ ಸುರಕ್ಷಿತ ಮರಳು",
    calcRoute: "ಅತ್ಯಂತ ಸುರಕ್ಷಿತ ಮಾರ್ಗ ಲೆಕ್ಕಹಾಕಲಾಗುತ್ತಿದೆ…",
    routeUnavail: "ಪ್ರಸ್ತುತ ಸ್ಥಳದಿಂದ ಸುರಕ್ಷಿತ ಮರಳು ಮಾರ್ಗ ಲಭ್ಯವಿಲ್ಲ.",
    destination: "ಗಮ್ಯಸ್ಥಾನ",
    distance: "ದೂರ",
    eta: "ಅಂದಾಜು ಸಮಯ",
    routeRisk: "ಮಾರ್ಗ ಅಪಾಯ",
    dispatchRecipients: "ಸ್ವಯಂಚಾಲಿತ ಆಪತ್ತು ಸ್ವೀಕರಿಸುವವರು",
    adminTarget: "ಕೇಂದ್ರ ಆಡಳಿತ",
    cgTarget: "ನಿಯೋಜಿತ ಸಮೀಪದ ಕೋಸ್ಟ್ ಗಾರ್ಡ್",
    customTarget: "ಹೆಚ್ಚುವರಿ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ (ಐಚ್ಛಿಕ)",
    customPlaceholder: "ಉದಾ. 9876543210",
    message: "ಹೆಚ್ಚುವರಿ ಸಂದೇಶ",
    cancel: "ರದ್ದು ಮಾಡಿ",
    viewRoute: "ಮಾರ್ಗ ನೋಡಿ",
    send: "SOS ಆಪತ್ತು ರವಾನಿಸಿ",
    sending: "TextBee ಮೂಲಕ ರವಾನಿಸಲಾಗುತ್ತಿದೆ…",
    disclaimer: "ಕೇಂದ್ರ ಆಡಳಿತ ಮತ್ತು ಸಮೀಪದ ಕೋಸ್ಟ್ ಗಾರ್ಡ್‌ಗೆ ನಿರ್ದೇಶಾಂಕಗಳು, ಗೂಗಲ್ ನಕ್ಷೆಗಳ ಲಿಂಕ್ ಮತ್ತು ಅಪಾಯದೊಂದಿಗೆ SMS ಕಳುಹಿಸಲಾಗುತ್ತದೆ.",
    successTitle: "SOS ಯಶಸ್ವಿಯಾಗಿ ರವಾನಿಸಲಾಗಿದೆ",
    failTitle: "ರವಾನೆ ವಿಫಲ",
    failNote: "ಸ್ಥಳ ಲಿಂಕ್ ಇಟ್ಟುಕೊಳ್ಳಿ ಮತ್ತು ತುರ್ತು ಸೇವೆಗಳನ್ನು ನೇರವಾಗಿ ಸಂಪರ್ಕಿಸಿ.",
  },
};

export default function SosModal({
  outlook,
  emergencyRoute,
  latitude,
  longitude,
  language = "en",
  onClose,
}: {
  outlook: FishingOutlook | null;
  emergencyRoute: EmergencyRoute | null;
  latitude: number;
  longitude: number;
  language?: Language;
  onClose: () => void;
}) {
  const t = L[language] ?? L.en;
  const [message, setMessage] = useState("Engine failure. Unable to return to shore.");
  const [customPhone, setCustomPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<SosResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pulse, setPulse] = useState(true);
  const [gatewayStatus, setGatewayStatus] = useState<SosGatewayStatus | null>(null);
  const [stations, setStations] = useState<CoastGuardStation[]>(DEFAULT_STATIONS);

  const current = outlook?.location.latitude === latitude && outlook.location.longitude === longitude;
  const route = current ? emergencyRoute : null;
  const hazards = current
    ? outlook.avoid.filter((item) => item.active_now).map((item) => `${item.name} (${item.severity})`)
    : [];

  const locationLink = `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const riskColor = current && outlook ? RISK_COLOR[outlook.safety.category] : "var(--text-dim)";

  // Load gateway status & Coast Guard stations
  useEffect(() => {
    api.getSosStatus()
      .then((res) => {
        if (res.ok) {
          if (res.gateway) setGatewayStatus(res.gateway);
          if (res.stations && res.stations.length) setStations(res.stations);
        }
      })
      .catch(() => {});
  }, []);

  // Compute nearest Coast Guard station for live display
  const nearestStation = (() => {
    const list = stations.length ? stations : DEFAULT_STATIONS;
    let closest = list[0];
    let minD = 999999;
    for (const s of list) {
      const lat = s.lat ?? s.station_lat ?? 0;
      const lon = s.lon ?? s.station_lon ?? 0;
      if (lat && lon) {
        const d = haversineKm(latitude, longitude, lat, lon);
        if (d < minD) {
          minD = d;
          closest = { ...s, distance_km: Math.round(d * 10) / 10 };
        }
      }
    }
    return closest;
  })();

  // Pulse animation for emergency beacon
  useEffect(() => {
    const id = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(id);
  }, []);

  const submit = async () => {
    if (!current || !outlook) return;
    setSending(true);
    setResponse(null);
    setErrorText(null);
    try {
      const res = await api.sendSos({
        latitude,
        longitude,
        risk: { category: outlook.safety.category, score: outlook.safety.score },
        hazards,
        route,
        message,
        language,
        recipient: customPhone.trim() || undefined,
      });
      setResponse(res);
    } catch {
      setErrorText(t.failNote);
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(0,0,0,0.88)",
        backdropFilter: "blur(5px)",
      }}
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--surface)",
          border: "1px solid rgba(239,68,68,0.5)",
          borderRadius: 3,
          boxShadow: "0 0 60px rgba(239,68,68,0.25), 0 20px 60px rgba(0,0,0,0.85)",
        }}
      >
        {/* ---- HEADER ---- */}
        <div
          style={{
            background: "rgba(239,68,68,0.12)",
            borderBottom: "1px solid rgba(239,68,68,0.3)",
            padding: "14px 18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ position: "relative", width: 28, height: 28, flexShrink: 0 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "1.5px solid #EF4444",
                  opacity: pulse ? 0.8 : 0.2,
                  transition: "opacity 0.4s",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 5,
                  borderRadius: "50%",
                  background: "#EF4444",
                  opacity: pulse ? 1 : 0.4,
                  transition: "opacity 0.4s",
                  boxShadow: pulse ? "0 0 12px #EF4444" : "none",
                }}
              />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.24em",
                    textTransform: "uppercase",
                    color: "#EF4444",
                  }}
                >
                  {t.title}
                </span>
                <span
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 8.5,
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: 2,
                    background: gatewayStatus?.is_live ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
                    color: gatewayStatus?.is_live ? "#22C55E" : "#EAB308",
                    border: `1px solid ${gatewayStatus?.is_live ? "rgba(34,197,94,0.4)" : "rgba(234,179,8,0.4)"}`,
                  }}
                >
                  TEXTBEE SMS GATEWAY {gatewayStatus?.is_live ? "● LIVE" : "● DEMO SIMULATION"}
                </span>
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces Variable', Georgia, serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-bright)",
                  lineHeight: 1.2,
                  marginTop: 2,
                }}
              >
                {t.subtitle}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--border-mid)",
              borderRadius: 2,
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: 16,
              fontFamily: "monospace",
            }}
            aria-label="Close SOS"
          >
            ×
          </button>
        </div>

        {/* ---- BODY ---- */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Location & Google Maps Link */}
          <div>
            <div
              style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              {t.location}
            </div>
            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border-mid)",
                borderRadius: 2,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-bright)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {latitude.toFixed(6)}° N &nbsp;·&nbsp; {longitude.toFixed(6)}° E
                </div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                  Direct GPS coordinates included in SMS alert
                </div>
              </div>
              <a
                href={locationLink}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#38BDF8",
                  textDecoration: "none",
                  border: "1px solid rgba(56,189,248,0.4)",
                  background: "rgba(56,189,248,0.08)",
                  padding: "5px 10px",
                  borderRadius: 2,
                  whiteSpace: "nowrap",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                📍 {t.viewMap} ↗
              </a>
            </div>
          </div>

          {/* Collaborator Dispatch Targets: Admin + Nearest Coast Guard */}
          <div
            style={{
              background: "rgba(239,68,68,0.04)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 2,
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8.5,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#EF4444",
                marginBottom: 10,
              }}
            >
              📡 {t.dispatchRecipients}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Central Admin */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--surface)",
                  padding: "6px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>🏛️</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-bright)" }}>
                      {t.adminTarget}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-dim)" }}>
                      All distress transmissions broadcast to ops command
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 9.5,
                    color: "var(--text-mid)",
                    background: "var(--surface-2)",
                    padding: "2px 6px",
                    borderRadius: 2,
                  }}
                >
                  {gatewayStatus?.admin_recipients?.join(", ") || "+919876543210"}
                </div>
              </div>

              {/* Nearest Coast Guard */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "var(--surface)",
                  padding: "6px 10px",
                  border: "1px solid rgba(239,68,68,0.3)",
                  borderRadius: 2,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13 }}>⚓</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#EF4444" }}>
                      {nearestStation.name}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--text-dim)" }}>
                      Nearest First Responder ({nearestStation.distance_km} km offshore · {nearestStation.region})
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 9.5,
                    color: "#EF4444",
                    background: "rgba(239,68,68,0.1)",
                    padding: "2px 6px",
                    borderRadius: 2,
                    fontWeight: 700,
                  }}
                >
                  {nearestStation.phone}
                </div>
              </div>
            </div>

            {/* Optional custom phone input */}
            <div style={{ marginTop: 10 }}>
              <label
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {t.customTarget}
              </label>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder={t.customPlaceholder}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 10px",
                  background: "var(--surface)",
                  color: "var(--text-bright)",
                  border: "1px solid var(--border-mid)",
                  borderRadius: 2,
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 11,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {/* Risk + Hazards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  marginBottom: 8,
                }}
              >
                {t.risk}
              </div>
              <div
                style={{
                  background: "var(--surface-2)",
                  border: `1px solid ${current && outlook ? riskColor + "40" : "var(--border)"}`,
                  borderRadius: 2,
                  padding: "10px 14px",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {current && outlook ? (
                  <>
                    <div
                      style={{
                        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                        fontSize: 28,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: riskColor,
                      }}
                    >
                      {outlook.safety.score}
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 10,
                          fontWeight: 700,
                          color: riskColor,
                          letterSpacing: "0.1em",
                        }}
                      >
                        {outlook.safety.category}
                      </div>
                      <div style={{ fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>/ 100</div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {t.calcRisk}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 8.5,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--text-faint)",
                  marginBottom: 8,
                }}
              >
                {t.hazards}
              </div>
              <div
                style={{
                  background: "var(--surface-2)",
                  border: hazards.length > 0 ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border)",
                  borderRadius: 2,
                  padding: "10px 14px",
                  height: "100%",
                }}
              >
                {current ? (
                  hazards.length > 0 ? (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                      {hazards.map((h) => (
                        <li
                          key={h}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 6,
                            fontSize: 11,
                            color: "#EF4444",
                            lineHeight: 1.4,
                          }}
                        >
                          <span style={{ marginTop: 2, flexShrink: 0 }}>⚠</span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--risk-low)" }}>✓ {t.noHazards}</div>
                  )
                ) : (
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontStyle: "italic" }}>
                    {t.calcHazards}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Route */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div
              style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(239,68,68,0.7)",
                marginBottom: 8,
              }}
            >
              {t.route}
            </div>

            {!current || !route ? (
              <div
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  padding: "12px 14px",
                  fontSize: 12,
                  color: "var(--text-dim)",
                  fontStyle: "italic",
                }}
              >
                {t.calcRoute}
              </div>
            ) : route.available ? (
              <div
                style={{
                  background: "rgba(239,68,68,0.05)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 2,
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  {[
                    { label: t.distance, value: `${route.distance_km}`, unit: "km" },
                    { label: t.eta, value: duration(route.eta_minutes ?? 0), unit: "" },
                    {
                      label: t.routeRisk,
                      value: route.risk_category ?? "—",
                      unit: "",
                      color: route.risk_category ? RISK_COLOR[route.risk_category] : undefined,
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <div
                        style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 8,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          color: "var(--text-faint)",
                          marginBottom: 4,
                        }}
                      >
                        {s.label}
                      </div>
                      <div
                        style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 15,
                          fontWeight: 800,
                          color: s.color ?? "var(--text-bright)",
                          lineHeight: 1,
                        }}
                      >
                        {s.value}
                        {s.unit && (
                          <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>
                            {s.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {route.destination && (
                  <div
                    style={{
                      borderTop: "1px solid rgba(239,68,68,0.15)",
                      paddingTop: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 10, color: "rgba(239,68,68,0.6)" }}>→</span>
                    <div>
                      <div
                        style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 8,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: "var(--text-faint)",
                        }}
                      >
                        {t.destination}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)", marginTop: 1 }}>
                        {route.destination.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(239,68,68,0.05)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 2,
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "rgba(239,68,68,0.8)",
                }}
              >
                {t.routeUnavail}
              </div>
            )}
          </div>

          {/* Message text */}
          <div>
            <div
              style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8.5,
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              {t.message}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 13px",
                background: "var(--surface-2)",
                color: "var(--text-bright)",
                border: "1px solid var(--border-mid)",
                borderRadius: 2,
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: 13,
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--ocean)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border-mid)";
              }}
            />
          </div>

          {/* Result Card */}
          {(response || errorText) && (
            <div
              style={{
                background: response?.ok ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${response?.ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
                borderRadius: 2,
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: response?.ok ? "var(--risk-low)" : "#EF4444",
                  marginBottom: 6,
                }}
              >
                {response?.ok ? t.successTitle : t.failTitle}
              </div>

              {response && (
                <div style={{ marginBottom: 10, fontSize: 11, color: "var(--text-bright)", lineHeight: 1.5 }}>
                  <div>{response.message}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        background: "rgba(255,255,255,0.08)",
                        padding: "2px 6px",
                        borderRadius: 2,
                        fontFamily: "monospace",
                      }}
                    >
                      Provider: {response.provider || "TextBee"}
                    </span>
                    {response.provider_id && (
                      <span
                        style={{
                          fontSize: 9,
                          background: "rgba(255,255,255,0.08)",
                          padding: "2px 6px",
                          borderRadius: 2,
                          fontFamily: "monospace",
                        }}
                      >
                        Batch ID: {response.provider_id}
                      </span>
                    )}
                    {response.nearest_coast_guard && (
                      <span
                        style={{
                          fontSize: 9,
                          background: "rgba(239,68,68,0.15)",
                          color: "#EF4444",
                          padding: "2px 6px",
                          borderRadius: 2,
                          fontFamily: "monospace",
                          fontWeight: 700,
                        }}
                      >
                        Assigned: {response.nearest_coast_guard.name} ({response.nearest_coast_guard.distance_km} km)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {errorText && (
                <div style={{ fontSize: 11, color: "#EF4444", marginBottom: 8 }}>{errorText}</div>
              )}

              {response?.sms && (
                <pre
                  style={{
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 9.5,
                    color: "var(--text-mid)",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 180,
                    overflowY: "auto",
                    margin: 0,
                    lineHeight: 1.6,
                    background: "rgba(0,0,0,0.3)",
                    padding: "8px 10px",
                    borderRadius: 2,
                    border: "1px solid var(--border)",
                  }}
                >
                  {response.sms}
                </pre>
              )}
            </div>
          )}

          {/* Disclaimer */}
          <div
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 9,
              color: "var(--text-faint)",
              lineHeight: 1.6,
              borderTop: "1px solid var(--border)",
              paddingTop: 12,
            }}
          >
            ⚠ {t.disclaimer}
          </div>
        </div>

        {/* ---- FOOTER ---- */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 18px",
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <button onClick={onClose} className="btn-ghost">
            {t.cancel}
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="btn-ghost">
              {t.viewRoute}
            </button>
            <button
              onClick={submit}
              disabled={sending || !current || emergencyRoute === null}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 22px",
                background: sending ? "rgba(239,68,68,0.4)" : "rgba(239,68,68,0.15)",
                color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.6)",
                borderRadius: 2,
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                cursor: sending || !current || emergencyRoute === null ? "not-allowed" : "pointer",
                opacity: !current || emergencyRoute === null ? 0.4 : 1,
                transition: "all 0.2s",
                animation: sending ? "inkblink 1s ease-in-out infinite" : "none",
              }}
              onMouseEnter={(e) => {
                if (!sending && current && emergencyRoute !== null) {
                  e.currentTarget.style.background = "rgba(239,68,68,0.3)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(239,68,68,0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {sending ? (
                <>
                  <span style={{ display: "inline-block", animation: "sonar 1.2s linear infinite" }}>◎</span>
                  {t.sending}
                </>
              ) : (
                <>
                  <span style={{ fontSize: 10 }}>⚡</span>
                  {t.send}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}