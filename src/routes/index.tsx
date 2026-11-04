import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent as RPE, type MouseEvent as RME } from "react";
import logo from "@/assets/omn-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "OMN-Service – Website im Aufbau" },
      {
        name: "description",
        content:
          "OMN-Service UG: Glasfaser, Trassenbau & Tiefbau. Unsere Website ist in der Erschließung – spiel solange Glasfaser-Express.",
      },
      { property: "og:title", content: "OMN-Service – Website im Aufbau" },
      {
        property: "og:description",
        content: "Glasfaser, Trassenbau & Tiefbau. Die Seite wird gerade eingeblasen – spiel Glasfaser-Express.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Theme = "lila" | "light" | "dark";
type Phase = "idle" | "jetting" | "overload" | "stuck" | "snapped";

const MAX_BAR = 12;
const GOAL = 1000; // metres

const BEST_KEY = "omn-best";
const readBest = () => {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
};
const writeBest = (v: number) => {
  try {
    localStorage.setItem(BEST_KEY, String(Math.max(0, Math.floor(v))));
  } catch {
    /* storage blocked (private mode) – record just won't persist */
  }
};

const MSG = {
  idle: "Meldung vom Tiefbauamt: Die Webseite befindet sich derzeit in der aktiven Erschließung (Aufbauphase). Bitte haben Sie noch etwas Geduld! Starte den Kompressor, um die Trasse manuell zu kalibrieren.",
  low: "Druck zu gering – das Kabel kriecht nur. Kompressor nachlegen!",
  jetting: "Vortrieb stabil: Geschwindigkeit jetzt weiter erhöhen! Aber halte die BAR-Anzeige im Auge.",
  hot: "Achtung: Drehzahl im roten Bereich! Über 11 BAR fliegt das Sicherheitsventil.",
  overload: "Druckrohr-Explosion! 11 BAR überschritten – Sicherheitsventil abgeflogen. Trasse reinigen und neu einblasen.",
  stuck: "Kollision im Rohrleitungssystem! Glasfaser-Stein im Weg! Ein Laden der Seite ist derzeit leider nicht möglich. Bitte das Glasfaserkabel zurückziehen und erneut versuchen zu jetten!",
  snapped: "RATSCH! Kabelriss – zu schnell eingeblasen! Über 140 m/s hält keine Glasfaser durch. Kabel neu spleißen und nochmal ran.",
  fast: "Vorsicht, Vorschub am Limit! Über 140 m/s reißt das Kabel.",
  weak: "Zu wenig Druck für dieses Tempo – das Kabel schleift. Mehr BAR geben!",
  done: "1.000 m eingeblasen – Trasse kalibriert! Die echte Website folgt trotzdem bald. Danke fürs Mitbauen.",
};

function Loader({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background" style={{ animation: "wipe 2s ease-in-out reverse" }}>
      <div className="flex flex-col items-center gap-6">
        <img src={logo} alt="OMN Logo" className="h-32 w-32 pulse-glow" />
        <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-gold" style={{ animation: "load 2s ease-out forwards" }} />
        </div>
      </div>
      <style>{`@keyframes load{from{width:0}to{width:100%}}`}</style>
    </div>
  );
}

function ThemeSwitch({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const opts: { id: Theme; label: string }[] = [
    { id: "lila", label: "Lila" },
    { id: "light", label: "Hell" },
    { id: "dark", label: "Dunkel" },
  ];
  return (
    <div className="flex rounded-full border border-border bg-card p-1 text-xs font-semibold">
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setTheme(o.id)}
          className={`rounded-full px-3 py-1.5 transition-colors ${theme === o.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PIPE = "M 90 165 H 775 Q 815 165 815 125 V 58";

function Index() {
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme>("lila");
  const [bar, setBar] = useState(0);
  const [dist, setDist] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [best, setBest] = useState(0);
  const bestRef = useRef(0);
  const bestNextWrite = useRef(0);
  const runStartBest = useRef(0);
  const pipeRef = useRef<SVGPathElement>(null);
  const [spd, setSpd] = useState(0);
  const st = useRef({ bar: 0, dist: 0, phase: "idle" as Phase, stuckAt: 0, dir: 0, spd: 0, sdir: 0, over: 0 });

  useEffect(() => {
    const saved = localStorage.getItem("omn-theme") as Theme | null;
    if (saved) setThemeState(saved);
    setBest(Number(localStorage.getItem("omn-best") || 0));
  }, []);
  useEffect(() => {
    document.documentElement.className = `theme-${theme}`;
  }, [theme]);
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("omn-theme", t);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const s = st.current;
      if (s.phase === "jetting") {
        s.bar = Math.max(0, Math.min(MAX_BAR, s.bar + s.dir * 3 * dt));
        s.spd = Math.max(0, Math.min(160, s.spd + s.sdir * 45 * dt));
        const eff = s.bar < 3 ? s.spd * 0.25 : s.spd;
        s.dist += eff * dt * 0.6;
        s.over = s.spd > 140 ? s.over + dt : 0;
        if (s.bar > 11) s.phase = "overload";
        else if (s.over > 0.8) s.phase = "snapped";
        else if (s.dist >= s.stuckAt) { s.dist = s.stuckAt; s.phase = "stuck"; }
        if (s.phase !== "jetting") {
          s.dir = 0;
          s.sdir = 0;
          setPhase(s.phase);
          const b = Math.max(Number(localStorage.getItem("omn-best") || 0), Math.round(s.dist));
          localStorage.setItem("omn-best", String(b));
          setBest(b);
        }
        setBar(s.bar);
        setSpd(s.spd);
        setDist(s.dist);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const start = () => {
    const s = st.current;
    s.phase = "jetting";
    s.bar = 4;
    s.dir = 0;
    s.spd = 40;
    s.sdir = 0;
    s.stuckAt = 740 + Math.random() * 150;
    setPhase("jetting");
  };
  const hold = (k: "dir" | "sdir", v: number) => { st.current[k] = v; };
  const reset = () => {
    st.current = { bar: 0, dist: 0, phase: "idle", stuckAt: 0, dir: 0, spd: 0, sdir: 0, over: 0 };
    setBar(0);
    setSpd(0);
    setDist(0);
    setPhase("idle");
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (st.current.phase !== "jetting") return;
      if (e.code === "ArrowUp") { e.preventDefault(); st.current.dir = 1; }
      if (e.code === "ArrowDown") { e.preventDefault(); st.current.dir = -1; }
      if (e.code === "ArrowRight") { e.preventDefault(); st.current.sdir = 1; }
      if (e.code === "ArrowLeft") { e.preventDefault(); st.current.sdir = -1; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "ArrowDown") st.current.dir = 0;
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") st.current.sdir = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const speed = phase === "jetting" ? Math.round(spd) : 0;
  const msg =
    phase === "jetting"
      ? bar > 9 ? MSG.hot : spd > 120 ? MSG.fast : bar < 3 ? (spd > 30 ? MSG.weak : MSG.low) : MSG.jetting
      : MSG[phase as keyof typeof MSG];
  const spdColor = spd > 140 ? "var(--destructive)" : spd > 120 ? "var(--hot)" : "var(--foreground)";
  const zoneOf = (v: number) => (v >= 9 ? "var(--destructive)" : v >= 6 ? "var(--hot)" : "var(--warn)");
  const zone = zoneOf(bar);
  const SEG = 44;
  const lit = Math.round((Math.min(bar, MAX_BAR) / MAX_BAR) * SEG);
  const progress = Math.min(dist / GOAL, 1);
  const stone = (() => {
    const el = pipeRef.current;
    if (!el || (phase !== "stuck" && phase !== "snapped")) return { x: 0, y: 0 };
    const p = el.getPointAtLength(el.getTotalLength() * Math.min(progress + 0.012, 1));
    return { x: p.x, y: p.y };
  })();
  const critical = phase === "jetting" && bar >= 9;
  const holdProps = (k: "dir" | "sdir", v: number) => ({
    onPointerDown: (e: RPE<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      hold(k, v);
    },
    onPointerUp: () => hold(k, 0),
    onPointerCancel: () => hold(k, 0),
    onContextMenu: (e: RME) => e.preventDefault(),
    style: { touchAction: "none" as const, WebkitUserSelect: "none" as const },
  });
  const ctrlBtn =
    "select-none flex h-16 flex-1 items-center justify-center rounded-2xl text-2xl font-extrabold transition-transform active:scale-95 md:h-20";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {loading && <Loader onDone={() => setLoading(false)} />}
      <div className="stripes h-3" />

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="OMN Logo" className="h-11 w-11" />
          <div className="leading-tight">
            <div className="font-extrabold tracking-wide">OMN-Service</div>
            <div className="text-xs text-muted-foreground">Glasfaser · Trassenbau · Tiefbau</div>
          </div>
        </div>
        <ThemeSwitch theme={theme} setTheme={setTheme} />
      </header>

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-5 px-4 pb-40 pt-2 md:gap-8 md:px-5 md:pb-16 md:pt-4">
        <h1 className="text-center text-3xl font-extrabold md:text-5xl">
          Website in <span className="text-primary">Erschließung</span>
        </h1>

        <div className="relative w-full max-w-2xl rounded-2xl border border-primary/60 bg-card p-4 text-center text-sm shadow-lg md:p-5 md:text-lg">
          <p aria-live="polite">{msg}</p>
          <span className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-primary/60 bg-card" />
        </div>

        {/* RS-style sport cockpit */}
        <div className={`w-full max-w-3xl ${critical ? "shake" : ""}`}>
          <div className="rounded-3xl border border-border p-4 md:p-6"
            style={{ background: "linear-gradient(180deg, var(--card), var(--gauge))", boxShadow: "0 30px 60px -20px var(--gauge)" }}>
            <div className="flex h-10 items-end gap-[2px] md:h-14 md:gap-[3px]">
              {Array.from({ length: SEG }, (_, i) => {
                const v = ((i + 1) / SEG) * MAX_BAR;
                const on = i < lit;
                const c = zoneOf(v);
                return (
                  <div key={i} className="flex-1 rounded-sm transition-all duration-75"
                    style={{
                      height: `${40 + (i / SEG) * 60}%`,
                      background: on ? c : "var(--muted)",
                      opacity: on ? 1 : 0.35,
                      boxShadow: on ? `0 0 10px ${c}` : "none",
                      transform: "skewX(-18deg)",
                    }} />
                );
              })}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              {[0, 2, 4, 6, 8, 10, 12].map((n) => <span key={n}>{n}</span>)}
            </div>
            <div className="mt-4 grid grid-cols-3 items-end font-mono">
              <div>
                <div className="text-2xl font-bold md:text-3xl" style={{ color: zone }}>{bar.toFixed(1)}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">BAR</div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold tabular-nums md:text-7xl" style={{ color: spdColor }}>{speed}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Meter / Sek</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary md:text-3xl">{Math.round(dist)}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Meter</div>
              </div>
            </div>
          </div>
        </div>

        {/* NVT -> straight -> 90° -> house */}
        <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-4">
          <svg viewBox="0 -30 900 250" className="w-full">
            {/* ground */}
            <line x1="0" y1="60" x2="900" y2="60" stroke="var(--border)" strokeDasharray="4 6" />
            {/* NVT box */}
            <rect x="20" y="130" width="70" height="70" rx="6" fill="var(--secondary)" stroke="var(--primary)" strokeWidth="2" />
            <text x="55" y="172" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--foreground)" fontFamily="var(--font-mono)">NVT</text>
            {/* house */}
            <path d="M 780 58 V 20 L 815 -5 L 850 20 V 58 Z" fill="var(--secondary)" stroke="var(--primary)" strokeWidth="2" transform="translate(0 0)" />
            <rect x="805" y="34" width="20" height="24" fill="var(--gauge)" />
            {/* pipe */}
            <path d={PIPE} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.45" strokeWidth="22" />
            <path ref={pipeRef} d={PIPE} fill="none" stroke="var(--gauge)" strokeWidth="14" />
            <path d={PIPE} pathLength={1000} fill="none" stroke="var(--fiber)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${dist} 1000`} style={{ filter: "drop-shadow(0 0 6px var(--fiber))" }} />
            <path d={PIPE} pathLength={1000} fill="none" stroke="var(--fiber)" strokeWidth="2" strokeOpacity="0.7"
              strokeDasharray="6 24" strokeDashoffset={-dist * 3} />
            {phase === "overload" && (
              <g>
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <line key={a} x1={450} y1={165} x2={450 + Math.cos((a * Math.PI) / 180) * 60} y2={165 + Math.sin((a * Math.PI) / 180) * 60}
                    stroke="var(--hot)" strokeWidth="5" strokeLinecap="round">
                    <animate attributeName="stroke-opacity" values="1;0.2;1" dur="0.3s" repeatCount="indefinite" />
                  </line>
                ))}
                <text x="450" y="120" textAnchor="middle" fontSize="40" fontWeight="800" fill="var(--destructive)">PENG!</text>
              </g>
            )}
            {phase === "snapped" && (
              <g>
                {[-1, 0, 1].map((d) => (
                  <line key={d} x1={stone.x} y1={stone.y} x2={stone.x + 18} y2={stone.y + d * 14}
                    stroke="var(--fiber)" strokeWidth="2" strokeLinecap="round">
                    <animate attributeName="x2" values={`${stone.x + 10};${stone.x + 22};${stone.x + 10}`} dur="0.25s" repeatCount="indefinite" />
                  </line>
                ))}
                <text x="450" y="125" textAnchor="middle" fontSize="40" fontWeight="800" fill="var(--fiber)">RATSCH!</text>
              </g>
            )}
            {phase === "stuck" && (
              <circle r="11" fill="var(--destructive)" cx={stone.x} cy={stone.y}>
                <animate attributeName="r" from="0" to="11" dur="0.25s" />
              </circle>
            )}
          </svg>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{Math.round(dist)} / {GOAL} m</span>
            <span>Rekord: {best} m</span>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:static md:w-full md:max-w-3xl md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          {phase === "idle" && (
            <button onClick={start} className="h-16 w-full rounded-2xl bg-primary text-xl font-extrabold text-primary-foreground shadow-lg active:scale-95 md:h-20">
              Jetting starten
            </button>
          )}
          {phase === "jetting" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-card p-2">
                <div className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Druck · BAR</div>
                <div className="flex gap-2">
                  <button aria-label="BAR runter" {...holdProps("dir", -1)} className={`${ctrlBtn} bg-secondary text-secondary-foreground`}>−</button>
                  <button aria-label="BAR hoch" {...holdProps("dir", 1)} className={`${ctrlBtn} bg-primary text-primary-foreground`}>+</button>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-2">
                <div className="mb-1 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Vorschub · m/s</div>
                <div className="flex gap-2">
                  <button aria-label="Langsamer" {...holdProps("sdir", -1)} className={`${ctrlBtn} bg-secondary text-secondary-foreground`}>−</button>
                  <button aria-label="Schneller" {...holdProps("sdir", 1)} className={`${ctrlBtn} bg-gold text-primary-foreground`}>+</button>
                </div>
              </div>
            </div>
          )}
          {phase !== "idle" && phase !== "jetting" && (
            <button onClick={reset} className="h-16 w-full rounded-2xl bg-destructive text-lg font-extrabold text-destructive-foreground active:scale-95 md:h-20">
              {phase === "overload" ? "Trasse reinigen & neu einblasen" : phase === "snapped" ? "Kabel neu spleißen & nochmal" : "Trasse evakuieren (Zurückziehen)"}
            </button>
          )}
          <p className="mt-2 hidden text-center text-xs text-muted-foreground md:block">
            Halten oder Tastatur: ↑ ↓ Druck · ← → Vorschub. Über 11 BAR platzt das Rohr, über 140 m/s reißt das Kabel.
          </p>
        </div>
      </main>

      <footer className="border-t border-border pb-28 pt-5 md:pb-5 md:py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OMN-Service UG · Inhabergeführt · 5+ Jahre Branchenerfahrung
      </footer>
      <div className="stripes h-2" />
    </div>
  );
}
