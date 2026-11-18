import { dayRange, formatEventLine, listEvents, newYorkToday } from "../../integrations/gcal";
import type { FeatureModule } from "../../core/types";

import { calendarTools } from "./tools";

/** Jack owns this module. */
export const calendarModule: FeatureModule = {
  id: "calendar",
  name: "Calendar",
  owner: "jack",
  tools: calendarTools,
  morningBriefSection: {
    id: "calendar",
    title: "Calendar",
    build: async (ctx) => {
      if (!ctx.netId) return "Sign in to see today's events.";
      try {
        const events = await listEvents(ctx.netId, dayRange(newYorkToday()));
        const name = ctx.profile?.displayName ?? ctx.netId;
        if (!events.length) return `Nothing on ${name}'s calendar today.`;
        return events.map(formatEventLine).join("\n");
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
  },
};
