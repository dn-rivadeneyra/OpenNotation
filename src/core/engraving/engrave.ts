import type { Measure, NoteEvent, Score } from "../model/index.ts";
import {
  getActiveClef,
  getActiveKeySignature,
  pitchToStaffPosition
} from "../model/index.ts";

import { buildSliceMap } from "../temporal/index.ts";
import {
  buildSprings,
  solveSpacing
} from "./spacing/spacingSolver.ts";

import { resolveBeamGroups } from "./beaming/beamResolver.ts";
import { breakIntoSystems } from "./systems/systemBreaker.ts";
import { placeAccidentals } from "./accidentals/accidentalPlacer.ts";
import { resolveStem } from "./stems/stemResolver.ts";
import { computeSlurGeometry } from "./slurs/slurPlacer.ts";

import {
  placeBelowSkyline,
  placeAboveSkyline,
  type Skyline
} from "./collision/skyline.ts";

import type {
  BoundingBox,
  EngravingElement,
  EngravingMeasure,
  EngravingResult,
  EngravingSystem,
  FontMetrics,
  LayoutParameters
} from "./types.ts";

// ============================================================================
// 🎛️ GRAPHICS & INTERACTION CALIBRATION DASHBOARD
// Edit these constants to fine-tune layout, hitboxes, and spacing.
// ============================================================================

const CONFIG = {
  // --- Resolution & Engine ---
  TICKS_PER_QUARTER: 480,
  DEFAULT_MEASURE_WIDTH: 6.0,
  MEASURE_WIDTH_PADDING: 1.0,
  SYSTEM_HEIGHT_SPACING: 10,
  STAFF_BOTTOM_Y: 4.0,

  // --- Preamble Spacing Buffer ---
  PREAMBLE_CLEF_WIDTH: 3.0,
  PREAMBLE_KEYSIG_WIDTH: 2.75,
  PREAMBLE_TIMESIG_WIDTH: 3.5,

  // --- Vertical Positions (Y) ---
  Y_REST_DEFAULT: 1.0,
  Y_TIMESIG_NUMERATOR: 1.0,
  Y_TIMESIG_DENOMINATOR: 3.0,
  Y_CLEFS: {
    treble: 2.5, bass: 0.5, alto: 1.0, tenor: 0.5,
    treble8vb: 1.0, bass8vb: 0.5, percussion: 1.0,
  } as Record<string, number>,

  // --- Interactive Hitboxes (Bounding Boxes) ---
  BBOX_DEFAULT:     { left: -0.5, top: -0.5, right: 0.5, bottom: 0.5 },
  BBOX_NOTEHEAD:    { left: 0, top: -0.45, right: 1.45, bottom: 0.45 },
  BBOX_BARLINE:     { left: -0.06, top: 0, right: 0.06, bottom: 4.0 },
  BBOX_CLEF:        { left: 0, top: -4.0, right: 2.5, bottom: 2.0 },
  BBOX_KEYSIG:      { left: -0.2, top: -1.0, right: 1.0, bottom: 1.0 },
  BBOX_TIMESIG:     { left: 0, top: -1.0, right: 1.5, bottom: 1.0 },
  BBOX_ACCIDENTAL:  { left: 0, top: -1.0, right: 1.5, bottom: 1.0 },
  BBOX_RESTHALF:    { left: 0, top: -0.5, right: 1.4, bottom: 0.20 },
  
  // --- Stem Math & SMuFL Adjustments ---
  STEM_LENGTH: 3.5,
  STEM_BBOX_LEFT: -0.075,
  STEM_BBOX_RIGHT: 0.06,
  STEM_BBOX_DOWN_PADDING_TOP: 0.075,
  STEM_UP_ANCHOR_X_SCALE: 1.10,   
  STEM_UP_ANCHOR_Y_OFFSET: -0.068,  
  STEM_DOWN_ANCHOR_X_OFFSET: 0.068, 

  // --- Skyline Collision Padding ---
  SKYLINE_DYNAMICS: { xPad: 0.5, hPad: 0.8, margin: 0.4 },
  SKYLINE_LYRICS:   { xPad: 0.8, hPad: 0.9, margin: 0.4 },
  SKYLINE_ARTIC:    { xPad: 0.5, hPad: 0.6, margin: 0.3 },
  SKYLINE_SLUR_OFFSET: 2.0,
  SKYLINE_MAX_X_SPAN: 10000,
  AABB_COLLISION_PADDING: 0.2,
  AABB_MAX_ITERATIONS: 5,

  // --- Math & Internal Magic Numbers ---
  MATH: {
    STAFF_LINES_BASELINE: 4,
    STAFF_LINE_MULTIPLIER: 0.5,
    ACCIDENTAL_X_OFFSET: -1.25,
    KEYSIG_X_STAGGER: 0.8,
    MAX_KEY_FIFTHS: 7,
    MAX_VOICES: 4,
    DEFAULT_NUMERATOR: 4,
    DEFAULT_DENOMINATOR: 4,
    PARSE_BASE_10: 10,
    SPANNER_BBOX_TOP: -2,
    SPANNER_BBOX_BOTTOM: 2,
  },

  // --- Glyph Definitions (SMuFL) ---
  SMUFL: {
    NOTEHEAD_WHOLE: 0xe0a2,
    NOTEHEAD_HALF: 0xe0a3,
    NOTEHEAD_BLACK: 0xe0a4,
    REST_WHOLE: 0xe4e3,
    REST_HALF: 0xe4e4,
    REST_QUARTER: 0xe4e5,
    REST_EIGHTH: 0xe4e6,
    ACC_SHARP: 0xe262,
    ACC_FLAT: 0xe260,
    ACC_NATURAL: 0xe261,
    ACC_DOUBLE_SHARP: 0xe263,
    ACC_DOUBLE_FLAT: 0xe264,
    CLEF_TREBLE: 0xe050,
    CLEF_BASS: 0xe062,
    CLEF_ALTO: 0xe05c,
    CLEF_TREBLE8VB: 0xe052,
    CLEF_PERCUSSION: 0xe069,
    DIGITS: [0xe080, 0xe081, 0xe082, 0xe083, 0xe084, 0xe085, 0xe086, 0xe087, 0xe088, 0xe089] as Record<number, number>
  },

  // --- Keysig Offsets ---
  KEYSIG_Y_OFFSETS: {
    SHARP: [0.5, 2.0, -0.5, 1.0, 2.5, 0.0, 1.5],
    FLAT: [2.0, 0.5, 2.5, 1.0, 3.0, 1.5, 3.5]
  }
};
// ============================================================================

