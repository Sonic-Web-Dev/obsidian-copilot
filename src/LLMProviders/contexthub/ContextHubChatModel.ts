import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  type MessageContent,
} from "@langchain/core/messages";
import { type ChatResult, ChatGeneration, ChatGenerationChunk } from "@langchain/core/outputs";
import { type CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import { createParser, type ParsedEvent, type ReconnectInterval } from "eventsource-parser";
import { extractTextFromChunk } from "@/utils";
import { logError } from "@/logger";

const CHARS_PER_TOKEN = 4;

/**
 * SSE stream chunk in OpenAI Chat Completions format.
 */
/**
 * AG-UI event forwarded from the OCXP gateway as an extension field.
 */
export interface AGUIEvent {
  type: string;
  name?: string;
  args?: unknown;
  result?: unknown;
  state?: unknown;
  toolCallId?: string;
  [key: string]: unknown;
}

interface ContextHubStreamChunk {
  choices: Array<{
    index: number;
    delta: {
      content?: string | null;
      role?: string;
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  /** AG-UI event forwarded by the OCXP gateway */
  x_agui?: AGUIEvent;
  model?: string;
  created?: number;
  id?: string;
}

/**
 * Non-streaming response in OpenAI Chat Completions format.
 */
interface ContextHubChatResponse {
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
  id?: string;
}

export interface ContextHubChatModelParams extends BaseChatModelParams {
  modelName: string;
  baseUrl: string;
  streaming?: boolean;
  /** Async function that returns fresh auth + context headers for each request */
  getHeaders: () => Promise<Record<string, string>>;
  /** Endpoint path appended to baseUrl. Defaults to "/chat/completions". */
  endpointPath?: string;
}

/**
 * Custom LangChain BaseChatModel for ContextHub that uses native fetch()
 * with eventsource-parser for real SSE streaming.
 *
 * This bypasses Obsidian's requestUrl (used by safeFetch) which buffers the
 * entire HTTP response before returning, breaking SSE streaming.
 */
export class ContextHubChatModel extends BaseChatModel {
  lc_serializable = false;
  lc_namespace = ["langchain", "chat_models", "contexthub"];

  modelName: string;
  streaming: boolean;
  private baseUrl: string;
  private getHeaders: () => Promise<Record<string, string>>;
  private endpointPath: string;

  /** Track active AG-UI slots per hintType within a streaming session */
  private activeAgUiSlots = new Map<string, string>();

  constructor(fields: ContextHubChatModelParams) {
    super(fields);
    this.modelName = fields.modelName;
    this.baseUrl = fields.baseUrl;
    this.streaming = fields.streaming ?? true;
    this.getHeaders = fields.getHeaders;
    this.endpointPath = fields.endpointPath ?? "/chat/completions";
  }

  _llmType(): string {
    return "contexthub";
  }

  private convertMessageType(messageType: string): string {
    switch (messageType) {
      case "human":
        return "user";
      case "ai":
        return "assistant";
      case "system":
        return "system";
      case "tool":
      case "function":
        return "user";
      case "generic":
      default:
        return "user";
    }
  }

  private toOpenAIMessages(messages: BaseMessage[]): Array<{ role: string; content: string }> {
    return messages.map((m) => ({
      role: this.convertMessageType(m._getType()),
      content: extractTextFromChunk(m.content),
    }));
  }

  /**
   * Non-streaming generation: POST with stream: false, parse JSON response.
   */
  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const chatMessages = this.toOpenAIMessages(messages);
    const headers = await this.getHeaders();
    const url = `${this.baseUrl}${this.endpointPath}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: chatMessages,
        stream: false,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ContextHub request failed (${response.status}): ${errorText || response.statusText}`
      );
    }

    const data = (await response.json()) as ContextHubChatResponse;
    const choice = data.choices?.[0];
    const content = choice?.message?.content || "";
    const finishReason = choice?.finish_reason;

    const tokenUsage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined;

    const responseMetadata = {
      finish_reason: finishReason,
      tokenUsage,
      model: data.model,
    };

    const generation: ChatGeneration = {
      text: content,
      message: new AIMessage({
        content,
        response_metadata: responseMetadata,
      }),
      generationInfo: { finish_reason: finishReason },
    };

    return {
      generations: [generation],
      llmOutput: { tokenUsage },
    };
  }

  /**
   * Reset AG-UI slot tracking between streaming sessions.
   * Called automatically at the start of each _streamResponseChunks invocation.
   */
  resetAgUiSlots(): void {
    this.activeAgUiSlots.clear();
  }

  /**
   * Streaming generation using native fetch + eventsource-parser.
   * Reads SSE events from a real ReadableStream (not Obsidian's buffered requestUrl).
   */
  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // Reset AG-UI slot tracking for this new streaming session
    this.activeAgUiSlots.clear();

    // If streaming is disabled, fall back to _generate and yield a single chunk
    if (!this.streaming) {
      const result = await this._generate(messages, options, runManager);
      const generation = result.generations[0];
      if (!generation) return;

      const messageChunk = new AIMessageChunk({
        content: generation.text,
        response_metadata: generation.message.response_metadata,
      });

      const generationChunk = new ChatGenerationChunk({
        message: messageChunk,
        text: generation.text,
        generationInfo: generation.generationInfo,
      });

      if (runManager && generation.text) {
        await runManager.handleLLMNewToken(generation.text);
      }

      yield generationChunk;
      return;
    }

    const chatMessages = this.toOpenAIMessages(messages);
    const headers = await this.getHeaders();
    const url = `${this.baseUrl}${this.endpointPath}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...headers,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: chatMessages,
        stream: true,
      }),
      signal: options?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `ContextHub streaming request failed (${response.status}): ${errorText || response.statusText}`
      );
    }

    if (!response.body) {
      throw new Error("ContextHub response body is not available for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const chunkQueue: ContextHubStreamChunk[] = [];
    let receivedDone = false;
    let yieldedUsableChunk = false;
    let rawResponsePreview = "";

    const parser = createParser((event: ParsedEvent | ReconnectInterval) => {
      if (event.type !== "event") return;

      const data = event.data;
      if (data === "[DONE]") {
        receivedDone = true;
        return;
      }

      try {
        const chunk = JSON.parse(data) as ContextHubStreamChunk;
        chunkQueue.push(chunk);
      } catch {
        // Skip invalid JSON
      }
    });

    try {
      while (true) {
        if (receivedDone) break;

        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        if (rawResponsePreview.length < 500) {
          rawResponsePreview += text.slice(0, 500 - rawResponsePreview.length);
        }
        parser.feed(text);

        while (chunkQueue.length > 0) {
          const chunk = chunkQueue.shift();
          if (!chunk) continue;

          const generationChunk = this.processStreamChunk(chunk);
          if (!generationChunk) continue;

          const content = generationChunk.text;
          if (runManager && content) {
            await runManager.handleLLMNewToken(content);
          }

          yieldedUsableChunk = true;
          yield generationChunk;
        }
      }

      // Flush decoder
      const finalText = decoder.decode();
      if (finalText) {
        if (rawResponsePreview.length < 500) {
          rawResponsePreview += finalText.slice(0, 500 - rawResponsePreview.length);
        }
        parser.feed(finalText);

        while (chunkQueue.length > 0) {
          const chunk = chunkQueue.shift();
          if (!chunk) continue;

          const generationChunk = this.processStreamChunk(chunk);
          if (!generationChunk) continue;

          const content = generationChunk.text;
          if (runManager && content) {
            await runManager.handleLLMNewToken(content);
          }

          yieldedUsableChunk = true;
          yield generationChunk;
        }
      }

      if (!yieldedUsableChunk) {
        const preview = rawResponsePreview.slice(0, 200);
        const contentType = response.headers.get("content-type") || "(empty)";
        logError(
          `ContextHub streaming produced no usable chunks. ` +
            `Content-Type: ${contentType}, Response preview: ${preview || "(empty)"}`
        );
        throw new Error(
          `ContextHub streaming produced no usable chunks. ` +
            `Content-Type: ${contentType}, Response preview: ${preview || "(empty)"}`
        );
      }
    } finally {
      try {
        await reader.cancel();
      } catch {
        // Ignore cancellation errors
      }
      reader.releaseLock();
    }
  }

  /**
   * Process a single SSE stream chunk into a ChatGenerationChunk.
   * Returns null if the chunk has no usable content or metadata.
   */
  private processStreamChunk(chunk: ContextHubStreamChunk): ChatGenerationChunk | null {
    const choice = chunk.choices?.[0];
    let content = choice?.delta?.content || "";

    // --- AG-UI CUSTOM events: slot injection ---
    // Intercept CUSTOM events before ThinkBlockStreamer sees them.
    // Inject a slot div into content and emit workspace event for our plugin to render.
    let strippedXAgui = chunk.x_agui;
    if (chunk.x_agui?.type === "CUSTOM") {
      const hintType = (chunk.x_agui.name as string) || "";
      if (hintType) {
        let slotId = this.activeAgUiSlots.get(hintType);
        const isUpdate = !!slotId;

        if (!slotId) {
          slotId = `agui-${hintType}-${Date.now()}`;
          this.activeAgUiSlots.set(hintType, slotId);
        }

        if (!isUpdate) {
          // First event for this hintType: inject slot div into content
          // HTML passthrough survives Obsidian's MarkdownRenderer
          content += `\n<div class="ch-agui-slot" data-slot-id="${slotId}" data-hint-type="${hintType}"></div>\n`;
        }

        // Notify contexthub-obsidian plugin with full event data
        try {
          const data = chunk.x_agui.value ?? chunk.x_agui;
          (globalThis as any).app?.workspace?.trigger("contexthub:agui-custom", {
            slotId,
            hintType,
            data,
            isUpdate,
          });
        } catch {
          /* companion plugin not loaded */
        }
      }
      strippedXAgui = undefined; // Don't pass CUSTOM events to ThinkBlockStreamer
    }

    const hasMetadata =
      choice?.finish_reason || chunk.usage || choice?.delta?.role || strippedXAgui;
    if (!content && !hasMetadata) return null;

    const responseMetadata: Record<string, unknown> = {};
    if (choice?.finish_reason) {
      responseMetadata.finish_reason = choice.finish_reason;
    }
    if (choice?.delta?.role) {
      responseMetadata.role = choice.delta.role;
    }
    if (chunk.usage) {
      responseMetadata.tokenUsage = {
        promptTokens: chunk.usage.prompt_tokens,
        completionTokens: chunk.usage.completion_tokens,
        totalTokens: chunk.usage.total_tokens,
      };
    }
    if (chunk.model) {
      responseMetadata.model = chunk.model;
    }
    if (strippedXAgui) {
      responseMetadata.x_agui = strippedXAgui;
    }

    const messageChunk = new AIMessageChunk({
      content,
      response_metadata: Object.keys(responseMetadata).length > 0 ? responseMetadata : undefined,
    });

    return new ChatGenerationChunk({
      message: messageChunk,
      text: content,
      generationInfo: choice?.finish_reason ? { finish_reason: choice.finish_reason } : undefined,
    });
  }

  async getNumTokens(content: MessageContent): Promise<number> {
    const text = extractTextFromChunk(content);
    if (!text) return 0;
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }
}
