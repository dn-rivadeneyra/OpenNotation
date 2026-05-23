import type { IFontAdapter } from "./IFontAdapter.js";
import type { EngravingDefaults, FontMetrics, GlyphMetrics } from "./metrics.js";
import { glyphChar, type SmuflName } from "./smufl.js";

/**
 * Default SMuFL adapter backed by loaded Leland metrics.
 */
export class LelandFontAdapter implements IFontAdapter {
  readonly fontFamily = "Leland";
  readonly isReady: boolean;

  constructor(private readonly metrics: FontMetrics | null) {
    this.isReady = metrics !== null;
  }

  /**
   * Gets unicode character for a SMuFL glyph name.
   *
   * @param name SMuFL glyph name.
   * @returns Unicode glyph character.
   */
  getGlyphChar(name: SmuflName): string {
    return glyphChar(name);
  }

  /**
   * Gets normalized glyph metrics.
   *
   * @param name SMuFL glyph name.
   * @returns Glyph metric record.
   */
  getGlyphMetrics(name: SmuflName): GlyphMetrics {
    if (!this.metrics) {
      throw new Error("Leland metrics not loaded.");
    }
    const metrics = this.metrics.glyphs[name];
    if (!metrics) {
      throw new Error(`Missing glyph metrics: ${name}`);
    }
    return metrics;
  }

  /**
   * Gets engraving defaults from Leland metadata.
   */
  get engravingDefaults(): EngravingDefaults {
    if (!this.metrics) {
      throw new Error("Leland metrics not loaded.");
    }
    return this.metrics.engravingDefaults;
  }
}
