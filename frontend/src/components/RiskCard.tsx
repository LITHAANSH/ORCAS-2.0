import { useState } from "react";
import type { Evidence, Language, RiskAssessment } from "../types";
import { LockGlyph } from "./glyphs";
import RiskDial, { RISK_COLOR } from "./RiskDial";

const VERDICT: Record<Language, Record<string, string>> = {
  en: {
    LOW: "Conditions look safe",
    MODERATE: "Go with caution",
    HIGH: "High risk — not recommended",
    EXTREME: "EXTREME — do not go to sea",
  },
  hi: {
    LOW: "स्थिति सुरक्षित लग रही है",
    MODERATE: "सावधानी से जाएँ",
    HIGH: "जोखिम अधिक है — जाने की सलाह नहीं",
    EXTREME: "अत्यधिक जोखिम — समुद्र में न जाएँ",
  },
  kn: {
    LOW: "ಪರಿಸ್ಥಿತಿಗಳು ಸುರಕ್ಷಿತವಾಗಿವೆ",
    MODERATE: "ಎಚ್ಚರಿಕೆಯಿಂದ ಹೋಗಿ",
    HIGH: "ಅಪಾಯ ಹೆಚ್ಚು — ಹೋಗುವುದು ಶಿಫಾರಸು ಮಾಡುವುದಿಲ್ಲ",
    EXTREME: "ಅತ್ಯಂತ ಅಪಾಯ — ಸಮುದ್ರಕ್ಕೆ ಹೋಗಬೇಡಿ",
  },
};

const UI: Record<Language, Record<string, string>> = {
  en: {
    why: "Risk factors — ranked contribution",
    warning: "Official warning active",
    improves: "Conditions expected to improve after",
    askAgain: "— ask again then.",
    overrides: "Safety overrides applied",
    overrideNote:
      "Deterministic rules can only raise a risk score — never lower it. No model or language output can talk ORCA down from an official warning.",
    evidence: "Evidence",
    traced: "traced values",
    show: "show",
    hide: "hide",
    cols: "Value|Reading|Source|Updated",
    riskAssessment: "ORCA RISK ASSESSMENT",
    mode: "mode",
  },
  hi: {
    why: "जोखिम कारक — योगदान",
    warning: "आधिकारिक चेतावनी जारी",
    improves: "स्थिति सुधरने की संभावना",
    askAgain: "बजे के बाद — तब दोबारा पूछें।",
    overrides: "सुरक्षा नियम लागू",
    overrideNote: "नियम केवल जोखिम बढ़ा सकते हैं, घटा नहीं।",
    evidence: "प्रमाण",
    traced: "स्रोत-सहित मान",
    show: "दिखाएँ",
    hide: "छिपाएँ",
    cols: "मान|रीडिंग|स्रोत|अपडेट",
    riskAssessment: "ORCA जोखिम मूल्यांकन",
    mode: "मोड",
  },
  kn: {
    why: "ಅಪಾಯ ಅಂಶಗಳು — ಕೊಡುಗೆ",
    warning: "ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ ಸಕ್ರಿಯ",
    improves: "ಪರಿಸ್ಥಿತಿ ಸುಧಾರಿಸುವ ನಿರೀಕ್ಷೆ",
    askAgain: "ನಂತರ — ಆಗ ಮತ್ತೆ ಕೇಳಿ.",
    overrides: "ಸುರಕ್ಷತಾ ನಿಯಮಗಳು ಅನ್ವಯಿಸಲಾಗಿದೆ",
    overrideNote: "ನಿಯಮಗಳು ಅಪಾಯದ ಅಂಕವನ್ನು ಹೆಚ್ಚಿಸಬಹುದು, ಕಡಿಮೆ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ.",
    evidence: "ಸಾಕ್ಷ್ಯ",
    traced: "ಮೂಲಗಳಿರುವ ಮೌಲ್ಯಗಳು",
    show: "ತೋರಿಸಿ",
    hide: "ಮರೆಮಾಡಿ",
    cols: "ಮೌಲ್ಯ|ಓದು|ಮೂಲ|ನವೀಕರಿಸಲಾಗಿದೆ",
    riskAssessment: "ORCA ಅಪಾಯ ಮೌಲ್ಯಮಾಪನ",
    mode: "ಮೋಡ್",
  },
};

