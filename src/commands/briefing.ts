/**
 * Briefing Command Handler
 *
 * Triggers the briefing-assistant skill in AgentCore to create
 * a validated BRIEF.md before mission creation.
 *
 * Flow:
 * 1. User types `/briefing Create coda.io provider`
 * 2. Command calls AgentCore briefing-assistant skill
 * 3. Skill conducts research (Context7, OCXP, Brain)
 * 4. Skill asks clarifying questions (if needed)
 * 5. Generates BRIEF.md with:
 *    - Pre-research findings
 *    - Strategic decisions
 *    - Confidence score (target: 85%+)
 *    - Zero/minimal open questions
 * 6. BRIEF.md can be used to create mission with briefing_context
 */

import { Notice } from "obsidian";
import CopilotPlugin from "@/main";

export interface BriefingRequest {
  user_request: string;
  output_type: string;
  project_id?: string;
}

export interface BriefingResponse {
  brief_id: string;
  brief_created: boolean;
  confidence: number;
  mission_ready: boolean;
  content: string; // BRIEF.md content
}

/**
 * Execute briefing command
 *
 * @param plugin - Copilot plugin instance
 * @param userRequest - User's mission request (e.g., "Create coda.io provider")
 * @returns Promise<BriefingResponse>
 */
export async function executeBriefingCommand(
  plugin: CopilotPlugin,
  userRequest: string
): Promise<BriefingResponse | null> {
  try {
    new Notice("Starting briefing session...", 3000);

    // Get ContextHub API settings
    const contexthubUrl = plugin.settings.contextHubApiUrl || "http://localhost:8000";
    const workspace = plugin.settings.contextHubWorkspace || "dev";
    const authToken = plugin.settings.contextHubAuthToken;

    if (!authToken) {
      new Notice("ContextHub auth token not configured. Check settings.", 5000);
      return null;
    }

    // Get current project context (if in project view)
    const projectId = await getCurrentProjectId(plugin);

    // Call AgentCore briefing-assistant skill
    const briefingRequest: BriefingRequest = {
      user_request: userRequest,
      output_type: "implementation-plan",
      project_id: projectId,
    };

    new Notice("Researching: API docs, codebase, prior missions...", 5000);

    const response = await fetch(`${contexthubUrl}/v1/agent/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
        "X-Workspace": workspace,
      },
      body: JSON.stringify({
        action: "run_skill",
        skill_name: "briefing-assistant",
        inputs: briefingRequest,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      new Notice(`Briefing failed: ${response.status} - ${errorText}`, 5000);
      return null;
    }

    // Parse streaming response (if SSE) or JSON
    const contentType = response.headers.get("content-type");
    let briefingResult: BriefingResponse;

    if (contentType?.includes("text/event-stream")) {
      // Handle SSE stream
      briefingResult = await parseBriefingStream(response);
    } else {
      // Handle JSON response
      briefingResult = await response.json();
    }

    // Show results
    const confidencePct = (briefingResult.confidence * 100).toFixed(0);
    new Notice(
      `Briefing complete! Confidence: ${confidencePct}% - ${
        briefingResult.mission_ready ? "Ready to create mission" : "Review needed"
      }`,
      10000
    );

    // Save BRIEF.md to vault
    await saveBriefToVault(plugin, briefingResult);

    return briefingResult;
  } catch (error) {
    console.error("[Briefing] Error:", error);
    new Notice(`Briefing error: ${error instanceof Error ? error.message : "Unknown error"}`, 5000);
    return null;
  }
}

/**
 * Get current project ID from context
 */
async function getCurrentProjectId(plugin: CopilotPlugin): Promise<string | undefined> {
  // Check if we're in a project-scoped note
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) return undefined;

  // Check frontmatter for project_id
  const cache = plugin.app.metadataCache.getFileCache(activeFile);
  const projectId = cache?.frontmatter?.project_id;

  return projectId;
}

/**
 * Parse SSE stream response from AgentCore
 */
async function parseBriefingStream(response: Response): Promise<BriefingResponse> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let result: Partial<BriefingResponse> = {};

  try {
    let processing = true;
    while (processing) {
      const { done, value } = await reader.read();
      if (done) {
        processing = false;
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            // Handle different event types
            if (event.type === "RESEARCH_UPDATE") {
              new Notice(`Research: ${event.message}`, 2000);
            } else if (event.type === "QUESTION") {
              // TODO: Show modal for user to answer question
              new Notice(`Question: ${event.question}`, 5000);
            } else if (event.type === "BRIEF_COMPLETE") {
              result = event.data;
            }
          } catch {
            console.warn("[Briefing] Failed to parse SSE event:", line);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!result.brief_id) {
    throw new Error("Incomplete briefing response");
  }

  return result as BriefingResponse;
}

/**
 * Save BRIEF.md to vault
 */
async function saveBriefToVault(plugin: CopilotPlugin, briefing: BriefingResponse): Promise<void> {
  try {
    // Create briefings folder if needed
    const briefingsPath = "Briefings";
    const folderExists = plugin.app.vault.getAbstractFileByPath(briefingsPath);
    if (!folderExists) {
      await plugin.app.vault.createFolder(briefingsPath);
    }

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 16).replace(/:/g, "-");
    const filename = `${briefingsPath}/BRIEF-${timestamp}.md`;

    // Save BRIEF.md
    await plugin.app.vault.create(filename, briefing.content);

    new Notice(`Briefing saved: ${filename}`, 5000);

    // Open the brief
    const file = plugin.app.vault.getAbstractFileByPath(filename);
    if (file) {
      await plugin.app.workspace.getLeaf().openFile(file as any);
    }
  } catch (error) {
    console.error("[Briefing] Failed to save:", error);
    new Notice("Failed to save briefing to vault", 5000);
  }
}

/**
 * Show briefing result modal with option to create mission
 */
export function showBriefingResultModal(plugin: CopilotPlugin, briefing: BriefingResponse): void {
  // TODO: Create modal with:
  // - Confidence score display
  // - Research findings summary
  // - Strategic decisions table
  // - Open questions (if any)
  // - Button: "Create Mission with This Brief"
  // - Button: "Edit Brief"
  // - Button: "Cancel"
}
