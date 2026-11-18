import type { Client } from "@modelcontextprotocol/client";

import { runWithToolContext } from "./context";
import { recordEpisode, recentEpisodes } from "./memory/episodic";
import { loadOrCreateProfile } from "./memory/profile";
import { retrieveYaleKnowledge } from "./memory/retrieval";
import { getAgentClient } from "./mcp-server";
import type { Episode, Profile, RetrievedChunk } from "./types";

const XAI_MODEL = "grok-4.7";
const RESPONSES_URL = "https://api.x.ai/v1/responses";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-4-hydrogen";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MAX_TOOL_ROUNDS = 5;

export interface AgentTurn {
  text: string;
  retrieved: Array<{ score: number; excerpt: string }>;
  retrievalWarning?: string;
  toolsUsed: string[];
  /** False when no model key is set and the turn returns retrieved context only. */
  model: boolean;
}

interface ResponsesBody {
  id?: string;
  output?: unknown[];
  output_text?: string;
}

interface ListedTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

/**
 * Every turn: load profile, retrieve Yale chunks, then call MCP tools and answer.
 * Retrieval always happens before the model sees the question.
 */
export async function answerQuestion(netId: string, message: string): Promise<AgentTurn> {
  const profile = await loadOrCreateProfile(netId);
  const [retrieval, episodes] = await Promise.all([
    retrieveYaleKnowledge(message, 5),
    recentEpisodes(netId, 8),
  ]);

  const retrieved = retrieval.chunks.map((chunk) => ({
    score: chunk.score,
    excerpt: chunk.text.slice(0, 400),
  }));

  const toolsUsed: string[] = [];
  let usedModel = false;
  let text: string;
  try {
    text = await runWithToolContext({ netId, profile }, async () => {
      const geminiKey = process.env.GEMINI_API_KEY?.trim();
      const xaiKey = process.env.XAI_API_KEY?.trim();
      if (!geminiKey && !xaiKey) {
        return fallbackText(message, profile, retrieval.chunks, episodes, retrieval.warning);
      }
      usedModel = true;
      const client = await getAgentClient();
      if (geminiKey) {
        return runGemini(client, message, profile, retrieval.chunks, episodes, retrieval.warning, toolsUsed);
      }
      return runModel(client, message, profile, retrieval.chunks, episodes, retrieval.warning, toolsUsed);
    });
  } catch (err) {
    usedModel = false;
    const reason = err instanceof Error ? err.message : String(err);
    text = `The model call failed after retrieval: ${reason}`;
  }

  await recordEpisode(
    netId,
    "chat",
    `User: ${message.trim().slice(0, 180)} | Hub: ${text.trim().slice(0, 240)}`,
  );

  return {
    text,
    retrieved,
    ...(retrieval.warning ? { retrievalWarning: retrieval.warning } : {}),
    toolsUsed,
    model: usedModel,
  };
}

