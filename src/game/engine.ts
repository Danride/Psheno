import { audio } from "./audio";
import { BOT_SKIN_IDS, skinById, type SkinDef } from "./skins";

/* ─────────────────────────── world constants ─────────────────────────── */

const CELL = 1400; // размер одной области (5×5 чанков по 280)
const CHUNK = 280;
const WORLD = CELL * 3;
const CROSS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], // север
  [0, 1], // запад
  [1, 1], // центр
  [2, 1], // восток
  [1, 2], // юг
];

type BonusType = "speed" | "magnet" | "shield" | "rage" | "coin" | "heart";
export type BuffId = "speed" | "magnet" | "shield" | "rage";

interface RegionDef {
  id: string;
  name: string;
  sub: string;
  cx: number;
  cy: number;
  ground: string;
  groundAlt: string;
  wheatStalk: string;
  wheatHead: string;
  wheatXp: number;
  density: number;
  grow: number; // секунд до полного роста
  catCount: number;
  catColor: string;
  catXp: number;
  weights: [BonusType, number][];
}

const REGIONS: RegionDef[] = [
  {
    id: "center", name: "Центровое поле", sub: "золото · монеты",
    cx: 1, cy: 1,
    ground: "#b3913c", groundAlt: "#ab8836",
    wheatStalk: "#8f7a2a", wheatHead: "#ecd06a",
    wheatXp: 8, density: 12, grow: 12, catCount: 10, catColor: "#7c6a2c", catXp: 16,
    weights: [["coin", 4], ["heart", 2], ["speed", 2], ["magnet", 1], ["shield", 1], ["rage", 1]],
  },
  {
    id: "north", name: "Мерзлая грива", sub: "редкая · дорогая",
    cx: 1, cy: 0,
    ground: "#7e93a3", groundAlt: "#768b9b",
    wheatStalk: "#5f7484", wheatHead: "#dfe8dd",
    wheatXp: 15, density: 6, grow: 16, catCount: 8, catColor: "#b9c9d6", catXp: 26,
    weights: [["shield", 4], ["heart", 3], ["coin", 1], ["rage", 1]],
  },
  {
    id: "south", name: "Сухая степь", sub: "густая · быстрая",
    cx: 1, cy: 2,
    ground: "#c08a4a", groundAlt: "#b78143",
    wheatStalk: "#93662c", wheatHead: "#e8b84b",
    wheatXp: 5, density: 18, grow: 8, catCount: 12, catColor: "#a3552e", catXp: 10,
    weights: [["speed", 4], ["magnet", 3], ["coin", 2], ["heart", 1]],
  },
  {
    id: "west", name: "Туманный луг", sub: "гусеницы · магнит",
    cx: 0, cy: 1,
    ground: "#79995f", groundAlt: "#719157",
    wheatStalk: "#55703c", wheatHead: "#d6d97e",
    wheatXp: 7, density: 12, grow: 11, catCount: 18, catColor: "#4c6b34", catXp: 15,
    weights: [["magnet", 4], ["coin", 3], ["speed", 1], ["heart", 2]],
  },
  {
    id: "east", name: "Багряная заря", sub: "ярость · опыт",
    cx: 2, cy: 1,
    ground: "#a86752", groundAlt: "#9f5f4b",
    wheatStalk: "#7a4534", wheatHead: "#f0b271",
    wheatXp: 11, density: 9, grow: 13, catCount: 14, catColor: "#8c3b30", catXp: 20,
    weights: [["rage", 4], ["shield", 2], ["speed", 2], ["coin", 1]],
  },
];

/* ─────────────────────────── entities ─────────────────────────── */

interface WheatStalk {
  x: number; y: number;
  stage: number; grow: number; phase: number;
  dead: boolean; cutT: number; respawn: number; fallDir: number;
  value: number;
}
interface Chunk { wheat: WheatStalk[] }
interface Bonus { x: number; y: number; type: BonusType; t: number; max: number }
interface Caterpillar {
  x: number; y: number; dir: number; speed: number;
  wig: number; alive: boolean; respawn: number; region: number;
}
interface Particle {
  x: number; y: number; vx: number; vy: number; g: number;
  t: number; max: number; size: number; color: string;
  kind: "dot" | "ring" | "spark";
}
interface FloatText { x: number; y: number; txt: string; color: string; t: number; big: boolean }

interface Reaper {
  id: number; name: string; isPlayer: boolean; skin: SkinDef;
  x: number; y: number; vx: number; vy: number; dir: number;
  level: number; xp: number; score: number;
  radius: number; pickLen: number;
  theta: number; omega: number; hitCd: number;
  hp: number; maxHp: number; lastHurt: number;
  dashT: number; dashCd: number; dashDx: number; dashDy: number;
  speedT: number; magnetT: number; shieldT: number; shieldHits: number; rageT: number;
  alive: boolean; respawnT: number; deathHandled: boolean;
  kills: number; harvests: number; coinsRun: number;
  ai: { thinkT: number; tx: number; ty: number; state: "farm" | "hunt" | "flee"; farmT: number };
}

/* ─────────────────────────── hud / result ─────────────────────────── */

export interface HudSnapshot {
  time: number; level: number; xp: number; xpNeed: number;
  hp: number; maxHp: number; score: number;
  coinsRun: number; kills: number; harvests: number; alive: number;
  regionName: string; dashReady: number;
  buffs: { id: BuffId; t: number }[];
  board: { name: string; score: number; you: boolean }[];
}
export interface GameResult {
  score: number; level: number; kills: number; harvests: number;
  coinsEarned: number; timeSec: number; best: number; newBest: boolean;
}

/* ─────────────────────────── helpers ─────────────────────────── */

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
};

function crossHas(cx: number, cy: number) {
  return CROSS.some(([x, y]) => x === cx && y === cy);
}
function regionIndexAt(x: number, y: number): number {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  return REGIONS.findIndex((r) => r.cx === cx && r.cy === cy);
}
function clampToCross(x: number, y: number): [number, number] {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  if (crossHas(cx, cy)) {
    return [clamp(x, 6, WORLD - 6), clamp(y, 6, WORLD - 6)];
  }
  // угол — выталкиваем в ближайшую область креста
  let bx = x, by = y, bd = Infinity;
  for (const [rx, ry] of CROSS) {
    const px = clamp(x, rx * CELL + 6, rx * CELL + CELL - 6);
    const py = clamp(y, ry * CELL + 6, ry * CELL + CELL - 6);
    const d = dist2(x, y, px, py);
    if (d < bd) { bd = d; bx = px; by = py; }
  }
  return [bx, by];
}

