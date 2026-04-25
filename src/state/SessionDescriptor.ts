import type { ChainType } from "@/chainFactory";
import type { MissionContextOverride } from "@/LLMProviders/contexthub/missionContextAtom";

export interface SessionDescriptor {
  sessionId: string;
  leafId: string | null;
  isPrimary: boolean;
  missionContext: MissionContextOverride | null;
  chainType: ChainType;
  modelKey: string;
  title?: string;
  createdAt: number;
}

export function createSessionId(): string {
  return crypto.randomUUID();
}
