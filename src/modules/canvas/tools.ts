import * as z from "zod/v4";

import {
  findCanvasCourses,
  formatCanvasAnnouncements,
  formatCanvasAssignments,
  formatCanvasCourses,
  formatCanvasTodo,
  listCanvasAnnouncements,
  listCanvasAssignments,
  listCanvasCourses,
  listCanvasTodo,
} from "../../integrations/canvas";
import { textResult, type Tool } from "../../core/types";

function failure(err: unknown): ReturnType<typeof textResult> {
  return textResult(err instanceof Error ? err.message : String(err), true);
}

/** Reads Canvas only. Registration in mcp-server.ts is left to the other owner. */
export const canvasTools: Tool[] = [
  {
    name: "list_canvas_courses",
    description: "List the student's active Yale Canvas courses, including course code, term, and current score when Canvas provides one.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        return textResult(formatCanvasCourses(await listCanvasCourses()));
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "list_canvas_assignments",
    description: "List upcoming Yale Canvas assignments. Pass a course id, course code, or part of a course name to limit the list.",
    inputSchema: z.object({
      course: z.string().optional().describe("Course id, code, or name. Omit for every active course."),
    }),
    handler: async (args) => {
      try {
        const courses = await listCanvasCourses();
        const query = typeof args.course === "string" ? args.course : "";
        const chosen = findCanvasCourses(courses, query);
        if (!chosen.length) {
          return textResult(`No active Canvas course matched "${query.trim()}".\n${formatCanvasCourses(courses)}`, true);
        }
        const groups = await Promise.all(chosen.map((course) => listCanvasAssignments(course)));
        return textResult(formatCanvasAssignments(groups.flat()));
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "list_canvas_todo",
    description: "List the student's Canvas to-do items, including unfinished assignments and quizzes.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        return textResult(formatCanvasTodo(await listCanvasTodo()));
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "list_canvas_announcements",
    description: "List the latest announcement from each active Yale Canvas course.",
    inputSchema: z.object({}),
    handler: async () => {
      try {
        const courses = await listCanvasCourses();
        return textResult(formatCanvasAnnouncements(await listCanvasAnnouncements(courses)));
      } catch (err) {
        return failure(err);
      }
    },
  },
];
