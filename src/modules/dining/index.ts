import type { FeatureModule } from "../../core/types";

import { diningTools } from "./tools";

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
