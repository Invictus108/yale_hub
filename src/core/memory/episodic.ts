import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Episode } from "../types.js";
import { assertNetId } from "./profile.js";

function fileFor(netId: string): string {
  return path.resolve(process.cwd(), "data", "episodes", `${netId}.jsonl`);
}

export async function appendEpisode(episode: Episode): Promise<void> {
  const netId = assertNetId(episode.netId);
  const file = fileFor(netId);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify({ ...episode, netId }) + "\n", "utf8");
}

export async function recordEpisode(
  netId: string,
  kind: Episode["kind"],
  summary: string,
  detail?: string,
): Promise<Episode> {
  const episode: Episode = {
    id: `ep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    netId: assertNetId(netId),
    at: new Date().toISOString(),
    kind,
    summary: summary.trim().slice(0, 500),
    ...(detail?.trim() ? { detail: detail.trim().slice(0, 4000) } : {}),
  };
  await appendEpisode(episode);
  return episode;
}

export async function recentEpisodes(netId: string, limit = 8): Promise<Episode[]> {
  const id = assertNetId(netId);
  let raw = "";
  try {
    raw = await readFile(fileFor(id), "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const episodes: Episode[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      episodes.push(JSON.parse(line) as Episode);
    } catch {
      // Skip a torn line rather than failing the turn.
    }
  }
  const take = Math.max(1, Math.min(limit, 50));
  return episodes.slice(-take);
}
