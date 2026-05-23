import { describe, expect, it } from "vitest";

import {
  TPQ,
  createMinimalScore,
  createNoteEvent
} from "../../../src/core/model/index.js";
import { buildSliceMap } from "../../../src/core/temporal/index.js";

function pushIndexedEvent(
  score: ReturnType<typeof createMinimalScore>,
  event: ReturnType<typeof createNoteEvent>
): void {
  score.events.set(event.id, event);
  const key = `${event.staffId}:${event.voiceId}`;
  const list = score.eventIndex.get(key) ?? [];
  list.push(event.id);
  list.sort((leftId, rightId) => {
    const left = score.events.get(leftId);
    const right = score.events.get(rightId);
    return (left?.tick ?? 0) - (right?.tick ?? 0);
  });
  score.eventIndex.set(key, list);
}

describe("temporal slice builder", () => {
  it("creates a zero slice for empty event map", () => {
    const score = createMinimalScore();
    score.events.clear();
    score.eventIndex.clear();

    const map = buildSliceMap(score);
    expect(map.slices).toHaveLength(1);
    expect(map.slices[0]?.tick).toBe(0);
    expect(map.slices[0]?.events).toHaveLength(0);
  });

  it("builds slices from event starts and ends", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;

    const quarter = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const eighth = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: TPQ,
      pitch: { step: "D", octave: 4, alter: 0 },
      duration: { type: "eighth", dots: 0, ticks: TPQ / 2 }
    });

    pushIndexedEvent(score, quarter);
    pushIndexedEvent(score, eighth);

    const map = buildSliceMap(score);
    const ticks = map.slices.map((slice) => slice.tick);
    expect(ticks).toContain(0);
    expect(ticks).toContain(TPQ);
    expect(map.totalTicks).toBe(TPQ + TPQ / 2);
  });

  it("captures subdivision boundaries across voices", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;

    const voiceOneQuarterAt0 = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const voiceTwoEighthAt0 = createNoteEvent({
      staffId,
      voiceId: 2,
      tick: 0,
      pitch: { step: "E", octave: 4, alter: 0 },
      duration: { type: "eighth", dots: 0, ticks: TPQ / 2 }
    });
    const voiceTwoEighthAt240 = createNoteEvent({
      staffId,
      voiceId: 2,
      tick: TPQ / 2,
      pitch: { step: "F", octave: 4, alter: 0 },
      duration: { type: "eighth", dots: 0, ticks: TPQ / 2 }
    });
    const voiceOneQuarterAt480 = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: TPQ,
      pitch: { step: "G", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });

    pushIndexedEvent(score, voiceOneQuarterAt0);
    pushIndexedEvent(score, voiceTwoEighthAt0);
    pushIndexedEvent(score, voiceTwoEighthAt240);
    pushIndexedEvent(score, voiceOneQuarterAt480);

    const map = buildSliceMap(score);
    expect(map.sliceByTick.has(0)).toBe(true);
    expect(map.sliceByTick.has(TPQ / 2)).toBe(true);
    expect(map.sliceByTick.has(TPQ)).toBe(true);
  });

  it("builds events with per-event duration in slices", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const note = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "A", octave: 4, alter: 0 },
      duration: { type: "half", dots: 0, ticks: TPQ * 2 }
    });
    pushIndexedEvent(score, note);

    const map = buildSliceMap(score);
    const firstSlice = map.slices.find((slice) => slice.tick === 0);
    expect(firstSlice?.events.some((sliceEvent) => sliceEvent.duration === TPQ * 2)).toBe(true);
  });
});
