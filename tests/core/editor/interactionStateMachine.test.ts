import { describe, expect, it } from "vitest";

import { TPQ, computeTicks, createMinimalScore } from "../../../src/core/model/index.js";
import {
  CommandHistory,
  InteractionStateMachine,
  createNoteEntryState,
  type EditorState
} from "../../../src/core/editor/index.js";
import type { EngravingResult } from "../../../src/core/engraving/index.js";

function baseState(score: ReturnType<typeof createMinimalScore>): EditorState {
  return {
    score,
    selection: { type: "none" },
    mode: "normal",
    noteEntryState: null,
    playbackState: null,
    viewport: { pageIndex: 0, scrollY: 0, scale: 1, spatium: 10 },
    history: new CommandHistory()
  };
}

const emptyEngraving: EngravingResult = {
  totalPages: 1,
  pages: [
    {
      index: 0,
      width: 100,
      height: 100,
      pageElements: [],
      systems: [
        {
          id: "sys-1",
          x: 2,
          y: 2,
          width: 80,
          height: 10,
          bracketElements: [],
          staffLines: [{ staffId: "staff", x: 0, y: 0, width: 80, lineCount: 5 }],
          measures: [{ measureId: "m1", x: 0, y: 0, width: 80, elements: [], spanners: [] }]
        }
      ]
    }
  ]
};

describe("InteractionStateMachine", () => {
  it("note entry key events produce InsertNoteCommand", () => {
    const score = createMinimalScore();
    score.staves[0]!.id;
    const machine = new InteractionStateMachine();
    let state = baseState(score);

    const enter = machine.handleKeyDown(state, { key: "n", shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: () => {} }, score);
    state = { ...state, ...enter.state, mode: enter.state.mode ?? state.mode, noteEntryState: enter.state.noteEntryState ?? state.noteEntryState };

    const duration = machine.handleKeyDown(state, { key: "5", shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: () => {} }, score);
    state = {
      ...state,
      noteEntryState: duration.state.noteEntryState ?? state.noteEntryState
    };

    const insert = machine.handleKeyDown(state, { key: "c", shiftKey: false, ctrlKey: false, metaKey: false, preventDefault: () => {} }, score);
    expect(insert.command).toBeDefined();
    expect(insert.command?.description).toBe("Insert note");
  });

  it("shift click extends selection to range", () => {
    const score = createMinimalScore();
    const machine = new InteractionStateMachine();
    const staffId = score.staves[0]!.id;
    score.events.set("b", {
      id: "b",
      kind: "note",
      staffId,
      voiceId: 1,
      tick: TPQ,
      pitch: { step: "D", octave: 4, alter: 0 },
      duration: { type: "quarter", dots: 0, ticks: computeTicks("quarter", 0) },
      accidental: null,
      tieStart: false,
      tieEnd: false,
      grace: false,
      graceSlash: false,
      articulations: [],
      technicals: []
    });

    const state: EditorState = {
      ...baseState(score),
      selection: { type: "single", elementId: "a", staffId, tick: 0 }
    };

    const withEvent = machine.handleMouseDown(
      state,
      { screenX: 100, screenY: 100, button: 0, shiftKey: true, ctrlKey: false, metaKey: false },
      emptyEngraving,
      score,
      { sourceId: "b", type: "notehead" }
    );

    expect(withEvent.state.selection?.type).toBe("range");
  });
});
