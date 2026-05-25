import type { Score, ScoreEvent } from "../../model/index.ts";

/**
 * Creates a shallow structural clone of a score with copied collections.
 *
 * @param score Source score.
 * @returns Cloned score safe for immutable mutation.
 */
export function cloneScore(score: Score): Score {
  return {
    ...score,
    metadata: { ...score.metadata },
    parts: score.parts.map((part) => ({ ...part, staffIds: [...part.staffIds] })),
    staves: score.staves.map((staff) => ({ ...staff })),
    measures: score.measures.map((measure) => ({ ...measure, clefs: { ...measure.clefs } })),
    events: new Map(score.events),
    eventIndex: new Map(
      [...score.eventIndex.entries()].map(([key, ids]) => [key, [...ids]])
    ),
    spanners: new Map(score.spanners),
    beamGroups: new Map(score.beamGroups),
    tuplets: new Map(score.tuplets),
    timeMap: { entries: score.timeMap.entries.map((entry) => ({ ...entry })) }
  };
}

function voiceKey(staffId: string, voiceId: number): string {
  return `${staffId}:${voiceId}`;
}

function sortEventIds(score: Score, ids: string[]): string[] {
  return [...ids].sort(
    (left, right) => (score.events.get(left)?.tick ?? 0) - (score.events.get(right)?.tick ?? 0)
  );
}

/**
 * Inserts an event and updates the voice event index.
 *
 * @param score Score root.
 * @param event Event to insert.
 * @returns Updated score.
 */
export function insertEvent(score: Score, event: ScoreEvent): Score {
  const next = cloneScore(score);
  next.events.set(event.id, event);
  const key = voiceKey(event.staffId, event.voiceId);
  const ids = [...(next.eventIndex.get(key) ?? []), event.id];
  next.eventIndex.set(key, sortEventIds(next, ids));
  return next;
}

/**
 * Removes an event and updates the voice event index.
 *
 * @param score Score root.
 * @param eventId Event identifier.
 * @returns Updated score and removed event if found.
 */
export function removeEvent(
  score: Score,
  eventId: string
): { score: Score; removed: ScoreEvent | undefined } {
  const existing = score.events.get(eventId);
  if (!existing) {
    return { score: cloneScore(score), removed: undefined };
  }

  const next = cloneScore(score);
  next.events.delete(eventId);
  const key = voiceKey(existing.staffId, existing.voiceId);
  const ids = (next.eventIndex.get(key) ?? []).filter((id) => id !== eventId);
  next.eventIndex.set(key, ids);
  return { score: next, removed: existing };
}

/**
 * Replaces an event by id.
 *
 * @param score Score root.
 * @param event Updated event payload.
 * @returns Updated score.
 */
export function replaceEvent(score: Score, event: ScoreEvent): Score {
  const next = cloneScore(score);
  next.events.set(event.id, event);
  return next;
}

/**
 * Removes events overlapping a tick range on a staff/voice.
 *
 * @param score Score root.
 * @param staffId Staff identifier.
 * @param voiceId Voice identifier.
 * @param startTick Range start (inclusive).
 * @param endTick Range end (exclusive).
 * @returns Updated score and removed event ids.
 */
export function removeEventsInRange(
  score: Score,
  staffId: string,
  voiceId: number,
  startTick: number,
  endTick: number
): { score: Score; removedIds: string[] } {
  let next = cloneScore(score);
  const removedIds: string[] = [];
  const key = voiceKey(staffId, voiceId);
  const ids = next.eventIndex.get(key) ?? [];

  for (const eventId of ids) {
    const event = next.events.get(eventId);
    if (!event) {
      continue;
    }
    const eventEnd =
      "duration" in event ? event.tick + event.duration.ticks : event.tick + 1;
    const overlaps = event.tick < endTick && eventEnd > startTick;
    if (overlaps && (event.kind === "note" || event.kind === "rest")) {
      const result = removeEvent(next, eventId);
      next = result.score;
      if (result.removed) {
        removedIds.push(eventId);
      }
    }
  }

  return { score: next, removedIds };
}
