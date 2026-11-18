import * as z from "zod/v4";

import {
  formatDiningMenu,
  getDiningMenu,
  mealForNow,
  newYorkToday,
  preferredHall,
} from "../../integrations/nutrislice.js";
import { textResult, type Tool } from "../../core/types.js";

/** Aiden owns this file. The handler calls integrations/nutrislice.ts. */
export const diningTools: Tool[] = [
  {
    name: "get_dining_menu",
    description:
      "Get a Yale dining-hall menu for a day from Nutrislice. Halls include Berkeley, Branford, Davenport, Ezra Stiles, Grace Hopper, Jonathan Edwards, Morse, Pauli Murray, Pierson, Saybrook, Silliman, Timothy Dwight, Trumbull, and Benjamin Franklin. Defaults to the student's college.",
    inputSchema: z.object({
      hall: z.string().optional().describe("Dining hall name. Default from the student profile when you have one."),
      date: z.string().optional().describe("YYYY-MM-DD. Default today in America/New_York."),
      meal: z.enum(["breakfast", "lunch", "dinner"]).optional(),
    }),
    handler: async (args, ctx) => {
      const requested = typeof args.hall === "string" ? args.hall : "";
      const hall = requested.trim()
        ? requested
        : preferredHall(ctx.profile?.college, ctx.profile?.preferences.dining.hall)?.name;
      if (!hall) {
        return textResult("Name a dining hall, or set a residential college on the profile.", true);
      }
      const date = typeof args.date === "string" && args.date.trim() ? args.date.trim() : newYorkToday();
      const meal = args.meal === "breakfast" || args.meal === "lunch" || args.meal === "dinner" ? args.meal : mealForNow();
      try {
        const menu = await getDiningMenu(hall, date, meal);
        return textResult(formatDiningMenu(menu));
      } catch (err) {
        return textResult(err instanceof Error ? err.message : String(err), true);
      }
    },
  },
];
