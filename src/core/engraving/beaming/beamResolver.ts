import type { Measure, NoteEvent, NoteType, Score, TimeSignature } from "../../model/index.js";
import { getActiveClef, pitchToStaffPosition } from "../../model/index.js";
import { computeAutoStemDirection } from "../stems/stemResolver.js";
import { primaryGroupSizeInTicks } from "./groups.js";

export type ResolvedBeamGroup = {
  noteIds: string[];
  beamCounts: number[];
  stemDirection: "up" | "down";
  timeSignature: TimeSignature;
};

const EIGHTH_TICKS = 240;

function isBeamable(noteType: NoteType): boolean {
  return noteType === "eighth" || noteType === "16th" || noteType === "32nd" || noteType === "64th" || noteType === "128th";
}

export function getTimeSignatureAtTick(score: Score, tick: number): TimeSignature {
  const eventTimeSig = [...score.events.values()]
    .filter((event): event is Extract<typeof event, { kind: "timesig" }> => event.kind === "timesig")
    .filter((event) => event.tick <= tick)
    .sort((left, right) => left.tick - right.tick)
    .at(-1)?.time;
  if (eventTimeSig) {
    return eventTimeSig;
  }

  const measureTimeSig = score.measures.find(
    (measure) => tick >= measure.tick && tick < measure.tick + measure.duration
  )?.timeSig;
  return measureTimeSig ?? { numerator: 4, denominator: 4 };
}

/**
 * Computes beam count for a note value.
 */
export function computeBeamCount(noteType: NoteType): number {
  const map: Partial<Record<NoteType, number>> = {
    eighth: 1,
    "16th": 2,
    "32nd": 3,
    "64th": 4,
    "128th": 5
  };
  return map[noteType] ?? 0;
}

function createGroup(score: Score, notes: NoteEvent[]): ResolvedBeamGroup {
  const timeSignature = getTimeSignatureAtTick(score, notes[0]?.tick ?? 0);
  const staffPositions = notes.map((note) => {
    const clef = getActiveClef(score, note.staffId, note.tick);
    return pitchToStaffPosition(note.pitch, clef);
  });

  let stemDirection = computeAutoStemDirection(staffPositions);
  if (notes.some((note) => note.voiceId === 2 || note.voiceId === 4)) {
    const firstVoice = notes[0]?.voiceId;
    if (firstVoice === 2 || firstVoice === 4) {
      stemDirection = "down";
    }
  }

  return {
    noteIds: notes.map((note) => note.id),
    beamCounts: notes.slice(0, -1).map((note, index) => {
      const right = notes[index + 1]!;
      return Math.min(computeBeamCount(note.duration.type), computeBeamCount(right.duration.type));
    }),
    stemDirection,
    timeSignature
  };
}

function noteEventsForVoice(
  score: Score,
  staffId: string,
  voiceId: number,
  measure?: Measure
): NoteEvent[] {
  const key = `${staffId}:${voiceId}`;
  return (score.eventIndex.get(key) ?? [])
    .map((eventId) => score.events.get(eventId))
    .filter((event): event is NoteEvent => Boolean(event && event.kind === "note"))
    .filter((note) => {
      if (!measure) {
        return true;
      }
      return note.tick >= measure.tick && note.tick < measure.tick + measure.duration;
    })
    .sort((left, right) => left.tick - right.tick);
}

/**
 * Resolves beam groups for a given staff and voice, optionally scoped to one measure.
 */
export function resolveBeamGroups(
  score: Score,
  staffId: string,
  voiceId: number,
  measure?: Measure
): ResolvedBeamGroup[] {
  const explicitGroups = [...score.beamGroups.values()]
    .map((group) => group.eventIds.map((eventId) => score.events.get(eventId)))
    .filter((events): events is NoteEvent[] => events.every((event): event is NoteEvent => Boolean(event && event.kind === "note")))
    .filter((notes) => notes.length > 1 && notes.every((note) => note.staffId === staffId && note.voiceId === voiceId))
    .filter((notes) => {
      if (!measure) {
        return true;
      }
      return notes.every(
        (note) => note.tick >= measure.tick && note.tick < measure.tick + measure.duration
      );
    });
  if (explicitGroups.length > 0) {
    return explicitGroups.map((notes) => createGroup(score, notes));
  }

  const noteEvents = noteEventsForVoice(score, staffId, voiceId, measure);
  const result: ResolvedBeamGroup[] = [];
  let current: NoteEvent[] = [];
  let currentBoundary = Number.NaN;

  for (const note of noteEvents) {
    const canBeam = isBeamable(note.duration.type);
    const measureForNote = score.measures.find(
      (candidate) => note.tick >= candidate.tick && note.tick < candidate.tick + candidate.duration
    );
    const measureEndTick = measureForNote ? measureForNote.tick + measureForNote.duration : Number.POSITIVE_INFINITY;
    const timeSignature = getTimeSignatureAtTick(score, note.tick);
    const groupSize = primaryGroupSizeInTicks(timeSignature);
    const thisBoundary = Math.floor((note.tick - (measureForNote?.tick ?? 0)) / groupSize) * groupSize
      + groupSize
      + (measureForNote?.tick ?? 0);

    if (!canBeam) {
      if (current.length > 1) {
        result.push(createGroup(score, current));
      }
      current = [];
      currentBoundary = Number.NaN;
      continue;
    }

    const crossesBoundary = current.length > 0 && note.tick >= currentBoundary;
    const crossesBarline = current.length > 0 && note.tick >= measureEndTick;
    if (crossesBoundary || crossesBarline) {
      if (current.length > 1) {
        result.push(createGroup(score, current));
      }
      current = [];
    }

    current.push(note);
    currentBoundary = thisBoundary;
  }

  if (current.length > 1) {
    result.push(createGroup(score, current));
  }

  return result;
}

export { EIGHTH_TICKS };
