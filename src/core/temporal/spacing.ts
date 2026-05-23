import type { Score } from "../model/index.js";

import type { TemporalSlice } from "./slice.js";

/**
 * Converts duration ticks to proportional spacing width in staff spaces.
 *
 * @param ticks Duration in ticks.
 * @param tpq Ticks per quarter note.
 * @returns Preferred proportional width in staff spaces.
 */
export function durationToSpacingWidth(ticks: number, tpq = 480): number {
  const BASE_QUARTER = 1.8;
  const ratio = ticks / tpq;
  return BASE_QUARTER * Math.pow(ratio, 0.55);
}

/**
 * Computes minimum slice width considering all events at the same tick.
 *
 * @param slice Temporal slice.
 * @param score Score root object.
 * @param tpq Ticks per quarter note.
 * @returns Minimum width in staff spaces.
 */
export function computeMinimumSliceWidth(slice: TemporalSlice, score: Score, tpq = 480): number {
  const BASE = 0.5;
  const durations = slice.events
    .map((sliceEvent) => score.events.get(sliceEvent.eventId))
    .filter((event): event is NonNullable<typeof event> => Boolean(event))
    .map((event) => ("duration" in event ? event.duration.ticks : 0))
    .filter((duration) => duration > 0);

  if (durations.length === 0) {
    return BASE;
  }

  const shortest = Math.min(...durations);
  return Math.max(BASE, durationToSpacingWidth(shortest, tpq));
}
