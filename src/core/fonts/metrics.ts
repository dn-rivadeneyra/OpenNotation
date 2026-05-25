import type { SmuflName } from "./smufl.js";
import { loadLeland } from "./lelandLoader.js";

export type GlyphMetrics = {
  bBoxNE: { x: number; y: number };
  bBoxSW: { x: number; y: number };
  stemUpSE: { x: number; y: number };
  stemDownNW: { x: number; y: number };
  noteheadOrigin?: { x: number; y: number };
};

export type GlyphAnchors = {
  stemUpSE?: [number, number];
  stemDownNW?: [number, number];
  cutOutNE?: [number, number];
  cutOutNW?: [number, number];
  cutOutSE?: [number, number];
  cutOutSW?: [number, number];
};

export type EngravingDefaults = {
  staffLineThickness: number;
  stemThickness: number;
  beamThickness: number;
  beamSpacing: number;
  legerLineThickness: number;
  legerLineExtension: number;
  slurEndpointThickness: number;
  slurMidpointThickness: number;
  thinBarlineThickness: number;
  thickBarlineThickness: number;
  barlineSeparation: number;
  dotDotDistance: number;
  tupletBracketThickness: number;
};

export type FontMetrics = {
  glyphs: Record<string, GlyphMetrics>;
  engravingDefaults: EngravingDefaults;
  metadata?: {
    glyphsWithAnchors: Record<string, GlyphAnchors>;
  };
};

export type FontLoader = {
  load(fontPath: string): Promise<FontMetrics>;
  isLoaded(): boolean;
  getMetrics(): FontMetrics;
};

class LelandFontLoader implements FontLoader {
  private metrics: FontMetrics | null = null;

  /**
   * Loads Leland OTF and metadata.
   *
   * @param fontPath Local path or URL to Leland.otf.
   * @returns Parsed font metrics.
   */
  async load(fontPath: string): Promise<FontMetrics> {
    const metrics = await loadLeland(fontPath);
    this.metrics = metrics;
    return metrics;
  }

  /**
   * Returns whether metrics are already loaded.
   *
   * @returns True when loaded at least once.
   */
  isLoaded(): boolean {
    return this.metrics !== null;
  }

  /**
   * Gets current loaded metrics.
   *
   * @returns Loaded metrics.
   */
  getMetrics(): FontMetrics {
    if (!this.metrics) {
      throw new Error("Font metrics not loaded.");
    }
    return this.metrics;
  }
}

/**
 * Creates a runtime font loader for Leland.
 *
 * @returns Font loader instance.
 */
export function createFontLoader(): FontLoader {
  return new LelandFontLoader();
}

export type GlyphKey = SmuflName;
