import * as z from "zod/v4";

import type { PreferenceNamespace, Tool } from "../types";
import { textResult } from "../types";
import { recentEpisodes, recordEpisode } from "./episodic";
import { patchProfile } from "./profile";
import { retrieveYaleKnowledge } from "./retrieval";

const preferenceNamespaces = ["dining", "calendar", "courses", "briefs"] as const;

export const memoryTools: Tool[] = [
  {
    name: "search_yale_knowledge",
    description:
      "Search the Yale text-chunk vector database (academic pages, already embedded). Use this for Yale facts, policies, departments, and programs. The agent also runs this before every answer.",
    inputSchema: z.object({
      query: z.string().describe("Natural-language lookup against the Yale chunk index"),
      k: z.number().int().min(1).max(10).optional().describe("How many chunks to return. Default 5."),
    }),
    handler: async (args) => {
      const query = typeof args.query === "string" ? args.query : "";
      const k = typeof args.k === "number" ? args.k : 5;
      const result = await retrieveYaleKnowledge(query, k);
      if (result.warning) {
        return textResult(`Yale knowledge search failed: ${result.warning}`, true);
      }
      if (result.chunks.length === 0) {
        return textResult("No Yale chunks matched that query.");
      }
      const body = result.chunks
        .map((chunk, index) => `(${index + 1}) score=${chunk.score.toFixed(3)}\n${chunk.text}`)
        .join("\n\n");
      return textResult(body);
    },
  },
  {
    name: "get_student_profile",
    description: "Read the signed-in student's structured profile.",
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      if (!ctx.profile) return textResult("No signed-in student. Ask them to log in with their NetID.", true);
      return textResult(JSON.stringify(ctx.profile, null, 2));
    },
  },
  {
    name: "update_student_profile",
    description:
      "Update the signed-in student's profile. Use this when you learn a stable fact (name, college, class year, major) or a module preference. Modules must not write the profile themselves.",
    inputSchema: z.object({
      displayName: z.string().optional(),
      college: z.string().nullable().optional().describe("Residential college"),
      classYear: z.number().int().nullable().optional().describe("Graduation year"),
      major: z.string().nullable().optional(),
      pronouns: z.string().nullable().optional(),
      note: z.string().optional().describe("Short note to append to the profile"),
      preferenceNamespace: z.enum(preferenceNamespaces).optional(),
      preferenceJson: z
        .string()
        .optional()
        .describe("JSON object merged into preferenceNamespace"),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId || !ctx.profile) {
        return textResult("No signed-in student. Ask them to log in with their NetID.", true);
      }
      let preferences: Partial<Record<PreferenceNamespace, Record<string, unknown>>> | undefined;
      if (typeof args.preferenceJson === "string" && args.preferenceJson.trim()) {
        const namespace = args.preferenceNamespace;
        if (namespace !== "dining" && namespace !== "calendar" && namespace !== "courses" && namespace !== "briefs") {
          return textResult("preferenceJson requires preferenceNamespace.", true);
        }
        let parsed: unknown;
        try {
          parsed = JSON.parse(args.preferenceJson);
        } catch {
          return textResult("preferenceJson must be a JSON object.", true);
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return textResult("preferenceJson must be a JSON object.", true);
        }
        preferences = { [namespace]: parsed as Record<string, unknown> };
      }
      const updated = await patchProfile(ctx.netId, {
        displayName: typeof args.displayName === "string" ? args.displayName : undefined,
        college: args.college === undefined ? undefined : (args.college as string | null),
        classYear: args.classYear === undefined ? undefined : (args.classYear as number | null),
        major: args.major === undefined ? undefined : (args.major as string | null),
        pronouns: args.pronouns === undefined ? undefined : (args.pronouns as string | null),
        note: typeof args.note === "string" ? args.note : undefined,
        preferences,
      });
      Object.assign(ctx.profile, updated);
      return textResult(JSON.stringify(updated, null, 2));
    },
  },
  {
    name: "remember_episode",
    description: "Append an episodic memory for the signed-in student. Use this for events worth recalling later that are not profile fields.",
    inputSchema: z.object({
      summary: z.string().describe("One or two sentences"),
      detail: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student. Ask them to log in with their NetID.", true);
      const summary = typeof args.summary === "string" ? args.summary : "";
      if (!summary.trim()) return textResult("summary is required.", true);
      const episode = await recordEpisode(
        ctx.netId,
        "note",
        summary,
        typeof args.detail === "string" ? args.detail : undefined,
      );
      return textResult(JSON.stringify(episode));
    },
  },
  {
    name: "recall_episodes",
    description: "Read the signed-in student's recent episodic memories.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(50).optional(),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student. Ask them to log in with their NetID.", true);
      const limit = typeof args.limit === "number" ? args.limit : 8;
      const episodes = await recentEpisodes(ctx.netId, limit);
      return textResult(episodes.length ? JSON.stringify(episodes, null, 2) : "No episodes yet.");
    },
  },
];