// Staff positions are 0-based from the bottom line.
// Renderer coordinates are top-origin:
//   smaller Y = visually higher
//   larger Y = visually lower
function staffPositionToY(staffPosition: number): number {
  return (4 - staffPosition) * 0.5;
}

function noteheadCodepoint(type: string): number {
  if (type === "whole") return 0xe0a2;
  if (type === "half") return 0xe0a3;
  return 0xe0a4;
}

function restCodepoint(type: string): number {
  switch (type) {
    case "whole": return 0xe4e3; // restWhole
    case "half": return 0xe4e4;  // restHalf
    case "eighth": 
    case "eight": return 0xe4e6; // rest8th
    case "quarter":
    default: return 0xe4e5;      // restQuarter
  }
}

function computePreambleWidth(score: Score, measure: Measure): number {
  const preambleEvents = [...score.events.values()].filter(
    (event) =>
      event.tick === measure.tick &&
      (event.kind === "clef" || event.kind === "keysig" || event.kind === "timesig")
  );
  
  let width = 0;
  if (preambleEvents.some((e) => e.kind === "clef")) width += CONFIG.PREAMBLE_CLEF_WIDTH;
  
  // Dynamic keysig width based on accidentals can be optimized later; flat padding for now
  if (preambleEvents.some((e) => e.kind === "keysig")) width += CONFIG.PREAMBLE_KEYSIG_WIDTH;
  
  if (preambleEvents.some((e) => e.kind === "timesig")) width += CONFIG.PREAMBLE_TIMESIG_WIDTH;
  
  return width;
}

