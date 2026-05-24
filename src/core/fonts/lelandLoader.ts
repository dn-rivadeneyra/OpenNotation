import type { FontMetrics } from "./types.js";

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

// ---------------------------------------------------------------------------
// parseMetadata — exported so the browser demo can call it directly
// ---------------------------------------------------------------------------

export function parseMetadata(raw: unknown): FontMetrics {
  const json = raw as Record<string, unknown>;

  return {
    glyphs: (json["glyphs"] as Record<string, unknown>) ?? {},
    engravingDefaults:
      (json["engravingDefaults"] as Record<string, number>) ?? {},
    metadata: {
      glyphsWithAnchors:
        (json["glyphsWithAnchors"] as Record<
          string,
          Record<string, [number, number]>
        >) ?? {}
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