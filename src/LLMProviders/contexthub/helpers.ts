import { ChatModelProviders } from "@/constants";
import { getMissionContext } from "./missionContextAtom";

// ---------------------------------------------------------------------------
// ContextHub companion plugin API type
// ---------------------------------------------------------------------------

export interface ContextHubPluginAPI {
  isAuthenticated(): boolean;
  getOcxpEndpoint?(): string;
  getWorkspaceId?(): string;
  getActiveMissionId?(): string;
  getActiveProjectId?(): string;
  getActiveSessionId?(): string | null;
  getIdToken?(): Promise<string | null>;
  listMissions(options?: { projectId?: string; limit?: number }): Promise<any[]>;
  listProjects(options?: { limit?: number }): Promise<any[]>;
  openCopilotChat?(options?: { missionId?: string; sessionId?: string }): void;
}

// ---------------------------------------------------------------------------
// Companion plugin access
// ---------------------------------------------------------------------------

/**
 * Returns the ContextHub companion plugin API, or null if unavailable.
 */
export function getContextHubPluginAPI(): ContextHubPluginAPI | null {
  try {
    const plugin = (globalThis as any).app?.plugins?.plugins?.["contexthub"];
    return plugin?.api ?? null;
  } catch {
    return null;
  }
}

/**
 * Checks whether the ContextHub companion plugin is installed and the user
 * is authenticated.
 */
export function isContextHubAuthenticated(): boolean {
  try {
    return getContextHubPluginAPI()?.isAuthenticated?.() ?? false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

/**
 * Get ContextHub OCXP base URL from companion plugin or fallback to default.
 */
export function getContextHubBaseUrl(): string {
  try {
    const ch = getContextHubPluginAPI();
    if (ch?.getOcxpEndpoint) {
      const endpoint = ch.getOcxpEndpoint();
      if (endpoint) return `${endpoint}/ocxp`;
    }
  } catch {
    // Companion plugin not available
  }
  return "http://localhost:8000/ocxp";
}

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/**
 * Create a header-provider callback for ContextHubChatModel.
 * Returns fresh auth + context headers from the contexthub-obsidian companion
 * plugin on every invocation, so they always reflect the current state.
 */
export function createContextHubHeaders(): () => Promise<Record<string, string>> {
  return async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    try {
      const ch = getContextHubPluginAPI();
      if (ch) {
        const workspaceId = ch.getWorkspaceId?.();
        const missionId = ch.getActiveMissionId?.();
        const projectId = ch.getActiveProjectId?.();
        const sessionId = ch.getActiveSessionId?.();
        if (workspaceId) headers["X-Workspace"] = workspaceId;
        if (missionId) headers["X-Mission"] = missionId;
        if (projectId) headers["X-Project"] = projectId;
        if (sessionId) headers["X-Session"] = sessionId;

        if (ch.getIdToken) {
          const idToken = await ch.getIdToken();
          if (idToken) {
            headers["Authorization"] = `Bearer ${idToken}`;
          }
        }
      }
    } catch {
      // Companion plugin not available -- request proceeds without context headers
    }

    // Apply mission context override (takes precedence over companion plugin values)
    const override = getMissionContext();
    if (override) {
      if (override.sessionId) headers["X-Session"] = override.sessionId;
      if (override.missionId) headers["X-Mission"] = override.missionId;
      if (override.projectId) headers["X-Project"] = override.projectId;
    }

    return headers;
  };
}

// ---------------------------------------------------------------------------
// API key check
// ---------------------------------------------------------------------------

/**
 * ContextHub auth is handled server-side by the OCXP gateway.
 * Always returns `{ hasApiKey: true }` to avoid timing issues with companion
 * plugin loading.
 */
export function checkContextHubApiKey(): { hasApiKey: true } {
  return { hasApiKey: true };
}

// ---------------------------------------------------------------------------
// Provider identity
// ---------------------------------------------------------------------------

/**
 * Returns true when `provider` is the ContextHub provider string.
 */
export function isContextHubProvider(provider: string): boolean {
  return provider === ChatModelProviders.CONTEXTHUB;
}
