import type { KeySignature, TimeSignature } from "./primitives.js";
import type { Score } from "./score.js";
import { TPQ, createMeasure, createPart, createScore } from "./factory.js";

const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator: 4,
  denominator: 4
};

const DEFAULT_KEY_SIGNATURE: KeySignature = {
  fifths: 0,
  mode: "major"
};

/**
 * Creates a deterministic baseline score fixture used across tests.
 *
 * @returns Score with 1 part, 1 staff, C major, 4/4, and four empty measures.
 */
export function createMinimalScore(): Score {
  const score = createScore({ title: "Minimal Score" });

  const { part, staves } = createPart({
    name: "Piano",
    abbreviation: "Pno.",
    staffCount: 1,
    instrument: {
      id: "instrument-piano",
      name: "Piano",
      family: "Keyboard"
    }
  });

  score.parts.push(part);
  score.staves.push(...staves);

  const measureDuration = (TPQ * 4 * DEFAULT_TIME_SIGNATURE.numerator) / DEFAULT_TIME_SIGNATURE.denominator;
  for (let index = 0; index < 4; index += 1) {
    score.measures.push(
      createMeasure({
        number: index + 1,
        tick: index * measureDuration,
        timeSig: DEFAULT_TIME_SIGNATURE
      })
    );
  }

  const staffId = staves[0]?.id;
  if (!staffId) {
    throw new Error("minimal score generation failed to create staff.");
  }

  const keySigEventId = "minimal-keysig-0";
  const timeSigEventId = "minimal-timesig-0";
  const clefEventId = "minimal-clef-0";

  score.events.set(keySigEventId, {
    id: keySigEventId,
    kind: "keysig",
    tick: 0,
    staffId,
    voiceId: 1,
    key: DEFAULT_KEY_SIGNATURE,
    cancel: false
  });
  score.events.set(timeSigEventId, {
    id: timeSigEventId,
    kind: "timesig",
    tick: 0,
    staffId,
    voiceId: 1,
    time: DEFAULT_TIME_SIGNATURE
  });
  score.events.set(clefEventId, {
    id: clefEventId,
    kind: "clef",
    tick: 0,
    staffId,
    voiceId: 1,
    clef: "treble",
    line: 2
  });

  score.eventIndex.set(`${staffId}:1`, [clefEventId, keySigEventId, timeSigEventId]);
  score.timeMap.entries = [
    {
      tick: 0,
      measureNumber: 1,
      beatIndex: 0,
      bpm: 120,
      realTimeMs: 0
    }
  ];

  return score;
}
