import { describe, expect, it } from "vitest";

import { TPQ, createMinimalScore } from "../../../src/core/model/index.js";
import { CommandHistory, InsertNoteCommand } from "../../../src/core/editor/index.js";

describe("CommandHistory", () => {
  it("restores intermediate states across 10 undo/redo operations", () => {
    const history = new CommandHistory();
    let score = createMinimalScore();
    const staffId = score.staves[0]!.id;
    const snapshots: string[] = [];

    for (let index = 0; index < 10; index += 1) {
      const command = new InsertNoteCommand({
        staffId,
        voiceId: 1,
        tick: index * TPQ,
        pitch: { step: "C", octave: 4, alter: 0 },
        duration: { type: "quarter", dots: 0, ticks: TPQ }
      });
      score = history.execute(command, score);
      snapshots.push([...score.events.keys()].sort().join(","));
    }

    for (let index = 9; index >= 0; index -= 1) {
      const undone = history.undo(score);
      expect(undone).not.toBeNull();
      score = undone!;
      if (index > 0) {
        expect([...score.events.keys()].sort().join(",")).toBe(snapshots[index - 1]);
      }
    }

    for (let index = 0; index < 10; index += 1) {
      const redone = history.redo(score);
      expect(redone).not.toBeNull();
      score = redone!;
      expect([...score.events.keys()].sort().join(",")).toBe(snapshots[index]);
    }
  });
});
