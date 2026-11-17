import type { ZodType } from "zod/v4";

/** Residential-college and academic facts the hub keeps about one student. */
export interface Profile {
  netId: string;
  displayName: string;
  email: string | null;
  /** Residential college, e.g. "Jonathan Edwards". */
  college: string | null;
  /** Graduation year, e.g. 2027. */
  classYear: number | null;
  major: string | null;
  pronouns: string | null;
  timezone: string;
  /**
   * Module-readable preferences. The memory owner is the only writer.
   * dining / calendar / courses / briefs are the namespaces for those modules.
   */
  preferences: ProfilePreferences;
  notes: string[];
  updatedAt: string;
}

export interface ProfilePreferences {
  dining: Record<string, unknown>;
  calendar: Record<string, unknown>;
  courses: Record<string, unknown>;
  briefs: Record<string, unknown>;
}

export type PreferenceNamespace = keyof ProfilePreferences;

export interface Episode {
  id: string;
  netId: string;
  at: string;
  kind: "chat" | "note";
  summary: string;
  detail?: string;
}

export interface RetrievedChunk {
  text: string;
  score: number;
}

/**
 * What a module handler is allowed to see.
 * Read `profile`. Do not import `core/memory`. Profile writes go through
 * the `update_student_profile` tool, which the agent calls.
 */
export interface ToolContext {
  netId: string | null;
  profile: Profile | null;
}

export interface ToolContentText {
  type: "text";
  text: string;
}

export interface ToolResult {
  content: ToolContentText[];
  isError?: boolean;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: ZodType;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
}

export interface MorningBriefSection {
  id: string;
  title: string;
  build: (ctx: ToolContext) => Promise<string>;
}

/**
 * One feature folder. Modules never import each other.
 * They export this object; `mcp-server.ts` is the only place that registers it.
 */
export interface FeatureModule {
  id: string;
  name: string;
  /** Folder owner, for example "jack" or "aiden". A string so a new module does not require a types edit. */
  owner: string;
  tools: Tool[];
  morningBriefSection?: MorningBriefSection;
}

export interface BriefSectionOutput {
  id: string;
  title: string;
  body: string;
}

export function textResult(text: string, isError = false): ToolResult {
  return isError
    ? { content: [{ type: "text", text }], isError: true }
    : { content: [{ type: "text", text }] };
}
