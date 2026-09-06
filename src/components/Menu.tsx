import { useEffect, useId, useRef, useState } from "react";
import { SKINS, type SaveData, type SkinDef } from "../game/skins";
import { audio } from "../game/audio";

/* ─────────────────── процедурное пшеничное поле ─────────────────── */

interface Stalk { x: number; h: number; ph: number; sp: number; layer: number; lean: number }
interface Grain { x: number; y: number; vy: number; s: number }

function MenuWheat() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0, raf = 0;
    let stalks: Stalk[] = [];
    let grains: Grain[] = [];

    const resize = () => {
      W = window.innerWidth; H = window.innerHeight;
      c.width = Math.floor(W * dpr); c.height = Math.floor(H * dpr);
      c.style.width = W + "px"; c.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stalks = [];
      const n = Math.max(30, Math.floor(W / 12));
      for (let i = 0; i < n; i++) {
        stalks.push({
          x: (i + Math.random() * 0.9) * (W / n),
          h: H * (0.14 + Math.random() * 0.38),
          ph: Math.random() * Math.PI * 2,
          sp: 0.7 + Math.random() * 1.3,
          layer: Math.random() < 0.5 ? 0 : 1,
          lean: (Math.random() - 0.5) * 0.3,
        });
      }
      stalks.sort((a, b) => a.layer - b.layer);
      grains = [];
      for (let i = 0; i < 26; i++) {
        grains.push({ x: Math.random() * W, y: H * (0.45 + Math.random() * 0.55), vy: -(5 + Math.random() * 10), s: 1 + Math.random() * 2 });
      }
    };
    resize();
    window.addEventListener("resize", resize);

    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const time = t / 1000;
      ctx.clearRect(0, 0, W, H);

      // солнце у горизонта
      ctx.fillStyle = "rgba(232,197,71,0.16)";
      ctx.beginPath(); ctx.arc(W * 0.74, H * 0.56, Math.min(W, H) * 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(240,216,120,0.14)";
      ctx.beginPath(); ctx.arc(W * 0.74, H * 0.56, Math.min(W, H) * 0.19, 0, Math.PI * 2); ctx.fill();
      // полоса земли
      ctx.fillStyle = "rgba(23,18,8,0.22)";
      ctx.fillRect(0, H * 0.86, W, H * 0.14);

      // зернинки поднимаются
      for (const g of grains) {
        g.y += g.vy * dt;
        g.x += Math.sin(time + g.y * 0.02) * 6 * dt;
        if (g.y < H * 0.32) { g.y = H * (0.9 + Math.random() * 0.1); g.x = Math.random() * W; }
        ctx.fillStyle = "rgba(240,216,120,0.4)";
        ctx.beginPath(); ctx.arc(g.x, g.y, g.s, 0, Math.PI * 2); ctx.fill();
      }

      // колосья
      for (const s of stalks) {
        const sway = Math.sin(time * s.sp + s.ph) * (2.5 + s.layer * 2.5) + s.lean * 14;
        const stalkCol = s.layer === 0 ? "#7c621a" : "#c9a63f";
        const headCol = s.layer === 0 ? "#93771f" : "#f0d878";
        const bx = s.x, by = H + 3;
        const tx = s.x + sway, ty = H - s.h;
        ctx.strokeStyle = stalkCol;
        ctx.lineWidth = s.layer === 0 ? 1.6 : 2.4;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + sway * 0.25, by - s.h * 0.55, tx, ty);
        ctx.stroke();
        // колос
        ctx.fillStyle = headCol;
        ctx.beginPath();
        ctx.ellipse(tx, ty - 4, 2.4 + s.layer * 1.2, 5.5 + s.layer * 2.5, sway * 0.04, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = headCol;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx - 2, ty - 6); ctx.lineTo(tx - 5, ty - 13);
        ctx.moveTo(tx + 2, ty - 6); ctx.lineTo(tx + 5, ty - 13);
        ctx.moveTo(tx, ty - 8); ctx.lineTo(tx, ty - 15);
        ctx.stroke();
        // лист
        if (s.layer === 1) {
          ctx.strokeStyle = stalkCol;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(bx + sway * 0.12, by - s.h * 0.4);
          ctx.quadraticCurveTo(bx + 9, by - s.h * 0.5, bx + 12, by - s.h * 0.42);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0" />;
}

/* ─────────────────── декор ─────────────────── */

function WheatEar({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 22V7" />
      <ellipse cx="9" cy="8" rx="2" ry="3.4" transform="rotate(-24 9 8)" fill="currentColor" stroke="none" />
      <ellipse cx="15" cy="8" rx="2" ry="3.4" transform="rotate(24 15 8)" fill="currentColor" stroke="none" />
      <ellipse cx="9.4" cy="13" rx="2" ry="3.4" transform="rotate(-24 9.4 13)" fill="currentColor" stroke="none" />
      <ellipse cx="14.6" cy="13" rx="2" ry="3.4" transform="rotate(24 14.6 13)" fill="currentColor" stroke="none" />
      <path d="M12 7l-2.5-4M12 7l2.5-4M12 7V2.5" />
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

function RzBtn(props: { children: React.ReactNode; onClick: () => void; big?: boolean }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      className={`btn-rz ${pressed ? "pressed" : ""} ${props.big ? "py-4 text-lg" : "text-base"}`}
      onPointerDown={() => { audio.ensure(); audio.click(); setPressed(true); }}
      onPointerUp={() => { setPressed(false); props.onClick(); }}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 opacity-80"><WheatEar className="size-6" /></span>
      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rotate-180 opacity-80"><WheatEar className="size-6" /></span>
      <span className="relative">{props.children}</span>
    </button>
  );
}

/* ─────────────────── превью скина ─────────────────── */

function SkinPreview({ skin, size = 60 }: { skin: SkinDef; size?: number }) {
  const uid = useId().replace(/[:]/g, "");
  const clip = "clip" + uid;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <defs>
        <clipPath id={clip}><circle cx="32" cy="32" r="27" /></clipPath>
      </defs>
      <circle cx="32" cy="32" r="27" fill={skin.body} stroke="#171208" strokeWidth="3" />
      <g clipPath={`url(#${clip})`}>
        {skin.pattern === "stripes" && [10, 22, 34, 46].map((x) => <rect key={x} x={x} y="2" width="6" height="60" fill={skin.accent} />)}
        {skin.pattern === "dots" && [18, 32, 46].flatMap((x) => [18, 32, 46].map((y) => <circle key={x + "-" + y} cx={x} cy={y} r="4" fill={skin.accent} />))}
        {skin.pattern === "ring" && <circle cx="32" cy="32" r="15" fill="none" stroke={skin.accent} strokeWidth="8" />}
        {skin.pattern === "zig" && (
          <path d="M0 42L13 27 26 42 39 27 52 42 64 30" fill="none" stroke={skin.accent} strokeWidth="7" />
        )}
        {skin.pattern === "wheat" && (
          <g stroke={skin.accent} fill={skin.accent}>
            <path d="M32 54V16" strokeWidth="3" fill="none" />
            <ellipse cx="25" cy="22" rx="4" ry="7" transform="rotate(-26 25 22)" stroke="none" />
            <ellipse cx="39" cy="22" rx="4" ry="7" transform="rotate(26 39 22)" stroke="none" />
            <ellipse cx="25" cy="33" rx="4" ry="7" transform="rotate(-26 25 33)" stroke="none" />
            <ellipse cx="39" cy="33" rx="4" ry="7" transform="rotate(26 39 33)" stroke="none" />
          </g>
        )}
      </g>
      <circle cx="25" cy="27" r="5.5" fill="#ffffff" />
      <circle cx="39" cy="27" r="5.5" fill="#ffffff" />
      <circle cx="26.5" cy="28.5" r="2.4" fill="#171208" />
      <circle cx="40.5" cy="28.5" r="2.4" fill="#171208" />
    </svg>
  );
}

/* ─────────────────── магазин скинов ─────────────────── */

function SkinShop(props: { save: SaveData; onClose: () => void; onPurchase: (id: string, cost: number) => void; onSelect: (id: string) => void }) {
  const [failId, setFailId] = useState<string | null>(null);
  const { save } = props;

  const tap = (s: SkinDef) => {
    audio.ensure();
    const owned = save.owned.includes(s.id);
    if (owned) {
      audio.click();
      props.onSelect(s.id);
      return;
    }
    if (save.coins >= s.cost) {
      audio.buy();
      props.onPurchase(s.id, s.cost);
    } else {
      audio.deny();
      setFailId(s.id);
      setTimeout(() => setFailId(null), 360);
    }
  };

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto bg-[#171208]/92 px-4 py-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}>
      <div className="anim-fade mx-auto max-w-md">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl tracking-[0.15em] text-[#f0d878]">ВЫБОР СКИНА</h2>
          <div className="flex items-center gap-2">
            <span className="hud-panel flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[#f0d878]">
              <WheatCoin /> <span className="font-display text-sm">{save.coins}</span>
            </span>
            <button className="hud-panel flex size-9 items-center justify-center rounded-md text-[#f0d878] active:scale-95" onClick={() => { audio.click(); props.onClose(); }} aria-label="закрыть">
              <svg viewBox="0 0 16 16" className="size-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /></svg>
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-[#f5e6b0]/60">Монеты падают с колосьев, гусениц и срезанных соперников.</p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {SKINS.map((s) => {
            const owned = save.owned.includes(s.id);
            const selected = save.selected === s.id;
            const afford = save.coins >= s.cost;
            return (
              <button
                key={s.id}
                onClick={() => tap(s)}
                className={`relative flex flex-col items-center border-2 px-2 pb-2 pt-3 transition-all duration-150 active:scale-95 ${failId === s.id ? "anim-shake" : ""} ${
                  selected
                    ? "border-[#e8c547] bg-[#e8c547]/15 shadow-[0_0_20px_rgba(232,197,71,0.25)]"
                    : owned
                      ? "border-[#a58a2c]/70 bg-black/25 hover:border-[#e8c547]/70"
                      : afford
                        ? "border-[#a58a2c]/50 bg-black/25 hover:border-[#e8c547]/70"
                        : "border-[#5c4c1c]/60 bg-black/30 opacity-75"
                }`}
              >
                {selected && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#e8c547] px-2 py-px font-display text-[8px] tracking-[0.2em] text-[#171208]">
                    ВЫБРАН
                  </span>
                )}
                <SkinPreview skin={s} />
                <span className="mt-1.5 text-[11px] font-semibold leading-none text-[#f5e6b0]">{s.name}</span>
                <span className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold leading-none ${owned ? "text-[#7dc95e]" : afford ? "text-[#f0d878]" : "text-[#d9534a]"}`}>
                  {owned ? (
                    "куплен"
                  ) : (
                    <>
                      <WheatCoin className="size-3" /> {s.cost}
                    </>
                  )}
                </span>
                {!owned && s.cost > 0 && (
                  <span className="pointer-events-none absolute right-1 top-1 text-[#a58a2c]">
                    <svg viewBox="0 0 12 12" className="size-3" fill="currentColor"><path d="M6 1a3 3 0 0 0-3 3v1.5H2.5v5.5h7V5.5H9V4a3 3 0 0 0-3-3zm-1.8 4.5V4a1.8 1.8 0 1 1 3.6 0v1.5z" /></svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="h-8" />
      </div>
    </div>
  );
}

/* ─────────────────── главное меню ─────────────────── */

export default function Menu(props: {
  save: SaveData;
  onStart: () => void;
  onPurchase: (id: string, cost: number) => void;
  onSelect: (id: string) => void;
}) {
  const [shop, setShop] = useState(false);
  const selected = SKINS.find((s) => s.id === props.save.selected) ?? SKINS[0];

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "linear-gradient(180deg, #5d4a10 0%, #6d5510 46%, #574409 100%)" }}>
      <MenuWheat />

      {/* тонкая рамка-орнамент по периметру */}
      <div className="pointer-events-none absolute inset-3 border border-[#e8c547]/25" />
      <div className="pointer-events-none absolute inset-5 border border-[#e8c547]/10" />

      <div className="relative z-10 flex h-full flex-col items-center justify-between overflow-hidden px-6" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 26px)", paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)" }}>
        {/* заголовок */}
        <div className="anim-fade flex flex-col items-center text-center">
          <span className="font-display text-[10px] tracking-[0.5em] text-[#e8c547]/90">ПОЛЕ №100 · СЕЗОН ЖАТВЫ</span>
          <h1 className="font-display mt-2 text-[17vw] leading-none text-[#f5e6b0] sm:text-8xl" style={{ textShadow: "0 4px 0 rgba(23,18,8,0.55), 0 0 44px rgba(232,197,71,0.35)" }}>
            ЖНЕЦЫ
          </h1>
          <div className="mt-3 flex items-center gap-3 text-[#e8c547]">
            <span className="h-px w-14 bg-current opacity-60" />
            <WheatEar className="size-6" />
            <span className="h-px w-14 bg-current opacity-60" />
          </div>
          <p className="mt-2 max-w-72 text-xs font-medium leading-relaxed text-[#f5e6b0]/85">
            Сто жнецов. Пять областей. Кирка крутится сама —
            <br />
            выживает тот, кто жнёт быстрее.
          </p>
          {/* статистика */}
          <div className="mt-4 flex items-center gap-2">
            <span className="hud-panel flex items-center gap-2 rounded-md px-3 py-1.5">
              <span className="text-[9px] font-bold tracking-[0.2em] text-[#a58a2c]">РЕКОРД</span>
              <span className="font-display text-sm text-[#f5e6b0]">{props.save.best > 0 ? props.save.best.toLocaleString("ru-RU") : "—"}</span>
            </span>
            <span className="hud-panel flex items-center gap-2 rounded-md px-3 py-1.5 text-[#f0d878]">
              <WheatCoin />
              <span className="font-display text-sm">{props.save.coins}</span>
            </span>
          </div>
        </div>

        {/* кнопки */}
        <div className="anim-fade z-10 mb-[16vh] flex w-full max-w-xs flex-col gap-4" style={{ animationDelay: "120ms" }}>
          <RzBtn big onClick={props.onStart}>
            Начать
          </RzBtn>
          <RzBtn onClick={() => { setShop(true); }}>
            Выбор скина
          </RzBtn>
          <div className="mt-1 flex items-center justify-center gap-2 text-[10px] font-semibold tracking-wider text-[#f5e6b0]/55">
            <SkinPreview skin={selected} size={20} />
            <span>ЖНЕЦ: {selected.name.toUpperCase()}</span>
          </div>
        </div>

        {/* нижняя подсказка */}
        <div className="z-10 flex flex-col items-center gap-1.5 text-center">
          <p className="text-[11px] font-medium tracking-wide text-[#171208]/80">
            палец — движение · двойной тап — рывок · кирка ранит, тело — нет
          </p>
        </div>
      </div>

      {shop && <SkinShop save={props.save} onClose={() => setShop(false)} onPurchase={props.onPurchase} onSelect={props.onSelect} />}
    </div>
  );
}
