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

export interface SerializedProjectPillNode extends SerializedBasePillNode {
  type: "project-pill";
  title: string;
}

/**
 * Project pill node for representing ContextHub projects in the editor.
 * Stores the project UUID as value and displays the name.
 * Text content outputs @project:UUID for gateway extraction.
 */
export class ProjectPillNode extends BasePillNode {
  __title: string;

  static getType(): string {
    return "project-pill";
  }

  static clone(node: ProjectPillNode): ProjectPillNode {
    return new ProjectPillNode(node.__value, node.__title, node.__key);
  }

  constructor(projectId: string, title: string, key?: NodeKey) {
    super(projectId, key);
    this.__title = title;
  }

  getClassName(): string {
    return "project-pill-wrapper";
  }

  getDataAttribute(): string {
    return "data-lexical-project-pill";
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (node: HTMLElement) => {
        if (node.hasAttribute("data-lexical-project-pill")) {
          return {
            conversion: convertProjectPillElement,
            priority: 1,
          };
        }
        return null;
      },
    };
  }

  static importJSON(serializedNode: SerializedProjectPillNode): ProjectPillNode {
    const { value, title } = serializedNode;
    return $createProjectPillNode(value, title);
  }

  exportJSON(): SerializedProjectPillNode {
    return {
      ...super.exportJSON(),
      type: "project-pill",
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
    return `@project:${this.__value}`;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement("span");
    element.setAttribute(this.getDataAttribute(), "");
    element.setAttribute("data-pill-value", this.__value);
    element.setAttribute("data-pill-title", this.__title);
    element.textContent = `@project:${this.__value}`;
    return { element };
  }

  getProjectId(): string {
    return this.getValue();
  }

  getTitle(): string {
    return this.__title;
  }
}

function convertProjectPillElement(domNode: HTMLElement): DOMConversionOutput | null {
  const value = domNode.getAttribute("data-pill-value");
  const title = domNode.getAttribute("data-pill-title") || "Project";
  if (value !== null) {
    const node = $createProjectPillNode(value, title);
    return { node };
  }
  return null;
}

export function $createProjectPillNode(projectId: string, title: string): ProjectPillNode {
  return new ProjectPillNode(projectId, title);
}

export function $isProjectPillNode(node: any): node is ProjectPillNode {
  return node instanceof ProjectPillNode;
}

export function $findProjectPills(): ProjectPillNode[] {
  const root = $getRoot();
  const pills: ProjectPillNode[] = [];

  function traverse(node: LexicalNode) {
    if (node instanceof ProjectPillNode) {
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
