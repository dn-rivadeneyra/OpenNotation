import type { EngravingDefaults, GlyphMetrics } from "./metrics.js";
import type { SmuflName } from "./smufl.js";

export interface IFontAdapter {
  readonly fontFamily: string;
  getGlyphChar(name: SmuflName): string;
  getGlyphMetrics(name: SmuflName): GlyphMetrics;
  readonly engravingDefaults: EngravingDefaults;
  readonly isReady: boolean;
}
