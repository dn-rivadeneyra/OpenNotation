import type { ArticulationType, DynamicType, Score } from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";
import { cloneScore, insertEvent, replaceEvent } from "./scoreMutations.ts";

export class AddArticulationCommand implements NotationCommand {
  readonly description = "Add articulation";
  private hadArticulation = false;

  constructor(
    private readonly noteId: string,
    private readonly articulation: ArticulationType
  ) {}

  execute(score: Score): Score {
    const event = score.events.get(this.noteId);
    if (!event || event.kind !== "note") {
      return score;
    }
    this.hadArticulation = event.articulations.includes(this.articulation);
    if (this.hadArticulation) {
      return score;
    }
    return replaceEvent(score, {
      ...event,
      articulations: [...event.articulations, this.articulation]
    });
  }

  undo(score: Score): Score {
    const event = score.events.get(this.noteId);
    if (!event || event.kind !== "note" || this.hadArticulation) {
      return score;
    }
    return replaceEvent(score, {
      ...event,
      articulations: event.articulations.filter((item) => item !== this.articulation)
    });
  }
}

export class AddDynamicCommand implements NotationCommand {
  readonly description = "Add dynamic";
  private insertedId: string | null = null;

  constructor(
    private readonly opts: {
      staffId: string;
      voiceId: number;
      tick: number;
      dynamic: DynamicType;
    }
  ) {}

  execute(score: Score): Score {
    const id = `dynamic-${this.opts.tick}-${this.opts.dynamic}`;
    this.insertedId = id;
    return insertEvent(score, {
      id,
      kind: "dynamic",
      staffId: this.opts.staffId,
      voiceId: this.opts.voiceId,
      tick: this.opts.tick,
      dynamic: this.opts.dynamic,
      userOffset: { x: 0, y: 0 }
    });
  }

  undo(score: Score): Score {
    if (!this.insertedId) {
      return score;
    }
    const next = cloneScore(score);
    next.events.delete(this.insertedId);
    const key = `${this.opts.staffId}:${this.opts.voiceId}`;
    next.eventIndex.set(
      key,
      (next.eventIndex.get(key) ?? []).filter((id) => id !== this.insertedId)
    );
    return next;
  }
}
