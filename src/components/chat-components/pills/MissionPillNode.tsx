import React from "react";
import {
  $getRoot,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  LexicalNode,
  NodeKey,
} from "lexical";
import { BasePillNode, SerializedBasePillNode } from "./BasePillNode";
import { TruncatedPillText } from "./TruncatedPillText";
import { PillBadge } from "./PillBadge";

export interface SerializedMissionPillNode extends SerializedBasePillNode {
  type: "mission-pill";
  title: string;
}

/**
 * Mission pill node for representing ContextHub missions in the editor.
 * Stores the mission UUID as value and displays the title.
 * Text content outputs @mission:UUID for gateway extraction.
 */
export class MissionPillNode extends BasePillNode {
  __title: string;

  static getType(): string {
    return "mission-pill";
  }

  static clone(node: MissionPillNode): MissionPillNode {
    return new MissionPillNode(node.__value, node.__title, node.__key);
  }

  constructor(missionId: string, title: string, key?: NodeKey) {
    super(missionId, key);
    this.__title = title;
  }

  getClassName(): string {
    return "mission-pill-wrapper";
  }

  getDataAttribute(): string {
    return "data-lexical-mission-pill";
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        if (node.hasAttribute("data-lexical-mission-pill")) {
          return {
            conversion: convertMissionPillElement,
            priority: 1,
          };
        }
        return null;
      },
    };
  }

  static importJSON(serializedNode: SerializedMissionPillNode): MissionPillNode {
    const { value, title } = serializedNode;
    return $createMissionPillNode(value, title);
  }

  exportJSON(): SerializedMissionPillNode {
    return {
      ...super.exportJSON(),
      type: "mission-pill",
      title: this.__title,
    };
  }

  decorate(): JSX.Element {
    return (
      <PillBadge>
        <TruncatedPillText content={this.__title} openBracket="" closeBracket="" />
      </PillBadge>
    );
  }

  getTextContent(): string {
    return `@mission:${this.__value}`;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute(this.getDataAttribute(), "");
    element.setAttribute("data-pill-value", this.__value);
    element.setAttribute("data-pill-title", this.__title);
    element.textContent = `@mission:${this.__value}`;
    return { element };
  }

  getMissionId(): string {
    return this.getValue();
  }

  getTitle(): string {
    return this.__title;
  }
}

function convertMissionPillElement(domNode: HTMLElement): DOMConversionOutput | null {
  const value = domNode.getAttribute("data-pill-value");
  const title = domNode.getAttribute("data-pill-title") || "Mission";
  if (value !== null) {
    const node = $createMissionPillNode(value, title);
    return { node };
  }
  return null;
}

export function $createMissionPillNode(missionId: string, title: string): MissionPillNode {
  return new MissionPillNode(missionId, title);
}

export function $isMissionPillNode(node: any): node is MissionPillNode {
  return node instanceof MissionPillNode;
}

export function $findMissionPills(): MissionPillNode[] {
  const root = $getRoot();
  const pills: MissionPillNode[] = [];

  function traverse(node: LexicalNode) {
    if (node instanceof MissionPillNode) {
      pills.push(node);
    }

    if ("getChildren" in node && typeof node.getChildren === "function") {
      const children = node.getChildren();
      for (const child of children) {
        traverse(child);
      }
    }
  }

  traverse(root);
  return pills;
}
