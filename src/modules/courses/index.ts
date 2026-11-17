import type { FeatureModule } from "../../core/types.js";

import { courseTools } from "./tools.js";

/** Aiden owns this module (courses and Yalies). */
export const coursesModule: FeatureModule = {
  id: "courses",
  name: "Courses",
  owner: "aiden",
  tools: courseTools,
  morningBriefSection: {
    id: "courses",
    title: "Courses",
    build: async () => "TODO(aiden): today's classes and deadlines.",
  },
};
