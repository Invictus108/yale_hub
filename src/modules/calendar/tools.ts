import * as z from "zod/v4";

import {
  createEvent,
  dayRange,
  deleteEvent,
  formatEventLine,
  listEvents,
  newYorkToday,
  updateEvent,
} from "../../integrations/gcal";
import { textResult, type Tool } from "../../core/types";
import { runCalendarAutoUpdate } from "./auto-update";

function failure(err: unknown): ReturnType<typeof textResult> {
  return textResult(err instanceof Error ? err.message : String(err), true);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Jack owns this file. Handlers call integrations/gcal.ts.
 */
export const calendarTools: Tool[] = [
  {
    name: "list_calendar_events",
    description: "List the signed-in student's calendar events in a time window. Uses Google Calendar when connected, otherwise the local calendar.",
    inputSchema: z.object({
      timeMin: z.string().optional().describe("ISO-8601 start, inclusive"),
      timeMax: z.string().optional().describe("ISO-8601 end, exclusive"),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const events = await listEvents(ctx.netId, {
          timeMin: optionalString(args.timeMin),
          timeMax: optionalString(args.timeMax),
        });
        if (!events.length) return textResult("No events in that window.");
        return textResult(events.map(formatEventLine).join("\n"));
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "create_calendar_event",
    description: "Create a calendar event for the signed-in student. Times without a zone are America/New_York.",
    inputSchema: z.object({
      title: z.string(),
      start: z.string().describe("ISO-8601 start"),
      end: z.string().describe("ISO-8601 end"),
      location: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const event = await createEvent(ctx.netId, {
          title: String(args.title ?? ""),
          start: String(args.start ?? ""),
          end: String(args.end ?? ""),
          location: optionalString(args.location),
        });
        return textResult(`Created ${formatEventLine(event)}`);
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "update_calendar_event",
    description: "Change an existing calendar event.",
    inputSchema: z.object({
      eventId: z.string(),
      title: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      location: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const event = await updateEvent(ctx.netId, String(args.eventId ?? ""), {
          title: optionalString(args.title),
          start: optionalString(args.start),
          end: optionalString(args.end),
          location: typeof args.location === "string" ? args.location : undefined,
        });
        return textResult(`Updated ${formatEventLine(event)}`);
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "delete_calendar_event",
    description: "Delete a calendar event.",
    inputSchema: z.object({
      eventId: z.string(),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const eventId = String(args.eventId ?? "");
        await deleteEvent(ctx.netId, eventId);
        return textResult(`Deleted event ${eventId}.`);
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "move_calendar_event",
    description: "Move a calendar event to a new start and end.",
    inputSchema: z.object({
      eventId: z.string(),
      start: z.string().describe("ISO-8601 start"),
      end: z.string().describe("ISO-8601 end"),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const event = await updateEvent(ctx.netId, String(args.eventId ?? ""), {
          start: String(args.start ?? ""),
          end: String(args.end ?? ""),
        });
        return textResult(`Moved ${formatEventLine(event)}`);
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "run_calendar_auto_update",
    description: "Run the automatic calendar sync for the signed-in student. Pulls Google Calendar when connected.",
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      const status = await runCalendarAutoUpdate(ctx.netId);
      const today = await listEvents(ctx.netId, dayRange(newYorkToday())).catch(() => []);
      const lines = today.length ? `\nToday:\n${today.map(formatEventLine).join("\n")}` : "";
      return textResult(`${status.status}: ${status.detail}${lines}`);
    },
  },
];
