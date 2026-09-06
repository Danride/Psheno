import { useEffect, useRef, useState } from "react";
import { Engine, type GameResult, type HudSnapshot } from "../game/engine";
import { audio } from "../game/audio";

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1).replace(".", ",") + "к" : String(Math.floor(n)));

const BUFF_META: Record<string, { label: string; color: string }> = {
  speed: { label: "ВЕТЕР", color: "#7fd1c0" },
  magnet: { label: "МАГНИТ", color: "#d9812e" },
  shield: { label: "ЩИТ", color: "#8fb8e8" },
  rage: { label: "ЯРОСТЬ", color: "#e06048" },
};

function BuffIcon({ id }: { id: string }) {
  const c = "#171208";
  return (
    <svg viewBox="0 0 12 12" className="size-3.5" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {id === "speed" && <path d="M2 2.5l3.5 3.5L2 9.5M6.5 2.5L10 6 6.5 9.5" />}
      {id === "magnet" && <path d="M3 2v3.5a3 3 0 0 0 6 0V2M3 4.5h2M7 4.5h2" />}
      {id === "shield" && <path d="M6 1.2l3.8 1.6v3c0 2.6-1.8 4-3.8 4.8-2-.8-3.8-2.2-3.8-4.8v-3z" />}
      {id === "rage" && <path d="M3 10L6 2M6.5 10L9.5 2M2 8l1-2M9 6l1-2" />}
    </svg>
  );
}

function WheatCoin({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 11.5V5M8 6.2L5.8 5M8 6.2l2.2-1.2M8 8.4L5.8 7.2M8 8.4l2.2-1.2" />
    </svg>
  );
}

/* ─────────────────── inner core: canvas + engine ─────────────────── */

