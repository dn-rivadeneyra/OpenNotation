import { describe, expect, it } from "vitest";

import {
  TPQ,
  createMeasure,
  createMinimalScore,
  createNoteEvent,
  createRestEvent,
  eventFitsInMeasure,
  getActiveClef,
  getActiveKeySignature,
  getActiveTimeSig,
  getChordNotes,
  getEventsInMeasure,
  getMeasureAtTick,
  getSpannersInRange,
  tickToMs
} from "../../../src/core/model/index.js";

describe("model queries", () => {
  it("gets events in a measure for staff/voice", () => {
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
    score.eventIndex.set(`${staffId}:1`, [...(score.eventIndex.get(`${staffId}:1`) ?? []), note.id]);
    const measureId = score.measures[0]!.id;
    const events = getEventsInMeasure(score, measureId, staffId, 1);
    expect(events.some((event) => event.id === note.id)).toBe(true);
  });

  it("returns empty list for unknown measure", () => {
    const score = createMinimalScore();
    const events = getEventsInMeasure(score, "missing", "s1", 1);
    expect(events).toEqual([]);
  });

  it("returns active clef from latest clef event", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    score.events.set("clef-change", {
      id: "clef-change",
      kind: "clef",
      tick: TPQ * 2,
      staffId,
      voiceId: 1,
      clef: "bass",
      line: 4
    });
    expect(getActiveClef(score, staffId, TPQ * 3)).toBe("bass");
  });

  it("falls back to staff default clef", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    expect(getActiveClef(score, staffId, 0)).toBe("treble");
  });

  it("returns active key signature from event stream", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    score.events.set("keysig-g", {
      id: "keysig-g",
      kind: "keysig",
      tick: TPQ * 4,
      staffId,
      voiceId: 1,
      key: { fifths: 1, mode: "major" },
      cancel: false
    });
    expect(getActiveKeySignature(score, TPQ * 5)).toEqual({ fifths: 1, mode: "major" });
  });

  it("defaults to C major key signature when absent", () => {
    const score = createMinimalScore();
    score.events.delete("minimal-keysig-0");
    expect(getActiveKeySignature(score, 0)).toEqual({ fifths: 0, mode: "major" });
  });

  it("returns active time signature from events", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    score.events.set("timesig-change", {
      id: "timesig-change",
      kind: "timesig",
      tick: TPQ * 8,
      staffId,
      voiceId: 1,
      time: { numerator: 3, denominator: 4 }
    });
    expect(getActiveTimeSig(score, TPQ * 9)).toEqual({ numerator: 3, denominator: 4 });
  });

  it("defaults to common time when no time signature exists", () => {
    const score = createMinimalScore();
    score.events.delete("minimal-timesig-0");
    expect(getActiveTimeSig(score, 0)).toEqual({ numerator: 4, denominator: 4 });
  });

  it("finds containing measure at tick", () => {
    const score = createMinimalScore();
    const measure = getMeasureAtTick(score, TPQ * 5);
    expect(measure?.number).toBe(2);
  });

  it("eventFitsInMeasure respects 4/4 measure capacity", () => {
    const score = createMinimalScore();
    const measureDuration = TPQ * 4;
    expect(eventFitsInMeasure(score, 0, TPQ)).toBe(true);
    expect(eventFitsInMeasure(score, measureDuration - TPQ, TPQ)).toBe(true);
    expect(eventFitsInMeasure(score, TPQ * 3, TPQ * 2)).toBe(false);
    expect(eventFitsInMeasure(score, TPQ * 1000, TPQ)).toBe(false);
  });

  it("returns undefined when tick is outside score", () => {
    const score = createMinimalScore();
    const measure = getMeasureAtTick(score, TPQ * 1000);
    expect(measure).toBeUndefined();
  });

  it("returns all notes in a chord by chord id", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const note1 = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    note1.chordId = "chord-1";
    const note2 = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      pitch: { step: "E", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    note2.chordId = "chord-1";
    score.events.set(note1.id, note1);
    score.events.set(note2.id, note2);
    const notes = getChordNotes(score, "chord-1");
    expect(notes).toHaveLength(2);
  });

  it("returns empty chord for unknown chord id", () => {
    const score = createMinimalScore();
    expect(getChordNotes(score, "missing")).toHaveLength(0);
  });

  it("gets spanners overlapping tick range", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const start = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: TPQ,
      pitch: { step: "C", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const end = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: TPQ * 3,
      pitch: { step: "D", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(start.id, start);
    score.events.set(end.id, end);
    score.spanners.set("slur-1", {
      id: "slur-1",
      kind: "slur",
      startId: start.id,
      endId: end.id,
      staffId,
      voiceId: 1,
      placement: "above",
      userOffset: { x: 0, y: 0 }
    });
    const spanners = getSpannersInRange(score, staffId, TPQ * 2, TPQ * 4);
    expect(spanners).toHaveLength(1);
  });

  it("ignores spanners on other staves", () => {
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
    score.spanners.set("slur-2", {
      id: "slur-2",
      kind: "slur",
      startId: n1.id,
      endId: n2.id,
      staffId: "other-staff",
      voiceId: 1,
      placement: "above",
      userOffset: { x: 0, y: 0 }
    });
    expect(getSpannersInRange(score, staffId, 0, TPQ * 2)).toHaveLength(0);
  });

  it("converts ticks to milliseconds from default tempo when time map is empty", () => {
    const score = createMinimalScore();
    score.timeMap.entries = [];
    expect(tickToMs(score, TPQ)).toBeCloseTo(500, 6);
  });

  it("converts ticks to milliseconds using nearest prior timemap anchor", () => {
    const score = createMinimalScore();
    score.timeMap.entries = [
      { tick: 0, measureNumber: 1, beatIndex: 0, bpm: 120, realTimeMs: 0 },
      { tick: TPQ * 4, measureNumber: 2, beatIndex: 0, bpm: 60, realTimeMs: 2000 }
    ];
    expect(tickToMs(score, TPQ * 6)).toBe(4000);
  });

  it("returns later events only from event index in measure query", () => {
    const score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const first = createRestEvent({
      staffId,
      voiceId: 1,
      tick: 0,
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    const second = createRestEvent({
      staffId,
      voiceId: 1,
      tick: TPQ * 4,
      duration: { type: "quarter", dots: 0, ticks: TPQ }
    });
    score.events.set(first.id, first);
    score.events.set(second.id, second);
    score.eventIndex.set(`${staffId}:1`, [first.id, second.id]);
    const events = getEventsInMeasure(score, score.measures[1]!.id, staffId, 1);
    expect(events.map((event) => event.id)).toEqual([second.id]);
  });

  it("handles ad-hoc measure insertion in query operations", () => {
    const score = createMinimalScore();
    score.measures.push(
      createMeasure({
        number: 5,
        tick: TPQ * 16,
        timeSig: { numerator: 4, denominator: 4 }
      })
    );
    const measure = getMeasureAtTick(score, TPQ * 17);
    expect(measure?.number).toBe(5);
  });
});