function fallbackText(
  message: string,
  profile: Profile,
  chunks: RetrievedChunk[],
  episodes: Episode[],
  warning?: string,
): string {
  const sources = chunks.length
    ? chunks.map((chunk, index) => `(${index + 1}) score=${chunk.score.toFixed(3)}\n${chunk.text.slice(0, 700)}`).join("\n\n")
    : "No chunks returned.";
  const memory = episodes.length
    ? episodes.map((episode) => `- ${episode.at} ${episode.summary}`).join("\n")
    : "No episodes yet.";
  return [
    "Profile and Yale chunks were loaded before this reply. Set GEMINI_API_KEY to have the model answer and call tools.",
    warning ? `Retrieval warning: ${warning}` : "",
    "",
    `Student: ${profile.displayName} (${profile.netId})`,
    `College: ${profile.college ?? "unknown"} | Year: ${profile.classYear ?? "unknown"} | Major: ${profile.major ?? "unknown"}`,
    "",
    `Question: ${message}`,
    "",
    "Recent episodes:",
    memory,
    "",
    "Retrieved Yale chunks:",
    sources,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

interface GeminiStep {
  type?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  signature?: string;
}

interface GeminiInteraction {
  steps?: GeminiStep[];
  error?: { message?: string };
}

async function runGemini(
  client: Client,
  message: string,
  profile: Profile,
  chunks: RetrievedChunk[],
  episodes: Episode[],
  warning: string | undefined,
  toolsUsed: string[],
): Promise<string> {
  const listed = (await client.listTools()) as { tools?: ListedTool[] };
  const tools = (listed.tools ?? []).map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description ?? "",
    parameters: geminiSchema(tool.inputSchema),
  }));
  const history: unknown[] = [
    { type: "user_input", content: [{ type: "text", text: message }] },
  ];
  const system = instructionsFor(profile, chunks, episodes, warning);

  let interaction = await createInteraction({ system_instruction: system, input: history, tools });
  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const steps = interaction.steps ?? [];
    const calls = steps.filter((step) => step.type === "function_call" && step.name && step.id);
    const text = geminiText(steps);
    if (calls.length === 0) return text || "I don't have a reply for that yet.";
    history.push(...steps);
    for (const call of calls) {
      toolsUsed.push(call.name ?? "");
      const args = typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {});
      history.push({
        type: "function_result",
        name: call.name,
        call_id: call.id,
        result: [{ type: "text", text: await invokeTool(client, call.name ?? "", args) }],
      });
    }
    interaction = await createInteraction({ system_instruction: system, input: history, tools });
  }
  return geminiText(interaction.steps ?? []) || "I stopped after several tool calls without a final answer.";
}

function geminiText(steps: GeminiStep[]): string {
  const parts: string[] = [];
  for (const step of steps) {
    if (step.type !== "model_output" || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      if (typeof block.text === "string" && block.text.trim()) parts.push(block.text.trim());
    }
  }
  return parts.join("\n").trim();
}

