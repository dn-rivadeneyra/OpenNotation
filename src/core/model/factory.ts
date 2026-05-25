import type {
  NoteEvent,
  RestEvent,
  ScoreEvent,
  ScoreEventBase
} from "./events.js";
import type {
  ClefType,
  Duration,
  NoteType,
  Pitch,
  TimeSignature
} from "./primitives.js";
import type { Score, ScoreMetadata } from "./score.js";
import type { Instrument, Measure, Part, Staff } from "./structure.js";

export const TPQ = 480;

const NOTE_BASE_TICKS: Record<NoteType, number> = {
  maxima: TPQ * 32,
  long: TPQ * 16,
  breve: TPQ * 8,
  whole: TPQ * 4,
  half: TPQ * 2,
  quarter: TPQ,
  eighth: TPQ / 2,
  "16th": TPQ / 4,
  "32nd": TPQ / 8,
  "64th": TPQ / 16,
  "128th": TPQ / 32
};

const STEP_INDEX: Record<Pitch["step"], number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

const SHARP_STEPS: Array<{ step: Pitch["step"]; alter: number }> = [
  { step: "C", alter: 0 },
  { step: "C", alter: 1 },
  { step: "D", alter: 0 },
  { step: "D", alter: 1 },
  { step: "E", alter: 0 },
  { step: "F", alter: 0 },
  { step: "F", alter: 1 },
  { step: "G", alter: 0 },
  { step: "G", alter: 1 },
  { step: "A", alter: 0 },
  { step: "A", alter: 1 },
  { step: "B", alter: 0 }
];

const DIATONIC_INDEX: Record<Pitch["step"], number> = {
  C: 0,
  D: 1,
  E: 2,
  F: 3,
  G: 4,
  A: 5,
  B: 6
};

const CLEF_BOTTOM_LINE: Record<ClefType, { step: Pitch["step"]; octave: number }> = {
  treble: { step: "E", octave: 4 },
  bass: { step: "G", octave: 2 },
  alto: { step: "F", octave: 3 },
  tenor: { step: "D", octave: 3 },
  treble8vb: { step: "E", octave: 3 },
  bass8vb: { step: "G", octave: 1 },
  percussion: { step: "E", octave: 4 }
};

