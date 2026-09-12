import type { ComponentNode } from "@/src/lib/a2ui";

export type OnEvento = (componentId: string, action: string, payload: Record<string, unknown>) => void;

export interface A2UIComponentProps {
  node: ComponentNode;
  onEvento: OnEvento;
}
