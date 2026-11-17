import * as z from "zod/v4";

import { textResult, type Tool } from "../../core/types.js";
import { runCalendarAutoUpdate } from "./auto-update.js";

/**
 * Jack owns this file. Replace each handler with a call into integrations/gcal.ts.
 * Schemas are a starting point for natural-language calendar changes.
 */
export const calendarTools: Tool[] = [
  {
    name: "list_calendar_events",
    description: "List the signed-in student's Google Calendar events in a time window.",
    inputSchema: z.object({
      timeMin: z.string().optional().describe("ISO-8601 start, inclusive"),
      timeMax: z.string().optional().describe("ISO-8601 end, exclusive"),
    }),
    handler: async () => textResult("TODO(jack): list Google Calendar events."),
  },
  {
    name: "create_calendar_event",
    description: "Create a Google Calendar event for the signed-in student.",
    inputSchema: z.object({
      title: z.string(),
      start: z.string().describe("ISO-8601 start"),
      end: z.string().describe("ISO-8601 end"),
      location: z.string().optional(),
    }),
    handler: async () => textResult("TODO(jack): create a Google Calendar event."),
  },
  {
    name: "update_calendar_event",
    description: "Change an existing Google Calendar event.",
    inputSchema: z.object({
      eventId: z.string(),
      title: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      location: z.string().optional(),
    }),
    handler: async () => textResult("TODO(jack): update a Google Calendar event."),
  },
  {
    name: "delete_calendar_event",
    description: "Delete a Google Calendar event.",
    inputSchema: z.object({
      eventId: z.string(),
    }),
    handler: async () => textResult("TODO(jack): delete a Google Calendar event."),
  },
  {
    name: "move_calendar_event",
    description: "Move a Google Calendar event to a new start and end.",
    inputSchema: z.object({
      eventId: z.string(),
      start: z.string().describe("ISO-8601 start"),
      end: z.string().describe("ISO-8601 end"),
    }),
    handler: async () => textResult("TODO(jack): move a Google Calendar event."),
  },
  {
    name: "run_calendar_auto_update",
    description: "Run the automatic Google Calendar sync for the signed-in student. Safe to call on a schedule.",
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      const status = await runCalendarAutoUpdate(ctx.netId);
      return textResult(JSON.stringify(status));
    },
  },
];