// ----------------------------------------------------
// SPRING SPACING
// ----------------------------------------------------

function buildTickXMap(score: Score, measure: Measure): Map<number, number> {
  const sliceMap = buildSliceMap(score);

  const measureSlices = sliceMap.slices.filter(
    (slice) =>
      slice.tick >= measure.tick &&
      slice.tick < measure.tick + measure.duration
  );

  const springs = buildSprings(measureSlices, score);

  if (springs.length === 0) {
    return new Map();
  }

  const naturalWidth = springs.reduce(
    (sum, s) => sum + s.minWidth + s.proportionalWidth + s.extraWidth,
    0
  );

  const positions = solveSpacing(springs, naturalWidth);
  const tickXMap = new Map<number, number>();

  for (let i = 0; i < measureSlices.length; i++) {
    tickXMap.set(measureSlices[i]!.tick, positions[i] ?? 0);
  }

  return tickXMap;
}

function baseMeasureWidth(score: Score, measure: Measure): number {
  const sliceMap = buildSliceMap(score);

  const measureSlices = sliceMap.slices.filter(
    (slice) =>
      slice.tick >= measure.tick &&
      slice.tick < measure.tick + measure.duration
  );

  const springs = buildSprings(measureSlices, score);

  if (springs.length === 0) {
    return CONFIG.DEFAULT_MEASURE_WIDTH;
  }

  const naturalWidth = springs.reduce(
    (sum, s) => sum + s.minWidth + s.proportionalWidth + s.extraWidth,
    0
  );

  const positions = solveSpacing(springs, naturalWidth);
  const lastSpring = springs[springs.length - 1]!;
  
  const preambleWidth = computePreambleWidth(score, measure);

  return (
    (positions[positions.length - 1] ?? 0) +
    lastSpring.proportionalWidth +
    CONFIG.MEASURE_WIDTH_PADDING + 
    preambleWidth
  );
}

// ----------------------------------------------------
// ELEMENT GENERATION
// ----------------------------------------------------

