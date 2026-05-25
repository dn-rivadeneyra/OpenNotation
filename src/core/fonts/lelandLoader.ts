import type { EngravingDefaults, FontMetrics, GlyphAnchors, GlyphMetrics } from "./metrics.ts";

// ---------------------------------------------------------------------------
// Path helpers — loaded dynamically so Vite never bundles Node modules
// ---------------------------------------------------------------------------

function normalizeLocalPath(p: string): string {
  // On Windows, strip leading slash from paths like /C:/Users/...
  if (/^\/[A-Za-z]:/.test(p)) {
    return p.slice(1);
  }
  return p;
}

async function loadMetadataText(metadataPath: string): Promise<string> {
  // Browser: always use fetch
  if (typeof window !== "undefined") {
    const url = new URL(metadataPath, window.location.origin);
    const response = await fetch(url.href);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${url.href}`);
    }
    return response.text();
  }

  // Node.js: dynamic import so Vite never bundles these
  const { readFile } = await import(/* @vite-ignore */ "node:fs/promises");
  const { isAbsolute, resolve } = await import(/* @vite-ignore */ "node:path");
  const normalized = normalizeLocalPath(metadataPath);
  const localPath = isAbsolute(normalized)
    ? normalized
    : resolve(process.cwd(), normalized);
  return readFile(localPath, "utf8");
}

type RawBBox = { bBoxNE?: [number, number]; bBoxSW?: [number, number] };

function toPoint(pair: [number, number] | undefined, fallback: { x: number; y: number }): {
  x: number;
  y: number;
} {
  if (!pair) {
    return fallback;
  }
  return { x: pair[0], y: pair[1] };
}

function buildGlyphMetrics(
  bbox: RawBBox,
  anchors: GlyphAnchors | undefined
): GlyphMetrics {
  return {
    bBoxNE: toPoint(bbox.bBoxNE, { x: 0, y: 0 }),
    bBoxSW: toPoint(bbox.bBoxSW, { x: 0, y: 0 }),
    stemUpSE: toPoint(anchors?.stemUpSE, { x: 0, y: 0 }),
    stemDownNW: toPoint(anchors?.stemDownNW, { x: 0, y: 0 })
  };
}

const DEFAULT_ENGRAVING_DEFAULTS: EngravingDefaults = {
  staffLineThickness: 0.11,
  stemThickness: 0.1,
  beamThickness: 0.5,
  beamSpacing: 0.25,
  legerLineThickness: 0.16,
  legerLineExtension: 0.33,
  slurEndpointThickness: 0.05,
  slurMidpointThickness: 0.21,
  thinBarlineThickness: 0.18,
  thickBarlineThickness: 0.55,
  barlineSeparation: 0.37,
  dotDotDistance: 0.33,
  tupletBracketThickness: 0.1
};

function parseEngravingDefaults(raw: Record<string, unknown> | undefined): EngravingDefaults {
  const source = raw ?? {};
  return {
    staffLineThickness:
      (source.staffLineThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.staffLineThickness,
    stemThickness:
      (source.stemThickness as number | undefined) ?? DEFAULT_ENGRAVING_DEFAULTS.stemThickness,
    beamThickness:
      (source.beamThickness as number | undefined) ?? DEFAULT_ENGRAVING_DEFAULTS.beamThickness,
    beamSpacing:
      (source.beamSpacing as number | undefined) ?? DEFAULT_ENGRAVING_DEFAULTS.beamSpacing,
    legerLineThickness:
      (source.legerLineThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.legerLineThickness,
    legerLineExtension:
      (source.legerLineExtension as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.legerLineExtension,
    slurEndpointThickness:
      (source.slurEndpointThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.slurEndpointThickness,
    slurMidpointThickness:
      (source.slurMidpointThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.slurMidpointThickness,
    thinBarlineThickness:
      (source.thinBarlineThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.thinBarlineThickness,
    thickBarlineThickness:
      (source.thickBarlineThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.thickBarlineThickness,
    barlineSeparation:
      (source.barlineSeparation as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.barlineSeparation,
    dotDotDistance:
      (source.dotDotDistance as number | undefined) ?? DEFAULT_ENGRAVING_DEFAULTS.dotDotDistance,
    tupletBracketThickness:
      (source.tupletBracketThickness as number | undefined) ??
      DEFAULT_ENGRAVING_DEFAULTS.tupletBracketThickness
  };
}

// ---------------------------------------------------------------------------
// parseMetadata — exported so the browser demo can call it directly
// ---------------------------------------------------------------------------

export function parseMetadata(raw: unknown): FontMetrics {
  const json = raw as Record<string, unknown>;
  const glyphBBoxes = (json.glyphBBoxes as Record<string, RawBBox> | undefined) ?? {};
  const glyphsWithAnchors =
    (json.glyphsWithAnchors as Record<string, GlyphAnchors> | undefined) ?? {};

  const glyphs: Record<string, GlyphMetrics> = {};
  for (const [name, bbox] of Object.entries(glyphBBoxes)) {
    glyphs[name] = buildGlyphMetrics(bbox, glyphsWithAnchors[name]);
  }

  return {
    glyphs,
    engravingDefaults: parseEngravingDefaults(
      json.engravingDefaults as Record<string, unknown> | undefined
    ),
    metadata: {
      glyphsWithAnchors
    }
  };
}

// ---------------------------------------------------------------------------
// loadLeland — main entry point
// ---------------------------------------------------------------------------

export async function loadLeland(metadataPath: string): Promise<FontMetrics> {
  // In the browser the font OTF must be registered separately via FontFace.
  // This function only loads the metadata JSON.
  const metaPath = metadataPath.replace(/\.otf$/i, ".metadata.json");
  const text = await loadMetadataText(metaPath);
  const json = JSON.parse(text) as unknown;
  return parseMetadata(json);
}
