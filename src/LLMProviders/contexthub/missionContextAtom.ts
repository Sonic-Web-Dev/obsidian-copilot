import { atom, useAtom } from "jotai";
import { settingsStore } from "@/settings/model";

export interface MissionContextOverride {
  missionId: string;
  sessionId: string;
  projectId?: string;
  missionName?: string;
  projectName?: string;
}

const missionContextAtom = atom<MissionContextOverride | null>(null);

export function setMissionContext(ctx: MissionContextOverride | null) {
  settingsStore.set(missionContextAtom, ctx);
}

export function getMissionContext(): MissionContextOverride | null {
  return settingsStore.get(missionContextAtom);
}

export function useMissionContext() {
  return useAtom(missionContextAtom, { store: settingsStore });
}
