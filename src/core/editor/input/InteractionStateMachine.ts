import {
  computeTicks,
  getActiveClef,
  type Duration,
  type NoteType,
  type Pitch,
  type Score
} from "../../model/index.ts";
import type { EngravingResult } from "../../engraving/index.ts";
import type { EditorState } from "../EditorState.ts";
import { createNoteEntryState } from "../noteentry/NoteEntryState.ts";
import { emptySelection, extendSelection } from "../selection/Selection.ts";
import type { NormalizedKeyEvent, NormalizedPointerEvent } from "../types.ts";
import { InsertNoteCommand, DeleteNoteCommand } from "../commands/index.ts";
import { pitchFromMousePosition } from "./pitchFromMouse.ts";

export type InteractionDispatch = {
  command?: InsertNoteCommand | DeleteNoteCommand;
  state: Partial<EditorState>;
};

const DURATION_BY_KEY: Record<string, NoteType> = {
  "1": "64th",
  "2": "32nd",
  "3": "16th",
  "4": "eighth",
  "5": "quarter",
  "6": "half",
  "7": "whole",
  "8": "breve"
};

const LETTER_TO_STEP: Record<string, Pitch["step"]> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G"
};

function durationFromKey(key: string): Duration | null {
  const type = DURATION_BY_KEY[key];
  if (!type) {
    return null;
  }
  return { type, dots: 0, ticks: computeTicks(type, 0) };
}

function pitchFromLetter(letter: string, reference: Pitch): Pitch {
  const step = LETTER_TO_STEP[letter.toLowerCase()];
  if (!step) {
    return reference;
  }
  return { step, octave: reference.octave, alter: 0 };
}

/**
 * Routes normalized input events to editor state transitions and commands.
 */
export class InteractionStateMachine {
  /**
   * Handles keyboard input for the current editor mode.
   *
   * @param state Current editor state.
   * @param event Normalized key event.
   * @param score Score root.
   * @returns Dispatch payload with optional command and state patch.
   */
  handleKeyDown(state: EditorState, event: NormalizedKeyEvent, score: Score): InteractionDispatch {
    if (event.key.toLowerCase() === "n" && state.mode === "normal") {
      const staffId = score.staves[0]?.id ?? "";
      return {
        state: {
          mode: "noteEntry",
          noteEntryState: createNoteEntryState({
            staffId,
            voiceId: 1,
            tick: 0,
            duration: { type: "quarter", dots: 0, ticks: computeTicks("quarter", 0) }
          })
        }
      };
    }

    if (event.key === "Escape" && state.mode === "noteEntry") {
      return {
        state: {
          mode: "normal",
          noteEntryState: null
        }
      };
    }

    if (state.mode !== "noteEntry" || !state.noteEntryState) {
      if (event.key === "Delete" && state.selection.type === "single") {
        const eventId = state.selection.elementId;
        const source = score.events.get(eventId);
        if (source?.kind === "note") {
          return {
            command: new DeleteNoteCommand(source.id),
            state: { selection: emptySelection() }
          };
        }
      }
      return { state: {} };
    }

    const duration = durationFromKey(event.key);
    if (duration) {
      return {
        state: {
          noteEntryState: {
            ...state.noteEntryState,
            duration
          }
        }
      };
    }

    const step = LETTER_TO_STEP[event.key.toLowerCase()];
    if (step) {
      const pitch = pitchFromLetter(event.key, { step: "B", octave: 4, alter: 0 });
      const command = new InsertNoteCommand({
        staffId: state.noteEntryState.staffId,
        voiceId: state.noteEntryState.voiceId,
        tick: state.noteEntryState.tick,
        pitch,
        duration: state.noteEntryState.duration
      });
      const nextTick = state.noteEntryState.tick + state.noteEntryState.duration.ticks;
      return {
        command,
        state: {
          noteEntryState: {
            ...state.noteEntryState,
            tick: state.noteEntryState.chordMode ? state.noteEntryState.tick : nextTick
          }
        }
      };
    }

    return { state: {} };
  }

  /**
   * Handles mouse down for selection and note entry.
   *
   * @param state Current editor state.
   * @param event Normalized pointer event.
   * @param engraving Current engraving result.
   * @param score Score root.
   * @param hitElement Optional hit-tested element.
   * @returns Dispatch payload with optional command and state patch.
   */
  handleMouseDown(
    state: EditorState,
    event: NormalizedPointerEvent,
    engraving: EngravingResult,
    score: Score,
    hitElement: { sourceId?: string; type: string } | null
  ): InteractionDispatch {
    const page = engraving.pages[state.viewport.pageIndex];
    const system = page?.systems[0];
    if (!system) {
      return { state: {} };
    }

    if (state.mode === "noteEntry" && state.noteEntryState) {
      const staffId = state.noteEntryState.staffId;
      const clef = getActiveClef(score, staffId, state.noteEntryState.tick);
      const { pitch, tick } = pitchFromMousePosition(
        event.screenX,
        event.screenY,
        hitElement as never,
        system,
        staffId,
        clef,
        state.viewport,
        score
      );
      const command = new InsertNoteCommand({
        staffId,
        voiceId: state.noteEntryState.voiceId,
        tick,
        pitch,
        duration: state.noteEntryState.duration
      });
      return {
        command,
        state: {
          noteEntryState: {
            ...state.noteEntryState,
            tick: state.noteEntryState.chordMode ? state.noteEntryState.tick : tick + state.noteEntryState.duration.ticks
          }
        }
      };
    }

    if (hitElement?.sourceId) {
      const source = score.events.get(hitElement.sourceId);
      if (source) {
        const single = {
          type: "single" as const,
          elementId: source.id,
          staffId: source.staffId,
          tick: source.tick
        };
        return {
          state: {
            selection: event.shiftKey ? extendSelection(state.selection, single) : single
          }
        };
      }
    }

    return { state: { selection: emptySelection() } };
  }
}
