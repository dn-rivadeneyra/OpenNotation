import {
  createMeasure,
  getActiveTimeSig,
  type KeySignature,
  type Measure,
  type Score,
  type ScoreEvent,
  type TimeSignature
} from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";
import { cloneScore, insertEvent } from "./scoreMutations.ts";

export class InsertMeasureCommand implements NotationCommand {
  readonly description = "Insert measure";
  private insertedMeasureId: string | null = null;

  constructor(private readonly afterMeasureNumber: number) {}

  execute(score: Score): Score {
    const next = cloneScore(score);
    const index = next.measures.findIndex((measure) => measure.number === this.afterMeasureNumber);
    if (index < 0) {
      return score;
    }

    const anchor = next.measures[index]!;
    const timeSig = anchor.timeSig ?? getActiveTimeSig(score, anchor.tick);
    const newMeasure = createMeasure({
      number: anchor.number + 1,
      tick: anchor.tick + anchor.duration,
      timeSig
    });
    this.insertedMeasureId = newMeasure.id;

    const shifted = next.measures.map((measure) => {
      if (measure.number > anchor.number) {
        return {
          ...measure,
          number: measure.number + 1,
          tick: measure.tick + anchor.duration
        };
      }
      return measure;
    });
    shifted.splice(index + 1, 0, newMeasure);
    next.measures = shifted;
    return next;
  }

  undo(score: Score): Score {
    if (!this.insertedMeasureId) {
      return score;
    }
    const next = cloneScore(score);
    const inserted = next.measures.find((measure) => measure.id === this.insertedMeasureId);
    if (!inserted) {
      return score;
    }
    next.measures = next.measures
      .filter((measure) => measure.id !== this.insertedMeasureId)
      .map((measure) => {
        if (measure.number > inserted.number) {
          return {
            ...measure,
            number: measure.number - 1,
            tick: measure.tick - inserted.duration
          };
        }
        return measure;
      });
    return next;
  }
}

export class DeleteMeasureCommand implements NotationCommand {
  readonly description = "Delete measure";
  private removedMeasure: Measure | null = null;
  private removedEvents: ScoreEvent[] = [];
  private shiftedMeasures: Measure[] = [];

  constructor(private readonly measureNumber: number) {}

  execute(score: Score): Score {
    const measure = score.measures.find((candidate) => candidate.number === this.measureNumber);
    if (!measure) {
      return score;
    }

    const next = cloneScore(score);
    this.removedMeasure = measure;
    this.removedEvents = [...next.events.values()].filter(
      (event) => event.tick >= measure.tick && event.tick < measure.tick + measure.duration
    );
    this.shiftedMeasures = next.measures
      .filter((candidate) => candidate.number > measure.number)
      .map((candidate) => ({ ...candidate }));

    for (const event of this.removedEvents) {
      next.events.delete(event.id);
    }
    for (const [key, ids] of next.eventIndex.entries()) {
      next.eventIndex.set(
        key,
        ids.filter((id) => next.events.has(id))
      );
    }

    next.measures = next.measures
      .filter((candidate) => candidate.id !== measure.id)
      .map((candidate) => {
        if (candidate.number > measure.number) {
          return {
            ...candidate,
            number: candidate.number - 1,
            tick: candidate.tick - measure.duration
          };
        }
        return candidate;
      });

    return next;
  }

  undo(score: Score): Score {
    if (!this.removedMeasure) {
      return score;
    }

    const next = cloneScore(score);
    for (const event of this.removedEvents) {
      next.events.set(event.id, event);
      const key = `${event.staffId}:${event.voiceId}`;
      const ids = [...(next.eventIndex.get(key) ?? []), event.id];
      next.eventIndex.set(
        key,
        ids.sort((left, right) => (next.events.get(left)?.tick ?? 0) - (next.events.get(right)?.tick ?? 0))
      );
    }

    const restored = [...next.measures];
    for (const original of this.shiftedMeasures) {
      const index = restored.findIndex((measure) => measure.id === original.id);
      if (index >= 0) {
        restored[index] = original;
      }
    }
    restored.splice(this.measureNumber - 1, 0, this.removedMeasure);
    next.measures = restored.sort((left, right) => left.number - right.number);
    return next;
  }
}

export class ChangeKeySignatureCommand implements NotationCommand {
  readonly description = "Change key signature";
  private previousEventId: string | null = null;
  private insertedId: string | null = null;

