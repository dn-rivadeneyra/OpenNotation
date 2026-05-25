import type { Score } from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";
import { cloneScore } from "./scoreMutations.ts";

function createSpannerId(prefix: string): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

export class AddSlurCommand implements NotationCommand {
  readonly description = "Add slur";
  private spannerId: string | null = null;

  constructor(
    private readonly opts: {
      startId: string;
      endId: string;
      staffId: string;
      voiceId: number;
      placement: "above" | "below";
    }
  ) {}

  execute(score: Score): Score {
    const next = cloneScore(score);
    const id = createSpannerId("slur");
    this.spannerId = id;
    next.spanners.set(id, {
      id,
      kind: "slur",
      startId: this.opts.startId,
      endId: this.opts.endId,
      staffId: this.opts.staffId,
      voiceId: this.opts.voiceId,
      placement: this.opts.placement,
      userOffset: { x: 0, y: 0 }
    });
    return next;
  }

  undo(score: Score): Score {
    if (!this.spannerId) {
      return score;
    }
    const next = cloneScore(score);
    next.spanners.delete(this.spannerId);
    return next;
  }
}

export class AddHairpinCommand implements NotationCommand {
  readonly description = "Add hairpin";
  private spannerId: string | null = null;

  constructor(
    private readonly opts: {
      startId: string;
      endId: string;
      staffId: string;
      voiceId: number;
      shape: "crescendo" | "decrescendo";
      spread?: number;
    }
  ) {}

  execute(score: Score): Score {
    const next = cloneScore(score);
    const id = createSpannerId("hairpin");
    this.spannerId = id;
    next.spanners.set(id, {
      id,
      kind: "hairpin",
      startId: this.opts.startId,
      endId: this.opts.endId,
      staffId: this.opts.staffId,
      voiceId: this.opts.voiceId,
      shape: this.opts.shape,
      spread: this.opts.spread ?? 1.5,
      userOffset: { x: 0, y: 0 }
    });
    return next;
  }

  undo(score: Score): Score {
    if (!this.spannerId) {
      return score;
    }
    const next = cloneScore(score);
    next.spanners.delete(this.spannerId);
    return next;
  }
}
