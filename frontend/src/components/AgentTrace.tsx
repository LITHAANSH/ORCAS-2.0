import type { AgentTrace as Trace, Language } from "../types";

const LABEL: Record<Language, Record<string, string>> = {
  en: {
    intent: "Intent", weather: "Weather", ocean: "Ocean", pfz: "Fishing Zones",
    cyclone: "Alerts", gis: "GIS", risk: "Risk Engine", route: "Route",
    explanation: "Explanation",
  },
  hi: {
    intent: "आशय", weather: "मौसम", ocean: "समुद्र", pfz: "मत्स्य क्षेत्र",
    cyclone: "चेतावनियाँ", gis: "GIS", risk: "रिस्क इंजन", route: "मार्ग",
    explanation: "व्याख्या",
  },
  kn: {
    intent: "ಉದ್ದೇಶ", weather: "ಹವಾಮಾನ", ocean: "ಸಮುದ್ರ", pfz: "ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು",
    cyclone: "ಎಚ್ಚರಿಕೆಗಳು", gis: "GIS", risk: "ಅಪಾಯ ಎಂಜಿನ್", route: "ಮಾರ್ಗ",
    explanation: "ವಿವರಣೆ",
  },
};

const T: Record<Language, Record<string, string>> = {
  en: {
    pipeline: "Intelligence Pipeline",
    crew: "Agent Crew",
    agents: "agents",
    total: "ms",
    concurrent: "parallel",
    understand: "Parse", understandN: "Understand query",
    gather: "Gather", gatherN: "Specialists run in parallel",
    decide: "Decide", decideN: "Fuse evidence + plan",
    explain: "Explain", explainN: "Answer in your language",
    note: "Specialists run concurrently. The risk engine waits for all — no agent can bypass it.",
    ok: "OK",
    skipped: "SKIP",
    failed: "FAIL",
    degraded: "DEGR",
  },
  hi: {
    pipeline: "बुद्धिमत्ता पाइपलाइन",
    crew: "एजेंट टीम",
    agents: "एजेंट",
    total: "ms",
    concurrent: "समानांतर",
    understand: "परखो", understandN: "सवाल समझो",
    gather: "जुटाओ", gatherN: "विशेषज्ञ एक साथ चलते हैं",
    decide: "तय करो", decideN: "प्रमाण जोड़ो, योजना बनाओ",
    explain: "समझाओ", explainN: "उपयोगकर्ता की भाषा में",
    note: "स्वतंत्र एजेंट एक साथ चलते हैं। रिस्क इंजन सबका इंतज़ार करता है।",
    ok: "OK", skipped: "SKIP", failed: "FAIL", degraded: "DEGR",
  },
  kn: {
    pipeline: "ಬುದ್ಧಿಮತ್ತೆ ಪೈಪ್‌ಲೈನ್",
    crew: "ಏಜೆಂಟ್ ತಂಡ",
    agents: "ಏಜೆಂಟ್‌ಗಳು",
    total: "ms",
    concurrent: "ಸಮಾನಾಂತರ",
    understand: "ವಿಶ್ಲೇಷಿಸಿ", understandN: "ಪ್ರಶ್ನೆ ಅರ್ಥಮಾಡಿ",
    gather: "ಸಂಗ್ರಹಿಸಿ", gatherN: "ತಜ್ಞರು ಏಕಕಾಲದಲ್ಲಿ",
    decide: "ನಿರ್ಧರಿಸಿ", decideN: "ಸಾಕ್ಷ್ಯ ಸೇರಿಸಿ, ಯೋಜಿಸಿ",
    explain: "ವಿವರಿಸಿ", explainN: "ಬಳಕೆದಾರ ಭಾಷೆಯಲ್ಲಿ",
    note: "ಸ್ವತಂತ್ರ ಏಜೆಂಟ್‌ಗಳು ಏಕಕಾಲದಲ್ಲಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಾರೆ. ಅಪಾಯ ಎಂಜಿನ್ ಎಲ್ಲರಿಗಾಗಿ ಕಾಯುತ್ತದೆ.",
    ok: "OK", skipped: "SKIP", failed: "FAIL", degraded: "DEGR",
  },
};

const PHASES: { key: string; agents: string[] }[] = [
  { key: "understand", agents: ["intent"] },
  { key: "gather", agents: ["weather", "ocean", "pfz", "cyclone", "gis"] },
  { key: "decide", agents: ["risk", "route"] },
  { key: "explain", agents: ["explanation"] },
];

const STATUS_COLOR: Record<Trace["status"], string> = {
  ok: "var(--risk-low)",
  degraded: "var(--risk-mod)",
  failed: "var(--risk-ext)",
  skipped: "var(--text-faint)",
};

const STATUS_BG: Record<Trace["status"], string> = {
  ok: "rgba(34,197,94,0.1)",
  degraded: "rgba(245,158,11,0.1)",
  failed: "rgba(239,68,68,0.1)",
  skipped: "transparent",
};

