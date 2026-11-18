import type { FeatureModule } from "../../core/types.js";

import { currentSeasonCode, formatMeetings, newYorkWeekdayBit, seasonLabel } from "./catalog.js";
import { courseTools } from "./tools.js";
import { listSavedCourses, todaySections } from "./worksheet.js";

/** Aiden owns this module (courses and Yalies). */
export const coursesModule: FeatureModule = {
  id: "courses",
  name: "Courses",
  owner: "aiden",
  tools: courseTools,
  morningBriefSection: {
    id: "courses",
    title: "Courses",
    build: async (ctx) => {
      if (!ctx.netId) return "Sign in to see today's classes.";
      const season = currentSeasonCode();
      const saved = await listSavedCourses(ctx.netId);
      const today = todaySections(saved, season);
      if (!saved.length) {
        return `No saved courses for ${seasonLabel(season)}. Search the catalog and save a section.`;
      }
      const lines = today.map((section) => {
        const now = section.meetings.filter((meeting) => (meeting.days & newYorkWeekdayBit()) !== 0);
        const when = formatMeetings(now);
        const finalExam = section.finalExam ? `\n  Final: ${section.finalExam}` : "";
        return `${section.courseCode} section ${section.section} — ${section.title}\n  ${when}${finalExam}`;
      });
      if (!lines.length) return `No ${seasonLabel(season)} classes today. ${saved.length} section(s) are saved.`;
      return lines.join("\n");
    },
  },
};
