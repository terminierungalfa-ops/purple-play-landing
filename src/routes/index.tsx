import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
type Phase = "idle" | "jetting" | "overload" | "stuck" | "done";

const MAX_BAR = 12;
const GOAL = 1000; // metres

const MSG = {
  idle: "Meldung vom Tiefbauamt: Die Webseite befindet sich derzeit in der aktiven Erschließung (Aufbauphase). Bitte haben Sie noch etwas Geduld! Starte den Kompressor, um die Trasse manuell zu kalibrieren.",
  low: "Druck zu gering – das Kabel kriecht nur. Kompressor nachlegen!",
  jetting: "Vortrieb stabil: Geschwindigkeit jetzt weiter erhöhen! Aber halte die BAR-Anzeige im Auge.",
  hot: "Achtung: Drehzahl im roten Bereich! Über 11 BAR fliegt das Sicherheitsventil.",
  overload: "Druckrohr-Explosion! 11 BAR überschritten – Sicherheitsventil abgeflogen. Trasse reinigen und neu einblasen.",
  stuck: "Kollision im Rohrleitungssystem! Glasfaser-Stein im Weg! Ein Laden der Seite ist derzeit leider nicht möglich. Bitte das Glasfaserkabel zurückziehen und erneut versuchen zu jetten!",
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
  const pipeRef = useRef<SVGPathElement>(null);
  const st = useRef({ bar: 0, dist: 0, phase: "idle" as Phase, stuckAt: 0, dir: 0 });

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
        const speed = (s.bar / 11) * 160;
        s.dist += speed * dt * 0.6;
        if (s.bar > 11) s.phase = "overload";
        else if (s.dist >= s.stuckAt) { s.dist = s.stuckAt; s.phase = "stuck"; }
        if (s.phase !== "jetting") {
          s.dir = 0;
          setPhase(s.phase);
          const b = Math.max(Number(localStorage.getItem("omn-best") || 0), Math.round(s.dist));
          localStorage.setItem("omn-best", String(b));
          setBest(b);
        }
        setBar(s.bar);
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
    s.stuckAt = 740 + Math.random() * 150;
    setPhase("jetting");
  };
  const hold = (dir: number) => { st.current.dir = dir; };
  const reset = () => {
    st.current = { bar: 0, dist: 0, phase: "idle", stuckAt: 0, dir: 0 };
    setBar(0);
    setDist(0);
    setPhase("idle");
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (st.current.phase !== "jetting") return;
      if (e.code === "ArrowUp") { e.preventDefault(); st.current.dir = 1; }
      if (e.code === "ArrowDown") { e.preventDefault(); st.current.dir = -1; }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "ArrowUp" || e.code === "ArrowDown") st.current.dir = 0;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const speed = phase === "jetting" ? Math.round((bar / 11) * 160) : 0;
  const msg =
    phase === "jetting" ? (bar > 9 ? MSG.hot : bar < 3 ? MSG.low : MSG.jetting) : MSG[phase as keyof typeof MSG];
  const zoneOf = (v: number) => (v >= 9 ? "var(--destructive)" : v >= 6 ? "var(--hot)" : "var(--warn)");
  const zone = zoneOf(bar);
  const SEG = 44;
  const lit = Math.round((Math.min(bar, MAX_BAR) / MAX_BAR) * SEG);
  const progress = Math.min(dist / GOAL, 1);
  const stone = (() => {
    const el = pipeRef.current;
    if (!el || phase !== "stuck") return { x: 0, y: 0 };
    const p = el.getPointAtLength(el.getTotalLength() * Math.min(progress + 0.012, 1));
    return { x: p.x, y: p.y };
  })();
  const critical = phase === "jetting" && bar >= 9;
  const holdProps = (dir: number) => ({
    onPointerDown: () => hold(dir),
    onPointerUp: () => hold(0),
    onPointerLeave: () => hold(0),
  });

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

      <main className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-5 pb-16 pt-4">
        <h1 className="text-center text-3xl font-extrabold md:text-5xl">
          Website in <span className="text-primary">Erschließung</span>
        </h1>

        <div className="relative w-full max-w-2xl rounded-2xl border border-primary/60 bg-card p-5 text-center text-base shadow-lg md:text-lg">
          <p aria-live="polite">{msg}</p>
          <span className="absolute -bottom-[9px] left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-primary/60 bg-card" />
        </div>

        {/* RS-style sport cockpit */}
        <div className={`w-full max-w-3xl ${critical ? "shake" : ""}`}>
          <div className="rounded-3xl border border-border p-6"
            style={{ background: "linear-gradient(180deg, var(--card), var(--gauge))", boxShadow: "0 30px 60px -20px var(--gauge)" }}>
            <div className="flex h-14 items-end gap-[3px]">
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
                <div className="text-3xl font-bold" style={{ color: zone }}>{bar.toFixed(1)}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">BAR</div>
              </div>
              <div className="text-center">
                <div className="text-7xl font-bold tabular-nums text-foreground">{speed}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Meter / Sek</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-primary">{Math.round(dist)}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Meter</div>
              </div>
            </div>
          </div>
        </div>

        {/* NVT -> straight -> 90° -> house */}
        <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-4">
          <svg viewBox="0 0 900 220" className="w-full">
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

        <div className="flex flex-col items-center gap-3">
          {phase === "idle" && (
            <button onClick={start}
              className="rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95">
              Jetting starten
            </button>
          )}
          {phase === "jetting" && (
            <div className="flex gap-3">
              <button {...holdProps(-1)} className="select-none rounded-full border border-border bg-secondary px-7 py-4 text-lg font-bold text-secondary-foreground active:scale-95">
                − BAR
              </button>
              <button {...holdProps(1)} className="select-none rounded-full bg-primary px-7 py-4 text-lg font-bold text-primary-foreground active:scale-95">
                + BAR
              </button>
            </div>
          )}
          {phase === "overload" && (
            <button onClick={reset} className="rounded-full bg-destructive px-8 py-4 text-lg font-bold text-destructive-foreground">
              Trasse reinigen &amp; neu einblasen
            </button>
          )}
          {phase === "stuck" && (
            <button onClick={reset} className="rounded-full bg-destructive px-8 py-4 text-lg font-bold text-destructive-foreground">
              Trasse evakuieren (Zurückziehen)
            </button>
          )}
          <p className="text-xs text-muted-foreground">Buttons gedrückt halten oder Pfeiltasten ↑ ↓ – über 11 BAR platzt das Rohr.</p>
        </div>
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OMN-Service UG · Inhabergeführt · 5+ Jahre Branchenerfahrung
      </footer>
      <div className="stripes h-2" />
    </div>
  );
}
