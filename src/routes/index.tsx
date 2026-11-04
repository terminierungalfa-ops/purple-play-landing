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

const MSG: Record<string, string> = {
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

const PIPE = "M 20 70 C 120 10, 200 130, 300 70 S 480 10, 580 70 S 760 130, 880 70";

function Index() {
  const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<Theme>("lila");
  const [bar, setBar] = useState(0);
  const [dist, setDist] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [best, setBest] = useState(0);
  const st = useRef({ bar: 0, dist: 0, phase: "idle" as Phase, stuckAt: 0 });

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
        s.bar = Math.max(0, s.bar - 1.6 * dt);
        const speed = (s.bar / 11) * 160;
        s.dist += speed * dt;
        if (s.bar > 11) s.phase = "overload";
        else if (s.dist >= s.stuckAt) s.phase = "stuck";
        else if (s.dist >= GOAL) s.phase = "done";
        if (s.phase !== "jetting") {
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

  const pump = () => {
    const s = st.current;
    if (s.phase === "idle") {
      s.phase = "jetting";
      s.stuckAt = Math.random() < 0.55 ? 250 + Math.random() * 650 : Infinity;
      setPhase("jetting");
    }
    if (s.phase === "jetting") s.bar = Math.min(MAX_BAR, s.bar + 0.9);
  };
  const reset = () => {
    st.current = { bar: 0, dist: 0, phase: "idle", stuckAt: 0 };
    setBar(0);
    setDist(0);
    setPhase("idle");
  };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (st.current.phase === "idle" || st.current.phase === "jetting") pump();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const speed = phase === "jetting" ? Math.round((bar / 11) * 160) : 0;
  const msg =
    phase === "jetting" ? (bar > 9 ? MSG.hot : bar < 3 ? MSG.low : MSG.jetting) : MSG[phase];
  const zone = bar >= 9 ? "var(--destructive)" : bar >= 6 ? "var(--hot)" : "var(--warn)";
  const R = 120;
  const C = 2 * Math.PI * R;
  const arc = 0.75 * C;
  const fill = arc * Math.min(bar / MAX_BAR, 1);
  const progress = Math.min(dist / GOAL, 1);
  const critical = phase === "jetting" && bar >= 9;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {loading && <Loader onDone={() => setLoading(false)} />}
      <div className="stripes h-4" />

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

        {/* Speech bubble */}
        <div className="relative w-full max-w-2xl rounded-2xl border-2 border-primary bg-card p-5 text-center text-base shadow-lg md:text-lg">
          <p aria-live="polite">{msg}</p>
          <span className="absolute -bottom-3 left-1/2 h-6 w-6 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-primary bg-card" />
        </div>

        {/* Gauge */}
        <div className={critical ? "shake" : ""}>
          <div
            className="relative grid h-72 w-72 place-items-center rounded-full md:h-80 md:w-80"
            style={{
              background: "radial-gradient(circle at 50% 35%, var(--card), var(--gauge) 70%)",
              boxShadow: "0 25px 50px -12px var(--gauge), inset 0 -10px 30px var(--gauge), 0 0 0 6px var(--secondary)",
            }}
          >
            <svg viewBox="0 0 300 300" className="absolute inset-0 h-full w-full">
              <circle cx="150" cy="150" r={R} fill="none" stroke="var(--muted)" strokeWidth="14"
                strokeDasharray={`${arc} ${C}`} transform="rotate(135 150 150)" strokeLinecap="round" />
              <circle cx="150" cy="150" r={R} fill="none" stroke={zone} strokeWidth="14"
                strokeDasharray={`${fill} ${C}`} transform="rotate(135 150 150)" strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 8px ${zone})`, transition: "stroke .2s" }} />
            </svg>
            <div className="z-10 text-center font-mono">
              <div className="text-6xl font-bold text-gold">{speed}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Meter / Sek</div>
              <div className="mt-3 text-2xl font-bold" style={{ color: zone }}>{bar.toFixed(1)}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">BAR</div>
            </div>
          </div>
        </div>

        {/* Pipe */}
        <div className="w-full max-w-4xl rounded-2xl border border-border bg-card p-4">
          <svg viewBox="0 0 900 140" className="w-full">
            <path d={PIPE} fill="none" stroke="var(--muted-foreground)" strokeOpacity="0.45" strokeWidth="22" strokeLinecap="round" />
            <path d={PIPE} fill="none" stroke="var(--gauge)" strokeWidth="14" strokeLinecap="round" />
            <path d={PIPE} pathLength={1000} fill="none" stroke="var(--fiber)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${dist} 1000`} style={{ filter: "drop-shadow(0 0 6px var(--fiber))" }} />
            <path d={PIPE} pathLength={1000} fill="none" stroke="var(--fiber)" strokeWidth="2" strokeOpacity="0.8"
              strokeDasharray="6 24" strokeDashoffset={-dist * 3} />
            {phase === "stuck" && (
              <circle r="11" fill="var(--destructive)" style={{ offsetPath: `path("${PIPE}")`, offsetDistance: `${progress * 100 + 1}%` }}>
                <animate attributeName="r" from="0" to="11" dur="0.25s" />
              </circle>
            )}
          </svg>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{Math.round(dist)} / {GOAL} m</span>
            <span>Rekord: {best} m</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col items-center gap-2">
          {(phase === "idle" || phase === "jetting") && (
            <button onClick={pump}
              className="rounded-full bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-lg transition-transform active:scale-95">
              Kabel einjetten
            </button>
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
          {phase === "done" && (
            <button onClick={reset} className="rounded-full bg-gold px-8 py-4 text-lg font-bold text-primary-foreground">
              Nochmal einblasen
            </button>
          )}
          <p className="text-xs text-muted-foreground">Klicken oder Leertaste – Druck zwischen 3 und 9 BAR halten.</p>
        </div>
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} OMN-Service UG · Inhabergeführt · 5+ Jahre Branchenerfahrung
      </footer>
      <div className="stripes h-2" />
    </div>
  );
}
