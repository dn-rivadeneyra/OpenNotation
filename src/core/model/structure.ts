import type { ClefType, KeySignature, TimeSignature } from "./primitives.js";

export type Measure = {
  id: string;
  number: number;
  tick: number;
  duration: number;
  timeSig?: TimeSignature;
  keySig?: KeySignature;
  clefs: Record<string, ClefType>;
  repeatStart: boolean;
  repeatEnd: boolean;
  repeatCount: number;
  sectionBreak?: boolean;
  pageBreak?: boolean;
  systemBreak?: boolean;
  rehearsalMark?: string;
};

export type Staff = {
  id: string;
  partId: string;
  index: number;
  lineCount: number;
  distance: number;
  showBraces: boolean;
  defaultClef: ClefType;
};

export type Instrument = {
  id: string;
  name: string;
  family: string;
  transposition?: {
    chromatic: number;
    diatonic: number;
  };
};

export type Part = {
  id: string;
  name: string;
  abbreviation: string;
  staffIds: string[];
  instrument: Instrument;
  midiChannel: number;
  midiProgram: number;
};

export type TupletGroup = {
  id: string;
  staffId: string;
  voiceId: number;
  startTick: number;
  endTick: number;
  actual: number;
  normal: number;
  showBracket: boolean;
  showNumber: "actual" | "both" | "none";
  eventIds: string[];
};

export type BeamGroup = {
  id: string;
  eventIds: string[];
};
