import { useState, useEffect, useRef } from "react";
import { App } from "obsidian";

declare const app: App;

interface MissionItem {
  mission_id: string;
  title: string;
  status: string;
  project_id?: string;
}

interface ProjectItem {
  project_id: string;
  name: string;
  description: string;
}

interface ContextHubPluginAPI {
  isAuthenticated(): boolean;
  listMissions(options?: { projectId?: string; limit?: number }): Promise<MissionItem[]>;
  listProjects(options?: { limit?: number }): Promise<ProjectItem[]>;
}

const CACHE_TTL_MS = 60_000;

function getContextHubAPI(): ContextHubPluginAPI | null {
  try {
    const plugin = (app as any)?.plugins?.plugins?.["contexthub"];
    return plugin?.api ?? null;
  } catch {
    return null;
  }
}

/**
 * Hook that fetches missions from the ContextHub Plugin API.
 * Returns [] if the plugin is not installed or user is not authenticated.
 * Caches results for 60 seconds.
 */
export function useContextHubMissions(): MissionItem[] {
  const [missions, setMissions] = useState<MissionItem[]>([]);
  const cacheRef = useRef<{ data: MissionItem[]; timestamp: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const api = getContextHubAPI();
      if (!api || !api.isAuthenticated()) {
        setMissions([]);
        return;
      }

      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.timestamp < CACHE_TTL_MS) {
        setMissions(cacheRef.current.data);
        return;
      }

      try {
        const result = await api.listMissions({ limit: 50 });
        if (!cancelled) {
          cacheRef.current = { data: result, timestamp: Date.now() };
          setMissions(result);
        }
      } catch {
        if (!cancelled) setMissions([]);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, []);

  return missions;
}

/**
 * Hook that fetches projects from the ContextHub Plugin API.
 * Returns [] if the plugin is not installed or user is not authenticated.
 * Caches results for 60 seconds.
 */
export function useContextHubProjects(): ProjectItem[] {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const cacheRef = useRef<{ data: ProjectItem[]; timestamp: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      const api = getContextHubAPI();
      if (!api || !api.isAuthenticated()) {
        setProjects([]);
        return;
      }

      const now = Date.now();
      if (cacheRef.current && now - cacheRef.current.timestamp < CACHE_TTL_MS) {
        setProjects(cacheRef.current.data);
        return;
      }

      try {
        const result = await api.listProjects({ limit: 50 });
        if (!cancelled) {
          cacheRef.current = { data: result, timestamp: Date.now() };
          setProjects(result);
        }
      } catch {
        if (!cancelled) setProjects([]);
      }
    }

    fetch();
    return () => {
      cancelled = true;
    };
  }, []);

  return projects;
}
