import { describe, expect, it } from "vitest";

import {
  TPQ,
  computeTicks,
  createMinimalScore,
  createNoteEvent,
  createRestEvent
} from "../../../src/core/model/index.js";
import {
  AddArticulationCommand,
  AddDynamicCommand,
  AddHairpinCommand,
  AddSlurCommand,
  ChangeDurationCommand,
  ChangeKeySignatureCommand,
  ChangePitchCommand,
  ChangeTempoCommand,
  ChangeTimeSignatureCommand,
  DeleteMeasureCommand,
  DeleteNoteCommand,
  InsertMeasureCommand,
  InsertNoteCommand,
  InsertRestCommand,
  MoveElementCommand
} from "../../../src/core/editor/index.js";

function countNotes(score: ReturnType<typeof createMinimalScore>): number {
  return [...score.events.values()].filter((event) => event.kind === "note").length;
}

describe("notation commands", () => {
  it("InsertNoteCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const cmd = new InsertNoteCommand({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const after = cmd.execute(score);
    expect(countNotes(after)).toBe(1);
    const restored = cmd.undo(after);
    expect(countNotes(restored)).toBe(0);
  });

  it("InsertNoteCommand rejects notes that exceed measure duration", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const cmd = new InsertNoteCommand({
      staffId,
      voiceId: 1,
      tick: TPQ * 3,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "half", dots: 0, ticks: TPQ * 2 }
    });
    expect(() => cmd.execute(score)).toThrow(/exceeds measure/i);
  });

  it("DeleteNoteCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const note = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "D", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(note.id, note);
    score.eventIndex.set(`${staffId}:1`, [note.id]);

    const cmd = new DeleteNoteCommand(note.id);
    const after = cmd.execute(score);
    expect(score.events.has(note.id)).toBe(true);
    expect(after.events.has(note.id)).toBe(false);
    expect([...after.events.values()].some((event) => event.kind === "rest")).toBe(true);
    const restored = cmd.undo(after);
    expect(restored.events.has(note.id)).toBe(true);
  });

  it("ChangePitchCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const note = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(note.id, note);
    const cmd = new ChangePitchCommand(note.id, { step: "G", octave: 4, alter: 0 });
    const after = cmd.execute(score);
    const updated = after.events.get(note.id);
    expect(updated?.kind).toBe("note");
    if (updated?.kind === "note") {
      expect(updated.pitch.step).toBe("G");
    }
    const restored = cmd.undo(after);
    const restoredNote = restored.events.get(note.id);
    if (restoredNote?.kind === "note") {
      expect(restoredNote.pitch.step).toBe("C");
    }
  });

  it("ChangeDurationCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const note = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(note.id, note);
    const newDuration = { type: "half" as const, dots: 0, ticks: computeTicks("half", 0) };
    const cmd = new ChangeDurationCommand(note.id, newDuration);
    const after = cmd.execute(score);
    const updated = after.events.get(note.id);
    if (updated?.kind === "note") {
      expect(updated.duration.type).toBe("half");
    }
    const restored = cmd.undo(after);
    const restoredNote = restored.events.get(note.id);
    if (restoredNote?.kind === "note") {
      expect(restoredNote.duration.type).toBe("quarter");
    }
  });

  it("InsertRestCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const cmd = new InsertRestCommand({
      staffId,
      voiceId: 1,
      tick: 0,
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const after = cmd.execute(score);
    expect([...after.events.values()].some((event) => event.kind === "rest")).toBe(true);
    const restored = cmd.undo(after);
    expect([...restored.events.values()].some((event) => event.kind === "rest")).toBe(false);
  });

  it("AddArticulationCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const note = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(note.id, note);
    const cmd = new AddArticulationCommand(note.id, "staccato");
    const after = cmd.execute(score);
    const updated = after.events.get(note.id);
    if (updated?.kind === "note") {
      expect(updated.articulations).toContain("staccato");
    }
    const restored = cmd.undo(after);
    const restoredNote = restored.events.get(note.id);
    if (restoredNote?.kind === "note") {
      expect(restoredNote.articulations).not.toContain("staccato");
    }
  });

  it("AddDynamicCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const cmd = new AddDynamicCommand({ staffId, voiceId: 1, tick: 0, dynamic: "f" });
    const after = cmd.execute(score);
    expect([...after.events.values()].some((event) => event.kind === "dynamic")).toBe(true);
    expect(cmd.undo(after).events.size).toBeLessThan(after.events.size);
  });

  it("AddSlurCommand and AddHairpinCommand execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const n1 = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const n2 = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: TPQ,
      pitch: { step: "D", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(n1.id, n1);
    score.events.set(n2.id, n2);

    const slur = new AddSlurCommand({
      startId: n1.id,
      endId: n2.id,
      staffId,
      voiceId: 1,
      placement: "above"
    });
    const afterSlur = slur.execute(score);
    expect(afterSlur.spanners.size).toBe(1);
    expect(slur.undo(afterSlur).spanners.size).toBe(0);

    const hairpin = new AddHairpinCommand({
      startId: n1.id,
      endId: n2.id,
      staffId,
      voiceId: 1,
      shape: "crescendo"
    });
    const afterHairpin = hairpin.execute(score);
    expect(afterHairpin.spanners.size).toBe(1);
    expect(hairpin.undo(afterHairpin).spanners.size).toBe(0);
  });

  it("measure and signature commands execute/undo roundtrip", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const beforeCount = score.measures.length;

    const insertMeasure = new InsertMeasureCommand(1);
    const withMeasure = insertMeasure.execute(score);
    expect(withMeasure.measures.length).toBe(beforeCount + 1);
    expect(insertMeasure.undo(withMeasure).measures.length).toBe(beforeCount);

    const deleteMeasure = new DeleteMeasureCommand(2);
    const deleted = deleteMeasure.execute(score);
    expect(deleted.measures.length).toBe(beforeCount - 1);
    expect(deleteMeasure.undo(deleted).measures.length).toBe(beforeCount);

    const keyCmd = new ChangeKeySignatureCommand({
      staffId,
      voiceId: 1,
      tick: 0,
      key: { fifths: 1, mode: "major" }
    });
    const withKey = keyCmd.execute(score);
    expect([...withKey.events.values()].some((event) => event.kind === "keysig")).toBe(true);

    const timeCmd = new ChangeTimeSignatureCommand({
      staffId,
      voiceId: 1,
      tick: 0,
      time: { numerator: 3, denominator: 4 }
    });
    const withTime = timeCmd.execute(score);
    expect([...withTime.events.values()].some((event) => event.kind === "timesig")).toBe(true);

    const tempoCmd = new ChangeTempoCommand({ staffId, voiceId: 1, tick: 0, bpm: 96 });
    const withTempo = tempoCmd.execute(score);
    expect([...withTempo.events.values()].some((event) => event.kind === "tempo")).toBe(true);
    expect(tempoCmd.undo(withTempo).events.size).toBeLessThan(withTempo.events.size);
  });

  it("MoveElementCommand stores user offset (UO)", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const dynamicId = "dyn-1";
    score.events.set(dynamicId, {
      id: dynamicId,
      kind: "dynamic",
      staffId,
      voiceId: 1,
      tick: 0,
      dynamic: "mf",
      userOffset: { x: 0, y: 0 }
    });
    const cmd = new MoveElementCommand(dynamicId, { x: 0.5, y: -0.25 });
    const after = cmd.execute(score);
    const updated = after.events.get(dynamicId);
    expect(updated?.kind).toBe("dynamic");
    if (updated?.kind === "dynamic") {
      expect(updated.userOffset).toEqual({ x: 0.5, y: -0.25 });
    }
    const restored = cmd.undo(after);
    const restoredDynamic = restored.events.get(dynamicId);
    if (restoredDynamic?.kind === "dynamic") {
      expect(restoredDynamic.userOffset).toEqual({ x: 0, y: 0 });
    }
  });
});
