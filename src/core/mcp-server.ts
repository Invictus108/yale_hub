import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { resolveToolContext, runWithToolContext } from "./context";
import { loadOrCreateProfile } from "./memory/profile";
import { memoryTools } from "./memory/tools";
import { briefsModule, renderMorningBrief } from "../modules/briefs/index";
import { calendarModule } from "../modules/calendar/index";
import { canvasModule } from "../modules/canvas/index";
import { coursesModule } from "../modules/courses/index";
import { diningModule } from "../modules/dining/index";
import { textResult, type BriefSectionOutput, type FeatureModule, type Tool, type ToolContext } from "./types";

/**
 * Every feature module is registered here and nowhere else.
 * Adding a feature: new folder under src/modules, then one line in this list.
 */
export const featureModules: FeatureModule[] = [
  calendarModule,
  diningModule,
  coursesModule,
  canvasModule,
  briefsModule,
];

export async function assembleMorningBrief(ctx: ToolContext): Promise<string> {
  const sections: BriefSectionOutput[] = [];
  for (const mod of featureModules) {
    const section = mod.morningBriefSection;
    if (!section) continue;
    try {
      const body = await section.build(ctx);
      sections.push({ id: section.id, title: section.title, body });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sections.push({ id: section.id, title: section.title, body: `This section failed: ${message}` });
    }
  }
  return renderMorningBrief(sections);
}

/** Dashboard and the send button use this. Modules do not import each other to build it. */
export async function morningBriefFor(netId: string): Promise<string> {
  const profile = await loadOrCreateProfile(netId);
  return runWithToolContext({ netId, profile }, () => assembleMorningBrief({ netId, profile }));
}

const morningBriefTool: Tool = {
  name: "get_morning_brief",
  description: "Build today's morning brief by asking every feature module for its section.",
  inputSchema: z.object({}),
  handler: async (_args, ctx) => {
    if (!ctx.netId) return textResult("No signed-in student. Ask them to log in with their NetID.", true);
    return textResult(await assembleMorningBrief(ctx));
  },
};

function allTools(): Tool[] {
  return [...memoryTools, morningBriefTool, ...featureModules.flatMap((mod) => mod.tools)];
}

export function assertRegistry(): void {
  const names = new Set<string>();
  for (const tool of allTools()) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate MCP tool name: ${tool.name}`);
    }
    names.add(tool.name);
  }
}

function registerTool(server: McpServer, tool: Tool): void {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.inputSchema,
    },
    async (args) => {
      const result = await tool.handler((args ?? {}) as Record<string, unknown>, await resolveToolContext());
      const callResult: CallToolResult = {
        content: result.content.map((block) => ({ type: "text" as const, text: block.text })),
        ...(result.isError ? { isError: true } : {}),
      };
      return callResult;
    },
  );
}

/** One MCP server: memory tools plus every feature module. */
export function createHubServer(): McpServer {
  assertRegistry();
  const server = new McpServer({ name: "yalehub", version: "0.1.0" });
  for (const tool of allTools()) registerTool(server, tool);
  return server;
}

let clientPromise: Promise<Client> | null = null;

/** In-process MCP client used by the agent loop. */
export function getAgentClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = connectAgentClient().catch((err: unknown) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

async function connectAgentClient(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createHubServer();
  const client = new Client({ name: "yalehub-agent", version: "0.1.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return client;
}

function isDirectRun(): boolean {
  const entry = process.argv[1]?.replaceAll("\\", "/") ?? "";
  return entry.endsWith("/mcp-server.ts") || entry.endsWith("/mcp-server.js");
}

if (isDirectRun()) {
  const { serveStdio } = await import("@modelcontextprotocol/server/stdio");
  serveStdio(() => createHubServer());
}
