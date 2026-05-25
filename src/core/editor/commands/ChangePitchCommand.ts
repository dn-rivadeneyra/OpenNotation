import { validateEventFitsInMeasure, type Duration, type Pitch, type Score } from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";
import { replaceEvent } from "./scoreMutations.ts";

export class ChangePitchCommand implements NotationCommand {
  readonly description = "Change pitch";
  private previousPitch: Pitch | null = null;

  constructor(
    private readonly noteId: string,
    private readonly pitch: Pitch
  ) {}

  execute(score: Score): Score {
    const event = score.events.get(this.noteId);
    if (!event || event.kind !== "note") {
      return score;
    }
    this.previousPitch = event.pitch;
    return replaceEvent(score, { ...event, pitch: this.pitch });
  }

  undo(score: Score): Score {
    const event = score.events.get(this.noteId);
    if (!event || event.kind !== "note" || !this.previousPitch) {
      return score;
    }
    return replaceEvent(score, { ...event, pitch: this.previousPitch });
  }
}

export class ChangeDurationCommand implements NotationCommand {
  readonly description = "Change duration";
  private previousDuration: Duration | null = null;

  constructor(
    private readonly noteId: string,
    private readonly duration: Duration
  ) {}

  execute(score: Score): Score {
    const event = score.events.get(this.noteId);
    if (!event || (event.kind !== "note" && event.kind !== "rest")) {
      return score;
    }
    validateEventFitsInMeasure(score, event.tick, this.duration.ticks);
    this.previousDuration = event.duration;
    return replaceEvent(score, { ...event, duration: this.duration });
  }

  undo(score: Score): Score {
    const event = score.events.get(this.noteId);
    if (!event || (event.kind !== "note" && event.kind !== "rest") || !this.previousDuration) {
      return score;
    }
    return replaceEvent(score, { ...event, duration: this.previousDuration });
  }
}
