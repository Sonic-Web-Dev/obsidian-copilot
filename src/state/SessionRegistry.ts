import type ChainManager from "@/LLMProviders/chainManager";
import type { FileParserManager } from "@/tools/FileParserManager";
import type CopilotPlugin from "@/main";
import { logInfo, logWarn } from "@/logger";
import { SessionState, type SessionStateOpts } from "./SessionState";
import type { SessionDescriptor } from "./SessionDescriptor";

export class SessionRegistry {
  private sessions: Map<string, SessionState> = new Map();
  private leafToSession: Map<string, string> = new Map();
  private primarySessionId: string | null = null;

  private chainManager: ChainManager;
  private fileParserManager: FileParserManager;
  private plugin: CopilotPlugin;

  constructor(
    chainManager: ChainManager,
    fileParserManager: FileParserManager,
    plugin: CopilotPlugin
  ) {
    this.chainManager = chainManager;
    this.fileParserManager = fileParserManager;
    this.plugin = plugin;
  }

  createSession(opts: SessionStateOpts = {}): SessionState {
    const session = new SessionState(this.chainManager, this.fileParserManager, this.plugin, opts);

    this.sessions.set(session.sessionId, session);

    if (opts.isPrimary) {
      this.primarySessionId = session.sessionId;
    }

    logInfo(
      `[SessionRegistry] Created session ${session.sessionId} (primary=${opts.isPrimary ?? false})`
    );
    return session;
  }

  getSessionById(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getSessionForLeaf(leafId: string): SessionState | null {
    const sessionId = this.leafToSession.get(leafId);
    if (!sessionId) return null;
    return this.sessions.get(sessionId) ?? null;
  }

  getPrimarySession(): SessionState | null {
    if (!this.primarySessionId) return null;
    return this.sessions.get(this.primarySessionId) ?? null;
  }

  bindLeaf(sessionId: string, leafId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logWarn(`[SessionRegistry] Cannot bind leaf: session ${sessionId} not found`);
      return;
    }

    // Unbind any previous leaf for this session
    if (session.descriptor.leafId) {
      this.leafToSession.delete(session.descriptor.leafId);
    }

    session.descriptor.leafId = leafId;
    this.leafToSession.set(leafId, sessionId);
  }

  destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    if (session.descriptor.leafId) {
      this.leafToSession.delete(session.descriptor.leafId);
    }

    this.sessions.delete(sessionId);

    if (this.primarySessionId === sessionId) {
      this.primarySessionId = null;
    }

    logInfo(`[SessionRegistry] Destroyed session ${sessionId}`);
  }

  listSessions(): SessionDescriptor[] {
    return Array.from(this.sessions.values()).map((s) => ({ ...s.descriptor }));
  }

  get size(): number {
    return this.sessions.size;
  }
}
