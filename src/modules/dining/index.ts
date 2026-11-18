import { getDiningMenu, mealForNow, newYorkToday, preferredHall } from "../../integrations/nutrislice.js";
import type { FeatureModule } from "../../core/types.js";

import { diningTools } from "./tools.js";

/** Aiden owns this module. */
export const diningModule: FeatureModule = {
  id: "dining",
  name: "Dining",
  owner: "aiden",
  tools: diningTools,
  morningBriefSection: {
    id: "dining",
    title: "Dining",
    build: async (ctx) => {
      const hall = preferredHall(ctx.profile?.college, ctx.profile?.preferences.dining.hall);
      if (!hall) return "Set a residential college on the profile to pin today's dining hall.";
      const date = newYorkToday();
      const meals = ["breakfast", "lunch", "dinner"] as const;
      const blocks: string[] = [];
      for (const meal of meals) {
        try {
          const menu = await getDiningMenu(hall.name, date, meal);
          const highlights = menu.items.slice(0, 6).map((item) => item.name);
          const extra = menu.items.length > highlights.length ? ` (+${menu.items.length - highlights.length} more)` : "";
          blocks.push(`${meal[0]?.toUpperCase()}${meal.slice(1)}: ${highlights.join(", ")}${extra}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          blocks.push(`${meal}: ${message}`);
        }
      }
      return `${hall.name} · ${date} · current meal is ${mealForNow()}\n${blocks.join("\n")}`;
    },
  },
};
