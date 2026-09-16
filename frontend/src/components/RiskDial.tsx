import { useEffect, useState } from "react";
import type { RiskCategory } from "../types";

export const RISK_COLOR: Record<RiskCategory, string> = {
  LOW: "#22C55E",
  MODERATE: "#F59E0B",
  HIGH: "#F97316",
  EXTREME: "#EF4444",
};

/**
 * Dark maritime risk dial — concentric rings, sonar-style, with a counting
 * numeral. Adapted from the original for the dark operational theme.
 */
export default function RiskDial({
  score,
  category,
  size = 138,
}: {
  score: number;
  category: RiskCategory;
  size?: number;
}) {
  const [shown, setShown] = useState(0);
  const color = RISK_COLOR[category];
  const c = size / 2;
  const rArc = c - 13;
  const circumference = 2 * Math.PI * rArc;

  useEffect(() => {
    const duration = 750;
    let raf = 0;
    const start = performance.now();
    const from = shown;

    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (score - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const settle = window.setTimeout(() => setShown(score), duration + 120);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  // Outer instrument ticks
  const ticks = Array.from({ length: 50 }, (_, i) => {
    const a = (i / 50) * 2 * Math.PI - Math.PI / 2;
    const major = i % 5 === 0;
    const r1 = major ? c - 5.5 : c - 3.5;
    return {
      x1: c + r1 * Math.cos(a),
      y1: c + r1 * Math.sin(a),
      x2: c + (c - 1) * Math.cos(a),
      y2: c + (c - 1) * Math.sin(a),
      major,
    };
  });

  // Band thresholds
  const thresholds = [
    { v: 25, col: RISK_COLOR.LOW },
    { v: 50, col: RISK_COLOR.MODERATE },
    { v: 79, col: RISK_COLOR.HIGH },
  ].map(({ v, col }) => {
    const a = (v / 100) * 2 * Math.PI - Math.PI / 2;
    return {
      x1: c + (c - 8) * Math.cos(a),
      y1: c + (c - 8) * Math.sin(a),
      x2: c + (c - 1) * Math.cos(a),
      y2: c + (c - 1) * Math.sin(a),
      col,
    };
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        {/* Tick marks */}
        {ticks.map((tk, i) => (
          <line
            key={i}
            x1={tk.x1}
            y1={tk.y1}
            x2={tk.x2}
            y2={tk.y2}
            stroke="rgba(0,168,204,0.3)"
            strokeWidth={tk.major ? 1.3 : 0.6}
            opacity={tk.major ? 0.8 : 0.35}
          />
        ))}

        {/* Threshold marks */}
        {thresholds.map((th, i) => (
          <line
            key={`t${i}`}
            x1={th.x1}
            y1={th.y1}
            x2={th.x2}
            y2={th.y2}
            stroke={th.col}
            strokeWidth={2.4}
          />
        ))}

        {/* Background track ring */}
        <circle
          cx={c}
          cy={c}
          r={rArc}
          fill="none"
          stroke="rgba(0,168,204,0.12)"
          strokeWidth={7}
        />

        {/* Score arc */}
        <circle
          cx={c}
          cy={c}
          r={rArc}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
          style={{ transition: "stroke-dashoffset .12s linear" }}
          transform={`rotate(-90 ${c} ${c})`}
        />

        {/* Inner circle */}
        <circle
          cx={c}
          cy={c}
          r={rArc - 6.5}
          fill="none"
          stroke="rgba(0,168,204,0.08)"
          strokeWidth={0.8}
        />

        {/* Glow for high risk */}
        {(category === "HIGH" || category === "EXTREME") && (
          <circle
            cx={c}
            cy={c}
            r={rArc}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="butt"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - shown / 100)}
            style={{ transition: "stroke-dashoffset .12s linear", filter: `blur(6px)`, opacity: 0.25 }}
            transform={`rotate(-90 ${c} ${c})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center leading-none">
          <div
            style={{
              fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
              fontSize: 38,
              fontWeight: 900,
              lineHeight: 1,
              color,
              fontVariantNumeric: "tabular-nums",
              textShadow: (category === "HIGH" || category === "EXTREME") ? `0 0 20px ${color}60` : "none",
            }}
          >
            {Math.max(0, shown)}
          </div>
          <div style={{
            marginTop: 4,
            fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}>
            / 100
          </div>
        </div>
      </div>
    </div>
  );
}
