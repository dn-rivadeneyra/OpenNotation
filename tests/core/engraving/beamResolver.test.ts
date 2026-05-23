import { describe, expect, it } from "vitest";

import { TPQ, createMeasure, createMinimalScore, createNoteEvent } from "../../../src/core/model/index.js";
import { resolveBeamGroups } from "../../../src/core/engraving/index.js";

function addNote(
  score: ReturnType<typeof createMinimalScore>,
  tick: number,
  type: "eighth" | "16th",
  voiceId = 1
): void {
  const staffId = score.staves[0]!.id;
  const note = createNoteEvent({
    staffId,
    voiceId,
    tick,
    pitch: { step: "C", octave: 4, alter: 0 },
    duration: { type, dots: 0, ticks: type === "eighth" ? TPQ / 2 : TPQ / 4 }
  });
  score.events.set(note.id, note);
  const key = `${staffId}:${voiceId}`;
  const ids = score.eventIndex.get(key) ?? [];
  ids.push(note.id);
  ids.sort((leftId, rightId) => (score.events.get(leftId)?.tick ?? 0) - (score.events.get(rightId)?.tick ?? 0));
  score.eventIndex.set(key, ids);
}

describe("beam resolver", () => {
  it("beams 4/4 eighth notes in groups of four", () => {
    const score = createMinimalScore();
    score.events.clear();
    score.eventIndex.clear();
    for (let i = 0; i < 8; i += 1) {
      addNote(score, i * (TPQ / 2), "eighth");
    }

    const staffId = score.staves[0]!.id;
    const groups = resolveBeamGroups(score, staffId, 1);
    expect(groups.map((group) => group.noteIds.length)).toEqual([4, 4]);
  });

  it("beams 6/8 notes in groups of three eighths", () => {
    const score = createMinimalScore();
    score.events.clear();
    score.eventIndex.clear();
    score.measures = [
      createMeasure({
        number: 1,
        tick: 0,
        timeSig: { numerator: 6, denominator: 8 }
      })
    ];
    for (let i = 0; i < 6; i += 1) {
      addNote(score, i * (TPQ / 2), "eighth");
    }

    const staffId = score.staves[0]!.id;
    const groups = resolveBeamGroups(score, staffId, 1);
    expect(groups.map((group) => group.noteIds.length)).toEqual([3, 3]);
  });
});
