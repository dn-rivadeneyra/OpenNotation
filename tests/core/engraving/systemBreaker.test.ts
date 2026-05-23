import { describe, expect, it } from "vitest";

import { createMinimalScore } from "../../../src/core/model/index.js";
import { breakIntoSystems, type LayoutParameters } from "../../../src/core/engraving/index.js";

const layout: LayoutParameters = {
  pageWidth: 40,
  pageHeight: 60,
  marginTop: 2,
  marginBottom: 2,
  marginLeft: 2,
  marginRight: 2,
  staffSpacing: 6,
  systemSpacing: 8,
  spatium: 10,
  minSystemFill: 0.6,
  stretchFactor: 1
};

describe("system breaker", () => {
  it("fits a four-measure score onto two systems", () => {
    const score = createMinimalScore();
    const widths = new Map<string, number>();
    for (const measure of score.measures) {
      widths.set(measure.id, 18);
    }

    const result = breakIntoSystems(score.measures, widths, layout);
    expect(result.systems).toHaveLength(2);
    expect(result.systems[0]?.measureIds).toHaveLength(2);
    expect(result.systems[1]?.measureIds).toHaveLength(2);
  });
});
