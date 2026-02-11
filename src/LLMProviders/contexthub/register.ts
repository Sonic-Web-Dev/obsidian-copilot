/**
 * ContextHub Provider Extension Registration
 *
 * Registers all ContextHub-specific UI extensions (pill nodes, @mention
 * categories, auth checks, search hooks) into the generic provider
 * extensions registry.
 *
 * Called once during plugin initialization so that core UI components
 * never need to import ContextHub-specific code directly.
 */

import type { Klass, LexicalNode } from "lexical";
import {
  registerPillNodes,
  registerPillFactory,
  registerMentionCategories,
  registerMentionAuthCheck,
  registerMentionSearchHook,
  registerNoApiKeyProvider,
} from "../providerExtensions";
import { MissionPillNode, $createMissionPillNode } from "./mentions/MissionPillNode";
import { ProjectPillNode, $createProjectPillNode } from "./mentions/ProjectPillNode";
import { CONTEXTHUB_MENTION_CATEGORIES, isContextHubAuthenticated } from "./mentions/categories";
import { useContextHubMissions, useContextHubProjects } from "./mentions/useContextHubItems";
import { ChatModelProviders } from "@/constants";

let registered = false;

export function registerContextHubExtensions(): void {
  if (registered) return;
  registered = true;

  // Lexical pill nodes
  registerPillNodes([MissionPillNode, ProjectPillNode] as Klass<LexicalNode>[]);

  // Pill creation factories (used by lexicalTextUtils $createPillNode)
  registerPillFactory("missions", (data, title) => $createMissionPillNode(data.id, title));
  registerPillFactory("projects", (data, title) => $createProjectPillNode(data.id, title));

  // @mention category options (shown in the category picker)
  registerMentionCategories(CONTEXTHUB_MENTION_CATEGORIES);

  // Auth checks for mention categories
  registerMentionAuthCheck("missions", isContextHubAuthenticated);
  registerMentionAuthCheck("projects", isContextHubAuthenticated);

  // React hooks for fetching mention items (called from useAtMentionSearch)
  registerMentionSearchHook("missions", useContextHubMissions);
  registerMentionSearchHook("projects", useContextHubProjects);

  // ContextHub handles auth server-side, no client API key needed
  registerNoApiKeyProvider(ChatModelProviders.CONTEXTHUB);
}
