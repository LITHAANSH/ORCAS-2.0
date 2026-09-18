import React, { useState } from "react";
import type { CatchRating, FishingOutlook, Language } from "../types";
import { FishGlyph, SchoolGlyph, WarnGlyph } from "./glyphs";

export const RATING_COLOR: Record<CatchRating, string> = {
  very_good: "#22C55E",
  good:      "#84CC16",
  fair:      "#F59E0B",
  poor:      "#EF4444",
};

const RATING_WORD: Record<Language, Record<CatchRating, string>> = {
  en: { very_good: "Very good", good: "Good", fair: "Some chance", poor: "Low chance" },
  hi: { very_good: "बहुत अच्छा", good: "अच्छा", fair: "कुछ उम्मीद", poor: "कम उम्मीद" },
  kn: { very_good: "ಬಹಳ ಉತ್ತಮ", good: "ಉತ್ತಮ", fair: "ಸ್ವಲ್ಪ ಸಾಧ್ಯತೆ", poor: "ಕಡಿಮೆ ಸಾಧ್ಯತೆ" },
};

const T: Record<Language, Record<string, string>> = {
  en: {
    advice: "ORCA RECOMMENDATION", areas: "Best fishing zones", within: "within", away: "away", chance: "chance",
    trip: "TRIP PLAN", stay: "Stay", travel: "Travel each way", total: "Round trip", hours: "h", min: "min",
    bestTime: "Best window", avoid: "AVOID THESE AREAS", closedNow: "active now", closedBetween: "closed",
    always: "always closed", forecast: "3-DAY FORECAST", today: "Today", tomorrow: "Tomorrow", dayAfter: "Day 3",
    bestAt: "best at", notWorth: "Insufficient safe time for this trip today.",
    likely: "Likely", likelyNote: "from SST + chlorophyll — never a promise",
    returnBy: "RETURN BY", returnWhy: "waves reach", econ: "TRIP ECONOMICS",
    fuel: "Fuel", catch: "Catch", revenue: "Revenue", profit: "Profit",
    econNote: "Planning estimate — not a guarantee.", barsCaption: "Factors: chlorophyll · SST · front · sea · time",
    pfzTitle: "PFZ INTELLIGENCE", pfzSub: "Potential Fishing Zones",
    targetTitle: "TARGET CATCH SPECIES", allCatch: "All Commercial Species",
    tideTitle: "TIDES & SOLUNAR INTELLIGENCE", tideSub: "Astronomical lunar cycles & coastal tidal schedule",
    nextHigh: "Next High", nextLow: "Next Low", tidalRange: "Tidal Range", currentLevel: "Current Tide",
    solunarFish: "Solunar Fish Feeding", match: "Match",
  },
  hi: {
    advice: "ORCA सुझाव", areas: "मछली पकड़ने की सबसे अच्छी जगहें", within: "के अंदर", away: "दूर", chance: "मछली की उम्मीद",
    trip: "यात्रा योजना", stay: "वहाँ रुकें", travel: "एक तरफ़", total: "कुल यात्रा", hours: "घंटे", min: "मिनट",
    bestTime: "सबसे अच्छा समय", avoid: "इन जगहों से बचें", closedNow: "अभी सक्रिय", closedBetween: "बंद",
    always: "हमेशा बंद", forecast: "3 दिन का अनुमान", today: "आज", tomorrow: "कल", dayAfter: "परसों",
    bestAt: "सबसे अच्छा", notWorth: "आज इस यात्रा के लिए पर्याप्त समय नहीं।",
    likely: "संभावित", likelyNote: "SST और क्लोरोफिल से — कोई गारंटी नहीं",
    returnBy: "इससे पहले लौटें", returnWhy: "लहरें होंगी", econ: "यात्रा का अर्थशास्त्र",
    fuel: "ईंधन", catch: "मछली", revenue: "आमदनी", profit: "मुनाफ़ा",
    econNote: "अनुमान — कोई वादा नहीं।", barsCaption: "कारक: क्लोरोफिल · SST · फ्रंट · समुद्र · समय",
    pfzTitle: "PFZ बुद्धिमत्ता", pfzSub: "संभावित मत्स्य क्षेत्र",
    targetTitle: "लक्षित मछली प्रजाति", allCatch: "सभी वाणिज्यिक प्रजातियाँ",
    tideTitle: "ज्वार और चंद्र बुद्धिमत्ता", tideSub: "खगोलीय चंद्र कला और तटीय ज्वार समय",
    nextHigh: "अगला उच्च ज्वार", nextLow: "अगला निम्न ज्वार", tidalRange: "ज्वार अंतर", currentLevel: "वर्तमान स्तर",
    solunarFish: "मछली भोजन गतिविधि", match: "अनुकूलता",
  },
  kn: {
    advice: "ORCA ಶಿಫಾರಸು", areas: "ಮೀನುಗಾರಿಕೆಗೆ ಉತ್ತಮ ಪ್ರದೇಶಗಳು", within: "ಒಳಗೆ", away: "ದೂರ", chance: "ಸಾಧ್ಯತೆ",
    trip: "ಪ್ರವಾಸ ಯೋಜನೆ", stay: "ಅಲ್ಲಿ ಇರಿ", travel: "ಒಂದು ದಿಕ್ಕು", total: "ಒಟ್ಟು", hours: "ಗಂಟೆ", min: "ನಿಮಿಷ",
    bestTime: "ಉತ್ತಮ ಸಮಯ", avoid: "ಈ ಪ್ರದೇಶಗಳಿಂದ ದೂರ ಇರಿ", closedNow: "ಈಗ ಸಕ್ರಿಯ", closedBetween: "ಮುಚ್ಚಲಾಗಿದೆ",
    always: "ಯಾವಾಗಲೂ ಮುಚ್ಚಲಾಗಿದೆ", forecast: "3 ದಿನದ ಮುನ್ಸೂಚನೆ", today: "ಇಂದು", tomorrow: "ನಾಳೆ", dayAfter: "ನಾಡಿದ್ದು",
    bestAt: "ಉತ್ತಮ ಸಮಯ", notWorth: "ಇಂದು ಸಾಕಷ್ಟು ಸಮಯವಿಲ್ಲ.",
    likely: "ಸಂಭಾವ್ಯ", likelyNote: "SST ಮತ್ತು ಕ್ಲೋರೊಫಿಲ್ ಆಧಾರಿತ — ಖಾತರಿ ಇಲ್ಲ",
    returnBy: "ಮರಳಬೇಕಾದ ಸಮಯ", returnWhy: "ಅಲೆಗಳು", econ: "ಪ್ರವಾಸದ ಅರ್ಥಶಾಸ್ತ್ರ",
    fuel: "ಇಂಧನ", catch: "ಮೀನು", revenue: "ಆದಾಯ", profit: "ಲಾಭ",
    econNote: "ಯೋಜನಾ ಅಂದಾಜು — ಖಾತರಿ ಇಲ್ಲ.", barsCaption: "ಅಂಶಗಳು: ಕ್ಲೋರೊಫಿಲ್ · SST · ಮುಂಭಾಗ · ಸಮುದ್ರ · ಸಮಯ",
    pfzTitle: "PFZ ಬುದ್ಧಿಮತ್ತೆ", pfzSub: "ಸಂಭಾವ್ಯ ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು",
    targetTitle: "ಗುರಿ ಮೀನು ಜಾತಿಗಳು", allCatch: "ಎಲ್ಲಾ ವಾಣಿಜ್ಯ ಜಾತಿಗಳು",
    tideTitle: "ಉಬ್ಬರವಿಳಿತ ಮತ್ತು ಚಂದ್ರನ ಬುದ್ಧಿಮತ್ತೆ", tideSub: "ಖಗೋಳ ಚಂದ್ರನ ಹಂತ ಮತ್ತು ಕರಾವಳಿ ವೇಳಾಪಟ್ಟಿ",
    nextHigh: "ಮುಂದಿನ ಉಬ್ಬರ", nextLow: "ಮುಂದಿನ ಇಳಿತ", tidalRange: "ಉಬ್ಬರ ವ್ಯಾಪ್ತಿ", currentLevel: "ಪ್ರಸ್ತುತ ಮಟ್ಟ",
    solunarFish: "ಮೀನು ಚಟುವಟಿಕೆ ರೇಟಿಂಗ್", match: "ಹೊಂದಾಣಿಕೆ",
  },
};

