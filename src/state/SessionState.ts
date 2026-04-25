import type ChainManager from "@/LLMProviders/chainManager";
import type { FileParserManager } from "@/tools/FileParserManager";
import type CopilotPlugin from "@/main";
import { ChatManager } from "@/core/ChatManager";
import { MessageRepository } from "@/core/MessageRepository";
import { ChatUIState } from "@/state/ChatUIState";
import { type SessionDescriptor, createSessionId } from "./SessionDescriptor";

export interface SessionStateOpts {
  isPrimary?: boolean;
  sessionId?: string;
  title?: string;
}

export class SessionState {
  readonly sessionId: string;
  readonly messageRepo: MessageRepository;
  readonly chatManager: ChatManager;
  readonly chatUIState: ChatUIState;
  descriptor: SessionDescriptor;

  constructor(
    chainManager: ChainManager,
    fileParserManager: FileParserManager,
    plugin: CopilotPlugin,
    opts: SessionStateOpts = {}
  ) {
    this.sessionId = opts.sessionId ?? createSessionId();
    this.messageRepo = new MessageRepository();
    this.chatManager = new ChatManager(this.messageRepo, chainManager, fileParserManager, plugin);
    this.chatUIState = new ChatUIState(this.chatManager);

    this.descriptor = {
      sessionId: this.sessionId,
      leafId: null,
      isPrimary: opts.isPrimary ?? false,
      missionContext: null,
      chainType: "llm_chain" as any,
      modelKey: "",
      title: opts.title,
      createdAt: Date.now(),
    };
  }
}
