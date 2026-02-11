import React from "react";
import { Target, Briefcase } from "lucide-react";
import type { CategoryOption } from "@/components/chat-components/hooks/useAtMentionCategories";

export { isContextHubAuthenticated } from "../helpers";

/**
 * ContextHub mention data shape shared across the mention subsystem.
 */
export interface ContextHubMentionData {
  id: string;
  title: string;
}

/**
 * Category options for ContextHub @ mentions (missions and projects).
 * These are conditionally included in the main category list when the
 * ContextHub companion plugin is installed and authenticated.
 */
export const CONTEXTHUB_MENTION_CATEGORIES: CategoryOption[] = [
  {
    key: "missions",
    title: "Missions",
    subtitle: "Link a mission for context",
    category: "missions",
    icon: <Target className="tw-size-4" />,
  },
  {
    key: "projects",
    title: "Projects",
    subtitle: "Link a project for context",
    category: "projects",
    icon: <Briefcase className="tw-size-4" />,
  },
];
