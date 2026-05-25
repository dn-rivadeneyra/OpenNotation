import {
  createNoteEvent,
  validateEventFitsInMeasure,
  type Duration,
  type Pitch,
  type Score,
  type ScoreEvent
} from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";
import { insertEvent, removeEvent, removeEventsInRange } from "./scoreMutations.ts";

export class InsertNoteCommand implements NotationCommand {
  readonly description = "Insert note";
  private insertedId: string | null = null;
  private persistedNote: ReturnType<typeof createNoteEvent> | null = null;
  private removedEvents: ScoreEvent[] = [];

  constructor(
    private readonly opts: {
      staffId: string;
      voiceId: number;
      tick: number;
      pitch: Pitch;
      duration: Duration;
    }
  ) {}

  execute(score: Score): Score {
    validateEventFitsInMeasure(score, this.opts.tick, this.opts.duration.ticks);

    const endTick = this.opts.tick + this.opts.duration.ticks;
    const cleared = removeEventsInRange(
      score,
      this.opts.staffId,
      this.opts.voiceId,
      this.opts.tick,
      endTick
    );

    if (!this.persistedNote) {
      this.removedEvents = cleared.removedIds
        .map((id) => score.events.get(id))
        .filter((event): event is ScoreEvent => Boolean(event));
      this.persistedNote = createNoteEvent(this.opts);
      this.insertedId = this.persistedNote.id;
    }

    return insertEvent(cleared.score, this.persistedNote);
  }

  undo(score: Score): Score {
    if (!this.insertedId) {
      return score;
    }
    let next = removeEvent(score, this.insertedId).score;
    for (const removed of this.removedEvents) {
      next = insertEvent(next, removed);
    }
    return next;
  }
}