async function createInteraction(body: Record<string, unknown>): Promise<GeminiInteraction> {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
    },
    body: JSON.stringify({ model: GEMINI_MODEL, store: false, ...body }),
  });
  const raw = await response.text();
  const parsed = JSON.parse(raw) as GeminiInteraction;
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${(parsed.error?.message ?? raw).slice(0, 500)}`);
  }
  return parsed;
}

/** Gemini function parameters are a subset of JSON Schema. Drop the rest. */
function geminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} };
  }
  const input = schema as Record<string, unknown>;
  const union = (Array.isArray(input.anyOf) ? input.anyOf : Array.isArray(input.oneOf) ? input.oneOf : null) as
    | unknown[]
    | null;
  if (union) {
    const chosen = union.find((option) => option && typeof option === "object" && (option as { type?: string }).type !== "null");
    return geminiSchema({ ...(chosen && typeof chosen === "object" ? chosen : { type: "string" }), description: input.description });
  }
  const out: Record<string, unknown> = {};
  const rawType = Array.isArray(input.type) ? input.type.find((item) => item !== "null") : input.type;
  if (typeof rawType === "string") out.type = rawType;
  if (typeof input.description === "string") out.description = input.description;
  if (Array.isArray(input.enum)) out.enum = input.enum.filter((item) => item != null);
  if (input.properties && typeof input.properties === "object" && !Array.isArray(input.properties)) {
    const properties: Record<string, unknown> = {};
    for (const [name, prop] of Object.entries(input.properties as Record<string, unknown>)) {
      properties[name] = geminiSchema(prop);
    }
    out.properties = properties;
  }
  if (input.items) out.items = geminiSchema(input.items);
  if (Array.isArray(input.required)) out.required = input.required;
  if (!out.type) out.type = out.properties ? "object" : "string";
  return out;
}

async function runModel(
  client: Client,
  message: string,
  profile: Profile,
  chunks: RetrievedChunk[],
  episodes: Episode[],
  warning: string | undefined,
  toolsUsed: string[],
): Promise<string> {
  const listed = (await client.listTools()) as { tools?: ListedTool[] };
  const tools = (listed.tools ?? []).map((tool) => ({
    type: "function" as const,
    name: tool.name,
    description: tool.description ?? "",
    parameters: tool.inputSchema ?? { type: "object", properties: {} },
  }));

  let response = await createResponse({
    instructions: instructionsFor(profile, chunks, episodes, warning),
    input: message,
    tools,
  });

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const calls = functionCalls(response.output ?? []);
    if (calls.length === 0) {
      return messageText(response) || "I don't have a reply for that yet.";
    }
    const outputs = [];
    for (const call of calls) {
      toolsUsed.push(call.name);
      outputs.push({
        type: "function_call_output" as const,
        call_id: call.callId,
        output: await invokeTool(client, call.name, call.arguments),
      });
    }
    response = await createResponse({
      previous_response_id: response.id,
      input: outputs,
      tools,
    });
  }

  return messageText(response) || "I stopped after several tool calls without a final answer.";
}

function instructionsFor(
  profile: Profile,
  chunks: RetrievedChunk[],
  episodes: Episode[],
  warning?: string,
): string {
  const chunkBlock = chunks.length
    ? chunks.map((chunk, index) => `(${index + 1}) score=${chunk.score.toFixed(3)}\n${chunk.text.slice(0, 1200)}`).join("\n\n")
    : "(none)";
  const episodeBlock = episodes.length
    ? episodes.map((episode) => `- ${episode.at} [${episode.kind}] ${episode.summary}`).join("\n")
    : "(none)";
  return [
    "You are YaleHub, the personal agent for one Yale student.",
    "The profile and episodes below were loaded before you answer. They are the memory of this student.",
    "Yale text chunks were retrieved before you answer. Prefer them for Yale facts. If they do not support a claim, say you do not know.",
    "Call tools for calendar changes, dining, courses, directory lookup, the morning brief, and for saving new facts.",
    "When you learn a stable fact (college, class year, major, a preference), call update_student_profile.",
    "When something is worth recalling later and is not a profile field, call remember_episode.",
    warning ? `Retrieval warning: ${warning}` : "",
    "",
    "Profile:",
    JSON.stringify(profile, null, 2),
    "",
    "Recent episodes:",
    episodeBlock,
    "",
    "Retrieved Yale chunks:",
    chunkBlock,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

async function createResponse(body: Record<string, unknown>): Promise<ResponsesBody> {
  const response = await fetch(RESPONSES_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.XAI_API_KEY}`,
    },
    body: JSON.stringify({ model: XAI_MODEL, ...body }),
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`xAI responses ${response.status}: ${raw.slice(0, 500)}`);
  }
  return JSON.parse(raw) as ResponsesBody;
}

function functionCalls(output: unknown[]): Array<{ name: string; callId: string; arguments: string }> {
  const calls = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "function_call") continue;
    const name = typeof record.name === "string" ? record.name : "";
    const callId = typeof record.call_id === "string" ? record.call_id : "";
    if (!name || !callId) continue;
    let args = "{}";
    if (typeof record.arguments === "string") args = record.arguments;
    else if (record.arguments && typeof record.arguments === "object") args = JSON.stringify(record.arguments);
    calls.push({ name, callId, arguments: args });
  }
  return calls;
}

function messageText(body: ResponsesBody): string {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  const parts: string[] = [];
  for (const item of body.output ?? []) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "message" || !Array.isArray(record.content)) continue;
    for (const block of record.content) {
      if (block && typeof block === "object" && typeof (block as { text?: unknown }).text === "string") {
        parts.push((block as { text: string }).text);
      }
    }
  }
  return parts.join("\n").trim();
}

async function invokeTool(client: Client, name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawArgs || "{}") as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      args = parsed as Record<string, unknown>;
    }
  } catch {
    args = {};
  }
  try {
    const result = (await client.callTool({ name, arguments: args })) as {
      content?: unknown;
      isError?: boolean;
    };
    const content = Array.isArray(result.content) ? result.content : [];
    const text = content
      .map((block) => {
        if (block && typeof block === "object" && (block as { type?: string }).type === "text") {
          return String((block as { text?: string }).text ?? "");
        }
        return JSON.stringify(block);
      })
      .join("\n");
    const body = result.isError ? `Error: ${text}` : text;
    return body.slice(0, 8000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `Error: ${message}`.slice(0, 8000);
  }
}
