import type { Score } from "../../model/index.js";
import { computeMinimumSliceWidth, durationToSpacingWidth, type TemporalSlice } from "../../temporal/index.js";

export type SliceSpring = {
  tick: number;
  minWidth: number;
  proportionalWidth: number;
  extraWidth: number;
};

/**
 * Solves slice x-positions from spring constraints.
 *
 * @param springs Slice spring constraints.
 * @param availableWidth Available measure/system width.
 * @returns X position per spring index.
 */
export function solveSpacing(springs: SliceSpring[], availableWidth: number): number[] {
  if (springs.length === 0) {
    return [];
  }

  const minWidths = springs.map((spring) => spring.minWidth + spring.extraWidth);
  const minSum = minWidths.reduce((sum, width) => sum + width, 0);
  const prefSum = springs.reduce((sum, spring) => sum + spring.proportionalWidth, 0);
  const remaining = Math.max(0, availableWidth - minSum);

  const allocations = springs.map((spring, index) => {
    if (prefSum <= 0 || minSum >= availableWidth) {
      return minWidths[index]!;
    }
    return minWidths[index]! + remaining * (spring.proportionalWidth / prefSum);
  });

  const positions: number[] = [];
  let cursor = 0;
  for (const allocation of allocations) {
    positions.push(cursor);
    cursor += allocation;
  }

  return positions;
}

/**
 * Builds spacing springs from temporal slices and score events.
 *
 * @param slices Temporal slices.
 * @param score Score root.
 * @param tpq Tick resolution.
 * @returns Slice springs.
 */
export function buildSprings(slices: TemporalSlice[], score: Score, tpq = 480): SliceSpring[] {
  return slices.map((slice) => {
    const nonZeroDurations = slice.events
      .map((eventRef) => score.events.get(eventRef.eventId))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .map((event) => ("duration" in event ? event.duration.ticks : 0))
      .filter((ticks) => ticks > 0);

    const shortest = nonZeroDurations.length > 0 ? Math.min(...nonZeroDurations) : tpq;

    // minWidth is a structural floor — enough space for a notehead plus minimal
    // clearance, independent of duration. This is the hard lower bound.
    const minWidth = 1.2;

    // proportionalWidth is the duration-derived preferred width.
    // The solver distributes space above minWidth proportionally to this value,
    // so longer notes get wider gaps than shorter ones.
    const proportionalWidth = durationToSpacingWidth(shortest, tpq);

    // Extra width for density: accidentals and lyrics need more horizontal room.
    const accidentalExtras = slice.events
      .map((eventRef) => score.events.get(eventRef.eventId))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .filter((event) => event.kind === "note" && event.accidental !== null).length;
    const lyricExtras = slice.events
      .map((eventRef) => score.events.get(eventRef.eventId))
      .filter((event): event is NonNullable<typeof event> => Boolean(event))
      .filter((event) => event.kind === "note" && event.lyric !== undefined).length;
    const extraWidth = accidentalExtras * 0.35 + lyricExtras * 0.5;

    return {
      tick: slice.tick,
      minWidth,
      proportionalWidth,
      extraWidth
    };
  });
}