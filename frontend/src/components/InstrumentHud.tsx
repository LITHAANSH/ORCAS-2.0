import React, { useState } from "react";
import type { EmergencyRoute, FishingOutlook, Language } from "../types";

const RISK_COLOR: Record<string, string> = {
  LOW: "#22C55E",
  MODERATE: "#F59E0B",
  HIGH: "#F97316",
  EXTREME: "#EF4444",
};

interface InstrumentHudProps {
  outlook: FishingOutlook | null;
  emergencyRoute?: EmergencyRoute | null;
  language?: Language;
  onEmergencyClick?: () => void;
}

export default function InstrumentHud({
  outlook,
  emergencyRoute,
  language = "en",
}: InstrumentHudProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (!outlook) return null;

  const safety = outlook.safety;
  const score = safety.score;
  const category = safety.category;
  const riskCol = RISK_COLOR[category] || "#22C55E";

  const labels = {
    en: {
      hudTitle: "LIVE TELEMETRY HUD",
      wave: "Wave Height",
      wind: "Wind",
      seaState: "Sea State",
      pfz: "PFZ Grounds",
      safetyScore: "Safety Score",
      tide: "Tide Phase",
      emergency: "Emergency Return",
      eta: "ETA",
    },
    hi: {
      hudTitle: "लाइव टेलीमेट्री HUD",
      wave: "लहरें",
      wind: "हवा",
      seaState: "समुद्र स्थिति",
      pfz: "मछली क्षेत्र",
      safetyScore: "सुरक्षा स्कोर",
      tide: "ज्वार स्थिति",
      emergency: "आपातकालीन वापसी",
      eta: "समय",
    },
    kn: {
      hudTitle: "ಲೈವ್ ಟೆಲಿಮೆಟ್ರಿ HUD",
      wave: "ಅಲೆ ಎತ್ತರ",
      wind: "ಗಾಳಿ",
      seaState: "ಸಮುದ್ರ ಸ್ಥಿತಿ",
      pfz: "PFZ ಪ್ರದೇಶಗಳು",
      safetyScore: "ಸುರಕ್ಷತಾ ಸ್ಕೋರ್",
      tide: "ಉಬ್ಬರವಿಳಿತ",
      emergency: "ತುರ್ತು ವಾಪಸಾತಿ",
      eta: "ಸಮಯ",
    },
  }[language] || {
    hudTitle: "LIVE TELEMETRY HUD",
    wave: "Wave Height",
    wind: "Wind",
    seaState: "Sea State",
    pfz: "PFZ Grounds",
    safetyScore: "Safety Score",
    tide: "Tide Phase",
    emergency: "Emergency Return",
    eta: "ETA",
  };

  // Compact collapsed bar
  if (collapsed) {
    return (
      <div
        className="absolute top-3 left-3 z-[999] transition-all duration-200 select-none"
        style={{
          background: "var(--hud-bg)",
          backdropFilter: "blur(16px)",
          border: "1px solid var(--hud-border)",
          borderRadius: 8,
          boxShadow: "var(--hud-shadow)",
          padding: "6px 12px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: outlook.mode === "LIVE" ? "#22C55E" : "#F59E0B",
              boxShadow: outlook.mode === "LIVE" ? "0 0 8px #22C55E" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 10,
              fontWeight: 800,
              color: "var(--ocean-bright)",
              letterSpacing: "0.1em",
            }}
          >
            HUD
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
          <span style={{ color: "var(--text-bright)" }}>
            ≋ {safety.wave_height_m?.toFixed(1) ?? "—"}m
          </span>
          <span style={{ color: "var(--text-dim)" }}>|</span>
          <span style={{ color: "var(--text-bright)" }}>
            ↑ {Math.round(safety.wind_speed_kmh ?? 0)} km/h
          </span>
          <span style={{ color: "var(--text-dim)" }}>|</span>
          <span style={{ color: riskCol, fontWeight: 700 }}>
            {score} {category}
          </span>
        </div>

        <button
          onClick={() => setCollapsed(false)}
          title="Expand Instrument HUD"
          style={{
            background: "var(--hud-header-bg)",
            border: "1px solid var(--hud-border)",
            color: "var(--ocean-bright)",
            borderRadius: 4,
            padding: "2px 6px",
            fontSize: 9,
            cursor: "pointer",
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          }}
        >
          ▼
        </button>
      </div>
    );
  }

  // Full Expanded Glass HUD
  return (
    <div
      className="absolute top-3 left-3 z-[999] transition-all duration-200 select-none"
      style={{
        width: 310,
        maxWidth: "calc(100% - 24px)",
        background: "var(--hud-bg)",
        backdropFilter: "blur(18px)",
        border: "1px solid var(--hud-border)",
        borderRadius: 8,
        boxShadow: "var(--hud-shadow)",
        overflow: "hidden",
      }}
    >
      {/* Top HUD Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "var(--hud-header-bg)",
          borderBottom: "1px solid var(--hud-border-dim)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: outlook.mode === "LIVE" ? "#22C55E" : "#F59E0B",
              boxShadow: outlook.mode === "LIVE" ? "0 0 8px #22C55E" : "none",
              animation: outlook.mode === "LIVE" ? "blink 2s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--ocean-bright)",
            }}
          >
            {labels.hudTitle}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: 3,
              background: outlook.mode === "LIVE" ? "rgba(34,197,94,0.15)" : "rgba(245,158,11,0.15)",
              color: outlook.mode === "LIVE" ? "#22C55E" : "#F59E0B",
              fontWeight: 700,
            }}
          >
            {outlook.mode}
          </span>
          <button
            onClick={() => setCollapsed(true)}
            title="Minimize HUD"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-faint)",
              fontSize: 10,
              cursor: "pointer",
              padding: "0 2px",
            }}
          >
            ▲
          </button>
        </div>
      </div>

      {/* 4 Primary Instruments Grid */}
      <div style={{ padding: "10px 12px 6px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {/* Wave */}
          <div
            style={{
              background: "var(--hud-card-bg)",
              border: "1px solid var(--hud-card-border)",
              borderRadius: 6,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
              <span style={{ color: "var(--ocean)" }}>≋</span> {labels.wave}
            </div>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 20, fontWeight: 800, color: "var(--text-bright)", lineHeight: 1.1, marginTop: 4 }}>
              {safety.wave_height_m?.toFixed(1) ?? "—"}{" "}
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)" }}>m</span>
            </div>
          </div>

          {/* Wind */}
          <div
            style={{
              background: "var(--hud-card-bg)",
              border: "1px solid var(--hud-card-border)",
              borderRadius: 6,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
              <span style={{ color: "var(--ocean)" }}>↑</span> {labels.wind}
            </div>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 20, fontWeight: 800, color: "var(--text-bright)", lineHeight: 1.1, marginTop: 4 }}>
              {Math.round(safety.wind_speed_kmh ?? 0)}{" "}
              <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)" }}>km/h</span>
            </div>
          </div>

          {/* Sea State */}
          <div
            style={{
              background: "var(--hud-card-bg)",
              border: "1px solid var(--hud-card-border)",
              borderRadius: 6,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
              <span style={{ color: "var(--ocean)" }}>◈</span> {labels.seaState}
            </div>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", lineHeight: 1.1, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {safety.sea_state || "Moderate"}
            </div>
          </div>

          {/* Tide / PFZ */}
          <div
            style={{
              background: "var(--hud-card-bg)",
              border: "1px solid var(--hud-card-border)",
              borderRadius: 6,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
              <span style={{ color: "var(--ocean)" }}>◉</span> {labels.pfz}
            </div>
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 16, fontWeight: 800, color: "var(--ocean-bright)", lineHeight: 1.1, marginTop: 5 }}>
              {outlook.areas.length}{" "}
              <span style={{ fontSize: 9, fontWeight: 500, color: "var(--text-dim)" }}>
                in {outlook.radius_km}km
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Score Barograph */}
      <div style={{ padding: "6px 12px 10px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-faint)" }}>
            {labels.safetyScore}
          </span>
          <span
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 16,
              fontWeight: 900,
              color: riskCol,
            }}
          >
            {score}{" "}
            <span style={{ fontSize: 10, fontWeight: 700, color: riskCol }}>
              {category}
            </span>
          </span>
        </div>

        {/* Miniature Barograph */}
        <div
          style={{
            position: "relative",
            height: 6,
            background: "var(--hud-card-border)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, Math.max(0, score))}%`,
              height: "100%",
              background: riskCol,
              boxShadow: `0 0 8px ${riskCol}`,
              borderRadius: 3,
              transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </div>
      </div>

      {/* Emergency Route Alert (if available) */}
      {emergencyRoute && emergencyRoute.available && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(239, 68, 68, 0.12)",
            borderTop: "1px solid rgba(239, 68, 68, 0.28)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 9, color: "#EF4444", fontWeight: 700, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {labels.emergency}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-bright)", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontWeight: 700, marginTop: 1 }}>
              → {emergencyRoute.destination?.name || "Nearest Safe Port"}: {emergencyRoute.distance_km} km
            </div>
          </div>
          <div style={{ textAlign: "right", fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
            <div style={{ fontSize: 8, color: "var(--text-faint)" }}>{labels.eta}</div>
            <div style={{ fontSize: 11, color: "var(--text-mid)", fontWeight: 700 }}>
              {Math.floor((emergencyRoute.eta_minutes ?? 0) / 60)}h {(emergencyRoute.eta_minutes ?? 0) % 60}m
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
