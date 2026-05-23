import { describe, expect, it } from "vitest";

import {
  TPQ,
  createMeasure,
  createMinimalScore,
  tickToMs
} from "../../../src/core/model/index.js";
import { buildTimeMap } from "../../../src/core/temporal/index.js";

describe("temporal timemap", () => {
  it("injects default 120 bpm entry at tick 0", () => {
    const score = createMinimalScore();
    const timeMap = buildTimeMap(score);
    expect(timeMap.entries[0]?.tick).toBe(0);
    expect(timeMap.entries[0]?.bpm).toBe(120);
  });

  it("builds ordered entries from tempo events", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    score.events.set("tempo-a", {
      id: "tempo-a",
      kind: "tempo",
      tick: TPQ * 8,
      staffId,
      voiceId: 1,
      bpm: 90,
      beatUnit: "quarter"
    });
    score.events.set("tempo-b", {
      id: "tempo-b",
      kind: "tempo",
      tick: TPQ * 4,
      staffId,
      voiceId: 1,
      bpm: 100,
      beatUnit: "quarter"
    });

    const timeMap = buildTimeMap(score);
    expect(timeMap.entries.map((entry) => entry.tick)).toEqual([0, TPQ * 4, TPQ * 8]);
  });

  it("shifts realtime correctly after tempo change at measure 5", () => {
    const score = createMinimalScore();
    const measureDuration = TPQ * 4;

    for (let measureNumber = 5; measureNumber <= 8; measureNumber += 1) {
      score.measures.push(
        createMeasure({
          number: measureNumber,
          tick: (measureNumber - 1) * measureDuration,
          timeSig: { numerator: 4, denominator: 4 }
        })
      );
    }

    const staffId = score.staves[0]!.id;
    const measure5Tick = (5 - 1) * measureDuration;
    score.events.set("tempo-measure-5", {
      id: "tempo-measure-5",
      kind: "tempo",
      tick: measure5Tick,
      staffId,
      voiceId: 1,
      bpm: 60,
      beatUnit: "quarter"
    });

    const timeMap = buildTimeMap(score);
    score.timeMap = timeMap;

    expect(tickToMs(score, measure5Tick)).toBeCloseTo(8000, 6);
    expect(tickToMs(score, measure5Tick + measureDuration)).toBeCloseTo(12000, 6);
  });

  it("maps tempo entries to containing measure number", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    score.events.set("tempo-mid", {
      id: "tempo-mid",
      kind: "tempo",
      tick: TPQ * 5,
      staffId,
      voiceId: 1,
      bpm: 110,
      beatUnit: "quarter"
    });

    const timeMap = buildTimeMap(score);
    const entry = timeMap.entries.find((candidate) => candidate.tick === TPQ * 5);
    expect(entry?.measureNumber).toBe(2);
  });
});