function GameCore(props: {
  skinId: string;
  best: number;
  muted: boolean;
  onToggleMute: () => void;
  onResult: (r: GameResult) => void;
  onExit: () => void;
  onRestart: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const snapRef = useRef<HudSnapshot | null>(null);
  const [snap, setSnap] = useState<HudSnapshot | null>(null);
  const [over, setOver] = useState<GameResult | null>(null);
  const [paused, setPaused] = useState(false);
  const [hint, setHint] = useState(true);
  const [regionFlash, setRegionFlash] = useState<string | null>(null);
  const lastRegion = useRef("");
  const reported = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new Engine(canvas, props.skinId, {
      best: props.best,
      onHud: (s) => {
        snapRef.current = s;
        setSnap(s);
        if (s.regionName !== lastRegion.current) {
          lastRegion.current = s.regionName;
          setRegionFlash(s.regionName);
        }
      },
      onOver: (r) => {
        setOver(r);
        if (!reported.current) {
          reported.current = true;
          props.onResult(r);
        }
      },
    });
    engineRef.current = engine;
    engine.start();
    const t = setTimeout(() => setHint(false), 5200);
    const rt = setTimeout(() => setRegionFlash(null), 2200);
    const vis = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(t);
      clearTimeout(rt);
      document.removeEventListener("visibilitychange", vis);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (!regionFlash) return;
    const t = setTimeout(() => setRegionFlash(null), 2200);
    return () => clearTimeout(t);
  }, [regionFlash]);

  const exitToMenu = () => {
    // при добровольном выходе сохраняем заработанное
    const s = snapRef.current;
    if (s && !reported.current && s.coinsRun > 0) {
      reported.current = true;
      props.onResult({
        score: s.score, level: s.level, kills: s.kills, harvests: s.harvests,
        coinsEarned: s.coinsRun, timeSec: Math.floor(s.time), best: props.best, newBest: false,
      });
    }
    props.onExit();
  };

  const hpPct = snap ? Math.max(0, Math.min(1, snap.hp / snap.maxHp)) : 1;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#171208]">
      <canvas ref={canvasRef} className="absolute inset-0" />

      {/* ── HUD ── */}
      <div
        className="pointer-events-none absolute inset-0 flex flex-col justify-between"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 10px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        {/* верхняя строка */}
        <div className="flex items-start justify-between gap-2 px-3">
          {/* слева: уровень / xp / hp */}
          <div className="hud-panel flex items-center gap-2.5 rounded-md px-2.5 py-2">
            <div className="flex flex-col items-center leading-none">
              <span className="font-display text-[10px] tracking-widest text-[#a58a2c]">УР</span>
              <span className="font-display text-2xl text-[#f0d878]" key={snap?.level ?? 0}>
                <span className="inline-block anim-pop">{snap?.level ?? 1}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="h-1.5 w-28 overflow-hidden rounded-sm bg-black/50">
                <div
                  className="h-full rounded-sm bg-[#e8c547] transition-[width] duration-200"
                  style={{ width: `${snap ? (snap.xp / snap.xpNeed) * 100 : 0}%` }}
                />
              </div>
              <div className="h-2 w-28 overflow-hidden rounded-sm bg-black/50">
                <div
                  className="h-full rounded-sm transition-[width] duration-200"
                  style={{ width: `${hpPct * 100}%`, background: hpPct > 0.4 ? "#7dc95e" : "#d9534a" }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end leading-tight">
              <span className="font-display text-sm text-[#f5e6b0]">{fmt(snap?.score ?? 0)}</span>
              <span className="text-[10px] font-medium text-[#a58a2c]">очков</span>
            </div>
          </div>

          {/* справа: кнопки + монеты + топ */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-1.5">
              <button
                className="hud-panel pointer-events-auto flex size-9 items-center justify-center rounded-md text-[#f0d878] active:scale-95"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => { audio.ensure(); props.onToggleMute(); }}
                aria-label="звук"
              >
                <svg viewBox="0 0 16 16" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="currentColor" stroke="none" />
                  {props.muted ? <path d="M10.5 6l4 4M14.5 6l-4 4" /> : <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" />}
                </svg>
              </button>
              <button
                className="hud-panel pointer-events-auto flex size-9 items-center justify-center rounded-md text-[#f0d878] active:scale-95"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => { audio.click(); setPaused(true); }}
                aria-label="пауза"
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="currentColor">
                  <rect x="3.5" y="2.5" width="3.2" height="11" rx="0.8" />
                  <rect x="9.3" y="2.5" width="3.2" height="11" rx="0.8" />
                </svg>
              </button>
            </div>
            <div className="hud-panel flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[#f0d878]">
              <WheatCoin />
              <span className="font-display text-sm">{snap?.coinsRun ?? 0}</span>
            </div>
            <div className="hud-panel flex items-center gap-2 rounded-md px-2.5 py-1 text-[11px] font-semibold text-[#f5e6b0]">
              <span className="flex items-center gap-1">
                <svg viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M2 10L10 2M10 2H5.5M10 2v4.5" />
                </svg>
                {snap?.kills ?? 0}
              </span>
              <span className="text-[#a58a2c]">·</span>
              <span>{snap?.alive ?? 100} жив.</span>
            </div>
            {/* таблица лидеров */}
            <div className="hud-panel mt-0.5 w-40 rounded-md px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-display text-[9px] tracking-[0.2em] text-[#a58a2c]">ТОП ЖНЕЦОВ</span>
              </div>
              {(snap?.board ?? []).map((b, i) => (
                <div
                  key={b.name + i}
                  className={`flex items-center justify-between text-[11px] leading-4 ${b.you ? "font-bold text-[#e8c547]" : "text-[#f5e6b0]/85"}`}
                >
                  <span className="truncate">
                    <span className="mr-1 text-[#a58a2c]">{i + 1}</span>
                    {b.name}
                  </span>
                  <span className="ml-1 font-display text-[10px]">{fmt(b.score)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* центр: название области */}
        <div className="flex justify-center">
          {regionFlash && (
            <div key={regionFlash} className="anim-pop flex flex-col items-center">
              <span className="font-display text-2xl tracking-[0.25em] text-[#f5e6b0] drop-shadow-[0_2px_0_rgba(23,18,8,0.9)] sm:text-3xl">
                {regionFlash.toUpperCase()}
              </span>
              <span className="mt-1 text-[11px] font-semibold tracking-[0.3em] text-[#e8c547]">— ОБЛАСТЬ —</span>
            </div>
          )}
        </div>

        {/* нижняя строка */}
        <div className="flex items-end justify-between px-3">
          <div className="flex flex-col gap-1.5 pl-[118px]">
            {/* активные бонусы */}
            <div className="flex gap-1.5">
              {(snap?.buffs ?? []).map((b) => (
                <div
                  key={b.id}
                  className="hud-panel flex items-center gap-1 rounded-md px-2 py-1"
                  style={{ borderColor: BUFF_META[b.id].color, color: BUFF_META[b.id].color }}
                >
                  <BuffIcon id={b.id} />
                  <span className="text-[10px] font-bold">{Math.ceil(b.t)}с</span>
                </div>
              ))}
            </div>
            {hint && !over && (
              <div className="anim-fade max-w-64 text-[11px] leading-snug text-[#f5e6b0]/75">
                Веди пальцем — движение. Двойной тап — <span className="font-bold text-[#e8c547]">рывок</span>.
                <br />
                <span className="font-bold text-[#f0d878]">Блок</span> отражает удар: враг замирает на 2с. Бьёт вся палка — наконечник сильнее.
              </div>
            )}
          </div>

          {/* кнопки навыков */}
          <div className="flex items-end gap-2">
            {/* блок */}
            <button
              className={`pointer-events-auto relative flex size-[64px] flex-col items-center justify-center overflow-hidden rounded-full border-2 transition-transform active:scale-95 ${
                (snap?.blockReady ?? 0) >= 1 ? "border-[#f0d878] text-[#f0d878]" : "border-[#a58a2c]/60 text-[#a58a2c]"
              }`}
              style={{ background: "rgba(24,18,7,0.82)" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                audio.ensure();
                engineRef.current?.tryBlock();
              }}
              aria-label="блок"
            >
              <span
                className="absolute bottom-0 left-0 right-0 bg-[#f0d878]/25"
                style={{ height: `${Math.round((snap?.blockReady ?? 1) * 100)}%` }}
              />
              <svg viewBox="0 0 20 20" className="relative size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2.2l6 2.4v4.6c0 4-2.8 6.6-6 8-3.2-1.4-6-4-6-8V4.6z" />
                <path d="M7 10l2.2 2.2L13.5 8" />
              </svg>
              <span className="relative font-display text-[8px] tracking-[0.18em]">БЛОК</span>
            </button>
            {/* рывок */}
            <button
              className={`pointer-events-auto relative flex size-[76px] flex-col items-center justify-center overflow-hidden rounded-full border-2 transition-transform active:scale-95 ${
                (snap?.dashReady ?? 0) >= 1 ? "border-[#e8c547] text-[#f0d878]" : "border-[#a58a2c]/60 text-[#a58a2c]"
              }`}
              style={{ background: "rgba(24,18,7,0.82)" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                audio.ensure();
                engineRef.current?.tryDash();
              }}
              aria-label="рывок"
            >
              <span
                className="absolute bottom-0 left-0 right-0 bg-[#e8c547]/25"
                style={{ height: `${Math.round((snap?.dashReady ?? 1) * 100)}%` }}
              />
              <svg viewBox="0 0 20 20" className="relative size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10h12M10 4.5L16 10l-6 5.5" />
              </svg>
              <span className="relative font-display text-[9px] tracking-[0.2em]">РЫВОК</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── пауза ── */}
      {paused && !over && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#171208]/80 px-6">
          <div className="anim-pop w-full max-w-xs border-2 border-[#e8c547] bg-[#241c0a] p-6 text-center">
            <h2 className="font-display text-3xl tracking-[0.2em] text-[#f0d878]">ПАУЗА</h2>
            <p className="mt-2 text-xs text-[#f5e6b0]/70">Жатва подождёт. Но соперники — нет.</p>
            <div className="mt-6 flex flex-col gap-3">
              <button className="btn-rz text-sm" onClick={() => { audio.ensure(); audio.click(); setPaused(false); }}>
                Продолжить
              </button>
              <button
                className="btn-rz text-sm"
                style={{ borderColor: "#a58a2c", color: "#a58a2c" }}
                onClick={() => { audio.click(); exitToMenu(); }}
              >
                В меню
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── итог ── */}
      {over && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#171208]/60 px-6">
          <div className="anim-pop w-full max-w-sm border-2 border-[#e8c547] bg-[#241c0a] p-6 text-center shadow-[0_0_60px_rgba(232,197,71,0.15)]">
            <p className="font-display text-[11px] tracking-[0.35em] text-[#d9534a]">КИРКА ВРАГА ОКАЗАЛАСЬ БЫСТРЕЕ</p>
            <h2 className="mt-1 font-display text-4xl tracking-wider text-[#f5e6b0]">ТЕБЯ СРЕЗАЛИ</h2>
            {over.newBest && (
              <div className="anim-blink mx-auto mt-2 w-fit border border-[#e8c547] px-3 py-0.5 font-display text-[11px] tracking-[0.25em] text-[#e8c547]">
                НОВЫЙ РЕКОРД
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2 text-left">
              {[
                ["Очки", fmt(over.score)],
                ["Уровень", String(over.level)],
                ["Колосья", String(over.harvests)],
                ["Убийства", String(over.kills)],
                ["Время", `${Math.floor(over.timeSec / 60)}:${String(over.timeSec % 60).padStart(2, "0")}`],
                ["Рекорд", fmt(over.best)],
              ].map(([k, v]) => (
                <div key={k} className="border border-[#a58a2c]/40 bg-black/25 px-3 py-2">
                  <div className="text-[10px] font-semibold tracking-widest text-[#a58a2c]">{k.toUpperCase()}</div>
                  <div className="font-display text-lg text-[#f5e6b0]">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-center gap-2 border border-[#e8c547]/60 bg-[#e8c547]/10 py-2 text-[#f0d878]">
              <WheatCoin className="size-5" />
              <span className="font-display text-xl">+{over.coinsEarned}</span>
              <span className="text-[11px] font-semibold tracking-widest">МОНЕТ</span>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <button
                className="btn-rz"
                onClick={() => {
                  audio.ensure();
                  audio.click();
                  props.onRestart();
                }}
              >
                Ещё раз
              </button>
              <button className="btn-rz" style={{ borderColor: "#a58a2c", color: "#a58a2c" }} onClick={() => { audio.click(); props.onExit(); }}>
                В меню
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── outer: restart wrapper ─────────────────── */

export default function GameScreen(props: {
  skinId: string;
  best: number;
  muted: boolean;
  onToggleMute: () => void;
  onResult: (r: GameResult) => void;
  onExit: () => void;
}) {
  const [run, setRun] = useState(0);
  return (
    <GameCore
      key={run}
      skinId={props.skinId}
      best={props.best}
      muted={props.muted}
      onToggleMute={props.onToggleMute}
      onResult={props.onResult}
      onExit={props.onExit}
      onRestart={() => setRun((r) => r + 1)}
    />
  );
}
