import type { Measure, NoteEvent, Score } from "../model/index.js";
import { getActiveClef, getActiveKeySignature, pitchToStaffPosition } from "../model/index.js";
import { buildSliceMap } from "../temporal/index.js";
import { buildSprings, solveSpacing } from "./spacing/spacingSolver.js";
import { resolveBeamGroups } from "./beaming/beamResolver.js";
import { breakIntoSystems } from "./systems/systemBreaker.js";
import { placeAccidentals } from "./accidentals/accidentalPlacer.js";
import { resolveStem } from "./stems/stemResolver.js";
import { computeSlurGeometry } from "./slurs/slurPlacer.js";
import { placeBelowSkyline, placeAboveSkyline, type Skyline } from "./collision/skyline.js";
import type {
  BoundingBox,
  EngravingElement,
  EngravingMeasure,
  EngravingResult,
  EngravingSystem,
  FontMetrics,
  LayoutParameters
} from "./types.js";

// Staff positions are 0-based from the bottom line.
// The renderer draws noteheads at Y = (4 - staffPosition) staff spaces from the top line,
// because the top line of a 5-line staff is position 4 and Y increases downward.
// We store Y relative to staff top (top line = 0), so:
//   staffPosition 4 → Y 0 (top line)
//   staffPosition 2 → Y 1 (middle line, one staff space below top)
//   staffPosition 0 → Y 2 (bottom line)
function staffPositionToY(staffPosition: number): number {
  return (4 - staffPosition) * 0.5; // in staff spaces, 0 = top line
}

function defaultBBox(): BoundingBox {
  return { left: -0.5, top: -0.5, right: 0.5, bottom: 0.5 };
}

function noteheadCodepoint(type: string): number {
  if (type === "whole") return 0xe0a2;
  if (type === "half") return 0xe0a3;
  return 0xe0a4; // quarter, eighth, 16th, 32nd, etc.
}

// Pre-compute tick → X positions for all slices in a measure using the spring solver.
// Returns a Map<tick, x> for O(1) lookup during element building.
function buildTickXMap(score: Score, measure: Measure): Map<number, number> {
  const sliceMap = buildSliceMap(score);
  const measureSlices = sliceMap.slices.filter(
    (slice) => slice.tick >= measure.tick && slice.tick < measure.tick + measure.duration
  );
  const springs = buildSprings(measureSlices, score);
  if (springs.length === 0) {
    return new Map();
  }
  // Solve with a generous available width; system justification scales the result later.
  const naturalWidth = springs.reduce((sum, s) => sum + s.minWidth + s.proportionalWidth + s.extraWidth, 0);
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
    (slice) => slice.tick >= measure.tick && slice.tick < measure.tick + measure.duration
  );
  const springs = buildSprings(measureSlices, score);
  if (springs.length === 0) {
    return 6;
  }
  const naturalWidth = springs.reduce((sum, s) => sum + s.minWidth + s.proportionalWidth + s.extraWidth, 0);
  const positions = solveSpacing(springs, naturalWidth);
  // Total width = last note position + last note's proportional width + trailing gap
  const lastSpring = springs[springs.length - 1]!;
  return (positions[positions.length - 1] ?? 0) + lastSpring.proportionalWidth + 1.0;
}

