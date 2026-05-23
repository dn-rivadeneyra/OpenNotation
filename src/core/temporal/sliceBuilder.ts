import type { Score, ScoreEvent } from "../model/index.js";

import type { SliceEvent, TemporalSlice, TemporalSliceMap } from "./slice.js";

function eventDurationTicks(event: ScoreEvent): number {
  if ("duration" in event) {
    return event.duration.ticks;
  }
  return 0;
}

/**
 * Builds a deterministic temporal slice map from a score.
 *
 * @param score Score root object.
 * @returns Ordered slice map with tick lookup index.
 */
export function buildSliceMap(score: Score): TemporalSliceMap {
  const tickSet = new Set<number>();
  tickSet.add(0);

  for (const event of score.events.values()) {
    tickSet.add(event.tick);
    const duration = eventDurationTicks(event);
    if (duration > 0) {
      tickSet.add(event.tick + duration);
    }
  }

  const ticks = [...tickSet].sort((left, right) => left - right);
  const eventsByTick = new Map<number, SliceEvent[]>();

  for (const event of score.events.values()) {
    const bucket = eventsByTick.get(event.tick) ?? [];
    bucket.push({
      eventId: event.id,
      staffId: event.staffId,
      voiceId: event.voiceId,
      duration: eventDurationTicks(event)
    });
    eventsByTick.set(event.tick, bucket);
  }

  const slices: TemporalSlice[] = [];
  for (let index = 0; index < ticks.length; index += 1) {
    const tick = ticks[index]!;
    const nextTick = ticks[index + 1] ?? tick;
    const events = eventsByTick.get(tick) ?? [];
    if (events.length > 0 || index === 0) {
      slices.push({
        tick,
        duration: nextTick - tick,
        events
      });
    }
  }

  const sliceByTick = new Map<number, TemporalSlice>();
  for (const slice of slices) {
    sliceByTick.set(slice.tick, slice);
  }

  return {
    slices,
    sliceByTick,
    totalTicks: ticks.at(-1) ?? 0
  };
}
