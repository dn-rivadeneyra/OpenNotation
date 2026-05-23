import type { Score, TempoEvent, TimeMap, TimeMapEntry } from "../model/index.js";
import { getMeasureAtTick } from "../model/index.js";

type TempoPoint = {
  tick: number;
  bpm: number;
};

/**
 * Builds a tick-to-realtime map from score tempo events.
 *
 * @param score Score root object.
 * @param tpq Ticks per quarter note.
 * @returns Time map entries sorted by tick.
 */
export function buildTimeMap(score: Score, tpq = 480): TimeMap {
  const tempoPoints = [...score.events.values()]
    .filter((event): event is TempoEvent => event.kind === "tempo")
    .map<TempoPoint>((event) => ({ tick: event.tick, bpm: event.bpm }))
    .sort((left, right) => left.tick - right.tick);

  if (!tempoPoints.some((tempo) => tempo.tick === 0)) {
    tempoPoints.unshift({ tick: 0, bpm: 120 });
  }

  const entries: TimeMapEntry[] = [];
  let currentBpm = 120;
  let currentRealTimeMs = 0;
  let currentTick = 0;
  const msPerTick = (bpm: number): number => (60000 / bpm) / tpq;

  for (const tempo of tempoPoints) {
    if (tempo.tick > currentTick) {
      currentRealTimeMs += (tempo.tick - currentTick) * msPerTick(currentBpm);
    }

    currentBpm = tempo.bpm;
    currentTick = tempo.tick;
    const measure = getMeasureAtTick(score, tempo.tick);

    entries.push({
      tick: tempo.tick,
      measureNumber: measure?.number ?? 1,
      beatIndex: 0,
      bpm: currentBpm,
      realTimeMs: currentRealTimeMs
    });
  }

  return { entries };
}
