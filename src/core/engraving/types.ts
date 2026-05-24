export type BoundingBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type SmuflGlyph = {
  codepoint: number;
  scale?: number;
};

export type PathCommand =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

export type EngravingElementType =
  | "notehead"
  | "stem"
  | "flag"
  | "beam"
  | "accidental"
  | "articulation"
  | "rest"
  | "clef"
  | "timesig"
  | "keysig"
  | "barline"
  | "dynamic"
  | "text"
  | "rehearsal"
  | "lyric"
  | "ledger"
  | "brace"
  | "bracket";

export type EngravingElement = {
  id: string;
  sourceId?: string;
  type: EngravingElementType;
  x: number;
  y: number;
  bbox: BoundingBox;
  glyph?: SmuflGlyph;
  path?: PathCommand[];
  children?: EngravingElement[];
};

export type EngravingSpanner = {
  id: string;
  sourceId: string;
  type: "slur" | "tie" | "hairpin" | "ottava" | "volta" | "pedal";
  path: PathCommand[];
  bbox: BoundingBox;
};

export type EngravingMeasure = {
  measureId: string;
  x: number;
  y: number;
  width: number;
  elements: EngravingElement[];
  spanners: EngravingSpanner[];
};

export type EngravingStaffLine = {
  staffId: string;
  x: number;
  y: number;
  width: number;
  lineCount: number;
};

export type EngravingSystem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  measures: EngravingMeasure[];
  bracketElements: EngravingElement[];
  staffLines: EngravingStaffLine[];
};

export type EngravingPage = {
  index: number;
  width: number;
  height: number;
  systems: EngravingSystem[];
  pageElements: EngravingElement[];
};

export type EngravingResult = {
  pages: EngravingPage[];
  totalPages: number;
};

export type LayoutParameters = {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  staffSpacing: number;
  systemSpacing: number;
  spatium: number;
  minSystemFill: number;
  stretchFactor: number;
};

export type GlyphAnchors = {
  stemUpSE?: [number, number];
  stemDownNW?: [number, number];
  cutOutNE?: [number, number];
  cutOutNW?: [number, number];
  cutOutSE?: [number, number];
  cutOutSW?: [number, number];
  opticalCenter?: [number, number];
  repeatOffset?: [number, number];
  stemUpNW?: [number, number];
  stemDownSW?: [number, number];
};

export type FontMetrics = {
  glyphs: Record<string, unknown>;
  engravingDefaults: Record<string, number>;
  metadata?: {
    glyphsWithAnchors: Record<string, GlyphAnchors>;
  };
  calibration?: FontCalibration;
};

export type StemCalibration = {
  xScale?: number;
  xOffset?: number;
  yOffset?: number;
};

export type FontCalibration = {
  stemAnchors: {
    up: StemCalibration;
    down: StemCalibration;
  };
};