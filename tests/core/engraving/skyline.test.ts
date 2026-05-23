import { describe, expect, it } from "vitest";

import { placeBelowSkyline } from "../../../src/core/engraving/index.js";

describe("skyline collision", () => {
  it("places dynamic and lyric below staff without collision", () => {
    const baseline = { direction: "down" as const, segments: [{ xStart: 0, xEnd: 40, y: 0 }] };
    const dynamic = placeBelowSkyline(baseline, 5, 8, 0.8, 0.4);
    const lyric = placeBelowSkyline(dynamic.updatedSkyline, 5, 8, 0.9, 0.4);

    expect(lyric.y).toBeGreaterThan(dynamic.y);
  });
});
