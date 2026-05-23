import type { ScoreEvent } from "./events.js";
import type { Spanner } from "./spanners.js";
import type { BeamGroup, Measure, Part, Staff, TupletGroup } from "./structure.js";

export type TimeMapEntry = {
  tick: number;
  measureNumber: number;
  beatIndex: number;
  bpm: number;
  realTimeMs: number;
};

export type TimeMap = {
  entries: TimeMapEntry[];
};

export type ScoreMetadata = {
  title: string;
  subtitle?: string;
  composer?: string;
  lyricist?: string;
  arranger?: string;
  copyright?: string;
  movementTitle?: string;
  movementNumber?: string;
  createdDate: string;
  modifiedDate: string;
  encodingDescription?: string;
};

export type Score = {
  id: string;
  metadata: ScoreMetadata;
  parts: Part[];
  staves: Staff[];
  measures: Measure[];
  events: Map<string, ScoreEvent>;
  eventIndex: Map<string, string[]>;
  spanners: Map<string, Spanner>;
  beamGroups: Map<string, BeamGroup>;
  tuplets: Map<string, TupletGroup>;
  timeMap: TimeMap;
};