const NAME_A = ["Серп", "Колос", "Жнец", "Сноп", "Зерно", "Рожь", "Ячмень", "Мельник", "Хлеб", "Солома", "Косарь", "Борода", "Плуг", "Овин", "Гумно", "Ток", "Степной", "Ветер", "Гром", "Молот", "Крыло", "Клык", "Шип", "Дым", "Пепел", "Корень", "Побег", "Ливень", "Зной", "Иней", "Урожай", "Полдень"];
const NAME_B = ["", "", "-ПРО", "-X", "77", "01"];
function makeBotNames(n: number): string[] {
  const set = new Set<string>();
  const pool: string[] = [];
  for (const a of NAME_A) for (const b of NAME_B) pool.push(a + b);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (const p of pool) {
    if (set.size >= n) break;
    set.add(p);
  }
  return [...set];
}

const BONUS_COLOR: Record<BonusType, string> = {
  speed: "#7fd1c0", magnet: "#d9812e", shield: "#8fb8e8", rage: "#e06048", coin: "#e8c547", heart: "#e08090",
};

/* ─────────────────────────── engine ─────────────────────────── */

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHud: (s: HudSnapshot) => void;
  private onOver: (r: GameResult) => void;
  private initialBest: number;

  private raf = 0;
  private lastT = 0;
  private running = false;
  private paused = false;
  private over = false;
  private time = 0;

  private W = 300; private H = 300; private dpr = 1;

  private reapers: Reaper[] = [];
  private player!: Reaper;
  private chunks: Chunk[][] = []; // [regionIdx][25]
  private wheatAll: WheatStalk[] = [];
  private bonuses: Bonus[] = [];
  private cats: Caterpillar[] = [];
  private particles: Particle[] = [];
  private texts: FloatText[] = [];

  private camX = WORLD / 2; private camY = WORLD / 2; private zoom = 1;
  private shakeT = 0; private shakeAmp = 0;
  private flash = 0;
  private cutSndCd = 0;

  private keys = new Set<string>();
  private inputX = 0; private inputY = 0;
  private ptrId = -1; private ptrSx = 0; private ptrSy = 0;
  private lastTapT = 0; private lastTapX = 0; private lastTapY = 0;

  private hudT = 0; private bonusT = 0;
  private lastRegion = -2;
  private result: GameResult | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    private skinId: string,
    cb: { onHud: (s: HudSnapshot) => void; onOver: (r: GameResult) => void; best: number },
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onHud = cb.onHud;
    this.onOver = cb.onOver;
    this.initialBest = cb.best;
    this.resize();
    this.bindInput();
    this.reset();
  }

  /* ── lifecycle ── */

  start() {
    if (this.running) return;
    this.running = true;
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (!this.running) return;
      const dt = clamp((t - this.lastT) / 1000, 0, 0.05);
      this.lastT = t;
      if (!this.paused) this.update(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPtrDown);
    window.removeEventListener("pointermove", this.onPtrMove);
    window.removeEventListener("pointerup", this.onPtrUp);
    document.removeEventListener("visibilitychange", this.onVis);
  }

  setPaused(p: boolean) {
    this.paused = p;
  }

  reset() {
    this.time = 0; this.over = false; this.result = null;
    this.particles = []; this.texts = []; this.bonuses = [];
    this.flash = 0; this.shakeT = 0; this.lastRegion = -2;
    this.buildWorld();
    this.spawnAll();
    this.camX = this.player.x; this.camY = this.player.y;
    this.zoom = this.zoomFor(this.player.level);
    this.pushHud(true);
  }

  /* ── world gen ── */

  private buildWorld() {
    this.chunks = REGIONS.map((rg) => {
      const list: Chunk[] = [];
      for (let i = 0; i < 25; i++) list.push({ wheat: [] });
      for (let cy = 0; cy < 5; cy++) {
        for (let cx = 0; cx < 5; cx++) {
          const ch = list[cy * 5 + cx];
          const count = rg.density + Math.floor(rand(0, 5));
          for (let k = 0; k < count; k++) {
            ch.wheat.push({
              x: rg.cx * CELL + cx * CHUNK + rand(16, CHUNK - 16),
              y: rg.cy * CELL + cy * CHUNK + rand(16, CHUNK - 16),
              stage: rand(0.4, 1), grow: rg.grow,
              phase: rand(0, Math.PI * 2),
              dead: false, cutT: 0, respawn: 0,
              fallDir: Math.random() < 0.5 ? -1 : 1,
              value: rg.wheatXp,
            });
          }
        }
      }
      return list;
    });
    this.wheatAll = this.chunks.flatMap((c) => c.flatMap((ch) => ch.wheat));

    this.cats = [];
    REGIONS.forEach((rg, ri) => {
      for (let i = 0; i < rg.catCount; i++) {
        this.cats.push({
          x: rg.cx * CELL + rand(60, CELL - 60),
          y: rg.cy * CELL + rand(60, CELL - 60),
          dir: rand(0, Math.PI * 2), speed: rand(20, 38),
          wig: rand(0, 10), alive: true, respawn: 0, region: ri,
        });
      }
    });
  }

  private spawnAll() {
    const names = makeBotNames(99);
    this.reapers = [];
    const mk = (name: string, isPlayer: boolean, skin: SkinDef): Reaper => {
      const [x, y] = this.randomPoint();
      return {
        id: this.reapers.length, name, isPlayer, skin,
        x, y, vx: 0, vy: 0, dir: rand(0, Math.PI * 2),
        level: 1, xp: 0, score: 0,
        radius: 16, pickLen: 56,
        theta: rand(0, Math.PI * 2),
        omega: (rand(0.9, 2.1) * (Math.random() < 0.5 ? -1 : 1)),
        hitCd: 0, hp: 102, maxHp: 102, lastHurt: -10,
        dashT: 0, dashCd: rand(0, 2), dashDx: 0, dashDy: 0,
        speedT: 0, magnetT: 0, shieldT: 0, shieldHits: 0, rageT: 0,
        alive: true, respawnT: 0, deathHandled: false,
        kills: 0, harvests: 0, coinsRun: 0,
        ai: { thinkT: rand(0, 0.3), tx: x, ty: y, state: "farm", farmT: 0 },
      };
    };
    this.player = mk("ТЫ", true, skinById(this.skinId));
    this.reapers.push(this.player);
    for (let i = 0; i < 99; i++) {
      const skin = skinById(BOT_SKIN_IDS[Math.floor(Math.random() * BOT_SKIN_IDS.length)]);
      const b = mk(names[i], false, skin);
      // часть ботов стартует с прокачкой — сразу живая резня
      if (Math.random() < 0.35) {
        b.level = 2 + Math.floor(rand(0, 6));
        this.applyLevel(b);
        b.hp = b.maxHp;
        b.score = b.level * 60;
      }
      this.reapers.push(b);
    }
  }

  private randomPoint(): [number, number] {
    const [cx, cy] = CROSS[Math.floor(Math.random() * CROSS.length)];
    return [cx * CELL + rand(80, CELL - 80), cy * CELL + rand(80, CELL - 80)];
  }

  private applyLevel(r: Reaper) {
    r.radius = clamp(16 + (r.level - 1) * 1.5, 16, 48);
    r.pickLen = clamp(r.radius * 1.9 + 28 + (r.level - 1) * 1.9, 56, 160);
    r.maxHp = 90 + r.level * 12;
  }
  private speedOf(r: Reaper) {
    let s = 158 * (1 - Math.min(r.level, 40) * 0.0045);
    if (r.speedT > 0) s *= 1.55;
    return s;
  }
  private zoomFor(level: number) {
    return clamp(1.12 - (level - 1) * 0.0085, 0.72, 1.12);
  }

  /* ── input ── */

  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + "px";
    this.canvas.style.height = this.H + "px";
  };

  private bindInput() {
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("pointerdown", this.onPtrDown);
    window.addEventListener("pointermove", this.onPtrMove);
    window.addEventListener("pointerup", this.onPtrUp);
    document.addEventListener("visibilitychange", this.onVis);
  }

  private onVis = () => {
    if (document.hidden) this.paused = true;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (e.code === "Space" || e.code === "ShiftLeft") {
      e.preventDefault();
      this.tryDash();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);

  private onPtrDown = (e: PointerEvent) => {
    audio.ensure();
    const now = performance.now();
    const dbl =
      now - this.lastTapT < 320 &&
      dist2(e.clientX, e.clientY, this.lastTapX, this.lastTapY) < 60 * 60;
    this.lastTapT = now;
    this.lastTapX = e.clientX;
    this.lastTapY = e.clientY;
    if (dbl) {
      this.tryDash();
      // продолжаем отслеживать палец, чтобы движение не прерывалось
      this.ptrId = e.pointerId;
      this.ptrSx = e.clientX;
      this.ptrSy = e.clientY;
      this.inputX = 0;
      this.inputY = 0;
      return;
    }
    this.ptrId = e.pointerId;
    this.ptrSx = e.clientX; this.ptrSy = e.clientY;
    this.inputX = 0; this.inputY = 0;
  };
  private onPtrMove = (e: PointerEvent) => {
    if (e.pointerId !== this.ptrId) return;
    const dx = e.clientX - this.ptrSx;
    const dy = e.clientY - this.ptrSy;
    const len = Math.hypot(dx, dy);
    const m = clamp(len / 56, 0, 1);
    if (len > 6) {
      this.inputX = (dx / len) * m;
      this.inputY = (dy / len) * m;
    } else {
      this.inputX = 0; this.inputY = 0;
    }
  };
  private onPtrUp = (e: PointerEvent) => {
    if (e.pointerId !== this.ptrId) return;
    this.ptrId = -1;
    this.inputX = 0; this.inputY = 0;
  };

  tryDash() {
    const r = this.player;
    if (!r.alive || r.dashCd > 0 || this.over) return;
    let dx = this.inputX, dy = this.inputY;
    if (Math.hypot(dx, dy) < 0.2) { dx = Math.cos(r.dir); dy = Math.sin(r.dir); }
    const len = Math.hypot(dx, dy);
    r.dashDx = dx / len; r.dashDy = dy / len;
    r.dashT = 0.22; r.dashCd = 2.4;
    audio.dash();
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: r.x - r.dashDx * r.radius, y: r.y - r.dashDy * r.radius,
        vx: -r.dashDx * rand(40, 130) + rand(-40, 40), vy: -r.dashDy * rand(40, 130) + rand(-40, 40),
        g: 0, t: 0, max: rand(0.2, 0.4), size: rand(2, 5), color: "#f5e6b0", kind: "dot",
      });
    }
  }

  /* ── update ── */

  private update(dt: number) {
    this.time += dt;
    if (this.cutSndCd > 0) this.cutSndCd -= dt;

    if (!this.over) {
      this.updateWheat(dt);
      this.updateCats(dt);
      this.updateBonuses(dt);
      for (const r of this.reapers) {
        if (r.alive) this.updateReaper(r, dt);
        else if (!r.isPlayer) {
          r.respawnT -= dt;
          if (r.respawnT <= 0) this.respawnBot(r);
        }
      }
      this.resolveCombat();
      this.updateCamera(dt);
      this.hudT -= dt;
      if (this.hudT <= 0) { this.hudT = 0.15; this.pushHud(); }
    }
    this.updateFx(dt);
  }

  private updateWheat(dt: number) {
    for (const w of this.wheatAll) {
      if (w.dead) {
        if (w.cutT > 0) w.cutT -= dt;
        else {
          w.respawn -= dt;
          if (w.respawn <= 0) { w.dead = false; w.stage = 0; }
        }
      } else if (w.stage < 1) {
        w.stage = Math.min(1, w.stage + dt / w.grow);
      }
    }
  }

  private updateCats(dt: number) {
    for (const c of this.cats) {
      if (!c.alive) {
        c.respawn -= dt;
        if (c.respawn <= 0) {
          const rg = REGIONS[c.region];
          c.x = rg.cx * CELL + rand(60, CELL - 60);
          c.y = rg.cy * CELL + rand(60, CELL - 60);
          c.alive = true;
        }
        continue;
      }
      c.wig += dt * 6;
      c.dir += rand(-1.6, 1.6) * dt;
      const nx = c.x + Math.cos(c.dir) * c.speed * dt;
      const ny = c.y + Math.sin(c.dir) * c.speed * dt;
      const rg = REGIONS[c.region];
      if (nx < rg.cx * CELL + 30 || nx > rg.cx * CELL + CELL - 30) c.dir = Math.PI - c.dir;
      else c.x = nx;
      if (ny < rg.cy * CELL + 30 || ny > rg.cy * CELL + CELL - 30) c.dir = -c.dir;
      else c.y = ny;
    }
  }

  private updateBonuses(dt: number) {
    this.bonusT -= dt;
    if (this.bonusT <= 0 && this.bonuses.length < 42) {
      this.bonusT = 0.7;
      const ri = Math.floor(Math.random() * REGIONS.length);
      const rg = REGIONS[ri];
      let tot = 0;
      for (const [, w] of rg.weights) tot += w;
      let roll = Math.random() * tot;
      let type: BonusType = "coin";
      for (const [t, w] of rg.weights) { roll -= w; if (roll <= 0) { type = t; break; } }
      this.bonuses.push({
        x: rg.cx * CELL + rand(50, CELL - 50),
        y: rg.cy * CELL + rand(50, CELL - 50),
        type, t: 0, max: 14,
      });
    }
    for (let i = this.bonuses.length - 1; i >= 0; i--) {
      const b = this.bonuses[i];
      b.t += dt;
      if (b.t >= b.max) this.bonuses.splice(i, 1);
    }
  }

  private updateReaper(r: Reaper, dt: number) {
    // таймеры
    r.hitCd = Math.max(0, r.hitCd - dt);
    r.dashCd = Math.max(0, r.dashCd - dt);
    r.speedT = Math.max(0, r.speedT - dt);
    r.magnetT = Math.max(0, r.magnetT - dt);
    r.rageT = Math.max(0, r.rageT - dt);
    if (r.shieldT > 0) { r.shieldT -= dt; if (r.shieldT <= 0) r.shieldHits = 0; }
    if (this.time - r.lastHurt > 3.5) r.hp = Math.min(r.maxHp, r.hp + (r.maxHp * 0.03) * dt * 2);

    // кирка крутится асинхронно
    r.theta += r.omega * (r.rageT > 0 ? 1.6 : 1) * dt;

    // намерение движения
    let ix = 0, iy = 0;
    if (r.isPlayer) {
      ix = this.inputX; iy = this.inputY;
      const kx = (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0);
      const ky = (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) - (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0);
      if (kx || ky) { const l = Math.hypot(kx, ky); ix = kx / l; iy = ky / l; }
    } else {
      this.botThink(r, dt);
      const dx = r.ai.tx - r.x, dy = r.ai.ty - r.y;
      const l = Math.hypot(dx, dy);
      if (l > 24) { ix = dx / l; iy = dy / l; }
    }

    const sp = this.speedOf(r);
    if (r.dashT > 0) {
      r.dashT -= dt;
      r.vx = r.dashDx * 560; r.vy = r.dashDy * 560;
    } else {
      r.vx += (ix * sp - r.vx) * Math.min(1, dt * 7);
      r.vy += (iy * sp - r.vy) * Math.min(1, dt * 7);
    }
    r.x += r.vx * dt; r.y += r.vy * dt;
    [r.x, r.y] = clampToCross(r.x, r.y);
    if (Math.hypot(r.vx, r.vy) > 30) r.dir = Math.atan2(r.vy, r.vx);

    // кирка срезает пшеницу
    const hx = r.x + Math.cos(r.theta) * r.pickLen;
    const hy = r.y + Math.sin(r.theta) * r.pickLen;
    this.headHarvest(r, hx, hy);
    if (r.magnetT > 0) this.magnetHarvest(r);

    // бонусы
    for (let i = this.bonuses.length - 1; i >= 0; i--) {
      const b = this.bonuses[i];
      if (dist2(r.x, r.y, b.x, b.y) < (r.radius + 15) ** 2) {
        this.bonuses.splice(i, 1);
        this.applyBonus(r, b.type);
      }
    }
  }

  private headHarvest(r: Reaper, hx: number, hy: number) {
    const ri = regionIndexAt(hx, hy);
    if (ri < 0) return;
    const cx = clamp(Math.floor((hx - REGIONS[ri].cx * CELL) / CHUNK), 0, 4);
    const cy = clamp(Math.floor((hy - REGIONS[ri].cy * CELL) / CHUNK), 0, 4);
    const ch = this.chunks[ri][cy * 5 + cx];
    for (const w of ch.wheat) {
      if (w.dead || w.stage < 0.6) continue;
      if (dist2(hx, hy, w.x, w.y - 10) < 26 * 26) this.cutWheat(r, w);
    }
    // гусеницы под наконечником
    for (const c of this.cats) {
      if (!c.alive) continue;
      if (dist2(hx, hy, c.x, c.y) < 22 * 22) this.killCat(r, c);
    }
  }

  private magnetHarvest(r: Reaper) {
    let n = 0;
    for (const w of this.wheatAll) {
      if (n >= 3) break;
      if (!w.dead && w.stage >= 0.6 && dist2(r.x, r.y, w.x, w.y) < 150 * 150) {
        this.cutWheat(r, w);
        n++;
      }
    }
  }

  private cutWheat(r: Reaper, w: WheatStalk) {
    w.dead = true; w.cutT = 0.32; w.respawn = rand(7, 15);
    r.harvests++;
    if (r.isPlayer) r.coinsRun += 1;
    const head = REGIONS[regionIndexAt(w.x, w.y)]?.wheatHead ?? "#ecd06a";
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: w.x, y: w.y - 14,
        vx: rand(-50, 50), vy: rand(-110, -30), g: 240,
        t: 0, max: rand(0.3, 0.55), size: rand(1.5, 3), color: head, kind: "dot",
      });
    }
    if (r.isPlayer && this.cutSndCd <= 0) {
      this.cutSndCd = 0.07;
      audio.cut(r.harvests);
    }
    this.addXp(r, w.value);
  }

  private killCat(r: Reaper, c: Caterpillar) {
    c.alive = false; c.respawn = rand(8, 14);
    if (r.isPlayer) r.coinsRun += 3;
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: c.x, y: c.y, vx: rand(-90, 90), vy: rand(-90, 90), g: 160,
        t: 0, max: rand(0.25, 0.45), size: rand(2, 4), color: REGIONS[c.region].catColor, kind: "dot",
      });
    }
    if (r.isPlayer) audio.hit();
    this.addXp(r, REGIONS[c.region].catXp);
  }

  private applyBonus(r: Reaper, type: BonusType) {
    switch (type) {
      case "speed": r.speedT = 6; break;
      case "magnet": r.magnetT = 8; break;
      case "shield": r.shieldT = 12; r.shieldHits = 3; break;
      case "rage": r.rageT = 7; break;
      case "coin":
        if (r.isPlayer) r.coinsRun += 15 + Math.floor(rand(0, 16));
        else r.score += 40;
        break;
      case "heart": r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.4); break;
    }
    if (r.isPlayer) {
      audio.pickup();
      this.texts.push({ x: r.x, y: r.y - r.radius - 22, txt: this.bonusLabel(type), color: BONUS_COLOR[type], t: 0, big: false });
    }
  }
  private bonusLabel(t: BonusType) {
    return t === "speed" ? "ВЕТЕР!" : t === "magnet" ? "МАГНИТ!" : t === "shield" ? "ЩИТ!" : t === "rage" ? "ЯРОСТЬ!" : t === "coin" ? "МОНЕТЫ!" : "ЛЕЧЕНИЕ!";
  }

  private addXp(r: Reaper, amt: number) {
    r.xp += amt; r.score += amt;
    let leveled = false;
    while (r.xp >= this.xpNeed(r.level)) {
      r.xp -= this.xpNeed(r.level);
      r.level++;
      leveled = true;
    }
    if (leveled) {
      this.applyLevel(r);
      r.hp = Math.min(r.maxHp, r.hp + r.maxHp * 0.35);
      this.particles.push({ x: r.x, y: r.y, vx: 0, vy: 0, g: 0, t: 0, max: 0.6, size: r.radius, color: "#e8c547", kind: "ring" });
      if (r.isPlayer) {
        audio.levelUp();
        this.texts.push({ x: r.x, y: r.y - r.radius - 30, txt: "УРОВЕНЬ " + r.level, color: "#e8c547", t: 0, big: true });
        this.pushHud(true);
      }
    }
  }
  private xpNeed(level: number) {
    return 40 + (level - 1) * 45;
  }

  /* ── bot brain ── */

  private botThink(r: Reaper, dt: number) {
    r.ai.thinkT -= dt;
    r.ai.farmT -= dt;
    if (r.ai.thinkT > 0) return;
    r.ai.thinkT = 0.18 + Math.random() * 0.12;

    // ближайший враг
    let near: Reaper | null = null; let nd = 460 * 460;
    for (const o of this.reapers) {
      if (o === r || !o.alive) continue;
      const d = dist2(r.x, r.y, o.x, o.y);
      if (d < nd) { nd = d; near = o; }
    }

    if (near && near.level > r.level + 1) {
      // опаснее нас — убегаем
      r.ai.state = "flee";
      const d = Math.sqrt(nd) || 1;
      r.ai.tx = r.x + ((r.x - near.x) / d) * 340;
      r.ai.ty = r.y + ((r.y - near.y) / d) * 340;
      if (r.dashCd <= 0 && nd < 260 * 260 && Math.random() < 0.55) {
        r.dashDx = (r.x - near.x) / d; r.dashDy = (r.y - near.y) / d;
        r.dashT = 0.22; r.dashCd = 2.6;
        if (Math.random() < 0.3) audio.dash();
      }
    } else if (near && r.level > near.level + 1 && Math.random() < 0.85) {
      // слабее нас — охотимся
      r.ai.state = "hunt";
      r.ai.tx = near.x + near.vx * 0.3;
      r.ai.ty = near.y + near.vy * 0.3;
      const d = Math.sqrt(nd) || 1;
      if (r.dashCd <= 0 && nd > 180 * 180 && Math.random() < 0.2) {
        r.dashDx = (near.x - r.x) / d; r.dashDy = (near.y - r.y) / d;
        r.dashT = 0.22; r.dashCd = 2.8;
      }
    } else {
      r.ai.state = "farm";
      const reached = dist2(r.x, r.y, r.ai.tx, r.ai.ty) < 50 * 50;
      if (reached || r.ai.farmT <= 0) {
        r.ai.farmT = rand(2.2, 4);
        // ищем колосья: сэмплим случайные из всех
        let best: WheatStalk | null = null; let bd = Infinity;
        for (let i = 0; i < 16; i++) {
          const w = this.wheatAll[Math.floor(Math.random() * this.wheatAll.length)];
          if (w.dead || w.stage < 0.5) continue;
          const d = dist2(r.x, r.y, w.x, w.y);
          if (d < bd) { bd = d; best = w; }
        }
        if (best) { r.ai.tx = best.x + rand(-30, 30); r.ai.ty = best.y + rand(-30, 30); }
        else { [r.ai.tx, r.ai.ty] = this.randomPoint(); }
      }
    }
    const [tx, ty] = clampToCross(r.ai.tx, r.ai.ty);
    r.ai.tx = tx; r.ai.ty = ty;
  }

  private respawnBot(r: Reaper) {
    const [x, y] = this.randomPoint();
    r.x = x; r.y = y; r.vx = 0; r.vy = 0;
    r.level = 1; r.xp = 0; r.score = Math.max(0, r.score * 0.2);
    this.applyLevel(r); r.hp = r.maxHp;
    r.alive = true; r.deathHandled = false;
    r.speedT = 0; r.magnetT = 0; r.shieldT = 0; r.shieldHits = 0; r.rageT = 0;
    r.dashCd = rand(1, 3);
  }

  /* ── combat ── */

  private resolveCombat() {
    const rs = this.reapers;
    // урон только от наконечника кирки
    for (const a of rs) {
      if (!a.alive) continue;
      const hx = a.x + Math.cos(a.theta) * a.pickLen;
      const hy = a.y + Math.sin(a.theta) * a.pickLen;
      for (const v of rs) {
        if (v === a || !v.alive) continue;
        if (dist2(hx, hy, v.x, v.y) < (v.radius + 7) ** 2) {
          if (a.hitCd <= 0) {
            a.hitCd = 0.55;
            let dmg = 13 + a.level * 3.2;
            if (a.rageT > 0) dmg *= 2;
            this.hurt(v, a, dmg, hx, hy);
          }
          break;
        }
      }
    }
    // мягкое расталкивание тел (без урона)
    for (let i = 0; i < rs.length; i++) {
      const a = rs[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < rs.length; j++) {
        const b = rs[j];
        if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < rr * rr) {
          const d = Math.sqrt(d2);
          const push = ((rr - d) / d) * 0.5;
          a.x -= dx * push * 0.5; a.y -= dy * push * 0.5;
          b.x += dx * push * 0.5; b.y += dy * push * 0.5;
        }
      }
    }
  }

  private hurt(v: Reaper, a: Reaper, dmg: number, hx: number, hy: number) {
    if (v.shieldHits > 0) {
      v.shieldHits--;
      if (v.shieldHits <= 0) v.shieldT = 0;
      for (let i = 0; i < 5; i++) {
        this.particles.push({ x: hx, y: hy, vx: rand(-90, 90), vy: rand(-90, 90), g: 0, t: 0, max: 0.3, size: 2.5, color: "#8fb8e8", kind: "spark" });
      }
      if (v.isPlayer) audio.hit();
      return;
    }
    v.hp -= dmg;
    v.lastHurt = this.time;
    const d = Math.hypot(v.x - hx, v.y - hy) || 1;
    v.vx += ((v.x - hx) / d) * 190;
    v.vy += ((v.y - hy) / d) * 190;
    for (let i = 0; i < 5; i++) {
      this.particles.push({ x: hx, y: hy, vx: rand(-120, 120), vy: rand(-120, 120), g: 200, t: 0, max: 0.35, size: 2.5, color: "#f0d878", kind: "spark" });
    }
    if (v.isPlayer) {
      this.flash = 0.5; this.shakeT = 0.25; this.shakeAmp = 7;
      audio.hurt();
    } else if (a.isPlayer) {
      audio.hit();
      this.shakeT = Math.max(this.shakeT, 0.1); this.shakeAmp = 3;
    }
    if (v.hp <= 0) this.kill(v, a);
  }

  private kill(v: Reaper, a: Reaper) {
    v.alive = false;
    v.respawnT = rand(4, 8);
    a.kills++;
    this.addXp(a, 25 + v.level * 10);
    if (a.isPlayer) {
      a.coinsRun += 6 + v.level * 2;
      audio.kill();
      this.texts.push({ x: v.x, y: v.y - 24, txt: "СРЕЗАЛ " + v.name, color: "#e8c547", t: 0, big: false });
      this.pushHud(true);
    }
    for (let i = 0; i < 18; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(40, 220);
      this.particles.push({ x: v.x, y: v.y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 140, t: 0, max: rand(0.4, 0.8), size: rand(2, 5), color: v.skin.body, kind: "dot" });
    }
    this.particles.push({ x: v.x, y: v.y, vx: 0, vy: 0, g: 0, t: 0, max: 0.5, size: v.radius, color: v.skin.body, kind: "ring" });
    // рассыпается немного монет
    for (let i = 0; i < 2; i++) {
      this.bonuses.push({ x: v.x + rand(-30, 30), y: v.y + rand(-30, 30), type: "coin", t: 0, max: 10 });
    }
    if (v.isPlayer) this.gameOver();
  }

  private gameOver() {
    if (this.over) return;
    this.over = true;
    audio.death();
    this.shakeT = 0.6; this.shakeAmp = 12; this.flash = 0.8;
    const score = this.player.score;
    const newBest = score > this.initialBest;
    this.result = {
      score, level: this.player.level, kills: this.player.kills,
      harvests: this.player.harvests, coinsEarned: this.player.coinsRun,
      timeSec: Math.floor(this.time), best: Math.max(this.initialBest, score), newBest,
    };
    this.pushHud(true);
    setTimeout(() => { if (this.result) this.onOver(this.result); }, 700);
  }

  /* ── camera / fx ── */

  private updateCamera(dt: number) {
    const p = this.player;
    const k = Math.min(1, dt * 5);
    this.camX += (p.x - this.camX) * k;
    this.camY += (p.y - this.camY) * k;
    this.zoom += (this.zoomFor(p.level) - this.zoom) * Math.min(1, dt * 2);
  }

  private updateFx(dt: number) {
    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.flash > 0) this.flash -= dt * 1.4;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t >= p.max) { this.particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t > 1.2) this.texts.splice(i, 1);
    }
  }

  /* ── hud ── */

  private pushHud(force = false) {
    const p = this.player;
    const ri = regionIndexAt(p.x, p.y);
    const regionName = ri >= 0 ? REGIONS[ri].name : "Пустота";
    if (force || ri !== this.lastRegion) this.lastRegion = ri;
    const board = [...this.reapers]
      .filter((r) => r.alive || r.isPlayer)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((r) => ({ name: r.name, score: r.score, you: r.isPlayer }));
    const buffs: { id: BuffId; t: number }[] = [];
    if (p.speedT > 0) buffs.push({ id: "speed", t: p.speedT });
    if (p.magnetT > 0) buffs.push({ id: "magnet", t: p.magnetT });
    if (p.shieldT > 0) buffs.push({ id: "shield", t: p.shieldT });
    if (p.rageT > 0) buffs.push({ id: "rage", t: p.rageT });
    this.onHud({
      time: this.time, level: p.level, xp: p.xp, xpNeed: this.xpNeed(p.level),
      hp: Math.max(0, p.hp), maxHp: p.maxHp, score: p.score,
      coinsRun: p.coinsRun, kills: p.kills, harvests: p.harvests,
      alive: this.reapers.filter((r) => r.alive).length,
      regionName, dashReady: p.dashCd <= 0 ? 1 : 1 - p.dashCd / 2.4,
      buffs, board,
    });
  }

  /* ── draw ── */

  private draw() {
    const { ctx, W, H } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#171208";
    ctx.fillRect(0, 0, W, H);

    const shx = this.shakeT > 0 ? rand(-this.shakeAmp, this.shakeAmp) * this.shakeT : 0;
    const shy = this.shakeT > 0 ? rand(-this.shakeAmp, this.shakeAmp) * this.shakeT : 0;

    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX + shx, -this.camY + shy);

    const vw = W / 2 / this.zoom + 120;
    const vx0 = this.camX - vw, vx1 = this.camX + vw;
    const vy0 = this.camY - (H / 2 / this.zoom + 120), vy1 = this.camY + (H / 2 / this.zoom + 120);

    this.drawGround(vx0, vy0, vx1, vy1);
    this.drawWheat(vx0, vy0, vx1, vy1);
    this.drawBonuses();
    this.drawCats(vx0, vy0, vx1, vy1);
    for (const r of this.reapers) {
      if (!r.alive || r.x < vx0 || r.x > vx1 || r.y < vy0 || r.y > vy1) continue;
      if (!r.isPlayer) this.drawReaper(r);
    }
    if (this.player.alive) this.drawReaper(this.player);
    this.drawParticles();
    this.drawTexts();
    ctx.restore();

    this.drawScreenFx();
    if (this.player.alive) this.drawMinimap();
  }

  private drawGround(vx0: number, vy0: number, vx1: number, vy1: number) {
    const { ctx } = this;
    for (let ri = 0; ri < REGIONS.length; ri++) {
      const rg = REGIONS[ri];
      const rx = rg.cx * CELL, ry = rg.cy * CELL;
      if (rx > vx1 || rx + CELL < vx0 || ry > vy1 || ry + CELL < vy0) continue;
      ctx.fillStyle = rg.ground;
      ctx.fillRect(rx, ry, CELL, CELL);
      // чанки: шахматная тонировка + сетка
      for (let cy = 0; cy < 5; cy++) {
        for (let cx = 0; cx < 5; cx++) {
          if ((cx + cy) % 2 === 0) continue;
          ctx.fillStyle = rg.groundAlt;
          ctx.fillRect(rx + cx * CHUNK, ry + cy * CHUNK, CHUNK, CHUNK);
        }
      }
      ctx.strokeStyle = "rgba(23,18,8,0.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        ctx.moveTo(rx + i * CHUNK, ry); ctx.lineTo(rx + i * CHUNK, ry + CELL);
        ctx.moveTo(rx, ry + i * CHUNK); ctx.lineTo(rx + CELL, ry + i * CHUNK);
      }
      ctx.stroke();
      // граница области
      ctx.strokeStyle = "rgba(23,18,8,0.45)";
      ctx.lineWidth = 8;
      ctx.strokeRect(rx + 4, ry + 4, CELL - 8, CELL - 8);
      ctx.strokeStyle = "rgba(232,197,71,0.22)";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 14, ry + 14, CELL - 28, CELL - 28);
      // название на земле
      ctx.fillStyle = "rgba(23,18,8,0.12)";
      ctx.font = '42px "Russo One", sans-serif';
      ctx.textAlign = "center";
      ctx.fillText(rg.name.toUpperCase(), rx + CELL / 2, ry + CELL / 2 + 14);
    }
  }

  private drawWheat(vx0: number, vy0: number, vx1: number, vy1: number) {
    const { ctx } = this;
    for (let ri = 0; ri < REGIONS.length; ri++) {
      const rg = REGIONS[ri];
      const rx = rg.cx * CELL, ry = rg.cy * CELL;
      if (rx > vx1 || rx + CELL < vx0 || ry > vy1 || ry + CELL < vy0) continue;
      for (const ch of this.chunks[ri]) {
        for (const w of ch.wheat) {
          if (w.x < vx0 || w.x > vx1 || w.y < vy0 || w.y > vy1) continue;
          if (w.dead && w.cutT <= 0) continue;
          const h = 11 + 17 * w.stage;
          if (w.dead) {
            const k = 1 - w.cutT / 0.32;
            ctx.save();
            ctx.translate(w.x, w.y);
            ctx.rotate(k * 1.25 * w.fallDir);
            ctx.globalAlpha = 1 - k;
            this.drawStalk(0, 0, h, 0, rg, w.stage);
            ctx.restore();
            ctx.globalAlpha = 1;
            continue;
          }
          const sway = Math.sin(this.time * 1.7 + w.phase) * 2.6 * w.stage;
          this.drawStalk(w.x, w.y, h, sway, rg, w.stage);
        }
      }
    }
  }

  private drawStalk(x: number, y: number, h: number, sway: number, rg: RegionDef, stage: number) {
    const { ctx } = this;
    const tipX = x + sway, tipY = y - h;
    ctx.strokeStyle = rg.wheatStalk;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + sway * 0.3, y - h * 0.6, tipX, tipY);
    ctx.stroke();
    if (stage > 0.45) {
      ctx.fillStyle = rg.wheatHead;
      ctx.beginPath();
      ctx.ellipse(tipX, tipY - 3, 2.6, 5.4, sway * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rg.wheatHead;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(tipX - 2, tipY - 5); ctx.lineTo(tipX - 4.5, tipY - 11);
      ctx.moveTo(tipX + 2, tipY - 5); ctx.lineTo(tipX + 4.5, tipY - 11);
      ctx.moveTo(tipX, tipY - 7); ctx.lineTo(tipX, tipY - 13);
      ctx.stroke();
    }
  }

  private drawBonuses() {
    const { ctx } = this;
    for (const b of this.bonuses) {
      const fade = b.max - b.t < 2 ? (b.max - b.t) / 2 : 1;
      const pulse = 1 + Math.sin(this.time * 5 + b.x) * 0.12;
      const r = 13 * pulse;
      ctx.globalAlpha = fade;
      ctx.fillStyle = "rgba(24,18,7,0.88)";
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = BONUS_COLOR[b.type];
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#f5e6b0"; ctx.fillStyle = "#f5e6b0";
      ctx.lineWidth = 2;
      ctx.beginPath();
      switch (b.type) {
        case "speed":
          ctx.moveTo(b.x - 5, b.y - 5); ctx.lineTo(b.x + 1, b.y); ctx.lineTo(b.x - 5, b.y + 5);
          ctx.moveTo(b.x, b.y - 5); ctx.lineTo(b.x + 6, b.y); ctx.lineTo(b.x, b.y + 5);
          break;
        case "magnet":
          ctx.arc(b.x, b.y - 1, 5, Math.PI, 0);
          ctx.moveTo(b.x - 5, b.y - 1); ctx.lineTo(b.x - 5, b.y + 5);
          ctx.moveTo(b.x + 5, b.y - 1); ctx.lineTo(b.x + 5, b.y + 5);
          break;
        case "shield":
          ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
          break;
        case "rage":
          ctx.moveTo(b.x - 5, b.y + 4); ctx.lineTo(b.x - 1, b.y - 4);
          ctx.moveTo(b.x - 1, b.y + 4); ctx.lineTo(b.x + 3, b.y - 4);
          ctx.moveTo(b.x + 3, b.y + 4); ctx.lineTo(b.x + 7, b.y - 4);
          break;
        case "coin":
          ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case "heart":
          ctx.moveTo(b.x - 5, b.y); ctx.lineTo(b.x + 5, b.y);
          ctx.moveTo(b.x, b.y - 5); ctx.lineTo(b.x, b.y + 5);
          break;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  private drawCats(vx0: number, vy0: number, vx1: number, vy1: number) {
    const { ctx } = this;
    for (const c of this.cats) {
      if (!c.alive || c.x < vx0 || c.x > vx1 || c.y < vy0 || c.y > vy1) continue;
      const col = REGIONS[c.region].catColor;
      for (let i = 3; i >= 0; i--) {
        const off = i * 6;
        const wob = Math.sin(c.wig - i * 0.9) * 2.4;
        const px = c.x - Math.cos(c.dir) * off + Math.cos(c.dir + Math.PI / 2) * wob;
        const py = c.y - Math.sin(c.dir) * off + Math.sin(c.dir + Math.PI / 2) * wob;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(px, py, 5 - i * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // глазки
      ctx.fillStyle = "#171208";
      const ex = Math.cos(c.dir + Math.PI / 2) * 2, ey = Math.sin(c.dir + Math.PI / 2) * 2;
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(c.dir) * 2 + ex, c.y + Math.sin(c.dir) * 2 + ey, 1, 0, Math.PI * 2);
      ctx.arc(c.x + Math.cos(c.dir) * 2 - ex, c.y + Math.sin(c.dir) * 2 - ey, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawReaper(r: Reaper) {
    const { ctx } = this;
    // тень
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + r.radius * 0.75, r.radius * 0.95, r.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // палка + кирка
    const hx = r.x + Math.cos(r.theta) * r.pickLen;
    const hy = r.y + Math.sin(r.theta) * r.pickLen;
    ctx.strokeStyle = "#4a3a18";
    ctx.lineWidth = 4 + r.level * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(r.x + Math.cos(r.theta) * r.radius * 0.5, r.y + Math.sin(r.theta) * r.radius * 0.5);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    // наконечник-кирка: поперечная дуга
    const pa = r.theta + Math.PI / 2;
    const hw = 9 + r.level * 0.55;
    ctx.strokeStyle = "#8d939c";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(pa) * hw, hy + Math.sin(pa) * hw);
    ctx.quadraticCurveTo(hx + Math.cos(r.theta) * 7, hy + Math.sin(r.theta) * 7, hx - Math.cos(pa) * hw, hy - Math.sin(pa) * hw);
    ctx.stroke();
    ctx.strokeStyle = "#5c616a";
    ctx.lineWidth = 2;
    ctx.stroke();

    // ауры
    if (r.rageT > 0) {
      ctx.strokeStyle = "rgba(224,96,72,0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.radius + 6, 0, Math.PI * 2); ctx.stroke();
    }
    if (r.shieldT > 0) {
      ctx.strokeStyle = "rgba(143,184,232,0.8)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(r.x, r.y, r.radius + 9, this.time * 2, this.time * 2 + Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // тело
    ctx.fillStyle = r.skin.body;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.clip();
    this.drawSkinPattern(r);
    ctx.restore();
    ctx.strokeStyle = "rgba(23,18,8,0.55)";
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2); ctx.stroke();

    // глаза
    const ex = Math.cos(r.dir) * r.radius * 0.45, ey = Math.sin(r.dir) * r.radius * 0.45;
    const px = Math.cos(r.dir + Math.PI / 2) * r.radius * 0.32;
    const py = Math.sin(r.dir + Math.PI / 2) * r.radius * 0.32;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(r.x + ex + px, r.y + ey + py, r.radius * 0.2, 0, Math.PI * 2);
    ctx.arc(r.x + ex - px, r.y + ey - py, r.radius * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1708";
    ctx.beginPath();
    ctx.arc(r.x + ex * 1.25 + px, r.y + ey * 1.25 + py, r.radius * 0.1, 0, Math.PI * 2);
    ctx.arc(r.x + ex * 1.25 - px, r.y + ey * 1.25 - py, r.radius * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // имя + уровень
    ctx.textAlign = "center";
    const label = r.isPlayer ? "ТЫ" : r.name;
    ctx.font = r.isPlayer ? '13px "Russo One", sans-serif' : '600 11px Rubik, sans-serif';
    const ty = r.y - r.radius - 14;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(23,18,8,0.75)";
    ctx.strokeText(label + " · " + r.level, r.x, ty);
    ctx.fillStyle = r.isPlayer ? "#e8c547" : "#f5e6b0";
    ctx.fillText(label + " · " + r.level, r.x, ty);

    // полоса hp
    if (r.hp < r.maxHp) {
      const w = Math.max(30, r.radius * 2);
      ctx.fillStyle = "rgba(23,18,8,0.7)";
      ctx.fillRect(r.x - w / 2, ty - 14, w, 4);
      ctx.fillStyle = r.isPlayer ? "#7dc95e" : "#d96a4a";
      ctx.fillRect(r.x - w / 2, ty - 14, w * clamp(r.hp / r.maxHp, 0, 1), 4);
    }
    // метка игрока
    if (r.isPlayer) {
      ctx.fillStyle = "#e8c547";
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - r.radius - 24);
      ctx.lineTo(r.x - 5, r.y - r.radius - 31);
      ctx.lineTo(r.x + 5, r.y - r.radius - 31);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawSkinPattern(r: Reaper) {
    const { ctx } = this;
    const { x, y, radius: rad } = r;
    const a = r.skin.accent;
    switch (r.skin.pattern) {
      case "stripes":
        ctx.fillStyle = a;
        for (let i = -2; i <= 2; i++) ctx.fillRect(x + i * rad * 0.42 - rad * 0.09, y - rad, rad * 0.18, rad * 2);
        break;
      case "dots":
        ctx.fillStyle = a;
        for (let j = -1; j <= 1; j++)
          for (let i = -1; i <= 1; i++) {
            ctx.beginPath();
            ctx.arc(x + i * rad * 0.45, y + j * rad * 0.45, rad * 0.13, 0, Math.PI * 2);
            ctx.fill();
          }
        break;
      case "ring":
        ctx.strokeStyle = a;
        ctx.lineWidth = rad * 0.28;
        ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2); ctx.stroke();
        break;
      case "zig": {
        ctx.strokeStyle = a;
        ctx.lineWidth = rad * 0.2;
        ctx.beginPath();
        ctx.moveTo(x - rad, y + rad * 0.2);
        for (let i = 0; i <= 4; i++) {
          ctx.lineTo(x - rad + (i + 0.5) * rad * 0.5, y + (i % 2 === 0 ? rad * 0.55 : -rad * 0.35));
        }
        ctx.stroke();
        break;
      }
      case "wheat": {
        ctx.strokeStyle = a;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x, y + rad * 0.7); ctx.lineTo(x, y - rad * 0.6);
        ctx.stroke();
        ctx.fillStyle = a;
        for (let i = 0; i < 3; i++) {
          const yy = y - rad * 0.1 - i * rad * 0.24;
          ctx.beginPath();
          ctx.ellipse(x - rad * 0.2, yy, rad * 0.1, rad * 0.2, -0.6, 0, Math.PI * 2);
          ctx.ellipse(x + rad * 0.2, yy, rad * 0.1, rad * 0.2, 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case "none":
        break;
    }
  }

  private drawParticles() {
    const { ctx } = this;
    for (const p of this.particles) {
      const k = 1 - p.t / p.max;
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = k;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - k) * 60, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = k;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTexts() {
    const { ctx } = this;
    ctx.textAlign = "center";
    for (const t of this.texts) {
      const k = 1 - t.t / 1.2;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = t.big ? '20px "Russo One", sans-serif' : '700 13px Rubik, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(23,18,8,0.8)";
      const y = t.y - t.t * 34;
      ctx.strokeText(t.txt, t.x, y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.txt, t.x, y);
    }
    ctx.globalAlpha = 1;
  }

  private drawScreenFx() {
    const { ctx, W, H } = this;
    // виньетка
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.36, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(23,18,8,0)");
    g.addColorStop(1, "rgba(23,18,8,0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(200,50,30,${clamp(this.flash * 0.45, 0, 0.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.over) {
      ctx.fillStyle = "rgba(23,18,8,0.55)";
      ctx.fillRect(0, 0, W, H);
    }
  }

  private drawMinimap() {
    const { ctx, H } = this;
    const size = 104;
    const s = size / WORLD;
    const x0 = 12, y0 = H - size - 14;
    ctx.fillStyle = "rgba(23,18,8,0.78)";
    ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
    ctx.strokeStyle = "rgba(232,197,71,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
    for (const rg of REGIONS) {
      ctx.fillStyle = rg.ground;
      ctx.fillRect(x0 + rg.cx * CELL * s, y0 + rg.cy * CELL * s, CELL * s, CELL * s);
    }
    // лидер
    let top: Reaper | null = null;
    for (const r of this.reapers) {
      if (!r.alive || r.isPlayer) continue;
      if (!top || r.score > top.score) top = r;
    }
    if (top) {
      ctx.fillStyle = "#e8c547";
      ctx.beginPath();
      ctx.arc(x0 + top.x * s, y0 + top.y * s, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // игрок
    const p = this.player;
    const pulse = 2.6 + Math.sin(this.time * 6) * 0.8;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x0 + p.x * s, y0 + p.y * s, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(x0 + p.x * s, y0 + p.y * s, pulse + 2.5, 0, Math.PI * 2);
    ctx.stroke();
  }
}
