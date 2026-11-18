import * as z from "zod/v4";

import { textResult, type Tool } from "../../core/types.js";
import { describeBriefDelivery, sendMorningEmail } from "./email.js";

/** Aiden owns this file. Email and other brief sources are collected here. */
export const briefTools: Tool[] = [
  {
    name: "list_brief_sources",
    description: "List how the morning brief is delivered and when it was last sent for the signed-in student.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(20).optional(),
    }),
    handler: async (_args, ctx) => {
      if (!ctx.netId) return textResult("No signed-in student.", true);
      return textResult(await describeBriefDelivery(ctx.netId, ctx.profile?.email ?? null));
    },
  },
  {
    name: "send_morning_brief",
    description: "Email a morning brief. Pass markdown from get_morning_brief. Uses the local outbox until SMTP is configured.",
    inputSchema: z.object({
      markdown: z.string(),
      to: z.string().optional().describe("Defaults to the student email on the profile"),
    }),
    handler: async (args, ctx) => {
      const to = typeof args.to === "string" && args.to.trim() ? args.to.trim() : ctx.profile?.email;
      if (!to) return textResult("No recipient email.", true);
      const markdown = typeof args.markdown === "string" ? args.markdown : "";
      try {
        const result = await sendMorningEmail({
          to,
          subject: "YaleHub morning brief",
          text: markdown,
          netId: ctx.netId ?? undefined,
        });
        return textResult(JSON.stringify(result));
      } catch (err) {
        return textResult(err instanceof Error ? err.message : String(err), true);
      }
    },
  },
];
