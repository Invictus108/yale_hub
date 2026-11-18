import * as z from "zod/v4";

import { formatYalies, lookupYalies } from "../../integrations/yalies.js";
import { textResult, type Tool } from "../../core/types.js";
import { currentSeasonCode, formatSection, searchCourses } from "./catalog.js";
import { listSavedCourses, removeCourse, saveCourse } from "./worksheet.js";

function failure(err: unknown): ReturnType<typeof textResult> {
  return textResult(err instanceof Error ? err.message : String(err), true);
}

/** Aiden owns this file. Courses and Yalies both live here. */
export const courseTools: Tool[] = [
  {
    name: "search_courses",
    description:
      "Search Yale courses by keyword, subject, course code, or instructor for the current term. Add a season like 'spring 2026' or a code like 202601 to search another term.",
    inputSchema: z.object({
      query: z.string().describe("Subject, title, instructor, or requirement"),
    }),
    handler: async (args) => {
      try {
        const query = typeof args.query === "string" ? args.query : "";
        const { seasonCode, sections } = await searchCourses(query);
        if (!sections.length) return textResult(`No courses matched "${query.trim()}" in ${seasonCode}.`);
        return textResult(sections.map(formatSection).join("\n\n"));
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "save_course",
    description: "Save a course section onto the signed-in student's worksheet by CRN, so it can show up in the morning brief.",
    inputSchema: z.object({
      crn: z.number().int().describe("Course registration number from search_courses"),
      seasonCode: z.string().optional().describe("Term code such as 202603. Defaults to the current term."),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const season = typeof args.seasonCode === "string" && args.seasonCode.trim() ? args.seasonCode.trim() : currentSeasonCode();
        const saved = await saveCourse(ctx.netId, Number(args.crn), season);
        return textResult(`Saved ${saved.courseCode} section ${saved.section} (CRN ${saved.crn}) for ${saved.seasonLabel}.`);
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "remove_course",
    description: "Remove a saved course section from the signed-in student's worksheet.",
    inputSchema: z.object({
      crn: z.number().int(),
      seasonCode: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const season = typeof args.seasonCode === "string" && args.seasonCode.trim() ? args.seasonCode.trim() : undefined;
        const removed = await removeCourse(ctx.netId, Number(args.crn), season);
        return textResult(removed ? `Removed CRN ${args.crn}.` : `CRN ${args.crn} was not on the worksheet.`);
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "list_saved_courses",
    description: "List course sections the signed-in student has saved.",
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      try {
        const sections = await listSavedCourses(ctx.netId);
        if (!sections.length) return textResult("No saved courses. Search the catalog and save a CRN.");
        return textResult(
          sections
            .map((section) => `${section.courseCode} section ${section.section} (CRN ${section.crn}) — ${section.title} [${section.seasonLabel}]`)
            .join("\n"),
        );
      } catch (err) {
        return failure(err);
      }
    },
  },
  {
    name: "lookup_yalies",
    description: "Look up a Yale student or directory entry via Yalies.",
    inputSchema: z.object({
      query: z.string().describe("Name, NetID, college, or year"),
    }),
    handler: async (args) => {
      try {
        const people = await lookupYalies(typeof args.query === "string" ? args.query : "");
        return textResult(formatYalies(people));
      } catch (err) {
        return failure(err);
      }
    },
  },
];
