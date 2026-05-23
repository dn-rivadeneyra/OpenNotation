import type { Accidental, KeySignature, NoteEvent } from "../../model/index.js";
import type { SmuflGlyph } from "../types.js";

export type AccidentalPlacement = {
  noteId: string;
  accidental: Accidental;
  xOffset: number;
  glyph: SmuflGlyph;
};

const ACCIDENTAL_GLYPHS: Record<Exclude<Accidental, null>, number> = {
  sharp: 0xe262,
  flat: 0xe260,
  natural: 0xe261,
  "double-sharp": 0xe263,
  "double-flat": 0xe264,
  "sharp-up": 0xe262,
  "flat-down": 0xe260
};

function chromaticValue(note: NoteEvent): number {
  const stepMap: Record<NoteEvent["pitch"]["step"], number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  return (note.pitch.octave + 1) * 12 + stepMap[note.pitch.step] + note.pitch.alter;
}

function collidesY(leftY: number, rightY: number): boolean {
  return Math.abs(leftY - rightY) < 1;
}

/**
 * Places accidentals for notes in a single chord/tick.
 *
 * @param notes Chord notes at same tick.
 * @param activeKey Active key signature.
 * @returns Deterministic accidental offsets and glyphs.
 */
export function placeAccidentals(notes: NoteEvent[], activeKey: KeySignature): AccidentalPlacement[] {
  if (notes.length === 0) {
    return [];
  }

  void activeKey;

  const ordered = [...notes]
    .filter((note) => note.accidental !== null)
    .sort((left, right) => chromaticValue(right) - chromaticValue(left));

  const placements: AccidentalPlacement[] = [];
  const GAP = 0.35;
  const WIDTH = 0.9;

  for (const note of ordered) {
    const accidental = note.accidental;
    if (accidental === null) {
      continue;
    }

    let xOffset = -(WIDTH + GAP);
    const noteY = chromaticValue(note) / 2;
    for (const placed of placements) {
      const otherNote = ordered.find((candidate) => candidate.id === placed.noteId);
      if (!otherNote) {
        continue;
      }
      const otherY = chromaticValue(otherNote) / 2;
      if (collidesY(noteY, otherY) && Math.abs(xOffset - placed.xOffset) < WIDTH) {
        xOffset = placed.xOffset - (WIDTH + GAP);
      }
    }

    placements.push({
      noteId: note.id,
      accidental,
      xOffset,
      glyph: {
        codepoint: ACCIDENTAL_GLYPHS[accidental]
      }
    });
  }

  return placements;
}
