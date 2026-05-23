import { describe, expect, it } from "vitest";

import { createFontLoader, glyphChar, LelandFontAdapter } from "../../../src/core/fonts/index.js";

describe("fonts phase 4", () => {
  it("glyphChar(noteheadBlack) returns expected unicode character", () => {
    expect(glyphChar("noteheadBlack")).toBe("\uE0A4");
  });

  it("getGlyphMetrics(noteheadBlack) returns bbox dimensions", async () => {
    const loader = createFontLoader();
    const fontPath = new URL("../../../fonts/Leland.otf", import.meta.url).pathname;
    const metrics = await loader.load(fontPath);
    const adapter = new LelandFontAdapter(metrics);

    const notehead = adapter.getGlyphMetrics("noteheadBlack");
    expect(notehead.bBoxNE.x).toBeCloseTo(1.3, 3);
    expect(notehead.bBoxSW.y).toBeCloseTo(-0.532, 3);
  });
});