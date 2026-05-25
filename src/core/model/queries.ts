import type { NoteEvent, ScoreEvent } from "./events.js";
import type { ClefType, KeySignature, TimeSignature } from "./primitives.js";
import type { Score } from "./score.js";
import type { Measure } from "./structure.js";
import type { Spanner } from "./spanners.js";
import { TPQ } from "./factory.js";

const DEFAULT_KEY_SIGNATURE: KeySignature = { fifths: 0, mode: "major" };
const DEFAULT_TIME_SIGNATURE: TimeSignature = { numerator: 4, denominator: 4 };
const DEFAULT_CLEF: ClefType = "treble";
const CHROMATIC_STEP: Record<NoteEvent["pitch"]["step"], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

function getEventDurationTicks(event: ScoreEvent): number {
  if ("duration" in event) {
    return event.duration.ticks;
  }

  return 0;
}

function getMeasureRange(measure: Measure): { start: number; end: number } {
  return {
    start: measure.tick,
    end: measure.tick + measure.duration
  };
}

/**
 * Gets all events in a measure filtered by staff/voice and ordered by tick.
 *
 * @param score Score root.
 * @param measureId Measure identifier.
 * @param staffId Staff identifier.
 * @param voiceId Voice number.
 * @returns Ordered list of score events within the measure range.
 */
export function getEventsInMeasure(
  score: Score,
  measureId: string,
  staffId: string,
  voiceId: number
): ScoreEvent[] {
  const measure = score.measures.find((candidate) => candidate.id === measureId);
  if (!measure) {
    return [];
  }

  const { start, end } = getMeasureRange(measure);
  const key = `${staffId}:${voiceId}`;
  const eventIds = score.eventIndex.get(key) ?? [];

  const events = eventIds
    .map((eventId) => score.events.get(eventId))
    .filter((event): event is ScoreEvent => Boolean(event))
    .filter((event) => event.tick >= start && event.tick < end)
    .sort((left, right) => left.tick - right.tick);

  return events;
}

/**
 * Gets the clef active at a given staff and tick position.
 *
 * @param score Score root.
 * @param staffId Staff identifier.
 * @param tick Absolute tick position.
 * @returns Active clef at that position.
 */
export function getActiveClef(score: Score, staffId: string, tick: number): ClefType {
  const staff = score.staves.find((candidate) => candidate.id === staffId);
  const defaultClef = staff?.defaultClef ?? DEFAULT_CLEF;

  const clefEvents = [...score.events.values()]
    .filter((event): event is Extract<ScoreEvent, { kind: "clef" }> => event.kind === "clef")
    .filter((event) => event.staffId === staffId && event.tick <= tick)
    .sort((left, right) => left.tick - right.tick);

  return clefEvents.at(-1)?.clef ?? defaultClef;
}

/**
 * Gets the key signature active at a tick position.
 *
 * @param score Score root.
 * @param tick Absolute tick.
 * @returns Key signature in effect.
 */
export function getActiveKeySignature(score: Score, tick: number): KeySignature {
  const keyEvents = [...score.events.values()]
    .filter((event): event is Extract<ScoreEvent, { kind: "keysig" }> => event.kind === "keysig")
    .filter((event) => event.tick <= tick)
    .sort((left, right) => left.tick - right.tick);

  return keyEvents.at(-1)?.key ?? DEFAULT_KEY_SIGNATURE;
}

/**
 * Gets the time signature active at a tick position.
 *
 * @param score Score root.
 * @param tick Absolute tick.
 * @returns Time signature in effect.
 */
export function getActiveTimeSig(score: Score, tick: number): TimeSignature {
  const timeEvents = [...score.events.values()]
    .filter((event): event is Extract<ScoreEvent, { kind: "timesig" }> => event.kind === "timesig")
    .filter((event) => event.tick <= tick)
    .sort((left, right) => left.tick - right.tick);

  return timeEvents.at(-1)?.time ?? DEFAULT_TIME_SIGNATURE;
}