function createId(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function assertVoiceId(voiceId: number): void {
  if (!Number.isInteger(voiceId) || voiceId < 1 || voiceId > 4) {
    throw new Error("voiceId must be an integer from 1 to 4.");
  }
}

function assertTick(tick: number): void {
  if (!Number.isInteger(tick) || tick < 0) {
    throw new Error("tick must be a non-negative integer.");
  }
}

function assertDuration(duration: Duration): void {
  if (!Number.isInteger(duration.ticks) || duration.ticks <= 0) {
    throw new Error("duration.ticks must be a positive integer.");
  }
}

function updateMetadataDates(metadata: Partial<ScoreMetadata>): ScoreMetadata {
  const now = new Date().toISOString();
  const result: ScoreMetadata = {
    title: metadata.title ?? "Untitled Score",
    createdDate: metadata.createdDate ?? now,
    modifiedDate: metadata.modifiedDate ?? now
  };

  if (metadata.subtitle !== undefined) result.subtitle = metadata.subtitle;
  if (metadata.composer !== undefined) result.composer = metadata.composer;
  if (metadata.lyricist !== undefined) result.lyricist = metadata.lyricist;
  if (metadata.arranger !== undefined) result.arranger = metadata.arranger;
  if (metadata.copyright !== undefined) result.copyright = metadata.copyright;
  if (metadata.movementTitle !== undefined) result.movementTitle = metadata.movementTitle;
  if (metadata.movementNumber !== undefined) result.movementNumber = metadata.movementNumber;
  if (metadata.encodingDescription !== undefined) {
    result.encodingDescription = metadata.encodingDescription;
  }

  return result;
}

/**
 * Creates an empty score root object with initialized maps and metadata defaults.
 *
 * @param metadata Partial metadata input to merge with defaults.
 * @returns A valid score object ready for structural and event insertion.
 */
export function createScore(metadata: Partial<ScoreMetadata>): Score {
  return {
    id: createId(),
    metadata: updateMetadataDates(metadata),
    parts: [],
    staves: [],
    measures: [],
    events: new Map<string, ScoreEvent>(),
    eventIndex: new Map<string, string[]>(),
    spanners: new Map(),
    beamGroups: new Map(),
    tuplets: new Map(),
    timeMap: { entries: [] }
  };
}

/**
 * Creates a part and its ordered staff list.
 *
 * @param opts Part creation options.
 * @returns The created part and all generated staves.
 */
export function createPart(opts: {
  name: string;
  abbreviation: string;
  staffCount: number;
  instrument: Instrument;
}): { part: Part; staves: Staff[] } {
  if (!Number.isInteger(opts.staffCount) || opts.staffCount < 1) {
    throw new Error("staffCount must be a positive integer.");
  }

  const partId = createId();
  const staves: Staff[] = Array.from({ length: opts.staffCount }, (_, index) => ({
    id: createId(),
    partId,
    index,
    lineCount: 5,
    distance: index === 0 ? 0 : 7,
    showBraces: opts.staffCount > 1,
    defaultClef: "treble"
  }));

  const part: Part = {
    id: partId,
    name: opts.name,
    abbreviation: opts.abbreviation,
    staffIds: staves.map((staff) => staff.id),
    instrument: opts.instrument,
    midiChannel: 0,
    midiProgram: 0
  };

  return { part, staves };
}

/**
 * Creates a measure with defaults derived from the provided time signature.
 *
 * @param opts Measure number, absolute tick, and active time signature.
 * @returns A fully initialized measure.
 */
export function createMeasure(opts: {
  number: number;
  tick: number;
  timeSig: TimeSignature;
}): Measure {
  assertTick(opts.tick);
  if (!Number.isInteger(opts.number) || opts.number < 1) {
    throw new Error("measure number must be >= 1.");
  }

  if (opts.timeSig.numerator < 1 || opts.timeSig.denominator < 1) {
    throw new Error("time signature values must be positive.");
  }

  const quarterTicks = TPQ;
  const beatTicks = (quarterTicks * 4) / opts.timeSig.denominator;

  return {
    id: createId(),
    number: opts.number,
    tick: opts.tick,
    duration: Math.round(opts.timeSig.numerator * beatTicks),
    timeSig: opts.timeSig,
    clefs: {},
    repeatStart: false,
    repeatEnd: false,
    repeatCount: 2
  };
}

function createBaseEvent(opts: {
  staffId: string;
  voiceId: number;
  tick: number;
}): ScoreEventBase {
  assertVoiceId(opts.voiceId);
  assertTick(opts.tick);

  return {
    id: createId(),
    tick: opts.tick,
    staffId: opts.staffId,
    voiceId: opts.voiceId
  };
}

/**
 * Creates a note event with normalized defaults for articulation and tie state.
 *
 * @param opts Note event creation options.
 * @returns A semantically valid note event.
 */
export function createNoteEvent(opts: {
  staffId: string;
  voiceId: number;
  tick: number;
  pitch: Pitch;
  duration: Duration;
}): NoteEvent {
  assertDuration(opts.duration);

  return {
    ...createBaseEvent(opts),
    kind: "note",
    pitch: opts.pitch,
    duration: opts.duration,
    accidental: null,
    tieStart: false,
    tieEnd: false,
    grace: false,
    graceSlash: false,
    articulations: [],
    technicals: []
  };
}

/**
 * Creates a rest event at a fixed staff, voice, and absolute tick.
 *
 * @param opts Rest creation options.
 * @returns A semantically valid rest event.
 */
export function createRestEvent(opts: {
  staffId: string;
  voiceId: number;
  tick: number;
  duration: Duration;
}): RestEvent {
  assertDuration(opts.duration);

  return {
    ...createBaseEvent(opts),
    kind: "rest",
    duration: opts.duration
  };
}

/**
 * Computes a deterministic tick duration from note type and augmentation dots.
 *
 * @param type Base notated duration type.
 * @param dots Number of augmentation dots.
 * @param tpq Ticks-per-quarter resolution.
 * @returns Exact integer tick duration.
 */
export function computeTicks(type: NoteType, dots: number, tpq = TPQ): number {
  if (!Number.isInteger(dots) || dots < 0) {
    throw new Error("dots must be a non-negative integer.");
  }

  const scale = tpq / TPQ;
  const baseTicks = NOTE_BASE_TICKS[type] * scale;
  let value = baseTicks;
  let add = baseTicks / 2;

  for (let i = 0; i < dots; i += 1) {
    value += add;
    add /= 2;
  }

  return Math.round(value);
}

/**
 * Converts a pitch to a MIDI note number.
 *
 * @param pitch Pitch object.
 * @returns MIDI note in [0, 127].
 */
export function pitchToMidi(pitch: Pitch): number {
  if (!Number.isInteger(pitch.octave) || pitch.octave < 0 || pitch.octave > 9) {
    throw new Error("pitch.octave must be an integer in the range 0..9.");
  }
  if (!Number.isInteger(pitch.alter) || pitch.alter < -2 || pitch.alter > 2) {
    throw new Error("pitch.alter must be an integer in the range -2..2.");
  }

  const midi = (pitch.octave + 1) * 12 + STEP_INDEX[pitch.step] + pitch.alter;
  if (midi < 0 || midi > 127) {
    throw new Error("pitch converts to MIDI outside the supported range 0..127.");
  }
  return midi;
}

/**
 * Converts a MIDI note number to a canonical sharp-based pitch spelling.
 *
 * @param midi MIDI note in [0, 127].
 * @returns Pitch object matching the MIDI value.
 */
export function midiToPitch(midi: number): Pitch {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new Error("midi must be an integer in the range 0..127.");
  }

  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 1;
  const sharpPitch = SHARP_STEPS[pitchClass];
  if (!sharpPitch) {
    throw new Error("failed to resolve pitch class.");
  }

  return {
    step: sharpPitch.step,
    octave,
    alter: sharpPitch.alter
  };
}

