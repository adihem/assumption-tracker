import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function assumptionTracker(pi: ExtensionAPI) {
  pi.registerCommand("tracker-hello", {
    description: "Check that the Assumption Tracker extension is loaded",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;
      ctx.ui.notify("Assumption Tracker loaded.", "info");
    },
  });
}