export default function AgentTracePanel({
  trace,
  elapsed,
  language = "en",
}: {
  trace: Trace[];
  elapsed?: number;
  language?: Language;
}) {
  if (!trace.length) return null;
  const t = T[language] ?? T.en;
  const labels = LABEL[language] ?? LABEL.en;

  const byName = new Map(trace.map((x) => [x.agent, x]));
  const maxLatency = Math.max(...trace.map((x) => x.latency_ms), 1);
  const totalMs = elapsed ?? trace.reduce((s, x) => s + x.latency_ms, 0);
  const ran = PHASES.map((p) => ({
    ...p,
    title: t[p.key],
    note: t[`${p.key}N`],
    rows: p.agents.map((a) => byName.get(a)).filter(Boolean) as Trace[],
  })).filter((p) => p.rows.length);

  const okCount = trace.filter(x => x.status === "ok").length;

  return (
    <div className="m-panel overflow-hidden">
      {/* Header */}
      <div className="m-hd">
        <div>
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--ocean)",
          }}>
            {t.pipeline}
          </div>
          <div style={{
            fontFamily: "'Fraunces Variable', Georgia, serif",
            fontSize: 13,
            fontWeight: 700,
            color: "var(--text-mid)",
            marginTop: 1,
          }}>
            {t.crew}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text-bright)",
            lineHeight: 1,
          }}>
            {okCount}/{trace.length}
          </div>
          <div style={{
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 8,
            color: "var(--text-faint)",
            marginTop: 2,
            letterSpacing: "0.12em",
          }}>
            {totalMs}{t.total}
          </div>
        </div>
      </div>

      {/* Phases */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
        {ran.map((phase, phaseIdx) => (
          <div key={phase.key}>
            {/* Phase label */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}>
              {/* Phase number */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: "1px solid var(--border-mid)",
                display: "grid",
                placeItems: "center",
                fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--ocean)",
                flexShrink: 0,
              }}>
                {phaseIdx + 1}
              </div>

              <div style={{ flex: 1 }}>
                <span style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--text-mid)",
                }}>
                  {phase.title}
                </span>
                <span style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 8,
                  color: "var(--text-faint)",
                  marginLeft: 8,
                  letterSpacing: "0.06em",
                }}>
                  {phase.note}
                </span>
              </div>

              {phase.key === "gather" && phase.rows.length > 1 && (
                <span style={{
                  fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                  fontSize: 7,
                  fontWeight: 800,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ocean)",
                  border: "1px solid var(--border-mid)",
                  padding: "2px 6px",
                }}>
                  ∥ {phase.rows.length} {t.concurrent}
                </span>
              )}
            </div>

            {/* Agent rows */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              paddingLeft: phase.key === "gather" ? 14 : 0,
              borderLeft: phase.key === "gather" ? "1px solid var(--border-mid)" : "none",
              marginLeft: phase.key === "gather" ? 10 : 0,
            }}>
              {phase.rows.map((row) => (
                <div
                  key={row.agent}
                  style={{
                    background: STATUS_BG[row.status],
                    border: `1px solid ${row.status === "ok" ? "var(--border)" : STATUS_COLOR[row.status] + "40"}`,
                    borderRadius: 2,
                    padding: "7px 10px",
                  }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}>
                    {/* Status indicator */}
                    <div style={{
                      width: 6,
                      height: 6,
                      transform: "rotate(45deg)",
                      background: STATUS_COLOR[row.status],
                      flexShrink: 0,
                    }} />

                    {/* Name */}
                    <span style={{
                      fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 10,
                      fontWeight: 700,
                      color: row.status === "ok" ? "var(--text-mid)" : STATUS_COLOR[row.status],
                      width: 90,
                      flexShrink: 0,
                      letterSpacing: "0.06em",
                    }}>
                      {labels[row.agent] ?? row.agent}
                    </span>

                    {/* Summary */}
                    <span style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11,
                      color: "var(--text-dim)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {row.summary || "—"}
                    </span>

                    {/* Latency */}
                    <span style={{
                      fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 9,
                      color: "var(--text-faint)",
                      flexShrink: 0,
                    }}>
                      {row.latency_ms}ms
                    </span>
                  </div>

                  {/* Latency bar */}
                  {row.latency_ms > 0 && (
                    <div style={{
                      marginTop: 5,
                      height: 2,
                      background: "var(--surface-3)",
                      borderRadius: 1,
                      overflow: "hidden",
                    }}>
                      <div
                        className="grow-x"
                        style={{
                          height: "100%",
                          width: `${(row.latency_ms / maxLatency) * 100}%`,
                          background: STATUS_COLOR[row.status],
                          borderRadius: 1,
                          opacity: 0.6,
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{
        borderTop: "1px solid var(--border)",
        padding: "8px 14px",
        fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
        fontSize: 9,
        color: "var(--text-faint)",
        lineHeight: 1.6,
        fontStyle: "italic",
      }}>
        {t.note}
      </div>
    </div>
  );
}
