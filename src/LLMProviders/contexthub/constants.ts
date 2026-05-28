import type { CustomModel } from "@/aiParams";
import type { CopilotSettings } from "@/settings/model";
import {
  ChatModels,
  ChatModelProviders,
  ModelCapability,
  type ProviderMetadata,
} from "@/constants";

// ---------------------------------------------------------------------------
// Model name enum values (re-exported for convenience)
// ---------------------------------------------------------------------------

export const CONTEXTHUB_MODELS = {
  HAIKU: ChatModels.CONTEXTHUB_HAIKU,
  SONNET: ChatModels.CONTEXTHUB_SONNET,
  OPUS: ChatModels.CONTEXTHUB_OPUS,
} as const;

// ---------------------------------------------------------------------------
// Built-in model definitions (spread into BUILTIN_CHAT_MODELS)
// ---------------------------------------------------------------------------

export const CONTEXTHUB_BUILTIN_MODELS: CustomModel[] = [
  {
    name: ChatModels.CONTEXTHUB_HAIKU,
    provider: ChatModelProviders.CONTEXTHUB,
    enabled: true,
    isBuiltIn: true,
    core: true,
    projectEnabled: true,
  },
  {
    name: ChatModels.CONTEXTHUB_SONNET,
    provider: ChatModelProviders.CONTEXTHUB,
    enabled: true,
    isBuiltIn: true,
    core: true,
    projectEnabled: true,
    capabilities: [ModelCapability.VISION],
  },
  {
    name: ChatModels.CONTEXTHUB_OPUS,
    provider: ChatModelProviders.CONTEXTHUB,
    enabled: true,
    isBuiltIn: true,
    core: true,
    projectEnabled: true,
    capabilities: [ModelCapability.REASONING, ModelCapability.VISION],
  },
];

// ---------------------------------------------------------------------------
// Provider info entry (spread into ProviderInfo)
// ---------------------------------------------------------------------------

export const CONTEXTHUB_PROVIDER_INFO: ProviderMetadata = {
  label: "ContextHub",
  host: "https://api.contexthub.md/v1",
  curlBaseURL: "https://api.contexthub.md/v1",
  keyManagementURL: "",
  listModelURL: "",
  testModel: ChatModels.CONTEXTHUB_SONNET,
};

// ---------------------------------------------------------------------------
// Settings key mapping
// ---------------------------------------------------------------------------

export const CONTEXTHUB_SETTINGS_KEY: keyof CopilotSettings = "contextHubApiKey";

// ---------------------------------------------------------------------------
// Default settings value (spread into DEFAULT_SETTINGS)
// ---------------------------------------------------------------------------

export const CONTEXTHUB_DEFAULT_SETTINGS = {
  contextHubApiKey: "",
  activeMissionContext: null as null,
} as const;