function toDiatonicNumber(pitch: { step: Pitch["step"]; octave: number }): number {
  return pitch.octave * 7 + DIATONIC_INDEX[pitch.step];
}

/**
 * Converts pitch to staff line/space position for a specific clef.
 *
 * @param pitch Pitch object.
 * @param clef Active clef.
 * @returns Staff position (0 = bottom line, 0.5 = first space, etc.).
 */
export function pitchToStaffPosition(
  pitch: Pitch,
  clef: ClefType
): number {
  const bottom = CLEF_BOTTOM_LINE[clef];

  const diatonicDistance =
    toDiatonicNumber(pitch) -
    toDiatonicNumber(bottom);

  return diatonicDistance * 0.5;
}

const DIATONIC_STEPS: Pitch["step"][] = ["C", "D", "E", "F", "G", "A", "B"];

/**
 * Converts a staff position to pitch for a given clef.
 *
 * @param staffPosition Position where 0 = bottom line, 4 = top line.
 * @param clef Active clef.
 * @returns Pitch at that staff position (natural spelling).
 */
export function staffPositionToPitch(staffPosition: number, clef: ClefType): Pitch {
  const bottom = CLEF_BOTTOM_LINE[clef];
  const targetDiatonic = toDiatonicNumber(bottom) + staffPosition * 2;
  const octave = Math.floor(targetDiatonic / 7);
  const stepIndex = ((targetDiatonic % 7) + 7) % 7;
  const step = DIATONIC_STEPS[stepIndex];
  if (!step) {
    throw new Error("failed to resolve diatonic step.");
  }
  return { step, octave, alter: 0 };
}
