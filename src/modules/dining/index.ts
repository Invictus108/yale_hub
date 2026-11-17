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
    build: async () => "TODO(aiden): today's dining halls and meals.",
  },
};
