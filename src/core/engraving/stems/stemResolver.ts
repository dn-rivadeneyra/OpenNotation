import type { NoteEvent } from "../../model/index.js";
import type { ResolvedBeamGroup } from "../beaming/beamResolver.js";

export type StemResolution = {
  noteId: string;
  direction: "up" | "down";
  tipY: number;
  baseY: number;
};

/**
 * Resolves stem direction and length for a note context.
 *
 * @param noteId Note identifier.
 * @param staffPosition Position in staff-space coordinates (0 = bottom line).
 * @param voiceCount Number of active voices on staff at this tick.
 * @param voiceId Voice identifier.
 * @param beamGroup Optional beam group context.
 * @returns Stem geometry metadata.
 */
export function resolveStem(
  noteId: string,
  staffPosition: number,
  voiceCount: number,
  voiceId: number,
  beamGroup?: ResolvedBeamGroup
): StemResolution {
  const center = 2;
  let direction: "up" | "down";
  if (voiceCount > 1) {
    direction = voiceId === 2 || voiceId === 4 ? "down" : "up";
  } else if (beamGroup) {
    direction = beamGroup.stemDirection;
  } else {
    direction = staffPosition < center ? "up" : "down";
  }

  const baseY = staffPosition; // baseY = staffPosition;
  const stemLength = 3.5;
  const tipY = direction === "up" ? baseY - stemLength : baseY + stemLength;

  return {
    noteId,
    direction,
    tipY,
    baseY
  };
}

/**
 * Derives a representative staff position for a chord.
 *
 * @param notes Chord note set.
 * @param positions Staff positions keyed by note id.
 * @returns Position farthest from staff center.
 */
export function chordStemPosition(notes: NoteEvent[], positions: Map<string, number>): number {
  if (notes.length === 0) {
    return 2;
  }
  let selected = positions.get(notes[0]!.id) ?? 2;
  let maxDistance = Math.abs(selected - 2);
  for (const note of notes) {
    const pos = positions.get(note.id) ?? 2;
    const distance = Math.abs(pos - 2);
    if (distance > maxDistance) {
      selected = pos;
      maxDistance = distance;
    }
  }
  return selected;
}
