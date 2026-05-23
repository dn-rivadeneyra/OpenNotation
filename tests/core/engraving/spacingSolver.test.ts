import { describe, expect, it } from "vitest";

import { durationToSpacingWidth } from "../../../src/core/temporal/index.js";
import { solveSpacing } from "../../../src/core/engraving/index.js";

describe("engraving spacing", () => {
  it("dotted quarter is wider than quarter", () => {
    const quarter = durationToSpacingWidth(480);
    const dottedQuarter = durationToSpacingWidth(720);
    expect(dottedQuarter).toBeGreaterThan(quarter);
  });

  it("solveSpacing returns increasing x positions", () => {
    const result = solveSpacing(
      [
        { tick: 0, minWidth: 1, proportionalWidth: 2, extraWidth: 0 },
        { tick: 240, minWidth: 1, proportionalWidth: 1, extraWidth: 0 },
        { tick: 480, minWidth: 1, proportionalWidth: 1, extraWidth: 0 }
      ],
      10
    );
    expect(result[0]).toBe(0);
    expect(result[1]!).toBeGreaterThan(result[0]!);
    expect(result[2]!).toBeGreaterThan(result[1]!);
  });
});