function eventElementsForMeasure(
  score: Score,
  measure: Measure,
  fonts: FontMetrics
): EngravingElement[] {
  const preambleWidth = computePreambleWidth(score, measure);
  const tickXMap = buildTickXMap(score, measure);

  const events = [...score.events.values()]
    .filter(
      (event) =>
        event.tick >= measure.tick &&
        event.tick < measure.tick + measure.duration
    )
    .sort((left, right) => left.tick - right.tick);

  const voicesPerStaffTick = new Map<string, Set<number>>();

  for (const event of events) {
    if (event.kind !== "note" && event.kind !== "rest") continue;

    const key = `${event.staffId}:${event.tick}`;
    const voices = voicesPerStaffTick.get(key) ?? new Set<number>();
    voices.add(event.voiceId);
    voicesPerStaffTick.set(key, voices);
  }

  const elements: EngravingElement[] = [];

  for (const event of events) {
    const x = (tickXMap.get(event.tick) ?? (event.tick - measure.tick) / CONFIG.TICKS_PER_QUARTER) + preambleWidth;
    
    // --- MULTI-STAFF Y-OFFSET CALCULATION ---
    const staffIndex = score.staves.findIndex(s => s.id === event.staffId);
    const staffOffsetY = staffIndex > 0 ? staffIndex * CONFIG.SYSTEM_HEIGHT_SPACING : 0;

    // ------------------------------------------------
    // NOTE
    // ------------------------------------------------
    if (event.kind === "note") {
      const clef = getActiveClef(score, event.staffId, event.tick);
      const staffPos = pitchToStaffPosition(event.pitch, clef);
      const noteY = staffPositionToY(staffPos) + staffOffsetY;
      const voiceCount = voicesPerStaffTick.get(`${event.staffId}:${event.tick}`)?.size ?? 1;
      const stem = resolveStem(event.id, staffPos, voiceCount, event.voiceId);

      elements.push({
        id: `el-note-${event.id}`,
        sourceId: event.id,
        type: "notehead",
        x,
        y: noteY,
        bbox: { ...CONFIG.BBOX_NOTEHEAD },
        glyph: { codepoint: noteheadCodepoint(event.duration.type) }
      });

      if (event.accidental !== null) {
        const accidentalGlyphs: Record<string, number> = {
          sharp:        0xe262,
          flat:         0xe260,
          natural:      0xe261,
          "double-sharp": 0xe263,
          "double-flat":  0xe264,
          "sharp-up":   0xe262,
          "flat-down":  0xe260,
        };
        elements.push({
          id: `el-acc-${event.id}`,
          sourceId: event.id,
          type: "accidental",
          x: x - 1.25, // offset left of notehead
          y: noteY,
          bbox: { ...CONFIG.BBOX_ACCIDENTAL },
          glyph: { codepoint: accidentalGlyphs[event.accidental] ?? 0xe261 }
        });
      }
      
      // --------------------------------------------
      // STEM
      // --------------------------------------------
      if (event.duration.type !== "whole") {
        const noteheadName = event.duration.type === "half" ? "noteheadHalf" : "noteheadBlack";
        const anchors = fonts.metadata?.glyphsWithAnchors?.[noteheadName];

        if (!anchors) {
          throw new Error(`Missing SMuFL anchors for ${noteheadName}`);
        }

        const anchor =
          stem.direction === "up"
            ? {
                x: anchors.stemUpSE[0] / CONFIG.STEM_UP_ANCHOR_X_SCALE,
                y: -anchors.stemUpSE[1] + CONFIG.STEM_UP_ANCHOR_Y_OFFSET
              }
            : {
                x: anchors.stemDownNW[0] + CONFIG.STEM_DOWN_ANCHOR_X_OFFSET,
                y: -anchors.stemDownNW[1] 
              };

        elements.push({
          id: `el-stem-${event.id}`,
          sourceId: event.id,
          type: "stem",
          x: x + anchor.x,
          y: noteY + anchor.y,
          bbox: {
            left: CONFIG.STEM_BBOX_LEFT,
            right: CONFIG.STEM_BBOX_RIGHT,
            top: stem.direction === "up" ? -CONFIG.STEM_LENGTH : CONFIG.STEM_BBOX_DOWN_PADDING_TOP,
            bottom: stem.direction === "up" ? 0 : CONFIG.STEM_LENGTH
          },
          path: [
            { type: "M", x: 0, y: 0 },
            {
              type: "L",
              x: 0,
              y: stem.direction === "up" ? -CONFIG.STEM_LENGTH : CONFIG.STEM_LENGTH
            }
          ]
        });
      }
    }

    // ------------------------------------------------
    // REST
    // ------------------------------------------------
    else if (event.kind === "rest") {
      elements.push({
        id: `el-rest-${event.id}`,
        sourceId: event.id,
        type: "rest",
        x,
        y: CONFIG.Y_REST_DEFAULT + staffOffsetY,
        bbox: { ...CONFIG.BBOX_RESTHALF },
        glyph: { codepoint: restCodepoint(event.duration.type) }
      });
    }

    // ------------------------------------------------
    // BARLINE
    // ------------------------------------------------
    else if (event.kind === "barline") {
      elements.push({
        id: `el-barline-${event.id}`,
        sourceId: event.id,
        type: "barline",
        x,
        y: staffOffsetY,
        bbox: { ...CONFIG.BBOX_BARLINE }
      });
    }
    
    // ------------------------------------------------
    // CLEF
    // ------------------------------------------------
    else if (event.kind === "clef") {
      const clefGlyphs: Record<string, number> = {
        treble: 0xe050, bass: 0xe062, alto: 0xe05c, tenor: 0xe05c,
        treble8vb: 0xe052, bass8vb: 0xe062, percussion: 0xe069,
      };
      
      elements.push({
        id: `el-clef-${event.id}`,
        sourceId: event.id,
        type: "clef",
        x: 0, 
        y: (CONFIG.Y_CLEFS[event.clef] ?? 1.0) + staffOffsetY,
        bbox: { ...CONFIG.BBOX_CLEF },
        glyph: { codepoint: clefGlyphs[event.clef] ?? 0xe050 }
      });
    }

    // ------------------------------------------------
    // KEY SIGNATURE (Armadura)
    // ------------------------------------------------
    else if (event.kind === "keysig") {
      // Safely access the number of fifths (positive = sharps, negative = flats)
      const keyObj = event["key" as keyof typeof event] as any;
      const fifths = keyObj?.fifths ?? 0;
      const isSharp = fifths > 0;
      const count = Math.abs(fifths);
      
      const SMUFL_SHARP = 0xE262;
      const SMUFL_FLAT = 0xE260;
      
      // Standard treble clef vertical offsets for accidentals
      const sharpY = [0.5, 2.0, -0.5, 1.0, 2.5, 0.0, 1.5]; // F, C, G, D, A, E, B
      const flatY = [2.0, 0.5, 2.5, 1.0, 3.0, 1.5, 3.5];   // B, E, A, D, G, C, F

      for (let i = 0; i < count && i < 7; i++) {
        const yOffset = isSharp ? sharpY[i] : flatY[i];
        const glyphCode = isSharp ? SMUFL_SHARP : SMUFL_FLAT;
        
        elements.push({
          id: `el-keysig-${event.id}-${i}`,
          sourceId: event.id,
          type: "keysig",
          // Stagger them horizontally based on their index
          x: preambleWidth - CONFIG.PREAMBLE_TIMESIG_WIDTH - CONFIG.PREAMBLE_KEYSIG_WIDTH + (i * 0.8),
          y: (yOffset ?? 1.0) + staffOffsetY,
          bbox: { ...CONFIG.BBOX_KEYSIG },
          glyph: { codepoint: glyphCode }
        });
      }
    }

    // ------------------------------------------------
    // TIME SIGNATURE (COMPÁS)
    // ------------------------------------------------
    else if (event.kind === "timesig") {
      const digitGlyphs: Record<number, number> = {
        0: 0xe080, 1: 0xe081, 2: 0xe082, 3: 0xe083, 4: 0xe084,
        5: 0xe085, 6: 0xe086, 7: 0xe087, 8: 0xe088, 9: 0xe089
      };

      const rawValue = event["value" as keyof typeof event] || "4/4";
      let num = 4;
      let den = 4;

      if (typeof rawValue === "string" && rawValue.includes("/")) {
        const parts = rawValue.split("/");
        num = parseInt(parts[0] || "4", 10);
        den = parseInt(parts[1] || "4", 10);
      } else {
        num = (event["numerator" as keyof typeof event] as number) ?? 4;
        den = (event["denominator" as keyof typeof event] as number) ?? 4;
      }

      elements.push({
        id: `el-timesig-num-${event.id}`,
        sourceId: event.id,
        type: "timesig", 
        x: preambleWidth - CONFIG.PREAMBLE_TIMESIG_WIDTH, 
        y: CONFIG.Y_TIMESIG_NUMERATOR + staffOffsetY, 
        bbox: { ...CONFIG.BBOX_TIMESIG },
        glyph: { codepoint: digitGlyphs[num] ?? 0xe084 }
      });

      elements.push({
        id: `el-timesig-den-${event.id}`,
        sourceId: event.id,
        type: "clef",
        x: preambleWidth - CONFIG.PREAMBLE_TIMESIG_WIDTH,
        y: CONFIG.Y_TIMESIG_DENOMINATOR + staffOffsetY,
        bbox: { ...CONFIG.BBOX_TIMESIG },
        glyph: { codepoint: digitGlyphs[den] ?? 0xe084 }
      });
    }
  }

  return elements;
}

