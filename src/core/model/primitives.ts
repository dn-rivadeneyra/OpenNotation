export type Pitch = {
  step: "C" | "D" | "E" | "F" | "G" | "A" | "B";
  octave: number;
  alter: number;
};

export type NoteType =
  | "maxima"
  | "long"
  | "breve"
  | "whole"
  | "half"
  | "quarter"
  | "eighth"
  | "16th"
  | "32nd"
  | "64th"
  | "128th";

export type Duration = {
  type: NoteType;
  dots: number;
  ticks: number;
};

export type Accidental =
  | "sharp"
  | "flat"
  | "natural"
  | "double-sharp"
  | "double-flat"
  | "sharp-up"
  | "flat-down"
  | null;

export type ClefType =
  | "treble"
  | "bass"
  | "alto"
  | "tenor"
  | "treble8vb"
  | "bass8vb"
  | "percussion";

export type KeySignature = {
  fifths: number;
  mode: "major" | "minor";
};

export type TimeSignature = {
  numerator: number;
  denominator: number;
  symbol?: "common" | "cut";
};
