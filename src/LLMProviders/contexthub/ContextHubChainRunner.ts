import { ABORT_REASON } from "@/constants";
import { LayerToMessagesConverter } from "@/context/LayerToMessagesConverter";
import { logInfo } from "@/logger";
import { ChatMessage } from "@/types/message";
import { withSuppressedTokenWarnings } from "@/utils";
import { BaseChainRunner } from "@/LLMProviders/chainRunner/BaseChainRunner";
import { loadAndAddChatHistory } from "@/LLMProviders/chainRunner/utils/chatHistoryUtils";
import { recordPromptPayload } from "@/LLMProviders/chainRunner/utils/promptPayloadRecorder";
import { ThinkBlockStreamer } from "@/LLMProviders/chainRunner/utils/ThinkBlockStreamer";
import { ContextHubChatModel } from "./ContextHubChatModel";
import { createContextHubHeaders, getContextHubBaseUrl } from "./helpers";
import { CONTEXTHUB_MODELS } from "./constants";

/**
 * Chain runner for the dedicated ContextHub chain mode.
 *
 * Forces requests through the OCXP `/chat/completions` endpoint (AgentCore)
 * using a ContextHub model, regardless of the user's global model selection.
 * Session/mission headers are injected via `createContextHubHeaders()` and
 * the mission context atom override (applied inside `helpers.ts`).
 *
 * AG-UI events are processed by ThinkBlockStreamer automatically.
 */
export class ContextHubChainRunner extends BaseChainRunner {
  /**
   * Build the ContextHubChatModel that targets the AgentCore endpoint.
   */
  private getChatModel(): ContextHubChatModel {
    return new ContextHubChatModel({
      modelName: CONTEXTHUB_MODELS.SONNET,
      baseUrl: getContextHubBaseUrl,
      streaming: true,
      getHeaders: createContextHubHeaders(),
      endpointPath: "/chat/completions",
    });
  }

  /**
   * Construct messages array using envelope-based context (L1-L5 layers).
   */
  private async constructMessages(userMessage: ChatMessage): Promise<any[]> {
    if (!userMessage.contextEnvelope) {
      throw new Error("[ContextHubChainRunner] Context envelope is required but not available.");
    }

    logInfo("[ContextHubChainRunner] Using envelope-based context");

    const baseMessages = LayerToMessagesConverter.convert(userMessage.contextEnvelope, {
      includeSystemMessage: true,
      mergeUserContent: true,
      debug: false,
    });

    const messages: any[] = [];

    // Add system message (L1)
    const systemMessage = baseMessages.find((m) => m.role === "system");
    if (systemMessage) {
      messages.push(systemMessage);
    }

    // Add chat history (L4)
    const memory = this.chainManager.memoryManager.getMemory();
    await loadAndAddChatHistory(memory, messages);

    // Add user message (L2+L3+L5 merged)
    const userMessageContent = baseMessages.find((m) => m.role === "user");
    if (userMessageContent) {
      if (userMessage.content && Array.isArray(userMessage.content)) {
        const updatedContent = userMessage.content.map((item: any) => {
          if (item.type === "text") {
            return { ...item, text: userMessageContent.content };
          }
          return item;
        });
        messages.push({ role: "user", content: updatedContent });
      } else {
        messages.push(userMessageContent);
      }
    }

    return messages;
  }

  async run(
    userMessage: ChatMessage,
    abortController: AbortController,
    updateCurrentAiMessage: (message: string) => void,
    addMessage: (message: ChatMessage) => void,
    options: {
      debug?: boolean;
      ignoreSystemMessage?: boolean;
      updateLoading?: (loading: boolean) => void;
    }
  ): Promise<string> {
    // ContextHub models do not expose thinking blocks
    const streamer = new ThinkBlockStreamer(updateCurrentAiMessage, true);

    try {
      const messages = await this.constructMessages(userMessage);

      const chatModel = this.getChatModel();
      recordPromptPayload({
        messages,
        modelName: chatModel.modelName,
        contextEnvelope: userMessage.contextEnvelope,
      });

      logInfo("Final Request to AI (ContextHub chain):\n", messages);

      const chatStream = await withSuppressedTokenWarnings(() =>
        chatModel.stream(messages, {
          signal: abortController.signal,
        })
      );

      for await (const chunk of chatStream) {
        if (abortController.signal.aborted) {
          logInfo("Stream iteration aborted", {
            reason: abortController.signal.reason,
          });
          break;
        }
        streamer.processChunk(chunk);
      }
    } catch (error: any) {
      if (error.name === "AbortError" || abortController.signal.aborted) {
        logInfo("Stream aborted by user", {
          reason: abortController.signal.reason,
        });
      } else {
        await this.handleError(error, streamer.processErrorChunk.bind(streamer));
      }
    }

    const result = streamer.close();

    const responseMetadata = {
      wasTruncated: result.wasTruncated,
      tokenUsage: result.tokenUsage ?? undefined,
    };

    if (abortController.signal.aborted && abortController.signal.reason === ABORT_REASON.NEW_CHAT) {
      updateCurrentAiMessage("");
      return "";
    }

    await this.handleResponse(
      result.content,
      userMessage,
      abortController,
      addMessage,
      updateCurrentAiMessage,
      undefined,
      undefined,
      responseMetadata
    );

    return result.content;
  }
}