/**
 * Gets the measure containing an absolute tick.
 *
 * @param score Score root.
 * @param tick Absolute tick.
 * @returns Containing measure, if any.
 */
export function getMeasureAtTick(score: Score, tick: number): Measure | undefined {
  return score.measures.find((measure) => tick >= measure.tick && tick < measure.tick + measure.duration);
}

/**
 * Returns whether an event starting at tick with the given duration fits entirely
 * within the containing measure (respecting the active time signature bounds).
 *
 * @param score Score root.
 * @param tick Event start tick.
 * @param durationTicks Event duration in ticks.
 * @returns True when the event does not cross a measure boundary.
 */
export function eventFitsInMeasure(score: Score, tick: number, durationTicks: number): boolean {
  const measure = getMeasureAtTick(score, tick);
  if (!measure) {
    return false;
  }
  return tick + durationTicks <= measure.tick + measure.duration;
}

/**
 * Validates that an event fits within its measure, throwing if it would overflow.
 *
 * @param score Score root.
 * @param tick Event start tick.
 * @param durationTicks Event duration in ticks.
 */
export function validateEventFitsInMeasure(score: Score, tick: number, durationTicks: number): void {
  const measure = getMeasureAtTick(score, tick);
  if (!measure) {
    throw new Error(`Tick ${tick} is not inside any measure.`);
  }
  if (tick + durationTicks > measure.tick + measure.duration) {
    throw new Error(
      `Event exceeds measure ${measure.number} (${measure.duration} ticks allowed by time signature).`
    );
  }
}

/**
 * Gets all notes that belong to the same chord ID.
 *
 * @param score Score root.
 * @param chordId Chord identifier.
 * @returns Chord note list ordered low-to-high by MIDI pitch.
 */
export function getChordNotes(score: Score, chordId: string): NoteEvent[] {
  return [...score.events.values()]
    .filter((event): event is NoteEvent => event.kind === "note")
    .filter((event) => event.chordId === chordId)
    .sort((left, right) => {
      const leftMidi = (left.pitch.octave + 1) * 12 + CHROMATIC_STEP[left.pitch.step] + left.pitch.alter;
      const rightMidi = (right.pitch.octave + 1) * 12 + CHROMATIC_STEP[right.pitch.step] + right.pitch.alter;
      return leftMidi - rightMidi;
    });
}

/**
 * Gets all spanners that overlap a tick range on a specific staff.
 *
 * @param score Score root.
 * @param staffId Staff identifier.
 * @param startTick Inclusive range start.
 * @param endTick Inclusive range end.
 * @returns Spanners touching the range.
 */
export function getSpannersInRange(
  score: Score,
  staffId: string,
  startTick: number,
  endTick: number
): Spanner[] {
  return [...score.spanners.values()].filter((spanner) => {
    if (spanner.staffId !== staffId) {
      return false;
    }

    const startEvent = score.events.get(spanner.startId);
    const endEvent = score.events.get(spanner.endId);
    if (!startEvent || !endEvent) {
      return false;
    }

    const spanStart = Math.min(startEvent.tick, endEvent.tick);
    const spanEnd = Math.max(startEvent.tick, endEvent.tick);
    return spanStart <= endTick && spanEnd >= startTick;
  });
}

/**
 * Converts a score tick to real-time milliseconds using the score time map.
 *
 * @param score Score root.
 * @param tick Absolute tick.
 * @returns Real-time milliseconds from score start.
 */
export function tickToMs(score: Score, tick: number): number {
  if (score.timeMap.entries.length === 0) {
    return ((60000 / 120) / TPQ) * tick;
  }

  const sorted = [...score.timeMap.entries].sort((left, right) => left.tick - right.tick);
  let anchor = sorted[0];
  if (!anchor) {
    return ((60000 / 120) / TPQ) * tick;
  }

  for (const entry of sorted) {
    if (entry.tick <= tick) {
      anchor = entry;
    } else {
      break;
    }
  }

  const msPerTick = (60000 / anchor.bpm) / TPQ;
  return anchor.realTimeMs + (tick - anchor.tick) * msPerTick;
}
