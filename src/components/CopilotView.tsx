import ChainManager from "@/LLMProviders/chainManager";
import Chat from "@/components/Chat";
import { CHAT_VIEWTYPE } from "@/constants";
import { AppContext, EventTargetContext } from "@/context";
import CopilotPlugin from "@/main";
import type { SessionState } from "@/state/SessionState";
import { FileParserManager } from "@/tools/FileParserManager";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ItemView, Platform, WorkspaceLeaf } from "obsidian";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

export default class CopilotView extends ItemView {
  private get chainManager(): ChainManager {
    return this.plugin.projectManager.getCurrentChainManager();
  }

  private fileParserManager: FileParserManager;
  private root: Root | null = null;
  private handleSaveAsNote: (() => Promise<void>) | null = null;
  private keyboardObserver: MutationObserver | null = null;
  private lastDrawerEl: HTMLElement | null = null;
  eventTarget: EventTarget;
  private boundSessionId: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: CopilotPlugin
  ) {
    super(leaf);
    this.app = plugin.app;
    this.fileParserManager = plugin.fileParserManager;
    this.eventTarget = new EventTarget();
    this.plugin = plugin;
  }

  private get leafId(): string {
    return (this.leaf as any).id as string;
  }

  getSession(): SessionState | null {
    if (this.boundSessionId) {
      return this.plugin.sessionRegistry.getSessionById(this.boundSessionId);
    }
    return (
      this.plugin.sessionRegistry.getSessionForLeaf(this.leafId) ??
      this.plugin.sessionRegistry.getPrimarySession()
    );
  }

  bindSession(sessionId: string): void {
    this.boundSessionId = sessionId;
    this.plugin.sessionRegistry.bindLeaf(sessionId, this.leafId);
  }

  getViewType(): string {
    return CHAT_VIEWTYPE;
  }

  getState(): Record<string, unknown> {
    return { sessionId: this.boundSessionId };
  }

  async setState(state: Record<string, unknown>, result: any): Promise<void> {
    if (typeof state.sessionId === "string") {
      const session = this.plugin.sessionRegistry.getSessionById(state.sessionId);
      if (session) {
        this.bindSession(state.sessionId);
      }
    }
    await super.setState(state, result);
  }

  // Return an icon for this view
  getIcon(): string {
    return "message-square";
  }

  // Return a title for this view
  getTitle(): string {
    return "Copilot Chat";
  }

  getDisplayText(): string {
    return "Copilot";
  }

  async onOpen(): Promise<void> {
    // Bind to primary session if no session was assigned before opening
    if (!this.boundSessionId) {
      const primary = this.plugin.sessionRegistry.getPrimarySession();
      if (primary) {
        this.bindSession(primary.sessionId);
      }
    }

    this.root = createRoot(this.containerEl.children[1]);
    const handleSaveAsNote = (saveFunction: () => Promise<void>) => {
      this.handleSaveAsNote = saveFunction;
    };
    const updateUserMessageHistory = (newMessage: string) => {
      this.plugin.updateUserMessageHistory(newMessage);
    };

    this.renderView(handleSaveAsNote, updateUserMessageHistory);
    this.setupMobileKeyboardObserver();
  }

  /**
   * Observe --keyboard-height on <html> style to toggle a class on the
   * parent .workspace-drawer when the soft keyboard is open.
   * CSS uses this class to hide drawer header elements on mobile.
   *
   * Reason: The drawer lookup is inside the callback (not at setup time) because
   * the view can be moved from editor tab to drawer without triggering onOpen again.
   */
  private setupMobileKeyboardObserver(): void {
    if (!Platform.isMobile) return;

    // Reason: Disconnect any existing observer defensively in case onOpen runs more than once
    this.keyboardObserver?.disconnect();

    const syncKeyboardClass = () => {
      const drawer = this.containerEl.closest(".workspace-drawer") as HTMLElement | null;

      // Reason: If the view moved out of its previous drawer, clear the class on the old one
      // so drawer chrome (header/tab options) is restored.
      if (this.lastDrawerEl && this.lastDrawerEl !== drawer) {
        this.lastDrawerEl.classList.remove("copilot-keyboard-open");
      }
      this.lastDrawerEl = drawer;

      if (!drawer) return;

      // Reason: Check if this view itself is inside the active tab content, rather than
      // querying by data-type which is more brittle across Obsidian versions.
      const isCopilotActive = !!this.containerEl.closest(".workspace-drawer-active-tab-content");
      const kbHeight = parseFloat(
        document.documentElement.style.getPropertyValue("--keyboard-height") || "0"
      );
      drawer.classList.toggle("copilot-keyboard-open", isCopilotActive && kbHeight > 0);
    };

    this.keyboardObserver = new MutationObserver(syncKeyboardClass);
    this.keyboardObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"],
    });

    // Reason: Sync initial state in case keyboard is already open when view opens
    syncKeyboardClass();
  }

  private renderView(
    handleSaveAsNote: (saveFunction: () => Promise<void>) => void,
    updateUserMessageHistory: (newMessage: string) => void
  ): void {
    if (!this.root) return;

    this.root.render(
      <AppContext.Provider value={this.app}>
        <EventTargetContext.Provider value={this.eventTarget}>
          <Tooltip.Provider delayDuration={0}>
            <Chat
              chainManager={this.chainManager}
              updateUserMessageHistory={updateUserMessageHistory}
              fileParserManager={this.fileParserManager}
              plugin={this.plugin}
              onSaveChat={handleSaveAsNote}
              chatUIState={this.getSession()?.chatUIState ?? this.plugin.chatUIState}
            />
          </Tooltip.Provider>
        </EventTargetContext.Provider>
      </AppContext.Provider>
    );
  }

  async saveChat(): Promise<void> {
    if (this.handleSaveAsNote) {
      await this.handleSaveAsNote();
    }
  }

  updateView(): void {
    // Note: The new architecture handles message loading through ChatManager
    // The messages will be loaded when the Chat component initializes
    const handleSaveAsNote = (saveFunction: () => Promise<void>) => {
      this.handleSaveAsNote = saveFunction;
    };
    const updateUserMessageHistory = (newMessage: string) => {
      this.plugin.updateUserMessageHistory(newMessage);
    };

    this.renderView(handleSaveAsNote, updateUserMessageHistory);
  }

  async onClose(): Promise<void> {
    this.keyboardObserver?.disconnect();
    this.keyboardObserver = null;
    this.lastDrawerEl?.classList.remove("copilot-keyboard-open");
    this.lastDrawerEl = null;

    // Destroy non-primary sessions when their view closes
    if (this.boundSessionId) {
      const session = this.plugin.sessionRegistry.getSessionById(this.boundSessionId);
      if (session && !session.descriptor.isPrimary) {
        this.plugin.sessionRegistry.destroySession(this.boundSessionId);
      }
    }
    this.boundSessionId = null;

    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
