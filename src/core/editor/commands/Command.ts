import type { Score } from "../../model/index.ts";

/**
 * Undoable notation mutation applied to the semantic score model.
 */
export interface NotationCommand {
  readonly description: string;
  execute(score: Score): Score;
  undo(score: Score): Score;
}
