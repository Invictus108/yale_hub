import type { BriefSectionOutput, FeatureModule } from "../../core/types.js";

import { briefTools } from "./tools.js";

/**
 * Aiden owns the brief layout. Core passes in every module's section.
 * This file must not import calendar, dining, or courses.
 */
export function renderMorningBrief(sections: BriefSectionOutput[]): string {
  const today = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());
  const body = sections.map((section) => `## ${section.title}\n\n${section.body}`).join("\n\n");
  return `# YaleHub morning brief\n${today}\n\n${body}\n`;
}

/** Aiden owns this module. */
export const briefsModule: FeatureModule = {
  id: "briefs",
  name: "Briefs",
  owner: "aiden",
  tools: briefTools,
  morningBriefSection: {
    id: "briefs",
    title: "Inbox",
    build: async () => "TODO(aiden): overnight mail and digest items.",
  },
};
