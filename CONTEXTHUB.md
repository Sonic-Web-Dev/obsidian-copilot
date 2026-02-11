# ContextHub Fork -- Change Documentation

This document tracks all changes made in the `contexthub-copilot` fork of
[obsidian-copilot](https://github.com/logancyang/obsidian-copilot). Its purpose
is to make upstream merges predictable by categorising every modified file.

---

## Fork Goal

Integrate ContextHub as a first-class LLM provider in Obsidian Copilot, adding:

- **ContextHub Chat Model** -- SSE streaming via native fetch, server-side auth
  through the OCXP gateway, per-request context headers (workspace, project,
  mission, git).
- **@mission / @project mentions** -- Pill nodes in the Lexical editor that
  inject mission and project context into prompts.
- **Companion plugin bridge** -- Reads auth tokens, workspace ID, active
  mission/project from the `contexthub` Obsidian plugin API.

---

## File Change Categories

### A. ContextHub Provider (self-contained)

All provider logic lives in `src/LLMProviders/contexthub/`. These files are
100 % ContextHub-specific and do not touch upstream code:

| File                             | Purpose                                                 |
| -------------------------------- | ------------------------------------------------------- |
| `ContextHubChatModel.ts`         | LangChain-compatible chat model with native fetch + SSE |
| `constants.ts`                   | Model definitions, provider info, settings key          |
| `helpers.ts`                     | Companion plugin API, auth check, header factory        |
| `mentions/MissionPillNode.tsx`   | Lexical pill node for `@mission:UUID`                   |
| `mentions/ProjectPillNode.tsx`   | Lexical pill node for `@project:UUID`                   |
| `mentions/categories.tsx`        | Category options for the @mention picker                |
| `mentions/useContextHubItems.ts` | React hooks to fetch missions/projects                  |
| `mentions/index.ts`              | Barrel exports                                          |
| `register.ts`                    | Registers all UI extensions into the provider registry  |
| `index.ts`                       | Barrel exports                                          |

### B. Mandatory Upstream Touchpoints (5 files)

These are compile-time registration points. Every new provider (Bedrock, GitHub
Copilot, etc.) follows the exact same pattern -- add an enum entry, a
constructor case, a settings field, and a type mapping. Merge conflicts here
are one-liners.

| File                                   | What was added                                                             | Why unavoidable                        |
| -------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------- |
| `src/constants.ts`                     | `CONTEXTHUB` enum entry, spread imports for models/info                    | TS enums cannot be extended at runtime |
| `src/LLMProviders/chatModelManager.ts` | Constructor map entry + `registerContextHubExtensions()` call              | Core provider instantiation registry   |
| `src/settings/model.ts`                | `contextHubApiKey: string` field                                           | TS interface (compile-time)            |
| `src/settings/providerModels.ts`       | `[CONTEXTHUB]: null`                                                       | TS type mapping for provider models    |
| `src/utils.ts`                         | `isContextHubProvider()` in `checkModelApiKey` and `getNeedSetKeyProvider` | Auth bypass for server-side auth       |

### C. Generic Provider Extension Registry (1 new file)

To avoid scattering ContextHub imports across the UI layer, a generic
**provider extension registry** was introduced. Any provider can register UI
extensions (pill nodes, @mention categories, search hooks, auth checks) and the
core UI reads from the registry without knowing which provider contributed what.

| File                                     | Purpose                                             |
| ---------------------------------------- | --------------------------------------------------- |
| `src/LLMProviders/providerExtensions.ts` | Generic registry -- **no ContextHub-specific code** |

### D. Non-ContextHub Changes (3 files)

These changes were made alongside the ContextHub work but benefit all
OpenAI-format providers (streamUsage support). They are not ContextHub-specific.

| File                                             | What                                           |
| ------------------------------------------------ | ---------------------------------------------- |
| `src/aiParams.ts`                                | `streamUsage?: boolean` field on `CustomModel` |
| `src/settings/v2/components/ModelAddDialog.tsx`  | streamUsage checkbox in add dialog             |
| `src/settings/v2/components/ModelEditDialog.tsx` | streamUsage checkbox in edit dialog            |

---

## Provider Extension Registry

### Problem

Before the registry, 6 UI files imported directly from
`src/LLMProviders/contexthub/`. Every upstream change to these files risked a
merge conflict.

### Solution

A lightweight registry (`providerExtensions.ts`) that providers populate at
startup and UI files read from:

```
Startup:
  chatModelManager.ts loads
    -> imports registerContextHubExtensions
    -> calls registerContextHubExtensions()
      -> registerPillNodes([MissionPillNode, ProjectPillNode])
      -> registerPillFactory("missions", ...)
      -> registerMentionCategories(CONTEXTHUB_MENTION_CATEGORIES)
      -> registerMentionAuthCheck("missions", isContextHubAuthenticated)
      -> registerMentionSearchHook("missions", useContextHubMissions)
      -> registerNoApiKeyProvider(ChatModelProviders.CONTEXTHUB)

Runtime:
  LexicalEditor.tsx       -> ...getAdditionalPillNodes()
  QuickAskInput.tsx       -> ...getAdditionalPillNodes()
  useAtMentionCategories  -> getAdditionalMentionCategories(), getMentionAuthCheck()
  useAtMentionSearch      -> getMentionSearchHook("missions"), getMentionSearchHook("projects")
  lexicalTextUtils        -> getPillFactory(type)
  ModelSelector           -> isNoApiKeyProvider(provider)
```

### Registry API

| Function                                    | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `registerPillNodes(nodes)`                  | Register Lexical node classes for editors       |
| `getAdditionalPillNodes()`                  | Retrieve registered pill nodes                  |
| `registerPillFactory(category, factory)`    | Register a pill creation factory                |
| `getPillFactory(category)`                  | Get factory for a mention category              |
| `registerMentionCategories(categories)`     | Register @mention category options              |
| `getAdditionalMentionCategories()`          | Get registered category options                 |
| `registerMentionAuthCheck(category, check)` | Register auth visibility check                  |
| `getMentionAuthCheck(category)`             | Get auth check for a category                   |
| `registerMentionSearchHook(category, hook)` | Register a React hook for fetching items        |
| `getMentionSearchHook(category)`            | Get the search hook for a category              |
| `registerNoApiKeyProvider(provider)`        | Mark a provider as not needing a client API key |
| `isNoApiKeyProvider(provider)`              | Check if provider handles auth server-side      |

### Result

|                                                        | Before registry | After registry           |
| ------------------------------------------------------ | --------------- | ------------------------ |
| UI files with ContextHub imports                       | 6               | 0                        |
| Total files outside `contexthub/` with ContextHub refs | 14              | 5 mandatory + 1 generic  |
| Merge conflict risk on upstream sync                   | 14 files        | 5 files (all one-liners) |

---

## UI Files -- Before / After

These 6 files previously imported directly from `LLMProviders/contexthub/`.
They now import only from `LLMProviders/providerExtensions.ts`.

| File                         | Before                                                                | After                                                                  |
| ---------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `LexicalEditor.tsx`          | `import { MissionPillNode } from "contexthub/..."`                    | `...getAdditionalPillNodes()`                                          |
| `QuickAskInput.tsx`          | `import { MissionPillNode } from "contexthub/..."`                    | `...getAdditionalPillNodes()`                                          |
| `useAtMentionCategories.tsx` | `import { CONTEXTHUB_MENTION_CATEGORIES, isContextHubAuthenticated }` | `getAdditionalMentionCategories()`, `getMentionAuthCheck()`            |
| `useAtMentionSearch.ts`      | `import { useContextHubMissions, useContextHubProjects }`             | `getMentionSearchHook("missions")`, `getMentionSearchHook("projects")` |
| `lexicalTextUtils.ts`        | `import { $createMissionPillNode, $createProjectPillNode }`           | `getPillFactory(type)?.(data, title)`                                  |
| `ModelSelector.tsx`          | `import { isContextHubProvider }`                                     | `isNoApiKeyProvider(provider)`                                         |

---

## Upstream Merge Playbook

When syncing with upstream `logancyang/obsidian-copilot`:

1. **`src/LLMProviders/contexthub/`** -- Never conflicts (upstream doesn't
   have this directory).
2. **`src/LLMProviders/providerExtensions.ts`** -- Never conflicts (new file,
   upstream doesn't have it).
3. **5 mandatory files** -- Conflicts are simple "add a line" merges:
   - `constants.ts` -- Add CONTEXTHUB entries after the last enum value.
   - `chatModelManager.ts` -- Add import + constructor entry + registration call.
   - `settings/model.ts` -- Add `contextHubApiKey` to interface/defaults.
   - `settings/providerModels.ts` -- Add `[CONTEXTHUB]: null`.
   - `utils.ts` -- Add `isContextHubProvider` check in two functions.
4. **6 UI files** -- Should merge cleanly since they no longer contain
   ContextHub imports. If upstream adds new pill types or @mention categories,
   no ContextHub-specific changes are needed.
5. **3 streamUsage files** -- Independent of ContextHub. Merge if upstream
   hasn't added the same feature.

---

## Commit History

| Commit    | Description                                                                           |
| --------- | ------------------------------------------------------------------------------------- |
| `b2aca33` | feat(contexthub): inject JWT auth token per-request via custom fetch                  |
| `476cfe3` | fix(contexthub): inject X-Workspace + context headers per-request                     |
| `a8095c0` | feat(mentions): add @mission and @project mentions to copilot                         |
| `e162539` | fix(contexthub): replace ChatOpenAI with custom ContextHubChatModel for SSE streaming |
| `3d1f92a` | refactor(contexthub): consolidate all ContextHub code into single provider folder     |
| `8cd1a77` | refactor: add provider extension registry to reduce fork touchpoints                  |
