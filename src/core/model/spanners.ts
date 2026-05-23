export type SpannerBase = {
  id: string;
  startId: string;
  endId: string;
  staffId: string;
  voiceId: number;
  userOffset: { x: number; y: number };
};

export type SlurSpan = SpannerBase & {
  kind: "slur";
  placement: "above" | "below";
  bezier?: { x1: number; y1: number; x2: number; y2: number };
};

export type TieSpan = SpannerBase & {
  kind: "tie";
  placement: "above" | "below";
};

export type HairpinSpan = SpannerBase & {
  kind: "hairpin";
  shape: "crescendo" | "decrescendo";
  spread: number;
};

export type OttavaSpan = SpannerBase & {
  kind: "ottava";
  type: "8va" | "8vb" | "15ma" | "15mb";
};

export type VoltaSpan = SpannerBase & {
  kind: "volta";
  numbers: number[];
  closed: boolean;
};

export type PedalSpan = SpannerBase & {
  kind: "pedal";
  style: "bracket" | "sign" | "line";
};

export type Spanner =
  | SlurSpan
  | TieSpan
  | HairpinSpan
  | OttavaSpan
  | VoltaSpan
  | PedalSpan;
