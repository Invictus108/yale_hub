import * as z from "zod/v4";

import { textResult, type Tool } from "../../core/types";

/** Aiden owns this file. Courses and Yalies both live here. */
export const courseTools: Tool[] = [
  {
    name: "search_courses",
    description: "Search Yale courses by keyword, subject, or instructor.",
    inputSchema: z.object({
      query: z.string().describe("Subject, title, instructor, or requirement"),
    }),
    handler: async () => textResult("TODO(aiden): search the course catalog."),
  },
  {
    name: "lookup_yalies",
    description: "Look up a Yale student or directory entry via Yalies.",
    inputSchema: z.object({
      query: z.string().describe("Name, NetID, college, or year"),
    }),
    handler: async () => textResult("TODO(aiden): query Yalies."),
  },
];