// ----------------------------------------------------
// STAFF LINES
// ----------------------------------------------------

function createSystemStaffLines(score: Score, systemWidth: number): EngravingSystem["staffLines"] {
  return score.staves.map((staff, index) => ({
    staffId: staff.id,
    x: 0,
    y: index * CONFIG.SYSTEM_HEIGHT_SPACING,
    width: systemWidth,
    lineCount: staff.lineCount
  }));
}

// ----------------------------------------------------
// SKYLINE COLLISION
// ----------------------------------------------------

function runSkylinePlacement(elements: EngravingElement[], staffIds: string[]): EngravingElement[] {
  const topSkylines = new Map<string, Skyline>();
  const bottomSkylines = new Map<string, Skyline>();

  for (const staffId of staffIds) {
    topSkylines.set(staffId, {
      direction: "up",
      segments: [{ xStart: 0, xEnd: CONFIG.SKYLINE_MAX_X_SPAN, y: 0 }]
    });

    bottomSkylines.set(staffId, {
      direction: "down",
      segments: [{ xStart: 0, xEnd: CONFIG.SKYLINE_MAX_X_SPAN, y: CONFIG.STAFF_BOTTOM_Y }]
    });
  }

  const fallbackStaffId = staffIds[0] ?? "default";
  const output = [...elements];

  for (const element of output) {
    const staffId = fallbackStaffId;
    const top = topSkylines.get(staffId)!;
    const bottom = bottomSkylines.get(staffId)!;

    if (element.type === "dynamic") {
      const placed = placeBelowSkyline(
        bottom,
        element.x - CONFIG.SKYLINE_DYNAMICS.xPad,
        element.x + CONFIG.SKYLINE_DYNAMICS.xPad,
        CONFIG.SKYLINE_DYNAMICS.hPad,
        CONFIG.SKYLINE_DYNAMICS.margin
      );
      element.y = placed.y;
      bottomSkylines.set(staffId, placed.updatedSkyline);
    }
    else if (element.type === "lyric" || element.type === "text") {
      const placed = placeBelowSkyline(
        bottom,
        element.x - CONFIG.SKYLINE_LYRICS.xPad,
        element.x + CONFIG.SKYLINE_LYRICS.xPad,
        CONFIG.SKYLINE_LYRICS.hPad,
        CONFIG.SKYLINE_LYRICS.margin
      );
      element.y = placed.y;
      bottomSkylines.set(staffId, placed.updatedSkyline);
    }
    else if (element.type === "articulation") {
      const placed = placeAboveSkyline(
        top,
        element.x - CONFIG.SKYLINE_ARTIC.xPad,
        element.x + CONFIG.SKYLINE_ARTIC.xPad,
        CONFIG.SKYLINE_ARTIC.hPad,
        CONFIG.SKYLINE_ARTIC.margin
      );
      element.y = placed.y;
      topSkylines.set(staffId, placed.updatedSkyline);
    }
  }

  return output;
}