function eventElementsForMeasure(score: Score, measure: Measure): EngravingElement[] {
  // Build proportional X positions once for this measure.
  const tickXMap = buildTickXMap(score, measure);

  const events = [...score.events.values()]
    .filter((event) => event.tick >= measure.tick && event.tick < measure.tick + measure.duration)
    .sort((left, right) => left.tick - right.tick);

  // Count voices per staff at each tick for stem direction.
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
    // X from the spring solver; fall back to a linear estimate only if the tick
    // has no slice (shouldn't happen for valid scores, but be defensive).
    const x = tickXMap.get(event.tick) ?? (event.tick - measure.tick) / 480;

    if (event.kind === "note") {
      const clef = getActiveClef(score, event.staffId, event.tick);
      const staffPos = pitchToStaffPosition(event.pitch, clef);
      console.log(event.pitch.step + event.pitch.octave, "staffPos:", staffPos);
      const noteY = staffPositionToY(staffPos);
      const voiceCount = voicesPerStaffTick.get(`${event.staffId}:${event.tick}`)?.size ?? 1;
      const stem = resolveStem(event.id, staffPos, voiceCount, event.voiceId);
      console.log(event.pitch.step + event.pitch.octave, "direction:", stem.direction);
      const stemBaseY = stem.direction === "up" ? noteY + 0.16 : noteY - 0.16;
      const stemTipY = stem.direction === "up" ? noteY - 3.5 : noteY + 3.5;
    
      // NOTEHEAD
      elements.push({
        id: `el-note-${event.id}`,
        sourceId: event.id,
        type: "notehead",
        x,
        y: noteY,
        bbox: { left: -0.5, top: -0.32, right: 0.5, bottom: 0.32 },
        glyph: { codepoint: noteheadCodepoint(event.duration.type) }
      });
      // STEM
      // STEM — whole notes have no stem
      if (event.duration.type !== "whole") {
        elements.push({
          id: `el-stem-${event.id}`,
          sourceId: event.id,
          type: "stem",
          x,
          y: stemBaseY,
          bbox: {
            left: -0.06,
            top: Math.min(0, stemTipY - stemBaseY),
            right: 0.06,
            bottom: Math.max(0, stemTipY - stemBaseY)
          },
          path: [
            { type: "M", x: stem.direction === "up" ? 0.5 : -0.5, y: 0 },
            { type: "L", x: stem.direction === "up" ? 0.5 : -0.5, y: stem.direction === "up" ? -3.5 : 3.5 },
          ]
        });
        console.log(event.pitch.step + event.pitch.octave, "path:", JSON.stringify(elements[elements.length - 1]?.path));
      
      }
    } else if (event.kind === "rest") {
      elements.push({
        id: `el-rest-${event.id}`,
        sourceId: event.id,
        type: "rest",
        x,
        y: 1.0, // rests sit at middle of staff (1 staff space below top line)
        bbox: defaultBBox()
      });
    } else if (event.kind === "barline") {
      elements.push({
        id: `el-barline-${event.id}`,
        sourceId: event.id,
        type: "barline",
        x,
        y: 0,
        bbox: { left: -0.06, top: 0, right: 0.06, bottom: 4.0 }
      });
    }
  }
  
  return elements;
}

function createSystemStaffLines(score: Score, systemWidth: number): EngravingSystem["staffLines"] {
  return score.staves.map((staff, index) => ({
    staffId: staff.id,
    x: 0,
    y: index * 10, // relative to system top; each staff is 10 staff spaces apart
    width: systemWidth,
    lineCount: staff.lineCount
  }));
}

// Per-staff skyline placement. Each staff gets independent top/bottom skylines so
// that dynamics below staff 1 never collide with lyrics below staff 2.
function runSkylinePlacement(
  elements: EngravingElement[],
  staffIds: string[]
): EngravingElement[] {
  const topSkylines = new Map<string, Skyline>();
  const bottomSkylines = new Map<string, Skyline>();
  for (const staffId of staffIds) {
    topSkylines.set(staffId, { direction: "up", segments: [{ xStart: 0, xEnd: 10000, y: 0 }] });
    bottomSkylines.set(staffId, { direction: "down", segments: [{ xStart: 0, xEnd: 10000, y: 4.0 }] });
  }

  // Default staffId for elements that don't carry one (shouldn't happen in practice).
  const fallbackStaffId = staffIds[0] ?? "default";

  const output = [...elements];
  for (const element of output) {
    // Derive the staffId from the sourceId lookup — elements carry sourceId pointing
    // back to the ScoreEvent. We use the fallback for geometry elements (stems, beams).
    // For now place dynamics/lyrics/articulations on the fallback staff;
    // Phase 6 will wire up staffId on EngravingElement when the editor is built.
    const staffId = fallbackStaffId;
    const top = topSkylines.get(staffId)!;
    const bottom = bottomSkylines.get(staffId)!;

    if (element.type === "dynamic") {
      const placed = placeBelowSkyline(bottom, element.x - 0.5, element.x + 0.5, 0.8, 0.4);
      element.y = placed.y;
      bottomSkylines.set(staffId, placed.updatedSkyline);
    } else if (element.type === "lyric" || element.type === "text") {
      const placed = placeBelowSkyline(bottom, element.x - 0.8, element.x + 0.8, 0.9, 0.4);
      element.y = placed.y;
      bottomSkylines.set(staffId, placed.updatedSkyline);
    } else if (element.type === "articulation") {
      const placed = placeAboveSkyline(top, element.x - 0.5, element.x + 0.5, 0.6, 0.3);
      element.y = placed.y;
      topSkylines.set(staffId, placed.updatedSkyline);
    }
  }

  return output;
}

