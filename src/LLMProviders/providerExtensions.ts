/**
 * Provider Extension Registry
 *
 * A generic, provider-agnostic registry that allows LLM providers to register
 * UI extensions (pill nodes, @mention categories, auth checks, etc.) without
 * requiring the UI layer to import provider-specific code.
 *
 * This decouples provider implementations from core UI components like
 * LexicalEditor, QuickAskInput, and the @mention system.
 */

import type { Klass, LexicalNode } from "lexical";
import type { CategoryOption } from "@/components/chat-components/hooks/useAtMentionCategories";

// ---------------------------------------------------------------------------
// Pill nodes -- Lexical node classes that editors must register
// ---------------------------------------------------------------------------

const additionalPillNodes: Klass<LexicalNode>[] = [];

export function registerPillNodes(nodes: Klass<LexicalNode>[]): void {
  for (const node of nodes) {
    if (!additionalPillNodes.includes(node)) {
      additionalPillNodes.push(node);
    }
  }
}

export function getAdditionalPillNodes(): readonly Klass<LexicalNode>[] {
  return additionalPillNodes;
}

// ---------------------------------------------------------------------------
// Pill factories -- create pill nodes from @mention data
// ---------------------------------------------------------------------------

type PillFactory = (data: { id: string }, title: string) => LexicalNode;

const pillFactories = new Map<string, PillFactory>();

export function registerPillFactory(category: string, factory: PillFactory): void {
  pillFactories.set(category, factory);
}

export function getPillFactory(category: string): PillFactory | undefined {
  return pillFactories.get(category);
}

// ---------------------------------------------------------------------------
// @mention categories -- additional category options for the mention picker
// ---------------------------------------------------------------------------

const mentionCategories: CategoryOption[] = [];

export function registerMentionCategories(categories: CategoryOption[]): void {
  for (const cat of categories) {
    if (!mentionCategories.some((c) => c.key === cat.key)) {
      mentionCategories.push(cat);
    }
  }
}

export function getAdditionalMentionCategories(): readonly CategoryOption[] {
  return mentionCategories;
}

// ---------------------------------------------------------------------------
// @mention auth checks -- per-category visibility checks
// ---------------------------------------------------------------------------

const mentionAuthChecks = new Map<string, () => boolean>();

export function registerMentionAuthCheck(category: string, check: () => boolean): void {
  mentionAuthChecks.set(category, check);
}

export function getMentionAuthCheck(category: string): (() => boolean) | undefined {
  return mentionAuthChecks.get(category);
}

// ---------------------------------------------------------------------------
// @mention search hooks -- per-category React hooks for fetching items
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mentionSearchHooks = new Map<string, () => any[]>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerMentionSearchHook(category: string, hook: () => any[]): void {
  mentionSearchHooks.set(category, hook);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMentionSearchHook(category: string): (() => any[]) | undefined {
  return mentionSearchHooks.get(category);
}

// ---------------------------------------------------------------------------
// No-API-key providers -- providers that handle auth server-side
// ---------------------------------------------------------------------------

const noApiKeyProviders = new Set<string>();

export function registerNoApiKeyProvider(provider: string): void {
  noApiKeyProviders.add(provider);
}

export function isNoApiKeyProvider(provider: string): boolean {
  return noApiKeyProviders.has(provider);
}
