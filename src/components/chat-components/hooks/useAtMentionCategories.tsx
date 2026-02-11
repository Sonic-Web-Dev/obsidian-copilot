import React, { useMemo } from "react";
import { Platform, TFile, TFolder } from "obsidian";
import { FileText, Wrench, Folder, Globe } from "lucide-react";
import { TypeaheadOption } from "../TypeaheadMenuContent";
import type { WebTabContext } from "@/types/message";
import {
  getAdditionalMentionCategories,
  getMentionAuthCheck,
} from "@/LLMProviders/providerExtensions";

export type AtMentionCategory =
  | "notes"
  | "tools"
  | "folders"
  | "activeNote"
  | "webTabs"
  | "activeWebTab"
  | string; // extensible for provider-registered categories

export interface AtMentionOption extends TypeaheadOption {
  category: AtMentionCategory;
  data: TFile | string | TFolder | WebTabContext | { id: string; title: string };
}

export interface CategoryOption extends TypeaheadOption {
  category: AtMentionCategory;
  icon: React.ReactNode;
}

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    key: "notes",
    title: "Notes",
    subtitle: "Reference notes in your vault",
    category: "notes",
    icon: <FileText className="tw-size-4" />,
  },
  {
    key: "webTabs",
    title: "Web Tabs",
    subtitle: "Reference open browser tabs",
    category: "webTabs",
    icon: <Globe className="tw-size-4" />,
  },
  {
    key: "tools",
    title: "Tools",
    subtitle: "AI tools and commands",
    category: "tools",
    icon: <Wrench className="tw-size-4" />,
  },
  {
    key: "folders",
    title: "Folders",
    subtitle: "Reference vault folders",
    category: "folders",
    icon: <Folder className="tw-size-4" />,
  },
  // Additional categories are appended via the provider extensions registry
  ...getAdditionalMentionCategories(),
];

/**
 * Hook that provides available @ mention categories based on Copilot Plus status.
 * Returns the array of available category options directly.
 * Web Tabs category is only available on desktop (Web Viewer not supported on mobile).
 *
 * @param isCopilotPlus - Whether Copilot Plus features are enabled
 * @returns Array of CategoryOption objects
 */
export function useAtMentionCategories(isCopilotPlus: boolean = false): CategoryOption[] {
  return useMemo(() => {
    // Rebuild category list to pick up late registrations
    const allCategories: CategoryOption[] = [
      ...CATEGORY_OPTIONS.filter(
        (c) => !getAdditionalMentionCategories().some((a) => a.key === c.key)
      ),
      ...getAdditionalMentionCategories(),
    ];

    return allCategories.filter((cat) => {
      // Tools require Copilot Plus
      if (cat.category === "tools") {
        return isCopilotPlus;
      }
      // Web Tabs only available on desktop (Web Viewer not supported on mobile)
      if (cat.category === "webTabs") {
        return Platform.isDesktopApp;
      }
      // Check registered auth checks for provider-contributed categories
      const authCheck = getMentionAuthCheck(cat.category);
      if (authCheck) {
        return authCheck();
      }
      return true;
    });
  }, [isCopilotPlus]);
}