const FACTOR_ORDER: { key: string; label: string }[] = [
  { key: "chlorophyll", label: "Chl" },
  { key: "sst", label: "SST" },
  { key: "front", label: "Front" },
  { key: "sea_state", label: "Sea" },
  { key: "time_of_day", label: "Time" },
];

function clock12(h: number): string {
  const hh = h % 24;
  return `${hh % 12 || 12}${hh < 12 ? "AM" : "PM"}`;
}

function dayName(offset: number, t: Record<string, string>): string {
  return offset === 0 ? t.today : offset === 1 ? t.tomorrow : t.dayAfter;
}

// ---- Shared styles ----
const SEC_LABEL: React.CSSProperties = {
  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
  fontSize: 8.5,
  fontWeight: 800,
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--text-faint)",
  marginBottom: 8,
};

export default function FishingPanel({
  data,
  language = "en",
  selectedSpecies,
  onSelectSpecies,
  onSelectArea,
}: {
  data: FishingOutlook;
  language?: Language;
  selectedSpecies?: string | null;
  onSelectSpecies?: (id: string | null) => void;
  onSelectArea?: (rank: number) => void;
}) {
  const t = T[language] ?? T.en;
  const words = RATING_WORD[language] ?? RATING_WORD.en;
  const top = data.areas.slice(0, 3);
  const [showValidation, setShowValidation] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* ---- DATA VALIDATION & RELIABILITY SCORE (0-10) ---- */}
      {data.reliability_score !== undefined && (
        <div className="m-panel overflow-hidden" style={{ borderLeft: `3px solid ${data.reliability_score >= 8.5 ? "var(--risk-low)" : data.reliability_score >= 7.0 ? "var(--ocean)" : "var(--risk-mod)"}` }}>
          <div className="m-hd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--ocean)", fontSize: 13 }}>✦</span>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
                Data Validation & Reliability
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 13,
                fontWeight: 900,
                color: data.reliability_score >= 8.5 ? "var(--risk-low)" : data.reliability_score >= 7.0 ? "var(--ocean-bright)" : "var(--risk-mod)",
                background: "var(--surface-2)",
                padding: "2px 8px",
                borderRadius: 3,
                border: "1px solid var(--border)",
              }}>
                {data.reliability_score.toFixed(1)} <span style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 500 }}>/ 10</span>
              </div>
              <span style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 9,
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 6px",
                borderRadius: 2,
                background: data.reliability_score >= 8.5 ? "rgba(34,197,94,0.15)" : data.reliability_score >= 7.0 ? "rgba(0,168,204,0.15)" : "rgba(245,158,11,0.15)",
                color: data.reliability_score >= 8.5 ? "var(--risk-low)" : data.reliability_score >= 7.0 ? "var(--ocean-bright)" : "var(--risk-mod)",
              }}>
                {data.validation?.rating || (data.reliability_score >= 8.5 ? "High" : "Moderate")}
              </span>
            </div>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <p style={{ fontSize: 11, color: "var(--text-mid)", margin: 0, lineHeight: 1.5, flex: 1, minWidth: 200 }}>
                {data.validation?.provenance_summary || "Telemetry cross-checked against Indian Ocean and coastal physical boundary models."}
              </p>
              <button
                onClick={() => setShowValidation(v => !v)}
                style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "var(--ocean-bright)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  padding: "4px 8px",
                  borderRadius: 2,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span>{showValidation ? "Hide Checks" : `View Checks (${data.validation?.checks_passed || 0}/${data.validation?.checks_total || 0} Passed)`}</span>
                <span>{showValidation ? "▲" : "▼"}</span>
              </button>
            </div>

            {/* Expandable Validation Checklist */}
            {showValidation && data.validation && (
              <div style={{
                marginTop: 6,
                padding: "10px",
                background: "var(--surface-2)",
                borderRadius: 3,
                border: "1px solid var(--border)",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, color: "var(--text-faint)", textTransform: "uppercase" }}>
                    Automated Physical & Boundary Checks
                  </span>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: data.validation.is_valid ? "var(--risk-low)" : "var(--risk-high)" }}>
                    {data.validation.is_valid ? "✓ ALL CRITICAL CHECKS PASSED" : "⚠ ISSUES DETECTED"}
                  </span>
                </div>
                {data.validation.checks.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                      fontSize: 11,
                      padding: "6px 8px",
                      borderRadius: 2,
                      background: "var(--surface)",
                      border: `1px solid ${c.passed ? "rgba(34,197,94,0.15)" : c.severity === "error" ? "rgba(239,68,68,0.25)" : "rgba(245,158,11,0.25)"}`,
                    }}
                  >
                    <span style={{ color: c.passed ? "var(--risk-low)" : c.severity === "error" ? "var(--risk-extreme)" : "var(--risk-mod)", fontWeight: 800, fontSize: 11, marginTop: 1 }}>
                      {c.passed ? "✓" : "✗"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}>
                        <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, fontWeight: 700, color: "var(--text-bright)" }}>
                          {c.name.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--ocean-dim)" }}>
                          {String(c.value)}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                        {c.message} <span style={{ color: "var(--text-dim)" }}>({c.expected})</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- TARGET SPECIES SELECTOR ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
            {t.targetTitle}
          </div>
          {selectedSpecies && (
            <button
              onClick={() => onSelectSpecies?.(null)}
              style={{
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 8,
                color: "var(--ocean)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Reset
            </button>
          )}
        </div>
        <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button
            onClick={() => onSelectSpecies?.(null)}
            style={{
              padding: "6px 10px",
              borderRadius: 2,
              border: `1px solid ${!selectedSpecies ? "var(--ocean)" : "var(--border)"}`,
              background: !selectedSpecies ? "rgba(0,168,204,0.15)" : "var(--surface-2)",
              color: !selectedSpecies ? "var(--ocean-bright)" : "var(--text-mid)",
              fontSize: 11,
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontWeight: !selectedSpecies ? 700 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            🐟 {t.allCatch}
          </button>
          {(data.species_catalog || []).map((sp) => {
            const isSel = selectedSpecies === sp.id;
            const vernName = sp.vernacular[language] || sp.name;
            return (
              <button
                key={sp.id}
                onClick={() => onSelectSpecies?.(isSel ? null : sp.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  borderRadius: 2,
                  border: `1px solid ${isSel ? "var(--ocean)" : "var(--border)"}`,
                  background: isSel ? "rgba(0,168,204,0.15)" : "var(--surface-2)",
                  color: isSel ? "var(--ocean-bright)" : "var(--text-mid)",
                  fontSize: 11,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontWeight: 700 }}>{vernName}</span>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: isSel ? "var(--ocean-dim)" : "var(--text-faint)" }}>
                  ₹{sp.market_price_inr_per_kg}/kg
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- ADVICE ---- */}
      <div className="m-panel overflow-hidden">
        <div className="m-hd">
          <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
            {t.advice}
          </div>
        </div>
        <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {data.advice.map((line, i) =>
            i === 0 ? (
              <p key={i} style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 16, fontWeight: 700, color: "var(--text-bright)", lineHeight: 1.4 }}>
                {line}
              </p>
            ) : (
              <p key={i} style={{ display: "flex", gap: 8, fontSize: 12, lineHeight: 1.6, color: "var(--text-mid)" }}>
                <span style={{ marginTop: 6, width: 5, height: 5, flexShrink: 0, background: "var(--ocean)", transform: "rotate(45deg)", display: "inline-block" }} />
                <span>{line}</span>
              </p>
            )
          )}
        </div>
      </div>

      {/* ---- PFZ ZONES ---- */}
      {top.length > 0 && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
                {t.pfzTitle}
              </div>
              <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", marginTop: 1 }}>
                {t.pfzSub}
              </div>
            </div>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ocean-dim)" }}>
              <SchoolGlyph size={22} />
              <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
                {data.radius_km}km
              </span>
            </span>
          </div>

          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {top.map((a) => {
              const rCol = RATING_COLOR[a.rating];
              return (
                <button
                  key={a.id}
                  onClick={() => onSelectArea?.(a.rank)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--surface-2)",
                    border: `1px solid ${rCol}30`,
                    borderRadius: 2,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.18s",
                    width: "100%",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = `${rCol}70`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = `0 4px 16px ${rCol}15`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = `${rCol}30`;
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Rank badge */}
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    border: `2.5px solid ${rCol}`,
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                    fontSize: 17,
                    fontWeight: 900,
                    color: rCol,
                    flexShrink: 0,
                    background: `${rCol}10`,
                  }}>
                    {a.rank}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                      <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 13, fontWeight: 700, color: "var(--text-bright)" }}>
                        {Math.round(a.distance_km)} km {t.away}
                      </span>
                      {a.recommended && (
                        <span style={{
                          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                          fontSize: 7,
                          fontWeight: 800,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          padding: "1px 6px",
                          border: `1px solid ${rCol}60`,
                          color: rCol,
                        }}>
                          {language === "kn" ? "ಅತ್ಯುತ್ತಮ" : language === "hi" ? "सुझाया" : "Best"}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 5 }}>
                      {words[a.rating]} · {t.chance}
                    </div>
                    {/* Factor bars */}
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {FACTOR_ORDER.map((f) => {
                        const v = a.factors?.[f.key];
                        if (v == null) return null;
                        return (
                          <span key={f.key} title={`${f.label}: ${Math.round(v * 100)}%`} style={{ display: "inline-block", height: 3, width: 22, overflow: "hidden", background: "var(--surface-3)", borderRadius: 1 }}>
                            <span className="grow-x" style={{ display: "block", height: "100%", width: `${Math.round(v * 100)}%`, background: rCol, opacity: 0.8 }} />
                          </span>
                        );
                      })}
                    </div>
                    {/* Species */}
                    {a.species_suitability ? (
                      <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 6px", background: "rgba(0,168,204,0.12)", border: "1px solid rgba(0,168,204,0.3)", borderRadius: 2 }}>
                        <FishGlyph size={11} className="swim" style={{ color: "var(--ocean-bright)" }} />
                        <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 700, color: "var(--ocean-bright)" }}>
                          {a.species_suitability.species_name} {t.match}: {Math.round(a.species_suitability.suitability * 100)}% ({a.species_suitability.status})
                        </span>
                      </div>
                    ) : (a.likely_species?.length ?? 0) > 0 ? (
                      <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 4, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--ocean-dim)" }}>
                        <FishGlyph size={11} className="swim" />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {a.likely_species!.map(s => s.split(" (")[0]).join(" · ")}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {/* Probability */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 22, fontWeight: 900, color: rCol, lineHeight: 1 }}>
                      {a.probability}
                      <span style={{ fontSize: 12, fontWeight: 500 }}>%</span>
                    </div>
                    <div style={{ marginTop: 4, height: 3, width: 60, overflow: "hidden", background: "var(--surface-3)", borderRadius: 1 }}>
                      <div className="grow-x" style={{ height: "100%", width: `${a.probability}%`, background: rCol }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Best window */}
          {data.best_window && (
            <div style={{
              borderTop: "1px solid var(--border)",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "rgba(34,197,94,0.04)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={SEC_LABEL as React.CSSProperties}>{t.bestTime}</div>
                <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 16, fontWeight: 800, color: "var(--risk-low)" }}>
                  {clock12(data.best_window.from_hour)} – {clock12(data.best_window.to_hour)}
                </div>
              </div>
            </div>
          )}

          <p style={{ padding: "6px 14px 8px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--text-faint)" }}>
            {t.barsCaption}
          </p>
        </div>
      )}

      {/* ---- TRIP PLAN ---- */}
      {data.duration && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.trip}
            </div>
          </div>
          {data.duration.feasible ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {[
                  { k: t.stay, v: `${data.duration.recommended_hours}`, u: t.hours, hero: true },
                  { k: t.travel, v: `${data.duration.travel_each_way_minutes}`, u: t.min, hero: false },
                  { k: t.total, v: `${data.duration.total_trip_hours}`, u: t.hours, hero: false },
                ].map((x, i) => (
                  <div key={x.k} style={{
                    padding: "12px 14px",
                    borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                    background: x.hero ? "rgba(34,197,94,0.05)" : "transparent",
                  }}>
                    <div style={SEC_LABEL as React.CSSProperties}>{x.k}</div>
                    <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 20, fontWeight: 800, color: x.hero ? "var(--risk-low)" : "var(--text-bright)", lineHeight: 1 }}>
                      {x.v}
                      <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>{x.u}</span>
                    </div>
                  </div>
                ))}
              </div>
              {data.duration.return_by && (
                <div style={{
                  borderTop: "1px solid rgba(239,68,68,0.25)",
                  padding: "10px 14px",
                  background: "rgba(239,68,68,0.05)",
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--risk-ext)" }}>
                    {t.returnBy}
                  </span>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 18, fontWeight: 900, color: "var(--risk-ext)" }}>
                    {data.duration.return_by}
                  </span>
                  {data.duration.return_reason_wave_m != null && (
                    <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, color: "var(--text-dim)" }}>
                      — {t.returnWhy} {data.duration.return_reason_wave_m}m
                    </span>
                  )}
                </div>
              )}
              {data.duration.limited_by_weather && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--risk-high)" }}>
                  <WarnGlyph size={12} />
                  {language === "kn" ? "ಹವಾಮಾನದಿಂದ ಸಮಯ ಕಡಿಮೆ — ಬೇಗ ಹಿಂದಿರುಗಿ." : language === "hi" ? "मौसम के कारण समय कम — जल्दी लौटें।" : "Weather shortens your window — return earlier."}
                </div>
              )}
            </>
          ) : (
            <p style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: "var(--risk-high)" }}>{t.notWorth}</p>
          )}
        </div>
      )}

      {/* ---- ECONOMICS ---- */}
      {data.economics && data.duration?.feasible && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.econ}
            </div>
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, color: "var(--text-faint)", letterSpacing: "0.1em" }}>
              {t.econNote}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
            {[
              { k: t.fuel, v: `₹${data.economics.fuel_cost_inr.toLocaleString("en-IN")}`, s: `${data.economics.fuel_litres}L`, hero: false },
              { k: t.catch, v: `${data.economics.catch_kg_low}–${data.economics.catch_kg_high}`, s: "kg", hero: false },
              { k: t.revenue, v: `₹${data.economics.revenue_inr.toLocaleString("en-IN")}`, s: "", hero: false },
              { k: t.profit, v: `₹${data.economics.profit_inr.toLocaleString("en-IN")}`, s: "", hero: true },
            ].map((x, i) => (
              <div key={x.k} style={{
                padding: "11px 14px",
                borderLeft: i % 2 === 1 ? "1px solid var(--border)" : "none",
                borderTop: i >= 2 ? "1px solid var(--border)" : "none",
                background: x.hero ? "rgba(34,197,94,0.05)" : "transparent",
              }}>
                <div style={SEC_LABEL as React.CSSProperties}>{x.k}</div>
                <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 16, fontWeight: 700, color: x.hero ? "var(--risk-low)" : "var(--text-bright)", lineHeight: 1 }}>
                  {x.v}
                  {x.s && <span style={{ fontSize: 9, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>{x.s}</span>}
                </div>
              </div>
            ))}
          </div>
          <p style={{ borderTop: "1px solid var(--border)", padding: "6px 14px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-faint)" }}>
            {data.economics.assumptions}
          </p>
        </div>
      )}

      {/* ---- AVOID ZONES ---- */}
      {data.avoid.length > 0 && (
        <div className="m-panel overflow-hidden" style={{ borderColor: "rgba(239,68,68,0.4)", backgroundImage: "repeating-linear-gradient(45deg, rgba(239,68,68,0.03) 0 1.5px, transparent 1.5px 8px)" }}>
          <div className="m-hd" style={{ borderColor: "rgba(239,68,68,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--risk-ext)" }}>
              <WarnGlyph size={12} />
              {t.avoid}
            </div>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {data.avoid.map((z) => (
              <div key={z.name} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <svg width="12" height="12" style={{ marginTop: 2, flexShrink: 0 }} aria-hidden>
                  <rect x="0.5" y="0.5" width="11" height="11" fill="url(#hatch-critical)" stroke="#EF4444" strokeWidth="1" />
                </svg>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-bright)" }}>{z.name}</div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>
                    {Math.round(z.distance_km)} km {t.away} ·{" "}
                    {z.window ? (
                      <span style={{ color: z.active_now ? "var(--risk-ext)" : "var(--text-dim)", fontWeight: z.active_now ? 700 : 400 }}>
                        {t.closedBetween} {z.window}{z.active_now ? ` (${t.closedNow})` : ""}
                      </span>
                    ) : t.always}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- TIDES & SOLUNAR INTELLIGENCE ---- */}
      {(data.tide || data.lunar) && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
                {t.tideTitle}
              </div>
              <div style={{ fontFamily: "'Fraunces Variable', Georgia, serif", fontSize: 13, fontWeight: 700, color: "var(--text-mid)", marginTop: 1 }}>
                {t.tideSub}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--border)" }}>
            {/* Moon Phase & Cycle */}
            <div style={{ padding: "12px 14px", borderRight: "1px solid var(--border)" }}>
              <div style={SEC_LABEL as React.CSSProperties}>LUNAR CYCLE</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 22 }}>{data.lunar?.phase_icon || "🌔"}</span>
                <div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 13, fontWeight: 800, color: "var(--text-bright)" }}>
                    {data.lunar?.phase_name || "Moon Phase"}
                  </div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-dim)", marginTop: 2 }}>
                    Age {data.lunar?.moon_age_days}d · {data.lunar?.illumination_pct}% lit
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 6, display: "inline-block", padding: "1px 6px", fontSize: 8.5, fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontWeight: 700, background: data.lunar?.is_spring_tide ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", color: data.lunar?.is_spring_tide ? "var(--risk-low)" : "var(--risk-mod)", border: `1px solid ${data.lunar?.is_spring_tide ? "rgba(34,197,94,0.3)" : "rgba(245,158,11,0.3)"}` }}>
                {data.lunar?.tide_cycle || "Semi-diurnal"}
              </div>
            </div>

            {/* Solunar Activity */}
            <div style={{ padding: "12px 14px", borderRight: "1px solid var(--border)", background: "rgba(0,168,204,0.03)" }}>
              <div style={SEC_LABEL as React.CSSProperties}>{t.solunarFish}</div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 20, fontWeight: 900, color: "var(--ocean-bright)", lineHeight: 1 }}>
                {data.lunar?.solunar_score ?? 75}
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>/100</span>
              </div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, fontWeight: 700, color: "var(--ocean)", marginTop: 4 }}>
                {data.lunar?.solunar_rating || "GOOD"}
              </div>
              <div style={{ fontSize: 8.5, color: "var(--text-faint)", marginTop: 3 }}>
                Optimal feeding at tidal turns
              </div>
            </div>

            {/* Current Sea Level & Tide */}
            <div style={{ padding: "12px 14px" }}>
              <div style={SEC_LABEL as React.CSSProperties}>{t.currentLevel}</div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 20, fontWeight: 900, color: "var(--text-bright)", lineHeight: 1 }}>
                {data.tide?.current_height_m ?? 1.8}
                <span style={{ fontSize: 10, fontWeight: 500, color: "var(--text-dim)", marginLeft: 3 }}>m</span>
              </div>
              <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 10, color: "var(--text-mid)", marginTop: 4 }}>
                {data.tide?.current_state || "Slack Water"}
              </div>
              <div style={{ fontSize: 8.5, color: "var(--text-faint)", marginTop: 3 }}>
                {t.tidalRange}: {data.tide?.tidal_range_m ?? 2.0}m
              </div>
            </div>
          </div>

          {/* Next High and Low Schedule */}
          {data.tide && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: "8px 14px", background: "var(--surface-2)", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-dim)" }}>
                  ▲ {t.nextHigh}:
                </span>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 11, fontWeight: 700, color: "var(--risk-low)" }}>
                  {data.tide.next_high_tide?.time} ({data.tide.next_high_tide?.height_m}m)
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-dim)" }}>
                  ▼ {t.nextLow}:
                </span>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 11, fontWeight: 700, color: "var(--ocean)" }}>
                  {data.tide.next_low_tide?.time} ({data.tide.next_low_tide?.height_m}m)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- 3-DAY FORECAST ---- */}
      {data.forecast.length > 1 && (
        <div className="m-panel overflow-hidden">
          <div className="m-hd">
            <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--ocean)" }}>
              {t.forecast}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.forecast.length, 3)}, 1fr)` }}>
            {data.forecast.slice(0, 3).map((f, i) => {
              const fCol = RATING_COLOR[f.rating];
              return (
                <div key={f.day_offset} style={{
                  padding: "12px 10px",
                  textAlign: "center",
                  borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                  background: f.day_offset === 0 ? "rgba(0,168,204,0.04)" : "transparent",
                }}>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>
                    {dayName(f.day_offset, t)}
                  </div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 24, fontWeight: 900, color: fCol, lineHeight: 1 }}>
                    {f.probability}<span style={{ fontSize: 12 }}>%</span>
                  </div>
                  <div style={{ fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
                    {t.bestAt} {clock12(f.best_hour)}
                  </div>
                  <div style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, color: "var(--text-faint)", marginTop: 2 }}>
                    {f.wave_height_m}m
                  </div>
                  {f.official_warning && (
                    <div style={{
                      marginTop: 6,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      border: "1px solid rgba(239,68,68,0.5)",
                      padding: "1px 5px",
                      color: "var(--risk-ext)",
                    }}>
                      <WarnGlyph size={9} />
                      <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 7, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>⚠</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ borderTop: "1px solid var(--border)", padding: "6px 14px 8px", fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 8, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-faint)" }}>
            {data.method}
          </p>
        </div>
      )}
    </div>
  );
}
