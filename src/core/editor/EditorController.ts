import { engrave, type EngravingResult, type FontMetrics, type LayoutParameters } from "../engraving/index.ts";
import type { Score } from "../model/index.ts";
import { CommandHistory } from "./commands/CommandHistory.ts";
import type { NotationCommand } from "./commands/Command.ts";
import type { EditorState, EditorViewport } from "./EditorState.ts";
import { emptySelection } from "./selection/Selection.ts";
import { InteractionStateMachine } from "./input/InteractionStateMachine.ts";
import { normalizeKeyEvent, normalizePointerEvent } from "./input/InputController.ts";
import type { EditorRendererPort } from "./types.ts";

type EditorListener = (state: EditorState) => void;

/**
 * Main editor orchestrator: commands, engraving reflow, and render updates.
 */
export class EditorController {
  private state: EditorState;
  private engravingResult: EngravingResult | null = null;
  private readonly listeners = new Set<EditorListener>();
  private readonly stateMachine = new InteractionStateMachine();

  constructor(
    private readonly renderer: EditorRendererPort,
    private readonly layoutParams: LayoutParameters,
    private readonly fonts: FontMetrics,
    opts: {
      score: Score;
      viewport?: Partial<EditorViewport>;
    }
  ) {
    this.state = {
      score: opts.score,
      selection: emptySelection(),
      mode: "normal",
      noteEntryState: null,
      playbackState: null,
      viewport: {
        pageIndex: opts.viewport?.pageIndex ?? 0,
        scrollY: opts.viewport?.scrollY ?? 0,
        scale: opts.viewport?.scale ?? 1,
        spatium: opts.viewport?.spatium ?? layoutParams.spatium
      },
      history: new CommandHistory()
    };
    this.reengrave();
  }

  /**
   * Gets a read-only snapshot of current editor state.
   */
  getState(): EditorState {
    return this.state;
  }

  /**
 * Gets the last engraving result.
 *
 * @returns Last computed engraving result or null if not yet engraved.
 */
  getEngravingResult(): EngravingResult | null {
    return this.engravingResult;
  }

  /**
   * Applies a notation command through history and re-engraves.
   *
   * @param command Undoable command.
   */
  dispatch(command: NotationCommand): void {
    const score = this.state.history.execute(command, this.state.score);
    this.patchState({ score });
    this.reengrave();
  }

  /**
   * Undoes the latest command.
   */
  undo(): void {
    const restored = this.state.history.undo(this.state.score);
    if (!restored) {
      return;
    }
    this.patchState({ score: restored });
    this.reengrave();
  }

  /**
   * Redoes the next command.
   */
  redo(): void {
    const restored = this.state.history.redo(this.state.score);
    if (!restored) {
      return;
    }
    this.patchState({ score: restored });
    this.reengrave();
  }

  /**
   * Loads a new score and resets selection/history rendering state.
   *
   * @param score New score root.
   */
  loadScore(score: Score): void {
    this.state = {
      ...this.state,
      score,
      selection: emptySelection(),
      noteEntryState: null,
      history: new CommandHistory()
    };
    this.reengrave();
    this.notify();
  }

  /**
   * Handles keyboard events through the interaction state machine.
   *
   * @param event Browser keyboard event.
   */
  handleKeyDown(event: KeyboardEvent): void {
    const normalized = normalizeKeyEvent(event);
    const result = this.stateMachine.handleKeyDown(this.state, normalized, this.state.score);
    if (result.command) {
      this.dispatch(result.command);
    }
    if (Object.keys(result.state).length > 0) {
      this.patchState(result.state);
      this.notify();
    }
  }

  /**
   * Handles mouse down for selection and note entry.
   *
   * @param event Browser mouse event.
   * @param canvas Target canvas element.
   */
  handleMouseDown(event: MouseEvent, canvas: HTMLCanvasElement): void {
    const normalized = normalizePointerEvent(event, canvas);
    const hitElement = this.renderer.hitTest(normalized.screenX, normalized.screenY);
    const engraving = this.engravingResult;
    if (!engraving) {
      return;
    }

    const result = this.stateMachine.handleMouseDown(
      this.state,
      normalized,
      engraving,
      this.state.score,
      hitElement
    );

    if (result.command) {
      this.dispatch(result.command);
    }
    if (Object.keys(result.state).length > 0) {
      this.patchState(result.state);
      this.updateHighlights();
      this.notify();
    }
  }

  /**
   * Subscribes to editor state changes.
   *
   * @param listener Callback invoked after state updates.
   * @returns Unsubscribe function.
   */
  subscribe(listener: EditorListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private patchState(patch: Partial<EditorState>): void {
    this.state = { ...this.state, ...patch };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private updateHighlights(): void {
    const selection = this.state.selection;
    if (selection.type === "single") {
      this.renderer.setHighlights([selection.elementId]);
      return;
    }
    this.renderer.setHighlights([]);
  }

  private reengrave(): void {
    this.engravingResult = engrave(this.state.score, this.layoutParams, this.fonts);
    this.renderer.render(this.engravingResult, this.state.viewport);
    this.updateHighlights();
  }
}
