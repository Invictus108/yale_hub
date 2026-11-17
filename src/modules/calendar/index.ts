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
      const name = ctx.profile?.displayName ?? "student";
      return `TODO(jack): today's events for ${name}.`;
    },
  },
};
