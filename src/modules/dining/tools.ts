import * as z from "zod/v4";

import { textResult, type Tool } from "../../core/types";

/** Aiden owns this file. Call integrations/nutrislice.ts from the handler. */
export const diningTools: Tool[] = [
  {
    name: "get_dining_menu",
    description: "Get a Yale dining-hall menu for a day from Nutrislice.",
    inputSchema: z.object({
      hall: z.string().optional().describe("Dining hall name. Default from the student profile when you have one."),
      date: z.string().optional().describe("YYYY-MM-DD. Default today in America/New_York."),
      meal: z.enum(["breakfast", "lunch", "dinner"]).optional(),
    }),
    handler: async () => textResult("TODO(aiden): fetch the Nutrislice menu."),
  },
];
