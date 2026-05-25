import type { EngravingElement, EngravingResult } from "../engraving/index.ts";
import type { EditorViewport } from "./EditorState.ts";

/**
 * Renderer port consumed by the editor without importing the rendering module.
 */
export interface EditorRendererPort {
  render(result: EngravingResult, viewport: EditorViewport): void;
  hitTest(screenX: number, screenY: number): EngravingElement | null;
  setHighlights(elementIds: string[]): void;
}

export type NormalizedPointerEvent = {
  screenX: number;
  screenY: number;
  button: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
};

export type NormalizedKeyEvent = {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  preventDefault: () => void;
};