/**
 * Deterministic engraving entry point.
 *
 * @param score Semantic score model.
 * @param params Layout parameters.
 * @param fonts Font metrics (phase 4 adapter payload).
 * @returns Engraving geometry.
 */
export function engrave(score: Score, params: LayoutParameters, fonts: FontMetrics): EngravingResult {
  void fonts;

  // 1) Build temporal slice map (used inside buildTickXMap per measure).
  const sliceMap = buildSliceMap(score);
  void sliceMap;

  // 2) Resolve beam groups per staff/voice so stem directions are group-aware.
  //    Results are consumed inside eventElementsForMeasure via resolveStem.
  for (const staff of score.staves) {
    for (let voiceId = 1; voiceId <= 4; voiceId += 1) {
      resolveBeamGroups(score, staff.id, voiceId);
    }
  }

  // 3) Place accidentals — groups notes by tick across all staves.
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

  // 4) Compute natural measure widths via the spring solver.
  const widths = new Map<string, number>();
  for (const measure of score.measures) {
    widths.set(measure.id, baseMeasureWidth(score, measure));
  }

  // 5) Break measures into systems and compute justification stretch factors.
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
      const naturalWidth = widths.get(measure.id) ?? 6;
      const measureWidth = naturalWidth * systemLayout.stretchFactor;

      // Build elements with spring-solver X positions and real pitch Y positions.
      const rawElements = eventElementsForMeasure(score, measure);

      // Scale element X positions to the justified measure width.
      // The spring solver returns positions in "natural" staff-space units;
      // we scale them proportionally so they fill the justified width.
      const scaledElements = rawElements.map((el) => ({
        ...el,
        x: naturalWidth > 0 ? (el.x / naturalWidth) * measureWidth : el.x
      }));

      // Run per-staff skyline placement for dynamics, lyrics, articulations.
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
      height: score.staves.length * 10,
      measures,
      bracketElements: [],
      staffLines: createSystemStaffLines(score, systemWidth)
    });
    systemY += score.staves.length * 10 + params.systemSpacing;
  }

  // 6) Compute slur/tie geometry using real note positions from the engraved measures.
  //    Build a quick lookup: eventId → {x, y} from the assembled geometry.
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

    computeSlurGeometry(
      spanner,
      startPos,
      endPos,
      { direction: "up", segments: [{ xStart: 0, xEnd: 100000, y: startPos.y - 2 }] },
      { direction: "down", segments: [{ xStart: 0, xEnd: 100000, y: startPos.y + 2 }] }
    );
  }

  return {
    pages: [
      {
        index: 0,
        width: params.pageWidth,
        height: params.pageHeight,
        systems,
        pageElements: []
      }
    ],
    totalPages: 1
  };
}

/**
 * Re-engraves from a measure index onward.
 *
 * @param score Current score.
 * @param params Layout parameters.
 * @param fonts Font metrics payload.
 * @param fromMeasure Start measure index.
 * @param previous Previous engraving result.
 * @returns Updated engraving result.
 */
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