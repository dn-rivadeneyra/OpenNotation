import { describe, expect, it } from "vitest";

import { createMinimalScore } from "../../../src/core/model/index.js";
import { pitchFromMousePosition } from "../../../src/core/editor/index.js";
import type { EngravingSystem } from "../../../src/core/engraving/index.js";

describe("pitchFromMouse", () => {
  it("maps staff click to pitch and tick using staff-space coordinates", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const system: EngravingSystem = {
      id: "sys",
      x: 2,
      y: 2,
      width: 80,
      height: 10,
      bracketElements: [],
      staffLines: [{ staffId, x: 0, y: 0, width: 80, lineCount: 5 }],
      measures: [{ measureId: score.measures[0]!.id, x: 0, y: 0, width: 80, elements: [], spanners: [] }]
    };

    const viewport = { pageIndex: 0, scrollY: 0, scale: 1, spatium: 10 };
    const topLineScreenY = (system.y + 0) * viewport.spatium * viewport.scale;
    const result = pitchFromMousePosition(
      20,
      topLineScreenY,
      null,
      system,
      staffId,
      "treble",
      viewport,
      score
    );

    expect(result.pitch.step).toBe("F");
    expect(result.pitch.octave).toBe(5);
    expect(result.tick).toBeGreaterThanOrEqual(0);
  });
});
