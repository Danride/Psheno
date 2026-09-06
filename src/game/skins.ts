export type PatternId = "none" | "stripes" | "dots" | "ring" | "zig" | "wheat";

export interface SkinDef {
  id: string;
  name: string;
  cost: number;
  body: string;
  accent: string;
  pattern: PatternId;
}

export const SKINS: SkinDef[] = [
  // бесплатные
  { id: "green", name: "Зелёный", cost: 0, body: "#4f9e4f", accent: "#2c5e30", pattern: "none" },
  { id: "red", name: "Красный", cost: 0, body: "#c9503f", accent: "#7e2a20", pattern: "none" },
  { id: "blue", name: "Синий", cost: 0, body: "#4a7fbf", accent: "#2a4d7c", pattern: "none" },
  { id: "yellow", name: "Жёлтый", cost: 0, body: "#e3b93d", accent: "#96761c", pattern: "none" },
  // за монеты — цвета
  { id: "orange", name: "Оранжевый", cost: 60, body: "#d9812e", accent: "#8a4c14", pattern: "none" },
  { id: "black", name: "Чёрный", cost: 90, body: "#33302b", accent: "#12100d", pattern: "none" },
  { id: "white", name: "Белый", cost: 90, body: "#e9e5d8", accent: "#a8a290", pattern: "none" },
  { id: "violet", name: "Фиолетовый", cost: 120, body: "#8a5cbf", accent: "#533479", pattern: "none" },
  { id: "turquoise", name: "Бирюзовый", cost: 120, body: "#3fb8a8", accent: "#1f6e63", pattern: "none" },
  // за монеты — с рисунком
  { id: "stripes", name: "Полосы", cost: 160, body: "#4a7fbf", accent: "#f0ead2", pattern: "stripes" },
  { id: "dots", name: "Горох", cost: 160, body: "#c9503f", accent: "#f5e6b0", pattern: "dots" },
  { id: "flame", name: "Пламя", cost: 220, body: "#33302b", accent: "#d9812e", pattern: "zig" },
  { id: "target", name: "Кольцо", cost: 220, body: "#e9e5d8", accent: "#c9503f", pattern: "ring" },
  { id: "spike", name: "Колос", cost: 280, body: "#e3b93d", accent: "#5d4a10", pattern: "wheat" },
];

export const BOT_SKIN_IDS = ["green", "red", "blue", "yellow", "orange", "black", "white", "violet", "turquoise"];

export function skinById(id: string): SkinDef {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}

export interface SaveData {
  coins: number;
  owned: string[];
  selected: string;
  best: number;
  muted: boolean;
}

const KEY = "zheptsy-save-v1";

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      return {
        coins: typeof d.coins === "number" ? d.coins : 0,
        owned: Array.isArray(d.owned) && d.owned.length ? d.owned : ["green", "red", "blue", "yellow"],
        selected: typeof d.selected === "string" ? d.selected : "yellow",
        best: typeof d.best === "number" ? d.best : 0,
        muted: !!d.muted,
      };
    }
  } catch {
    /* ignore */
  }
  return { coins: 0, owned: ["green", "red", "blue", "yellow"], selected: "yellow", best: 0, muted: false };
}

export function storeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
