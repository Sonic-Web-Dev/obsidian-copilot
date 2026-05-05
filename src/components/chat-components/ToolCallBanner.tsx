import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ToolResultFormatter } from "@/tools/ToolResultFormatter";
import {
  Check,
  ChevronRight,
  Database,
  FileText,
  FolderTree,
  Globe,
  Heart,
  Rocket,
  Search,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import React, { useMemo, useState } from "react";

const TOOL_ICONS: Record<string, LucideIcon> = {
  ocxp_health: Heart,
  ch_project_repos: FolderTree,
  ch_list_output_templates: FileText,
  ocxp_warmup: Zap,
  ocxp_communities: Globe,
  ocxp_topology: Database,
  ch_mission_start: Rocket,
  localSearch: Search,
  webSearch: Globe,
};

// Animation constants
// The shimmer keyframe is defined in the global CSS (see styles.css)
const SHIMMER_ANIMATION = "shimmer 2s ease-in-out infinite";

interface ToolCallBannerProps {
  toolName: string;
  displayName: string;
  emoji: string;
  isExecuting: boolean;
  result: string | null;
  args?: string | null;
  confirmationMessage?: string | null;
  onAccept?: () => void;
  onReject?: () => void;
}

/**
 * Produce a display-friendly tool result, falling back to raw strings when they are already concise.
 * @param toolName Name of the tool that produced the result
 * @param result Raw tool result string (possibly null if tool still running)
 * @returns Formatted result or null when there is nothing to show yet
 */
const MAX_DISPLAY_CHARS = 5_000;

/**
 * Produce a display-friendly tool result while guarding against oversized payloads.
 * Large strings are summarized instead of rendered to keep the UI responsive.
 * @param toolName Name of the tool that produced the result
 * @param result Raw tool result string (possibly null if tool still running)
 * @returns Formatted result or a guardrail message; null when there is nothing to show yet
 */
const formatToolResult = (toolName: string, result: string | null): string | null => {
  if (!result) {
    return null;
  }

  if (result.length > MAX_DISPLAY_CHARS) {
    return `Tool '${toolName}' returned ${result.length.toLocaleString()} characters. The full output is preserved in chat history but omitted here to keep the UI responsive.`;
  }

  try {
    const formatted = ToolResultFormatter.format(toolName, result);
    if (formatted.length > MAX_DISPLAY_CHARS) {
      return (
        formatted.slice(0, MAX_DISPLAY_CHARS) +
        `\n\n… (truncated ${(formatted.length - MAX_DISPLAY_CHARS).toLocaleString()} characters for display)`
      );
    }
    return formatted;
  } catch {
    return result.length > MAX_DISPLAY_CHARS
      ? `Tool '${toolName}' returned ${result.length.toLocaleString()} characters. The full output is preserved in chat history but omitted here to keep the UI responsive.`
      : result;
  }
};

const formatArgs = (args: string): string => {
  try {
    const parsed = JSON.parse(args);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return args;
  }
};

export const ToolCallBanner: React.FC<ToolCallBannerProps> = ({
  toolName,
  displayName,
  emoji,
  isExecuting,
  result,
  args,
  confirmationMessage,
  onAccept,
  onReject,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const formattedResult = useMemo(() => formatToolResult(toolName, result), [toolName, result]);
  const formattedArgs = useMemo(() => (args ? formatArgs(args) : null), [args]);

  // Defensive check: If we have a result, the tool is definitely done executing
  // This prevents infinite rolling animation if marker update fails or is delayed
  const actuallyExecuting = isExecuting && !result;

  // Always allow expanding completed tool calls
  const canExpand = !actuallyExecuting;

  return (
    <Collapsible
      open={canExpand ? isOpen : false}
      onOpenChange={setIsOpen}
      disabled={!canExpand}
      aria-disabled={!canExpand}
      className="tw-my-3 tw-w-full"
    >
      <div
        className={cn(
          "tw-rounded-md tw-border tw-border-border tw-bg-secondary/50",
          actuallyExecuting && "tw-relative tw-overflow-hidden"
        )}
      >
        {/* Shimmer effect overlay */}
        {actuallyExecuting && (
          <div className="tw-absolute tw-inset-0 tw-z-[1] tw-overflow-hidden">
            <div
              className="tw-absolute tw-inset-0 -tw-translate-x-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)",
                animation: SHIMMER_ANIMATION,
              }}
            />
          </div>
        )}

        <CollapsibleTrigger
          className={cn(
            "tw-flex tw-w-full tw-items-center tw-justify-between tw-px-3 tw-py-2.5 tw-text-sm sm:tw-px-4 sm:tw-py-3",
            canExpand && "hover:tw-bg-secondary/70",
            !canExpand && "tw-cursor-default"
          )}
        >
          <div className="tw-flex tw-items-center tw-gap-2">
            {React.createElement(TOOL_ICONS[toolName] || Wrench, {
              className: "tw-size-4 tw-text-muted",
            })}
            <span className="tw-font-medium">
              {toolName === "readNote"
                ? `${actuallyExecuting ? "Reading" : "Read"} ${displayName}`
                : `${actuallyExecuting ? "Calling" : "Called"} ${displayName}`}
              {actuallyExecuting && toolName !== "readNote" && "..."}
            </span>
            {actuallyExecuting && confirmationMessage && (
              <span className="tw-text-xs tw-text-muted">• {confirmationMessage}...</span>
            )}
          </div>

          <div className="tw-flex tw-items-center tw-gap-2">
            {/* Token estimates (chars/4) shown when completed */}
            {!actuallyExecuting && (args || result) && (
              <span className="tw-font-mono tw-text-[10px] tw-text-muted tw-opacity-70">
                {args ? `${Math.ceil(args.length / 4)}` : "0"}
                {" / "}
                {result ? `${Math.ceil(result.length / 4)}` : "0"}
                {" tok"}
              </span>
            )}

            {!actuallyExecuting && onAccept && onReject && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAccept();
                  }}
                  className="hover:tw-bg-green-rgb/20 tw-rounded tw-p-1"
                  title="Accept"
                >
                  <Check className="tw-size-4 tw-text-success" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject();
                  }}
                  className="hover:tw-bg-red-rgb/20 tw-rounded tw-p-1"
                  title="Reject"
                >
                  <X className="tw-size-4 tw-text-error" />
                </button>
              </>
            )}

            {(canExpand || actuallyExecuting) && (
              <ChevronRight
                className={cn(
                  "tw-size-4 tw-text-muted tw-transition-transform",
                  isOpen && "tw-rotate-90"
                )}
              />
            )}
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="tw-space-y-2 tw-border-t tw-border-border tw-px-3 tw-py-2.5 sm:tw-px-4 sm:tw-py-3">
            {formattedArgs && (
              <div>
                <div className="tw-mb-1 tw-text-xs tw-font-medium tw-text-muted">Request</div>
                <pre className="tw-max-h-48 tw-overflow-auto tw-whitespace-pre-wrap tw-rounded tw-bg-secondary tw-p-2 tw-font-mono tw-text-xs">
                  {formattedArgs}
                </pre>
              </div>
            )}
            {formattedResult && (
              <div>
                <div className="tw-mb-1 tw-text-xs tw-font-medium tw-text-muted">Response</div>
                <pre className="tw-max-h-64 tw-overflow-auto tw-whitespace-pre-wrap tw-rounded tw-bg-secondary tw-p-2 tw-font-mono tw-text-xs">
                  {formattedResult}
                </pre>
              </div>
            )}
            {!formattedArgs && !formattedResult && (
              <div className="tw-text-xs tw-italic tw-text-muted">
                Tool completed (result streamed as text below)
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