// ----------------------------------------------------
// MAIN ENGRAVING ENTRY
// ----------------------------------------------------

export function engrave(
  score: Score,
  params: LayoutParameters,
  fonts: FontMetrics
): EngravingResult {
  const sliceMap = buildSliceMap(score);
  void sliceMap;

  for (const staff of score.staves) {
    for (let voiceId = 1; voiceId <= 4; voiceId += 1) {
      resolveBeamGroups(score, staff.id, voiceId);
    }
  }

  const notesByTick = new Map<number, NoteEvent[]>();
  for (const event of score.events.values()) {
    if (event.kind !== "note") continue;
    const list = notesByTick.get(event.tick) ?? [];
    list.push(event);
    notesByTick.set(event.tick, list);
  }

  for (const [tick, notes] of notesByTick.entries()) {
    const key = getActiveKeySignature(score, tick);
    placeAccidentals(notes, key);
  }

  const widths = new Map<string, number>();
  for (const measure of score.measures) {
    widths.set(measure.id, baseMeasureWidth(score, measure));
  }

  const breaks = breakIntoSystems(score.measures, widths, params);
  const staffIds = score.staves.map((s) => s.id);
  const systems: EngravingSystem[] = [];
  let systemY = params.marginTop;

  for (let systemIndex = 0; systemIndex < breaks.systems.length; systemIndex += 1) {
    const systemLayout = breaks.systems[systemIndex]!;
    const measureModels = systemLayout.measureIds
      .map((measureId) => score.measures.find((measure) => measure.id === measureId))
      .filter((measure): measure is Measure => Boolean(measure));

    let cursorX = 0;
    const measures: EngravingMeasure[] = [];

    for (const measure of measureModels) {
      const naturalWidth = widths.get(measure.id) ?? CONFIG.DEFAULT_MEASURE_WIDTH;
      const measureWidth = naturalWidth * systemLayout.stretchFactor;
      const rawElements = eventElementsForMeasure(score, measure, fonts);

      const scaledElements = rawElements.map((el) => {
        if (el.type === "clef" || el.type === "keysig" || el.type === "timesig") {
          return el;
        }
        return {
          ...el,
          x: naturalWidth > 0 ? (el.x / naturalWidth) * measureWidth : el.x
        };
      });

      const elements = runSkylinePlacement(scaledElements, staffIds);

      measures.push({
        measureId: measure.id,
        x: cursorX,
        y: 0,
        width: measureWidth,
        elements,
        spanners: []
      });

      cursorX += measureWidth;
    }

    const systemWidth = params.pageWidth - params.marginLeft - params.marginRight;

    systems.push({
      id: `system-${systemIndex}`,
      x: params.marginLeft,
      y: systemY,
      width: systemWidth,
      height: score.staves.length * CONFIG.SYSTEM_HEIGHT_SPACING,
      measures,
      bracketElements: [],
      staffLines: createSystemStaffLines(score, systemWidth)
    });

    systemY += score.staves.length * CONFIG.SYSTEM_HEIGHT_SPACING + params.systemSpacing;
  }

  const eventPositions = new Map<string, { x: number; y: number }>();
  for (const system of systems) {
    for (const measure of system.measures) {
      for (const el of measure.elements) {
        if (el.sourceId && el.type === "notehead") {
          eventPositions.set(el.sourceId, {
            x: system.x + measure.x + el.x,
            y: system.y + measure.y + el.y
          });
        }
      }
    }
  }

  for (const spanner of score.spanners.values()) {
    if (spanner.kind !== "slur" && spanner.kind !== "tie") continue;

    const startPos = eventPositions.get(spanner.startId);
    const endPos = eventPositions.get(spanner.endId);
    if (!startPos || !endPos) continue;

    const spannerPath = computeSlurGeometry(
      spanner,
      startPos,
      endPos,
      {
        direction: "up",
        segments: [{ xStart: 0, xEnd: CONFIG.SKYLINE_MAX_X_SPAN, y: startPos.y - CONFIG.SKYLINE_SLUR_OFFSET }]
      },
      {
        direction: "down",
        segments: [{ xStart: 0, xEnd: CONFIG.SKYLINE_MAX_X_SPAN, y: startPos.y + CONFIG.SKYLINE_SLUR_OFFSET }]
      }
    );

    // Inject the computed spanner path directly into the first measure of the first system
    // so the renderer has access to draw the Bézier curve.
    if (spannerPath && systems[0]?.measures[0]) {
      systems[0].measures[0].spanners.push({
        id: `span-render-${spanner.id}`,
        sourceId: spanner.id,
        type: spanner.kind,
        path: spannerPath,
        bbox: { left: 0, top: -2, right: (endPos.x - startPos.x), bottom: 2 } // Fallback generic span box
      });
    }
  }

  return {
    pages: [{
      index: 0,
      width: params.pageWidth,
      height: params.pageHeight,
      systems,
      pageElements: []
    }],
    totalPages: 1
  };
}

export function reengraveFromMeasure(
  score: Score,
  params: LayoutParameters,
  fonts: FontMetrics,
  fromMeasure: number,
  previous: EngravingResult
): EngravingResult {
  void fromMeasure;
  void previous;

  return engrave(score, params, fonts);
}