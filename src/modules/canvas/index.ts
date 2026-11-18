import { formatCanvasTodo, listCanvasTodo } from "../../integrations/canvas";
import type { FeatureModule } from "../../core/types";

import { canvasTools } from "./tools";

/**
 * Canvas reads only. Not in featureModules.
 * The other owner registers it with one import and one array entry in src/core/mcp-server.ts.
 */
export const canvasModule: FeatureModule = {
  id: "canvas",
  name: "Canvas",
  owner: "unassigned",
  tools: canvasTools,
  morningBriefSection: {
    id: "canvas",
    title: "Canvas",
    build: async () => {
      try {
        const items = await listCanvasTodo();
        if (!items.length) return "Nothing on the Canvas to-do list.";
        return formatCanvasTodo(items.slice(0, 8));
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    },
  },
};
