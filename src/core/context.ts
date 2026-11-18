import { AsyncLocalStorage } from "node:async_hooks";

import { loadOrCreateProfile } from "./memory/profile";
import { assertNetId } from "./memory/profile";
import type { ToolContext } from "./types";

const storage = new AsyncLocalStorage<ToolContext>();

/** Run a turn so every MCP tool handler sees this student's profile. */
export function runWithToolContext<T>(ctx: ToolContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

/**
 * Context for a tool call. The HTTP agent sets this per turn.
 * The stdio MCP process falls back to YALEHUB_NETID.
 */
export async function resolveToolContext(): Promise<ToolContext> {
  const current = storage.getStore();
  if (current) return current;

  const raw = process.env.YALEHUB_NETID?.trim();
  if (!raw) return { netId: null, profile: null };

  const netId = assertNetId(raw);
  const profile = await loadOrCreateProfile(netId);
  return { netId, profile };
}
