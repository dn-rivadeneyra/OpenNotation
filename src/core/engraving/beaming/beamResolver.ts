import type { NoteEvent, NoteType, Score, TimeSignature } from "../../model/index.js";

export type ResolvedBeamGroup = {
  noteIds: string[];
  beamCounts: number[];
  stemDirection: "up" | "down";
};

const EIGHTH_TICKS = 240;

function isBeamable(noteType: NoteType): boolean {
  return noteType === "eighth" || noteType === "16th" || noteType === "32nd" || noteType === "64th" || noteType === "128th";
}

function getTimeSignatureAtTick(score: Score, tick: number): TimeSignature {
  const eventTimeSig = [...score.events.values()]
    .filter((event): event is Extract<typeof event, { kind: "timesig" }> => event.kind === "timesig")
    .filter((event) => event.tick <= tick)
    .sort((left, right) => left.tick - right.tick)
    .at(-1)?.time;
  if (eventTimeSig) {
    return eventTimeSig;
  }

  const measureTimeSig = score.measures.find((measure) => tick >= measure.tick && tick < measure.tick + measure.duration)?.timeSig;
  return measureTimeSig ?? { numerator: 4, denominator: 4 };
}

function defaultGroupSizeInTicks(timeSig: TimeSignature): number {
  if (timeSig.denominator === 8 && timeSig.numerator % 3 === 0 && timeSig.numerator >= 6) {
    return EIGHTH_TICKS * 3;
  }

  if (timeSig.denominator === 4 && timeSig.numerator === 4) {
    return EIGHTH_TICKS * 4;
  }

  if (timeSig.denominator === 4 && timeSig.numerator === 3) {
    return EIGHTH_TICKS * 2;
  }

  const beatTicks = (480 * 4) / timeSig.denominator;
  return Math.max(EIGHTH_TICKS, beatTicks);
}

/**
 * Computes beam count for a note value.
 *
 * @param noteType Note type.
 * @returns Number of beams.
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

function createGroup(notes: NoteEvent[]): ResolvedBeamGroup {
  return {
    noteIds: notes.map((note) => note.id),
    beamCounts: notes.slice(0, -1).map((note, index) => {
      const right = notes[index + 1]!;
      return Math.min(computeBeamCount(note.duration.type), computeBeamCount(right.duration.type));
    }),
    stemDirection: notes[0]?.voiceId === 2 || notes[0]?.voiceId === 4 ? "down" : "up"
  };
}

/**
 * Resolves beam groups for a given staff and voice.
 *
 * @param score Score root.
 * @param staffId Staff identifier.
 * @param voiceId Voice identifier.
 * @returns Deterministic beam groups.
 */
export function resolveBeamGroups(score: Score, staffId: string, voiceId: number): ResolvedBeamGroup[] {
  const explicitGroups = [...score.beamGroups.values()]
    .map((group) => group.eventIds.map((eventId) => score.events.get(eventId)))
    .filter((events): events is NoteEvent[] => events.every((event): event is NoteEvent => Boolean(event && event.kind === "note")))
    .filter((notes) => notes.length > 1 && notes.every((note) => note.staffId === staffId && note.voiceId === voiceId));
  if (explicitGroups.length > 0) {
    return explicitGroups.map((notes) => createGroup(notes));
  }

  const key = `${staffId}:${voiceId}`;
  const noteEvents = (score.eventIndex.get(key) ?? [])
    .map((eventId) => score.events.get(eventId))
    .filter((event): event is NoteEvent => Boolean(event && event.kind === "note"))
    .sort((left, right) => left.tick - right.tick);

  const result: ResolvedBeamGroup[] = [];
  let current: NoteEvent[] = [];
  let currentBoundary = Number.NaN;

  for (const note of noteEvents) {
    const canBeam = isBeamable(note.duration.type);
    const measure = score.measures.find((candidate) => note.tick >= candidate.tick && note.tick < candidate.tick + candidate.duration);
    const measureEndTick = measure ? measure.tick + measure.duration : Number.POSITIVE_INFINITY;
    const groupSize = defaultGroupSizeInTicks(getTimeSignatureAtTick(score, note.tick));
    const thisBoundary = Math.floor(note.tick / groupSize) * groupSize + groupSize;

    if (!canBeam) {
      if (current.length > 1) {
        result.push(createGroup(current));
      }
      current = [];
      currentBoundary = Number.NaN;
      continue;
    }

    const crossesBoundary = current.length > 0 && note.tick >= currentBoundary;
    const crossesBarline = current.length > 0 && note.tick >= measureEndTick;
    if (crossesBoundary || crossesBarline) {
      if (current.length > 1) {
        result.push(createGroup(current));
      }
      current = [];
    }

    current.push(note);
    currentBoundary = thisBoundary;
  }

  if (current.length > 1) {
    result.push(createGroup(current));
  }

  return result;
}
