import type {
  BoundingBox,
  EngravingElement,
  EngravingResult
} from "../engraving/index.ts";

export type FontAdapterLike = {
  readonly fontFamily: string;
  getGlyphChar(name: string): string;
  getGlyphMetrics(name: string): unknown;
  readonly engravingDefaults: Record<string, number>;
  readonly metadata?: {
    glyphsWithAnchors: Record<
      string,
      {
        stemUpSE?: [number, number];
        stemDownNW?: [number, number];
      }
    >;
  };
  readonly isReady: boolean;
};

export type Viewport = {
  pageIndex: number;
  scrollY: number;
  scale: number;
  spatium: number;
};

export type HitElementRecord = {
  element: EngravingElement;
  screenBBox: BoundingBox;
};

export interface IRenderer {
  init(canvas: HTMLCanvasElement, fonts: FontAdapterLike): Promise<void>;
  render(result: EngravingResult, viewport: Viewport): void;
  renderPages(pageIndices: number[], result: EngravingResult, viewport: Viewport): void;
  resize(width: number, height: number): void;
  hitTest(screenX: number, screenY: number): EngravingElement | null;
  setHighlights(elementIds: string[]): void;
  dispose(): void;
}
