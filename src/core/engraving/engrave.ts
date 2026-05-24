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

// Staff positions are 0-based from the bottom line.
// Renderer coordinates are top-origin:
//   smaller Y = visually higher
//   larger Y = visually lower
//
// staffPosition 4 -> top line
// staffPosition 0 -> bottom line
function staffPositionToY(staffPosition: number): number {
  return (4 - staffPosition) * 0.5;
}

function defaultBBox(): BoundingBox {
  return {
    left: -0.5,
    top: -0.5,
    right: 0.5,
    bottom: 0.5
  };
}

function noteheadCodepoint(type: string): number {
  if (type === "whole") return 0xe0a2;
  if (type === "half") return 0xe0a3;
  return 0xe0a4;
}
// ----------------------------------------------------
// SPRING SPACING
// ----------------------------------------------------

function buildTickXMap(
  score: Score,
  measure: Measure
): Map<number, number> {
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
    (sum, s) =>
      sum +
      s.minWidth +
      s.proportionalWidth +
      s.extraWidth,
    0
  );

  const positions = solveSpacing(
    springs,
    naturalWidth
  );

  const tickXMap = new Map<number, number>();

  for (let i = 0; i < measureSlices.length; i++) {
    tickXMap.set(
      measureSlices[i]!.tick,
      positions[i] ?? 0
    );
  }

  return tickXMap;
}

function baseMeasureWidth(
  score: Score,
  measure: Measure
): number {
  const sliceMap = buildSliceMap(score);

  const measureSlices = sliceMap.slices.filter(
    (slice) =>
      slice.tick >= measure.tick &&
      slice.tick < measure.tick + measure.duration
  );

  const springs = buildSprings(measureSlices, score);

  if (springs.length === 0) {
    return 6;
  }

  const naturalWidth = springs.reduce(
    (sum, s) =>
      sum +
      s.minWidth +
      s.proportionalWidth +
      s.extraWidth,
    0
  );

  const positions = solveSpacing(
    springs,
    naturalWidth
  );

  const lastSpring = springs[springs.length - 1]!;

  return (
    (positions[positions.length - 1] ?? 0) +
    lastSpring.proportionalWidth +
    1.0
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
  const tickXMap = buildTickXMap(
    score,
    measure
  );

  const events = [...score.events.values()]
    .filter(
      (event) =>
        event.tick >= measure.tick &&
        event.tick < measure.tick + measure.duration
    )
    .sort(
      (left, right) =>
        left.tick - right.tick
    );

  // Count active voices per staff/tick
  // for stem direction logic.
  const voicesPerStaffTick =
    new Map<string, Set<number>>();

  for (const event of events) {
    if (
      event.kind !== "note" &&
      event.kind !== "rest"
    ) {
      continue;
    }

    const key =
      `${event.staffId}:${event.tick}`;

    const voices =
      voicesPerStaffTick.get(key) ??
      new Set<number>();

    voices.add(event.voiceId);

    voicesPerStaffTick.set(
      key,
      voices
    );
  }

  const elements: EngravingElement[] = [];

  for (const event of events) {
    const x =
      tickXMap.get(event.tick) ??
      (event.tick - measure.tick) / 480;

    // ------------------------------------------------
    // NOTE
    // ------------------------------------------------

    if (event.kind === "note") {
      const clef = getActiveClef(
        score,
        event.staffId,
        event.tick
      );

      const staffPos =
        pitchToStaffPosition(
          event.pitch,
          clef
        );

      const noteY =
        staffPositionToY(staffPos);

      const voiceCount =
        voicesPerStaffTick.get(
          `${event.staffId}:${event.tick}`
        )?.size ?? 1;

      const stem = resolveStem(
        event.id,
        staffPos,
        voiceCount,
        event.voiceId
      );

      // --------------------------------------------
      // NOTEHEAD
      // --------------------------------------------

      elements.push({
        id: `el-note-${event.id}`,
        sourceId: event.id,
        type: "notehead",

        x,
        y: noteY,

        bbox: {
          left: -0.5,
          top: -0.32,
          right: 0.5,
          bottom: 0.32
        },

        glyph: {
          codepoint:
            noteheadCodepoint(
              event.duration.type
            )
        }
      });

      // --------------------------------------------
      // STEM
      // --------------------------------------------

      if (event.duration.type !== "whole") {
        const noteheadName =
          event.duration.type === "half"
            ? "noteheadHalf"
            : "noteheadBlack";

        const anchors =
          fonts.metadata?.glyphsWithAnchors?.[noteheadName];

        if (!anchors) {
          throw new Error(
            `Missing SMuFL anchors for ${noteheadName}`
          );
        }

        const stemLength = 3.5;

        // SMuFL stemUpSE = right edge of notehead (use for up stems)
        // SMuFL stemDownNW = left edge of notehead (use for down stems)
        // SMuFL Y is upward-positive; renderer Y is downward-positive → negate Y
        //We will have to change it in the furture to use the FontCalibration
        //FONTCALIBRATION
        const anchor =
          stem.direction === "up"
            ? {
                x: anchors.stemUpSE[0] / 1.38,
                y: -anchors.stemUpSE[1]
              }
            : {
                x: anchors.stemDownNW[0] + 0.068,
                y: -anchors.stemDownNW[1] 
              };

        elements.push({
          id: `el-stem-${event.id}`,
          sourceId: event.id,
          type: "stem",

          x: x + anchor.x,
          y: noteY + anchor.y,

          bbox: {
            left: -0.06,
            right: 0.06,
            top: stem.direction === "up" ? -stemLength : 0,
            bottom: stem.direction === "up" ? 0 : stemLength
          },

          path: [
            { type: "M", x: 0, y: 0 },
            {
              type: "L",
              x: 0,
              y: stem.direction === "up" ? -stemLength : stemLength
            }
          ]
        });
        console.log(
          event.pitch.step + event.pitch.octave,
          "dir:", stem.direction,
          "noteY:", noteY,
          "anchor:", JSON.stringify(anchor),
          "stemY:", noteY + anchor.y
        );
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
        y: 1.0,

        bbox: defaultBBox()
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
        y: 0,

        bbox: {
          left: -0.06,
          top: 0,
          right: 0.06,
          bottom: 4.0
        }
      });
    }
  }

  return elements;
}

