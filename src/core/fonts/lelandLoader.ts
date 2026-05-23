import type { EngravingDefaults, FontMetrics, GlyphMetrics } from "./metrics.js";

// ... keep all your existing type definitions and helper functions unchanged ...

// 1. Helper to safely grab Node modules without Vite trying to bundle them for the browser
const nativeImport = (mod: string) => {
  if (typeof window === "undefined") {
    return import(/* @vite-ignore */ mod);
  }
  return null;
};

async function loadMetadataText(metadataPath: string): Promise<string> {
  // Browser environment
  if (typeof window !== "undefined") {
    const url = new URL(metadataPath, window.location.origin);
    const response = await fetch(url.href);
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${url.href}`);
    }
    return response.text();
  }

  // Server/Node environment - uses nativeImport + /* @vite-ignore */ to blindfold Vite
  const { readFile } = await nativeImport("node:fs/promises");
  const { isAbsolute, resolve } = await nativeImport("node:path");
  
  const normalized = normalizeLocalPath(metadataPath);
  const localPath = isAbsolute(normalized) ? normalized : resolve(process.cwd(), normalized);
  return readFile(localPath, "utf8");
}

// 2. THE FIX FOR YOUR ERROR: Make sure you explicitly export loadLeland!
export async function loadLeland(metadataPath: string): Promise<FontMetrics> {
  const text = await loadMetadataText(metadataPath);
  const json = JSON.parse(text);
  
  // ... your existing parsing logic that turns json into FontMetrics ...
  return json as FontMetrics; 
}