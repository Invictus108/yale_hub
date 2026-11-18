/**
 * Aiden owns Nutrislice. Dining tools call this.
 * Parsed menus are cached in data/dining/.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const API = "https://yalehospitality.api.nutrislice.com";
const CACHE_MS = 3 * 60 * 60 * 1000;

export interface MenuItem {
  name: string;
  station: string | null;
}

export interface DiningMenu {
  hall: string;
  slug: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner";
  items: MenuItem[];
}

export interface DiningHall {
  name: string;
  slug: string;
}

/** Residential dining halls on the Yale Hospitality Nutrislice site. */
export const DINING_HALLS: DiningHall[] = [
  { name: "Benjamin Franklin College", slug: "benjamin-franklin-college" },
  { name: "Berkeley College", slug: "berkeley-college" },
  { name: "Branford College", slug: "branford-college" },
  { name: "Davenport College", slug: "davenport-college" },
  { name: "Ezra Stiles College", slug: "ezra-stiles-college" },
  { name: "Grace Hopper College", slug: "hopper-college" },
  { name: "Jonathan Edwards College", slug: "jonathan-edwards-college" },
  { name: "Morse College", slug: "morse-college" },
  { name: "Pauli Murray College", slug: "pauli-murray-college" },
  { name: "Pierson College", slug: "pierson-college" },
  { name: "Saybrook College", slug: "saybrook-college" },
  { name: "Silliman College", slug: "silliman-college" },
  { name: "Timothy Dwight College", slug: "timothy-dwight-college" },
  { name: "Trumbull College", slug: "trumbull-college" },
];

const HALL_ALIASES: Record<string, string> = {
  bf: "benjamin-franklin-college",
  franklin: "benjamin-franklin-college",
  "benjamin franklin": "benjamin-franklin-college",
  berkeley: "berkeley-college",
  bk: "berkeley-college",
  branford: "branford-college",
  br: "branford-college",
  davenport: "davenport-college",
  dc: "davenport-college",
  stiles: "ezra-stiles-college",
  "ezra stiles": "ezra-stiles-college",
  es: "ezra-stiles-college",
  hopper: "hopper-college",
  "grace hopper": "hopper-college",
  gh: "hopper-college",
  je: "jonathan-edwards-college",
  "jonathan edwards": "jonathan-edwards-college",
  morse: "morse-college",
  mc: "morse-college",
  murray: "pauli-murray-college",
  "pauli murray": "pauli-murray-college",
  pm: "pauli-murray-college",
  pierson: "pierson-college",
  pc: "pierson-college",
  saybrook: "saybrook-college",
  sy: "saybrook-college",
  silliman: "silliman-college",
  sm: "silliman-college",
  td: "timothy-dwight-college",
  "timothy dwight": "timothy-dwight-college",
  trumbull: "trumbull-college",
  tc: "trumbull-college",
};

export function newYorkToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function mealForNow(now = new Date()): DiningMenu["meal"] {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(now),
  );
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  return "dinner";
}

function hallKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’.]/g, "")
    .replace(/\s+college$/, "")
    .replace(/\s+/g, " ");
}

export function resolveDiningHall(hall: string): DiningHall {
  const key = hallKey(hall);
  if (!key) throw new Error("Name a dining hall, or set a residential college on the profile.");
  const alias = HALL_ALIASES[key];
  const known = DINING_HALLS.find((item) => item.slug === key || item.slug === alias || hallKey(item.name) === key);
  if (known) return known;
  throw new Error(
    `Unknown dining hall "${hall}". Use one of: ${DINING_HALLS.map((item) => item.name.replace(" College", "")).join(", ")}.`,
  );
}

export function preferredHall(college: string | null | undefined, preference: unknown): DiningHall | null {
  const fromPreference = typeof preference === "string" ? preference : "";
  const candidate = fromPreference.trim() || college?.trim() || "";
  if (!candidate) return null;
  try {
    return resolveDiningHall(candidate);
  } catch {
    return null;
  }
}

interface CacheFile {
  savedAt: string;
  menu: DiningMenu;
}

function cacheFile(slug: string, date: string, meal: string): string {
  return path.resolve(process.cwd(), "data", "dining", `${slug}-${date}-${meal}.json`);
}

async function readCache(slug: string, date: string, meal: string): Promise<CacheFile | null> {
  try {
    return JSON.parse(await readFile(cacheFile(slug, date, meal), "utf8")) as CacheFile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

interface NutrisliceItem {
  is_section_title?: boolean;
  is_station_header?: boolean;
  text?: string;
  food?: { name?: string } | null;
}

interface NutrisliceDay {
  date?: string;
  menu_items?: NutrisliceItem[];
}

function itemsFromDay(day: NutrisliceDay): MenuItem[] {
  const items: MenuItem[] = [];
  let station: string | null = null;
  for (const item of day.menu_items ?? []) {
    if (item.is_station_header || item.is_section_title) {
      const label = item.text?.trim();
      if (label) station = label;
      continue;
    }
    const name = item.food?.name?.trim() || item.text?.trim() || "";
    if (!name) continue;
    items.push({ name, station });
  }
  return items;
}

export async function getDiningMenu(hall: string, date: string, meal: DiningMenu["meal"]): Promise<DiningMenu> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date must be YYYY-MM-DD.");
  const resolved = resolveDiningHall(hall);
  const cached = await readCache(resolved.slug, date, meal);
  if (cached && Date.now() - Date.parse(cached.savedAt) < CACHE_MS) return cached.menu;

  const [year, month, day] = date.split("-").map(Number);
  const url = `${API}/menu/api/weeks/school/${resolved.slug}/menu-type/${meal}/${year}/${month}/${day}/`;
  try {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Nutrislice returned ${response.status} for ${resolved.name}.`);
    }
    const payload = (await response.json()) as { days?: NutrisliceDay[] };
    const match = payload.days?.find((entry) => entry.date === date);
    const items = match ? itemsFromDay(match) : [];
    if (!items.length) {
      throw new Error(`No ${meal} menu is posted for ${resolved.name} on ${date}.`);
    }
    const menu: DiningMenu = { hall: resolved.name, slug: resolved.slug, date, meal, items };
    const file = cacheFile(resolved.slug, date, meal);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify({ savedAt: new Date().toISOString(), menu }, null, 2), "utf8");
    return menu;
  } catch (err) {
    if (cached) return cached.menu;
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function formatDiningMenu(menu: DiningMenu): string {
  const meal = menu.meal[0]?.toUpperCase() + menu.meal.slice(1);
  const lines = [`${meal} at ${menu.hall} on ${menu.date}`];
  let station = "";
  for (const item of menu.items) {
    const next = item.station ?? "";
    if (next && next !== station) {
      station = next;
      lines.push(`\n${station}`);
    }
    lines.push(`- ${item.name}`);
  }
  return lines.join("\n");
}
