import type { ChatResponse, Language } from "../types";

const L: Record<Language, Record<string, string>> = {
  en: { wave: "Wave Ht", wind: "Wind", sea: "Sea State", vis: "Visibility", sst: "Sea Temp", rain: "Rain Prob", header: "CURRENT CONDITIONS" },
  hi: { wave: "लहरें", wind: "हवा", sea: "समुद्र", vis: "दृश्यता", sst: "तापमान", rain: "वर्षा", header: "वर्तमान स्थिति" },
  kn: { wave: "ಅಲೆ ಎತ್ತರ", wind: "ಗಾಳಿ", sea: "ಸಮುದ್ರ ಸ್ಥಿತಿ", vis: "ಗೋಚರ", sst: "ಸಮುದ್ರ ಉಷ್ಣ", rain: "ಮಳೆ", header: "ಪ್ರಸ್ತುತ ಸ್ಥಿತಿ" },
};

/** Reads the traced evidence rows rather than duplicating any parsing. */
function findEvidence(res: ChatResponse, label: string): string | null {
  const row = res.evidence.find((e) => e.label.toLowerCase() === label.toLowerCase());
  return row ? row.value : null;
}

/** Bridge instruments strip — six readings behind hairline dividers, styled as a navigation console. */
export default function ConditionsStrip({
  res,
  language = "en",
}: {
  res: ChatResponse;
  language?: Language;
}) {
  const t = L[language] ?? L.en;
  const tiles = [
    { label: t.wave, value: findEvidence(res, "Wave height"), accent: true },
    { label: t.wind, value: findEvidence(res, "Wind"), accent: true },
    { label: t.sea, value: findEvidence(res, "Sea state") },
    { label: t.rain, value: findEvidence(res, "Rain probability") },
    { label: t.vis, value: findEvidence(res, "Visibility") },
    { label: t.sst, value: findEvidence(res, "Sea surface temperature") },
  ];

  return (
    <div className="bridge-strip">
      {/* Header */}
      <div className="bridge-strip-hd">
        <span className="bridge-strip-label">
          <span style={{ marginRight: 6, color: "var(--ocean)", fontSize: 9 }}>◎</span>
          {t.header}
        </span>
        <span style={{
          fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
          fontSize: 7.5,
          letterSpacing: "0.14em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
        }}>
          {res.mode ?? "DEMO"}
        </span>
      </div>
      {/* Instruments */}
      <div className="bridge-instruments">
        {tiles.map((tile, i) => (
          <div key={tile.label} className="bridge-instrument">
            <div className="bridge-instrument-label">{tile.label}</div>
            <div className={`bridge-instrument-val${tile.accent ? " bridge-instrument-val--accent" : ""}`}>
              {tile.value ?? "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
