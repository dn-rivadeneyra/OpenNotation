import type {
  Accidental,
  ClefType,
  Duration,
  KeySignature,
  NoteType,
  Pitch,
  TimeSignature
} from "./primitives.js";

export type ScoreEventBase = {
  id: string;
  tick: number;
  staffId: string;
  voiceId: number;
};

export type ArticulationType =
  | "staccato"
  | "tenuto"
  | "accent"
  | "marcato"
  | "staccatissimo"
  | "portato"
  | "stress"
  | "unstress";

export type DynamicType =
  | "pppp"
  | "ppp"
  | "pp"
  | "p"
  | "mp"
  | "mf"
  | "f"
  | "ff"
  | "fff"
  | "ffff"
  | "sfz"
  | "sfp"
  | "rfz"
  | "fp";

export type TechnicalType =
  | "up-bow"
  | "down-bow"
  | "harmonic"
  | "open-string"
  | "stopped"
  | "snap-pizzicato"
  | "left-hand-pizzicato";

export type BarlineType =
  | "regular"
  | "dotted"
  | "dashed"
  | "heavy"
  | "light-light"
  | "light-heavy"
  | "heavy-light"
  | "heavy-heavy"
  | "short"
  | "tick"
  | "repeat-start"
  | "repeat-end"
  | "repeat-end-start";

export type TextStyle = {
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
};

export type LyricEvent = {
  text: string;
  syllabic: "single" | "begin" | "middle" | "end";
  verse: number;
};

export type ChordMember = {
  noteId: string;
  chordId: string;
};

export type NoteEvent = ScoreEventBase & {
  kind: "note";
  pitch: Pitch;
  duration: Duration;
  accidental: Accidental;
  tieStart: boolean;
  tieEnd: boolean;
  grace: boolean;
  graceSlash: boolean;
  articulations: ArticulationType[];
  dynamic?: DynamicType;
  fingering?: string;
  technicals: TechnicalType[];
  lyric?: LyricEvent;
  chordId?: string;
};

export type RestEvent = ScoreEventBase & {
  kind: "rest";
  duration: Duration;
  hidden?: boolean;
};

export type ClefEvent = ScoreEventBase & {
  kind: "clef";
  clef: ClefType;
  line: number;
};

export type KeySigEvent = ScoreEventBase & {
  kind: "keysig";
  key: KeySignature;
  cancel: boolean;
};

export type TimeSigEvent = ScoreEventBase & {
  kind: "timesig";
  time: TimeSignature;
};

export type TempoEvent = ScoreEventBase & {
  kind: "tempo";
  bpm: number;
  beatUnit: NoteType;
  text?: string;
  fermata?: boolean;
};

export type DynamicEvent = ScoreEventBase & {
  kind: "dynamic";
  dynamic: DynamicType;
  userOffset: { x: number; y: number };
};

export type TextEvent = ScoreEventBase & {
  kind: "text";
  text: string;
  style: TextStyle;
  userOffset: { x: number; y: number };
};

export type BarlineEvent = ScoreEventBase & {
  kind: "barline";
  barline: BarlineType;
};

export type ScoreEvent =
  | NoteEvent
  | RestEvent
  | ClefEvent
  | KeySigEvent
  | TimeSigEvent
  | TempoEvent
  | DynamicEvent
  | TextEvent
  | BarlineEvent;
