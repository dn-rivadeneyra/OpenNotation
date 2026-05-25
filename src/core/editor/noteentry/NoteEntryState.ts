import type { Accidental, Duration } from "../../model/index.ts";

export type NoteEntryState = {
  staffId: string;
  voiceId: number;
  tick: number;
  duration: Duration;
  accidentalOverride: Accidental | null;
  chordMode: boolean;
  tieNext: boolean;
};

export function createNoteEntryState(opts: {
  staffId: string;
  voiceId: number;
  tick: number;
  duration: Duration;
}): NoteEntryState {
  return {
    staffId: opts.staffId,
    voiceId: opts.voiceId,
    tick: opts.tick,
    duration: opts.duration,
    accidentalOverride: null,
    chordMode: false,
    tieNext: false
  };
}
