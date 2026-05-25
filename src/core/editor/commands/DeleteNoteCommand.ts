import {
  createRestEvent,
  validateEventFitsInMeasure,
  type Duration,
  type NoteEvent,
  type Score
} from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";
import { insertEvent, removeEvent } from "./scoreMutations.ts";

export class DeleteNoteCommand implements NotationCommand {
  readonly description = "Delete note";
  private removed: NoteEvent | null = null;
  private restId: string | null = null;

  constructor(private readonly noteId: string) {}

  execute(score: Score): Score {
    const existing = score.events.get(this.noteId);
    if (!existing || existing.kind !== "note") {
      return score;
    }

    this.removed = existing;
    let next = removeEvent(score, this.noteId).score;
    const rest = createRestEvent({
      staffId: existing.staffId,
      voiceId: existing.voiceId,
      tick: existing.tick,
      duration: existing.duration
    });
    this.restId = rest.id;
    next = insertEvent(next, rest);
    return next;
  }

  undo(score: Score): Score {
    if (!this.removed) {
      return score;
    }
    let next = score;
    if (this.restId) {
      next = removeEvent(next, this.restId).score;
    }
    return insertEvent(next, this.removed);
  }
}

export class InsertRestCommand implements NotationCommand {
  readonly description = "Insert rest";
  private insertedId: string | null = null;

  constructor(
    private readonly opts: {
      staffId: string;
      voiceId: number;
      tick: number;
      duration: Duration;
    }
  ) {}

  execute(score: Score): Score {
    validateEventFitsInMeasure(score, this.opts.tick, this.opts.duration.ticks);

    const rest = createRestEvent(this.opts);
    this.insertedId = rest.id;
    return insertEvent(score, rest);
  }

  undo(score: Score): Score {
    if (!this.insertedId) {
      return score;
    }
    return removeEvent(score, this.insertedId).score;
  }
}
