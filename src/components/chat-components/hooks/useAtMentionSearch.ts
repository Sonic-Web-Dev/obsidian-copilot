import React, { useMemo } from "react";
import { Platform, TFolder, TFile } from "obsidian";
import { FileText, Wrench, Folder, FileClock, Globe, CircleDashed } from "lucide-react";
import fuzzysort from "fuzzysort";
import { getToolDescription } from "@/tools/toolManager";
import { AVAILABLE_TOOLS } from "../constants/tools";
import { useAllNotes } from "./useAllNotes";
import { useAllFolders } from "./useAllFolders";
import { useOpenWebTabs } from "./useOpenWebTabs";
import { useActiveWebTabState } from "./useActiveWebTabState";
import { getMentionSearchHook } from "@/LLMProviders/providerExtensions";
import { AtMentionCategory, AtMentionOption, CategoryOption } from "./useAtMentionCategories";
import { getSettings } from "@/settings/model";

// Maximum number of results to show in @ mention search
const MAX_SEARCH_RESULTS = 30;

// Stable empty array to avoid re-renders when no search hook is registered
const EMPTY_ITEMS: any[] = [];

/**
 * Custom hook for @ mention search results with unified fuzzy search
 */
export function useAtMentionSearch(
  query: string,
  mode: "category" | "search",
  selectedCategory: AtMentionCategory | undefined,
  isCopilotPlus: boolean,
  availableCategoryOptions: CategoryOption[],
  currentActiveFile: TFile | null = null
): (CategoryOption | AtMentionOption)[] {
  // Get raw data without pre-filtering
  const allNotes = useAllNotes(isCopilotPlus);
  const allFolders = useAllFolders();

  // Only enable web tab polling when actually needed:
  // - In category mode with a search query (searching across all categories)
  // - In search mode when webTabs category is selected
  const shouldEnableWebTabPolling =
    Platform.isDesktopApp &&
    ((mode === "category" && query.trim().length > 0) ||
      (mode === "search" && selectedCategory === "webTabs"));
  const openWebTabs = useOpenWebTabs({ enabled: shouldEnableWebTabPolling });

  // Use the single-source-of-truth Active Web Tab state
  const { activeWebTabForMentions: activeWebTab } = useActiveWebTabState();

  // Create memoized item arrays (reused in both modes)
  const noteItems: AtMentionOption[] = useMemo(
    () =>
      allNotes.map((file, index) => ({
        key: `note-${file.basename}-${index}`,
        title: file.basename,
        subtitle: file.path,
        category: "notes" as AtMentionCategory,
        data: file,
        content: undefined,
        icon: React.createElement(FileText, { className: "tw-size-4" }),
        searchKeyword: file.path, // Search by note path
      })),
    [allNotes]
  );

  const toolItems: AtMentionOption[] = useMemo(
    () =>
      isCopilotPlus
        ? AVAILABLE_TOOLS.map((tool) => ({
            key: `tool-${tool}`,
            title: tool,
            subtitle: getToolDescription(tool),
            category: "tools" as AtMentionCategory,
            data: tool,
            content: getToolDescription(tool),
            icon: React.createElement(Wrench, { className: "tw-size-4" }),
          }))
        : [],
    [isCopilotPlus]
  );

  const folderItems: AtMentionOption[] = useMemo(
    () =>
      allFolders.map((folder: TFolder) => ({
        key: `folder-${folder.path}`,
        title: folder.name,
        subtitle: folder.path,
        category: "folders" as AtMentionCategory,
        data: folder,
        content: undefined,
        icon: React.createElement(Folder, { className: "tw-size-4" }),
        searchKeyword: folder.path, // Search by folder path
      })),
    [allFolders]
  );

  const webTabItems: AtMentionOption[] = useMemo(
    () =>
      Platform.isDesktopApp
        ? openWebTabs.map((tab, index) => {
            const isLoaded = tab.isLoaded !== false;
            return {
              key: `webtab-${tab.url || tab.title || index}-${index}`,
              title: tab.title || "Untitled",
              subtitle: isLoaded ? tab.url : "Tab not loaded",
              category: "webTabs" as AtMentionCategory,
              data: tab,
              content: undefined,
              disabled: !isLoaded,
              disabledReason: "Switch to this tab to load it first",
              icon: isLoaded
                ? React.createElement(Globe, { className: "tw-size-4" })
                : React.createElement(CircleDashed, { className: "tw-size-4 tw-text-muted" }),
              searchKeyword: `${tab.title || ""} ${tab.url || ""}`,
            };
          })
        : [],
    [openWebTabs]
  );

  // Dynamically call registered mention search hooks from provider extensions
  const missionsHook = getMentionSearchHook("missions");
  const projectsHook = getMentionSearchHook("projects");
  // Hooks are registered at startup (before first render), so the conditional branch is stable.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const chMissions = missionsHook ? missionsHook() : EMPTY_ITEMS;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const chProjects = projectsHook ? projectsHook() : EMPTY_ITEMS;

  // Look up icons from the registered category options
  const missionCatIcon = availableCategoryOptions.find((c) => c.category === "missions")?.icon;
  const projectCatIcon = availableCategoryOptions.find((c) => c.category === "projects")?.icon;

  const missionItems: AtMentionOption[] = useMemo(
    () =>
      chMissions.map((m: any) => ({
        key: `mission-${m.mission_id}`,
        title: m.title,
        subtitle: m.status,
        category: "missions" as AtMentionCategory,
        data: { id: m.mission_id, title: m.title },
        content: undefined,
        icon: missionCatIcon,
        searchKeyword: m.title,
      })),
    [chMissions, missionCatIcon]
  );

  const projectItems: AtMentionOption[] = useMemo(
    () =>
      chProjects.map((p: any) => ({
        key: `project-${p.project_id}`,
        title: p.name,
        subtitle: p.description,
        category: "projects" as AtMentionCategory,
        data: { id: p.project_id, title: p.name },
        content: undefined,
        icon: projectCatIcon,
        searchKeyword: p.name,
      })),
    [chProjects, projectCatIcon]
  );

  return useMemo(() => {
    if (mode === "category") {
      // Show category options when no query
      if (!query) {
        const categoryOptions = availableCategoryOptions.map((cat) => ({
          ...cat,
          content: undefined,
        })) as (CategoryOption | AtMentionOption)[];

        const activeOptions: AtMentionOption[] = [];

        // Add "Active Web Tab" option when the active leaf is Web Viewer (desktop-only)
        if (activeWebTab) {
          activeOptions.push({
            key: "active-web-tab",
            title: "Active Web Tab",
            subtitle: undefined,
            category: "activeWebTab" as AtMentionCategory,
            data: activeWebTab,
            content: undefined,
            icon: React.createElement(Globe, { className: "tw-size-4" }),
          });
        }

        // Add "Active Note" option if there is an active file
        if (currentActiveFile) {
          activeOptions.push({
            key: `active-note-${currentActiveFile.path}`,
            title: "Active Note",
            subtitle: undefined,
            category: "activeNote" as AtMentionCategory,
            data: currentActiveFile,
            content: undefined,
            icon: React.createElement(FileClock, { className: "tw-size-4" }),
          });
        }

        return activeOptions.length > 0 ? [...activeOptions, ...categoryOptions] : categoryOptions;
      }

      // Search across all categories when query exists
      // Search tools using exact string matching on name only (case-insensitive)
      const queryLower = query.toLowerCase();
      const matchingTools = toolItems.filter((tool) => {
        return tool.title.toLowerCase().includes(queryLower);
      });

      // Check if "active note" contains the query as a substring (case-insensitive)
      const activeNoteTitle = "active note";
      const activeNoteMatches = activeNoteTitle.includes(queryLower);
      const activeNoteOption =
        activeNoteMatches && currentActiveFile
          ? {
              key: `active-note-${currentActiveFile.path}`,
              title: "Active Note",
              subtitle: undefined,
              category: "activeNote" as AtMentionCategory,
              data: currentActiveFile,
              content: undefined,
              icon: React.createElement(FileClock, { className: "tw-size-4" }),
            }
          : null;

      // Check if "active web tab" contains the query as a substring (case-insensitive)
      const activeWebTabTitle = "active web tab";
      const activeWebTabMatches = activeWebTabTitle.includes(queryLower);
      const activeWebTabOption =
        activeWebTabMatches && activeWebTab
          ? {
              key: "active-web-tab",
              title: "Active Web Tab",
              subtitle: undefined,
              category: "activeWebTab" as AtMentionCategory,
              data: activeWebTab,
              content: undefined,
              icon: React.createElement(Globe, { className: "tw-size-4" }),
            }
          : null;

      // Combine all non-tool items for unified fuzzy search
      const allNonToolItems = [
        ...noteItems,
        ...folderItems,
        ...webTabItems,
        ...missionItems,
        ...projectItems,
      ];
      const fuzzySearchResults = fuzzysort.go(query, allNonToolItems, {
        keys: ["searchKeyword"],
        limit: MAX_SEARCH_RESULTS,
        threshold: -10000,
      });

      const rankedNonToolItems = fuzzySearchResults.map((result) => result.obj);

      // Tools first, then Active Web Tab / Active Note (if matches), then everything else
      return [
        ...matchingTools,
        ...(activeWebTabOption ? [activeWebTabOption] : []),
        ...(activeNoteOption ? [activeNoteOption] : []),
        ...rankedNonToolItems,
      ].slice(0, MAX_SEARCH_RESULTS);
    } else {
      // Category-specific search mode - reuse memoized items
      let items: AtMentionOption[] = [];

      switch (selectedCategory) {
        case "notes":
          items = noteItems;
          break;
        case "tools":
          items = toolItems;
          break;
        case "folders":
          items = folderItems;
          break;
        case "webTabs":
          items = webTabItems;
          break;
        case "missions":
          items = missionItems;
          break;
        case "projects":
          items = projectItems;
          break;
      }

      // Apply fuzzy search for all categories if there's a query
      if (!query) {
        // For notes category with no query, rank custom command notes lower
        if (selectedCategory === "notes") {
          const customPromptsFolder = getSettings().customPromptsFolder;
          const regularNotes = items.filter(
            (item) =>
              !(
                typeof item.data === "object" &&
                "path" in item.data &&
                typeof item.data.path === "string" &&
                item.data.path.startsWith(customPromptsFolder + "/")
              )
          );
          const customCommandNotes = items.filter(
            (item) =>
              typeof item.data === "object" &&
              "path" in item.data &&
              typeof item.data.path === "string" &&
              item.data.path.startsWith(customPromptsFolder + "/")
          );
          return [...regularNotes, ...customCommandNotes].slice(0, MAX_SEARCH_RESULTS);
        }
        return items.slice(0, MAX_SEARCH_RESULTS);
      }

      const results = fuzzysort.go(query, items, {
        keys: ["title", "subtitle"],
        limit: MAX_SEARCH_RESULTS,
        threshold: -10000,
      });

      return results.map((result) => result.obj);
    }
  }, [
    mode,
    query,
    selectedCategory,
    noteItems,
    toolItems,
    folderItems,
    webTabItems,
    missionItems,
    projectItems,
    availableCategoryOptions,
    activeWebTab,
    currentActiveFile,
  ]);
}
