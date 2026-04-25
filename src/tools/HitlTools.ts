import { z } from "zod";
import { createLangChainTool } from "./createLangChainTool";
import { getContextHubPluginAPI } from "@/LLMProviders/contexthub/helpers";

const resolveHitlMemoSchema = z.object({
  memo_id: z.string().describe("The memo ID to resolve"),
  action: z.enum(["approve", "reject"]).describe("Whether to approve or reject"),
  feedback: z.string().optional().describe("Optional feedback explaining the decision"),
});

export const resolveHitlMemoTool = createLangChainTool({
  name: "resolveHitlMemo",
  description:
    "Resolve a human-in-the-loop review memo by approving or rejecting it. " +
    "Use this when the user has decided to approve or reject a plan after reviewing the quality scorecard.",
  schema: resolveHitlMemoSchema,
  func: async ({ memo_id, action, feedback }) => {
    const ch = getContextHubPluginAPI();
    if (!ch) {
      return JSON.stringify({ error: "ContextHub not available" });
    }

    try {
      const client = (ch as any).contextHubService?.getClient();
      if (!client) {
        return JSON.stringify({ error: "ContextHub client not available" });
      }

      const result = await client.resolveMemoFromChat(memo_id, action, feedback);
      return JSON.stringify({
        success: true,
        action,
        message:
          action === "approve"
            ? "Plan approved. The pipeline will continue with the storage phase."
            : "Plan rejected. Feedback has been stored for the next regeneration.",
        ...result,
      });
    } catch (err) {
      return JSON.stringify({
        error: `Failed to ${action} memo: ${err instanceof Error ? err.message : "unknown error"}`,
      });
    }
  },
});