  constructor(
    private readonly opts: {
      staffId: string;
      voiceId: number;
      tick: number;
      key: KeySignature;
    }
  ) {}

  execute(score: Score): Score {
    const existing = [...score.events.values()].find(
      (event) => event.kind === "keysig" && event.tick === this.opts.tick && event.staffId === this.opts.staffId
    );
    this.previousEventId = existing?.id ?? null;

    let next = cloneScore(score);
    if (existing && existing.kind === "keysig") {
      next.events.set(existing.id, { ...existing, key: this.opts.key });
      return next;
    }

    const id = `keysig-${this.opts.tick}`;
    this.insertedId = id;
    return insertEvent(next, {
      id,
      kind: "keysig",
      tick: this.opts.tick,
      staffId: this.opts.staffId,
      voiceId: this.opts.voiceId,
      key: this.opts.key,
      cancel: false
    });
  }

  undo(score: Score): Score {
    const next = cloneScore(score);
    if (this.insertedId) {
      next.events.delete(this.insertedId);
      return next;
    }
    if (this.previousEventId) {
      const event = score.events.get(this.previousEventId);
      if (event && event.kind === "keysig") {
        next.events.set(event.id, event);
      }
    }
    return next;
  }
}

export class ChangeTimeSignatureCommand implements NotationCommand {
  readonly description = "Change time signature";
  private previousEventId: string | null = null;
  private insertedId: string | null = null;

  constructor(
    private readonly opts: {
      staffId: string;
      voiceId: number;
      tick: number;
      time: TimeSignature;
    }
  ) {}

  execute(score: Score): Score {
    const existing = [...score.events.values()].find(
      (event) => event.kind === "timesig" && event.tick === this.opts.tick && event.staffId === this.opts.staffId
    );
    this.previousEventId = existing?.id ?? null;

    let next = cloneScore(score);
    if (existing && existing.kind === "timesig") {
      next.events.set(existing.id, { ...existing, time: this.opts.time });
      return next;
    }

    const id = `timesig-${this.opts.tick}`;
    this.insertedId = id;
    return insertEvent(next, {
      id,
      kind: "timesig",
      tick: this.opts.tick,
      staffId: this.opts.staffId,
      voiceId: this.opts.voiceId,
      time: this.opts.time
    });
  }

  undo(score: Score): Score {
    const next = cloneScore(score);
    if (this.insertedId) {
      next.events.delete(this.insertedId);
      return next;
    }
    if (this.previousEventId) {
      const event = score.events.get(this.previousEventId);
      if (event && event.kind === "timesig") {
        next.events.set(event.id, event);
      }
    }
    return next;
  }
}

export class ChangeTempoCommand implements NotationCommand {
  readonly description = "Change tempo";
  private insertedId: string | null = null;

  constructor(
    private readonly opts: {
      staffId: string;
      voiceId: number;
      tick: number;
      bpm: number;
    }
  ) {}

  execute(score: Score): Score {
    const id = `tempo-${this.opts.tick}`;
    this.insertedId = id;
    return insertEvent(cloneScore(score), {
      id,
      kind: "tempo",
      tick: this.opts.tick,
      staffId: this.opts.staffId,
      voiceId: this.opts.voiceId,
      bpm: this.opts.bpm,
      beatUnit: "quarter"
    });
  }

  undo(score: Score): Score {
    if (!this.insertedId) {
      return score;
    }
    const next = cloneScore(score);
    next.events.delete(this.insertedId);
    return next;
  }
}

export class MoveElementCommand implements NotationCommand {
  readonly description = "Move element";
  private previousOffset: { x: number; y: number } | null = null;

  constructor(
    private readonly eventId: string,
    private readonly userOffset: { x: number; y: number }
  ) {}

  execute(score: Score): Score {
    const event = score.events.get(this.eventId);
    if (!event || (event.kind !== "dynamic" && event.kind !== "text")) {
      return score;
    }
    this.previousOffset = event.userOffset;
    const next = cloneScore(score);
    next.events.set(this.eventId, { ...event, userOffset: this.userOffset });
    return next;
  }

  undo(score: Score): Score {
    const event = score.events.get(this.eventId);
    if (!event || (event.kind !== "dynamic" && event.kind !== "text") || !this.previousOffset) {
      return score;
    }
    const next = cloneScore(score);
    next.events.set(this.eventId, { ...event, userOffset: this.previousOffset });
    return next;
  }
}
