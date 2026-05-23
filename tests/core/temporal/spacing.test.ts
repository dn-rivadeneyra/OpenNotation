import { describe, expect, it } from "vitest";

import {
  TPQ,
  createMinimalScore,
  createNoteEvent
} from "../../../src/core/model/index.js";
import {
  buildSliceMap,
  computeMinimumSliceWidth,
  durationToSpacingWidth
} from "../../../src/core/temporal/index.js";

describe("temporal spacing", () => {
  it("returns quarter-note baseline width at TPQ", () => {
    const width = durationToSpacingWidth(TPQ);
    expect(width).toBeCloseTo(1.8, 6);
  });

  it("returns wider values for longer durations", () => {
    const eighth = durationToSpacingWidth(TPQ / 2);
    const quarter = durationToSpacingWidth(TPQ);
    const half = durationToSpacingWidth(TPQ * 2);
    expect(eighth).toBeLessThan(quarter);
    expect(quarter).toBeLessThan(half);
  });

  it("returns deterministic ratios for common durations", () => {
    const quarter = durationToSpacingWidth(TPQ);
    const dottedQuarter = durationToSpacingWidth((TPQ * 3) / 2);
    const half = durationToSpacingWidth(TPQ * 2);
    expect(dottedQuarter / quarter).toBeCloseTo(Math.pow(1.5, 0.55), 6);
    expect(half / quarter).toBeCloseTo(Math.pow(2, 0.55), 6);
  });

  it("computes minimum slice width from shortest slice event", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;

    const half = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: TPQ,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "half", dots: 0, ticks: TPQ * 2 }
    });
    const eighth = createNoteEvent({
      staffId,
      voiceId: 2,
      tick: TPQ,
      pitch: { step: "E", octave: 4, alter: 0 },
      duration: { type: "eighth", dots: 0, ticks: TPQ / 2 }
    });

    score.events.set(half.id, half);
    score.events.set(eighth.id, eighth);

    const map = buildSliceMap(score);
    const slice = map.sliceByTick.get(TPQ);
    expect(slice).toBeTruthy();

    const width = computeMinimumSliceWidth(slice!, score);
    expect(width).toBeCloseTo(durationToSpacingWidth(TPQ / 2), 6);
  });

  it("returns baseline width when slice contains no durations", () => {
    const score = createMinimalScore();
    score.events.clear();
    score.eventIndex.clear();
    const map = buildSliceMap(score);
    const width = computeMinimumSliceWidth(map.slices[0]!, score);
    expect(width).toBe(0.5);
  });
});
