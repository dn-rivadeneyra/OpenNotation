import type { Score } from "../../model/index.ts";
import type { NotationCommand } from "./Command.ts";

/**
 * Undo/redo stack for notation commands.
 */
export class CommandHistory {
  private stack: NotationCommand[] = [];
  private pointer = -1;

  /**
   * Executes a command and pushes it onto the undo stack.
   *
   * @param command Command to execute.
   * @param score Current score.
   * @returns Score after command execution.
   */
  execute(command: NotationCommand, score: Score): Score {
    this.stack = this.stack.slice(0, this.pointer + 1);
    const newScore = command.execute(score);
    this.stack.push(command);
    this.pointer += 1;
    return newScore;
  }

  /**
   * Undoes the most recent command.
   *
   * @param score Current score.
   * @returns Score before the undone command, or null if empty.
   */
  undo(score: Score): Score | null {
    if (this.pointer < 0) {
      return null;
    }
    const command = this.stack[this.pointer];
    if (!command) {
      return null;
    }
    this.pointer -= 1;
    return command.undo(score);
  }

  /**
   * Redoes the next command on the stack.
   *
   * @param score Current score.
   * @returns Score after redo, or null if unavailable.
   */
  redo(score: Score): Score | null {
    if (this.pointer >= this.stack.length - 1) {
      return null;
    }
    this.pointer += 1;
    const command = this.stack[this.pointer];
    if (!command) {
      return null;
    }
    return command.execute(score);
  }

  get canUndo(): boolean {
    return this.pointer >= 0;
  }

  get canRedo(): boolean {
    return this.pointer < this.stack.length - 1;
  }
}