// ----------------------------------------------------
// STAFF LINES
// ----------------------------------------------------

function createSystemStaffLines(
  score: Score,
  systemWidth: number
): EngravingSystem["staffLines"] {
  return score.staves.map(
    (staff, index) => ({
      staffId: staff.id,

      x: 0,
      y: index * 10,

      width: systemWidth,

      lineCount: staff.lineCount
    })
  );
}

// ----------------------------------------------------
// SKYLINE COLLISION
// ----------------------------------------------------

function runSkylinePlacement(
  elements: EngravingElement[],
  staffIds: string[]
): EngravingElement[] {
  const topSkylines =
    new Map<string, Skyline>();

  const bottomSkylines =
    new Map<string, Skyline>();

  for (const staffId of staffIds) {
    topSkylines.set(staffId, {
      direction: "up",
      segments: [
        {
          xStart: 0,
          xEnd: 10000,
          y: 0
        }
      ]
    });

    bottomSkylines.set(staffId, {
      direction: "down",
      segments: [
        {
          xStart: 0,
          xEnd: 10000,
          y: 4.0
        }
      ]
    });
  }

  const fallbackStaffId =
    staffIds[0] ?? "default";

  const output = [...elements];

  for (const element of output) {
    const staffId =
      fallbackStaffId;

    const top =
      topSkylines.get(staffId)!;

    const bottom =
      bottomSkylines.get(staffId)!;

    if (element.type === "dynamic") {
      const placed =
        placeBelowSkyline(
          bottom,
          element.x - 0.5,
          element.x + 0.5,
          0.8,
          0.4
        );

      element.y = placed.y;

      bottomSkylines.set(
        staffId,
        placed.updatedSkyline
      );
    }

    else if (
      element.type === "lyric" ||
      element.type === "text"
    ) {
      const placed =
        placeBelowSkyline(
          bottom,
          element.x - 0.8,
          element.x + 0.8,
          0.9,
          0.4
        );

      element.y = placed.y;

      bottomSkylines.set(
        staffId,
        placed.updatedSkyline
      );
    }

    else if (
      element.type === "articulation"
    ) {
      const placed =
        placeAboveSkyline(
          top,
          element.x - 0.5,
          element.x + 0.5,
          0.6,
          0.3
        );

      element.y = placed.y;

      topSkylines.set(
        staffId,
        placed.updatedSkyline
      );
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
  const sliceMap =
    buildSliceMap(score);

  void sliceMap;

  // Resolve beam groups
  for (const staff of score.staves) {
    for (
      let voiceId = 1;
      voiceId <= 4;
      voiceId += 1
    ) {
      resolveBeamGroups(
        score,
        staff.id,
        voiceId
      );
    }
  }

  // Place accidentals
  const notesByTick =
    new Map<number, NoteEvent[]>();

  for (const event of score.events.values()) {
    if (event.kind !== "note") {
      continue;
    }

    const list =
      notesByTick.get(event.tick) ??
      [];

    list.push(event);

    notesByTick.set(
      event.tick,
      list
    );
  }

  for (const [tick, notes] of notesByTick.entries()) {
    const key =
      getActiveKeySignature(
        score,
        tick
      );

    placeAccidentals(notes, key);
  }

  // Measure widths
  const widths =
    new Map<string, number>();

  for (const measure of score.measures) {
    widths.set(
      measure.id,
      baseMeasureWidth(
        score,
        measure
      )
    );
  }

  // System breaking
  const breaks =
    breakIntoSystems(
      score.measures,
      widths,
      params
    );

  const staffIds =
    score.staves.map(
      (s) => s.id
    );

  const systems: EngravingSystem[] = [];

  let systemY =
    params.marginTop;

  for (
    let systemIndex = 0;
    systemIndex <
    breaks.systems.length;
    systemIndex += 1
  ) {
    const systemLayout =
      breaks.systems[
        systemIndex
      ]!;

    const measureModels =
      systemLayout.measureIds
        .map((measureId) =>
          score.measures.find(
            (measure) =>
              measure.id ===
              measureId
          )
        )
        .filter(
          (
            measure
          ): measure is Measure =>
            Boolean(measure)
        );

    let cursorX = 0;

    const measures:
      EngravingMeasure[] = [];

    for (const measure of measureModels) {
      const naturalWidth =
        widths.get(measure.id) ?? 6;

      const measureWidth =
        naturalWidth *
        systemLayout.stretchFactor;

      const rawElements =
        eventElementsForMeasure(
          score,
          measure,
          fonts
        );

      const scaledElements =
        rawElements.map((el) => ({
          ...el,

          x:
            naturalWidth > 0
              ? (el.x / naturalWidth) *
                measureWidth
              : el.x
        }));

      const elements =
        runSkylinePlacement(
          scaledElements,
          staffIds
        );

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

    const systemWidth =
      params.pageWidth -
      params.marginLeft -
      params.marginRight;

    systems.push({
      id: `system-${systemIndex}`,

      x: params.marginLeft,
      y: systemY,

      width: systemWidth,

      height:
        score.staves.length * 10,

      measures,

      bracketElements: [],

      staffLines:
        createSystemStaffLines(
          score,
          systemWidth
        )
    });

    systemY +=
      score.staves.length * 10 +
      params.systemSpacing;
  }

  // Slur/tie geometry
  const eventPositions =
    new Map<
      string,
      { x: number; y: number }
    >();

  for (const system of systems) {
    for (const measure of system.measures) {
      for (const el of measure.elements) {
        if (
          el.sourceId &&
          el.type === "notehead"
        ) {
          eventPositions.set(
            el.sourceId,
            {
              x:
                system.x +
                measure.x +
                el.x,

              y:
                system.y +
                measure.y +
                el.y
            }
          );
        }
      }
    }
  }

  for (const spanner of score.spanners.values()) {
    if (
      spanner.kind !== "slur" &&
      spanner.kind !== "tie"
    ) {
      continue;
    }

    const startPos =
      eventPositions.get(
        spanner.startId
      );

    const endPos =
      eventPositions.get(
        spanner.endId
      );

    if (!startPos || !endPos) {
      continue;
    }

    computeSlurGeometry(
      spanner,
      startPos,
      endPos,

      {
        direction: "up",

        segments: [
          {
            xStart: 0,
            xEnd: 100000,
            y: startPos.y - 2
          }
        ]
      },

      {
        direction: "down",

        segments: [
          {
            xStart: 0,
            xEnd: 100000,
            y: startPos.y + 2
          }
        ]
      }
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

// ----------------------------------------------------
// INCREMENTAL RE-ENGRAVING
// ----------------------------------------------------

export function reengraveFromMeasure(
  score: Score,
  params: LayoutParameters,
  fonts: FontMetrics,
  fromMeasure: number,
  previous: EngravingResult
): EngravingResult {
  void fromMeasure;
  void previous;

  return engrave(
    score,
    params,
    fonts
  );
}