export default function RiskCard({
  risk,
  evidence,
  language = "en",
}: {
  risk: RiskAssessment;
  evidence: Evidence[];
  language?: Language;
}) {
  const ui = UI[language] ?? UI.en;
  const [colValue, colReading, colSource, colUpdated] = ui.cols.split("|");
  const [showEvidence, setShowEvidence] = useState(false);
  const color = RISK_COLOR[risk.category];
  const top = risk.factors.filter((f) => f.contribution > 0).slice(0, 5);
  const max = Math.max(...top.map((f) => f.contribution), 1);
  const isUrgent = risk.category === "HIGH" || risk.category === "EXTREME";

  return (
    <div
      className="m-panel overflow-hidden"
      style={{
        borderColor: isUrgent ? `${color}40` : undefined,
        boxShadow: isUrgent ? `0 0 30px ${color}15` : undefined,
      }}
    >
      {/* ---- HEADER ---- */}
      <div className="m-hd" style={{
        background: isUrgent ? `linear-gradient(180deg, ${color}12, transparent)` : undefined,
      }}>
        <div style={{
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: isUrgent ? color : "var(--text-dim)",
        }}>
          {ui.riskAssessment}
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          {risk.official_warning && (
            <span style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "2px 7px",
              border: "1px solid rgba(239,68,68,0.6)",
              color: "#EF4444",
              animation: "inkblink 1.8s ease-in-out infinite",
            }}>
              ⚠ {ui.warning}
            </span>
          )}
          <span style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--text-faint)",
            letterSpacing: "0.1em",
          }}>
            {risk.mode}
          </span>
        </div>
      </div>

      {/* ---- SCORE + VERDICT ---- */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 20,
        padding: "16px 18px",
      }}>
        <RiskDial score={risk.score} category={risk.category} size={130} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Category stamp */}
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color,
            marginBottom: 6,
          }}>
            {risk.category}
          </div>

          {/* Verdict */}
          <div style={{
            fontFamily: "'Fraunces Variable', Georgia, serif",
            fontSize: 18,
            fontWeight: 700,
            color: isUrgent ? color : "var(--text-bright)",
            lineHeight: 1.3,
            marginBottom: 12,
          }}>
            {(VERDICT[language] ?? VERDICT.en)[risk.category]}
          </div>

          {/* Improve window */}
          {risk.window && (
            <div style={{
              padding: "8px 12px",
              border: "1px dashed rgba(34,197,94,0.4)",
              background: "rgba(34,197,94,0.05)",
              borderRadius: 2,
              fontSize: 12,
              color: "var(--risk-low)",
              lineHeight: 1.5,
            }}>
              {ui.improves}{" "}
              <strong style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace" }}>
                {risk.window}
              </strong>{" "}
              {ui.askAgain}
            </div>
          )}
        </div>
      </div>

      {/* ---- FACTORS ---- */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "14px 18px" }}>
        <div style={{
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          fontSize: 8.5,
          fontWeight: 700,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          marginBottom: 12,
        }}>
          {ui.why}
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {top.map((f) => (
            <li key={f.key}>
              <div style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 4,
              }}>
                <span style={{ fontSize: 12, color: "var(--text-mid)", fontWeight: 500 }}>
                  {f.label}
                </span>
                <span style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 11,
                  fontWeight: 700,
                  color,
                  flexShrink: 0,
                }}>
                  +{f.contribution.toFixed(1)}
                </span>
              </div>
              {/* Bar */}
              <div style={{
                height: 3,
                background: "var(--surface-3)",
                borderRadius: 2,
                overflow: "hidden",
              }}>
                <div
                  className="grow-x"
                  style={{
                    height: "100%",
                    width: `${(f.contribution / max) * 100}%`,
                    background: color,
                    borderRadius: 2,
                    opacity: 0.75,
                  }}
                />
              </div>
              {f.detail && (
                <div style={{
                  marginTop: 3,
                  fontSize: 11,
                  color: "var(--text-faint)",
                  lineHeight: 1.5,
                }}>
                  {f.detail}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* ---- OVERRIDES ---- */}
      {risk.overrides.length > 0 && (
        <div style={{
          borderTop: "1px solid rgba(239,68,68,0.3)",
          padding: "12px 18px",
          background: "rgba(239,68,68,0.04)",
          backgroundImage: "repeating-linear-gradient(45deg, rgba(239,68,68,0.04) 0 1.5px, transparent 1.5px 8px)",
        }}>
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#EF4444",
            marginBottom: 8,
          }}>
            {ui.overrides}
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {risk.overrides.map((o, i) => (
              <li key={i} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 12,
                color: "var(--text-mid)",
              }}>
                <LockGlyph size={12} style={{ marginTop: 2, flexShrink: 0, color: "#EF4444" } as React.CSSProperties} />
                {o}
              </li>
            ))}
          </ul>
          <p style={{
            marginTop: 8,
            fontSize: 10,
            color: "var(--text-faint)",
            fontStyle: "italic",
            lineHeight: 1.6,
          }}>
            {ui.overrideNote}
          </p>
        </div>
      )}

      {/* ---- EVIDENCE ---- */}
      <div style={{ borderTop: "1px solid var(--border)", padding: "10px 18px" }}>
        <button
          onClick={() => setShowEvidence((v) => !v)}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <span style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}>
            {ui.evidence} · {evidence.length} {ui.traced}
          </span>
          <span style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            color: "var(--ocean)",
            letterSpacing: "0.1em",
          }}>
            {showEvidence ? `${ui.hide} ▴` : `${ui.show} ▾`}
          </span>
        </button>

        {showEvidence && (
          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table style={{
              width: "100%",
              textAlign: "left",
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 10,
              borderCollapse: "collapse",
            }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[colValue, colReading, colSource, colUpdated].map((h) => (
                    <th key={h} style={{
                      paddingBottom: 6,
                      paddingRight: 12,
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--text-faint)",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                    <td style={{ padding: "5px 12px 5px 0", color: "var(--text-mid)", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 11 }}>
                      {e.label}
                    </td>
                    <td style={{ padding: "5px 12px 5px 0", fontWeight: 700, color: "var(--text-bright)" }}>
                      {e.value}
                    </td>
                    <td style={{ padding: "5px 12px 5px 0", color: "var(--text-dim)" }}>
                      {e.source}
                    </td>
                    <td style={{ padding: "5px 0", color: "var(--text-dim)" }}>
                      {e.timestamp?.slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
