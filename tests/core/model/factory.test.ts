import { describe, expect, it } from "vitest";

import {
  TPQ,
  computeTicks,
  createMeasure,
  createMinimalScore,
  createNoteEvent,
  createPart,
  createRestEvent,
  createScore,
  midiToPitch,
  pitchToMidi,
  pitchToStaffPosition
} from "../../../src/core/model/index.js";

describe("model factory", () => {
  it("creates a score with initialized collections", () => {
    const score = createScore({ title: "Suite No. 1" });
    expect(score.metadata.title).toBe("Suite No. 1");
    expect(score.events.size).toBe(0);
    expect(score.measures).toHaveLength(0);
  });

  it("creates a part and requested number of staves", () => {
    const result = createPart({
      name: "Violin I",
      abbreviation: "Vln. I",
      staffCount: 2,
      instrument: { id: "violin", name: "Violin", family: "Strings" }
    });
    expect(result.part.staffIds).toHaveLength(2);
    expect(result.staves).toHaveLength(2);
  });

  it("rejects invalid staff count", () => {
    expect(() =>
      createPart({
        name: "Invalid",
        abbreviation: "Inv",
        staffCount: 0,
        instrument: { id: "piano", name: "Piano", family: "Keyboard" }
      })
    ).toThrow();
  });

  it("creates measure duration from time signature", () => {
    const measure = createMeasure({
      number: 3,
      tick: 3840,
      timeSig: { numerator: 3, denominator: 4 }
    });
    expect(measure.duration).toBe(1440);
  });

  it("rejects invalid measure number", () => {
    expect(() =>
      createMeasure({
        number: 0,
        tick: 0,
        timeSig: { numerator: 4, denominator: 4 }
      })
    ).toThrow();
  });

  it("creates note event defaults", () => {
    const note = createNoteEvent({
      staffId: "s1",
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    expect(note.kind).toBe("note");
    expect(note.tieStart).toBe(false);
    expect(note.articulations).toHaveLength(0);
  });

  it("creates rest event defaults", () => {
    const rest = createRestEvent({
      staffId: "s1",
      voiceId: 2,
      tick: 0,
      duration: { type: "half", dots: 0, ticks: TPQ * 2 }
    });
    expect(rest.kind).toBe("rest");
    expect(rest.hidden).toBeUndefined();
  });

  it("rejects out-of-range voice id", () => {
    expect(() =>
      createNoteEvent({
        staffId: "s1",
        voiceId: 5,
        tick: 0,
        pitch: { step: "C", octave: 4, alter: 0 },
        duration: { type: "quarter", dots: 0, ticks: TPQ }
      })
    ).toThrow();
  });

  it("rejects negative tick", () => {
    expect(() =>
      createRestEvent({
        staffId: "s1",
        voiceId: 1,
        tick: -10,
        duration: { type: "quarter", dots: 0, ticks: TPQ }
      })
    ).toThrow();
  });

  it.each([
    ["whole", 0, TPQ * 4],
    ["half", 0, TPQ * 2],
    ["quarter", 0, TPQ],
    ["eighth", 0, TPQ / 2],
    ["16th", 0, TPQ / 4],
    ["32nd", 0, TPQ / 8],
    ["64th", 0, TPQ / 16],
    ["128th", 0, TPQ / 32]
  ] as const)("computes base ticks for %s", (type, dots, expected) => {
    expect(computeTicks(type, dots)).toBe(expected);
  });

  it.each([
    ["quarter", 1, 720],
    ["quarter", 2, 840],
    ["eighth", 1, 360],
    ["half", 1, 1440],
    ["16th", 2, 210]
  ] as const)("computes dotted ticks for %s with %i dots", (type, dots, expected) => {
    expect(computeTicks(type, dots)).toBe(expected);
  });

  it("computes triplet quarter at custom TPQ", () => {
    expect(computeTicks("quarter", 0, 960)).toBe(960);
  });

  it("rejects negative dots", () => {
    expect(() => computeTicks("quarter", -1)).toThrow();
  });

  it.each([
    [{ step: "C", octave: 4, alter: 0 }, 60],
    [{ step: "A", octave: 4, alter: 0 }, 69],
    [{ step: "F", octave: 3, alter: 1 }, 54],
    [{ step: "B", octave: 3, alter: -1 }, 58]
  ] as const)("converts pitch to midi %j", (pitch, expectedMidi) => {
    expect(pitchToMidi(pitch)).toBe(expectedMidi);
  });

  it("throws when pitch to midi is out of range", () => {
    expect(() => pitchToMidi({ step: "C", octave: 10, alter: 0 })).toThrow();
  });

  it.each([
    [60, { step: "C", octave: 4, alter: 0 }],
    [61, { step: "C", octave: 4, alter: 1 }],
    [67, { step: "G", octave: 4, alter: 0 }],
    [73, { step: "C", octave: 5, alter: 1 }]
  ] as const)("converts midi to canonical pitch %i", (midi, expectedPitch) => {
    expect(midiToPitch(midi)).toEqual(expectedPitch);
  });

  it("throws for invalid midi input", () => {
    expect(() => midiToPitch(128)).toThrow();
  });

  it.each([
    [{ step: "E", octave: 4, alter: 0 }, "treble", 0],
    [{ step: "F", octave: 4, alter: 0 }, "treble", 0.5],
    [{ step: "D", octave: 3, alter: 0 }, "tenor", 0],
    [{ step: "G", octave: 2, alter: 0 }, "bass", 0]
  ] as const)("maps pitch to staff position for %s clef", (pitch, clef, expected) => {
    expect(pitchToStaffPosition(pitch, clef)).toBe(expected);
  });

  it("creates minimal score with required baseline structure", () => {
    const score = createMinimalScore();
    expect(score.parts).toHaveLength(1);
    expect(score.staves).toHaveLength(1);
    expect(score.measures).toHaveLength(4);
    expect(score.events.size).toBeGreaterThanOrEqual(3);
  });
});
