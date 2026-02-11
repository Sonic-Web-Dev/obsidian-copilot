import { useMissionContext, setMissionContext } from "./missionContextAtom";
import { Globe, X } from "lucide-react";
import React from "react";

/**
 * Compact banner displayed above chat messages when a mission context override
 * is active (e.g. user opened Copilot from a ContextHub mission).
 *
 * Shows session UUID (truncated), mission ID, and optional project ID.
 * Close button clears the override without switching away from ContextHub mode.
 */
export function MissionContextBanner() {
  const [ctx] = useMissionContext();

  if (!ctx) return null;

  const truncatedSession = ctx.sessionId ? ctx.sessionId.slice(0, 8) : undefined;

  return (
    <div className="tw-mx-2 tw-mb-2 tw-flex tw-items-center tw-gap-2 tw-rounded-md tw-border tw-border-border tw-bg-secondary tw-px-3 tw-py-1.5 tw-text-xs tw-text-muted">
      <Globe className="tw-size-3.5 tw-shrink-0" />
      <span className="tw-font-medium">ContextHub Session</span>
      <span className="tw-text-faint">|</span>
      {ctx.missionId && (
        <>
          <span>Mission: {ctx.missionName || ctx.missionId}</span>
          <span className="tw-text-faint">|</span>
        </>
      )}
      {truncatedSession && (
        <>
          <span>Session: {truncatedSession}...</span>
          {ctx.projectId && <span className="tw-text-faint">|</span>}
        </>
      )}
      {ctx.projectId && <span>Project: {ctx.projectName || ctx.projectId}</span>}
      <button
        onClick={() => setMissionContext(null)}
        className="tw-ml-auto tw-flex tw-items-center tw-rounded tw-p-0.5 hover:tw-bg-primary"
        title="Detach from mission session"
      >
        <X className="tw-size-3.5" />
      </button>
    </div>
  );
}
