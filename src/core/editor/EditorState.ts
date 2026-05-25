import type { CommandHistory } from "./commands/CommandHistory.ts";
import type { NoteEntryState } from "./noteentry/NoteEntryState.ts";
import type { Selection } from "./selection/Selection.ts";
import type { Score } from "../model/index.ts";

export type EditorMode =
  | "normal"
  | "noteEntry"
  | "textEdit"
  | "selection"
  | "playback"
  | "pan"
  | "zoom";

export type PlaybackState = {
  playing: boolean;
  positionMs: number;
};

export type EditorViewport = {
  pageIndex: number;
  scrollY: number;
  scale: number;
  spatium: number;
};

export type EditorState = {
  score: Score;
  selection: Selection;
  mode: EditorMode;
  noteEntryState: NoteEntryState | null;
  playbackState: PlaybackState | null;
  viewport: EditorViewport;
  history: CommandHistory;
};
