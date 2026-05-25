import type { NoteEvent } from "../../model/index.js";
import type { EngravingElement } from "../types.js";
import type { ResolvedBeamGroup } from "./beamResolver.js";
import { computeBeamCount } from "./beamResolver.js";
import { getBeatTicks, shouldBreakBeamAtLevel } from "./groups.js";

export type BeamStemTip = {
  noteId: string;
  x: number;
  y: number;
  stem: EngravingElement;
  direction: "up" | "down";
};

export type BeamAnchorLayout = {
  firstStemX: number;
  lastStemX: number;
  firstBeamY: number;
  lastBeamY: number;
  clampedSlope: number;
  stemDirection: "up" | "down";
};

export type BeamLayoutConfig = {
  beamThickness: number;
  beamMaxSlope: number;
  beamLevelGap: number;
};

export function inferStemDirection(stem: EngravingElement): "up" | "down" {
  const end = stem.path?.[1];
  if (end?.type === "L" && end.y < 0) {
    return "up";
  }
  return "down";
}

export function getStemTipY(stem: EngravingElement, stemDirection: "up" | "down"): number {
  return stemDirection === "up" ? stem.y + stem.bbox.top : stem.y + stem.bbox.bottom;
}

export function stretchStemToBeam(
  stemEl: EngravingElement,
  beamY: number,
  stemDirection: "up" | "down",
  stemBBoxDownPaddingTop: number
): void {
  const localEndY = beamY - stemEl.y;
  const path = stemEl.path ?? [{ type: "M", x: 0, y: 0 }];
  const next = path[1];
  if (next?.type === "L") {
    next.y = localEndY;
  } else {
    path.push({ type: "L", x: 0, y: localEndY });
  }
  stemEl.path = path;

  if (stemDirection === "up") {
    stemEl.bbox = {
      ...stemEl.bbox,
      top: Math.min(0, localEndY),
      bottom: 0
    };
  } else {
    stemEl.bbox = {
      ...stemEl.bbox,
      top: stemBBoxDownPaddingTop,
      bottom: Math.max(localEndY, stemBBoxDownPaddingTop)
    };
  }
}

export function collectBeamStemTips(
  group: ResolvedBeamGroup,
  elements: EngravingElement[]
): BeamStemTip[] {
  return group.noteIds.flatMap((noteId) => {
    const stem = elements.find((el) => el.id === `el-stem-${noteId}`);
    if (!stem) {
      return [];
    }
    const direction = group.stemDirection;
    return [{
      noteId,
      x: stem.x,
      y: getStemTipY(stem, direction),
      stem,
      direction
    }];
  });
}

/**
 * MuseScore-style anchor placement: clamp slope, then fit the beam line through
 * the centroid of default stem tips using the clamped slope.
 */
export function computeBeamAnchors(
  stemTips: { x: number; y: number }[],
  stemDirection: "up" | "down",
  beamMaxSlope: number
): BeamAnchorLayout | null {
  if (stemTips.length < 2) {
    return null;
  }

  const first = stemTips[0]!;
  const last = stemTips[stemTips.length - 1]!;
  const dx = last.x - first.x;
  if (Math.abs(dx) < 1e-6) {
    return null;
  }

  const rawSlope = (last.y - first.y) / dx;
  const clampedSlope = Math.max(-beamMaxSlope, Math.min(beamMaxSlope, rawSlope));
  const centerX = (first.x + last.x) / 2;
  const avgY = stemTips.reduce((sum, tip) => sum + tip.y, 0) / stemTips.length;
  const firstBeamY = avgY + clampedSlope * (first.x - centerX);
  const lastBeamY = avgY + clampedSlope * (last.x - centerX);

  return {
    firstStemX: first.x,
    lastStemX: last.x,
    firstBeamY,
    lastBeamY,
    clampedSlope,
    stemDirection
  };
}

function beamYAtX(layout: BeamAnchorLayout, x: number): number {
  return layout.firstBeamY + layout.clampedSlope * (x - layout.firstStemX);
}

function createBeamPath(
  dx: number,
  levelDy: number,
  thickness: number
): NonNullable<EngravingElement["path"]> {
  return [
    { type: "M", x: 0, y: 0 },
    { type: "L", x: dx, y: levelDy },
    { type: "L", x: dx, y: levelDy + thickness },
    { type: "L", x: 0, y: thickness },
    { type: "Z" }
  ];
}

function pushBeamElement(
  elements: EngravingElement[],
  startTip: BeamStemTip,
  endTip: BeamStemTip,
  layout: BeamAnchorLayout,
  level: number,
  config: BeamLayoutConfig
): void {
  const dx = endTip.x - layout.firstStemX;
  if (Math.abs(dx) < 1e-6 && startTip.x === endTip.x) {
    return;
  }

  const isUp = layout.stemDirection === "up";
  const levelStep = config.beamThickness + config.beamLevelGap;
  const inset = isUp ? -level * levelStep : level * levelStep;
  const levelFirstBeamY = layout.firstBeamY + inset;
  const startY = beamYAtX(layout, startTip.x) + inset;
  const endY = beamYAtX(layout, endTip.x) + inset;
  const levelDy = endY - startY;
  const localDx = endTip.x - startTip.x;

  elements.push({
    id: `el-beam-${startTip.noteId}-${endTip.noteId}-${level}`,
    sourceId: startTip.noteId,
    type: "beam",
    x: startTip.x,
    y: startY,
    bbox: {
      left: 0,
      top: isUp ? 0 : -config.beamThickness,
      right: localDx,
      bottom: isUp ? config.beamThickness : 0
    },
    path: createBeamPath(localDx, levelDy, config.beamThickness)
  });
}

/**
 * Creates per-level beam segments with beat-aware secondary breaks.
 */
export function layoutBeamGroup(
  group: ResolvedBeamGroup,
  notes: NoteEvent[],
  stemTips: BeamStemTip[],
  measureTick: number,
  elements: EngravingElement[],
  config: BeamLayoutConfig,
  stemBBoxDownPaddingTop: number
): void {
  const layout = computeBeamAnchors(stemTips, group.stemDirection, config.beamMaxSlope);
  if (!layout) {
    return;
  }

  for (const tip of stemTips) {
    const beamY = beamYAtX(layout, tip.x);
    const connectionY = layout.stemDirection === "up"
      ? beamY + config.beamThickness
      : beamY;
    stretchStemToBeam(tip.stem, connectionY, tip.direction, stemBBoxDownPaddingTop);
  }

  const maxBeams = Math.max(...(group.beamCounts.length > 0 ? group.beamCounts : [1]));
  const beatTicks = getBeatTicks(notes[0]?.tick ?? measureTick, group.timeSignature);

  for (let level = 0; level < maxBeams; level += 1) {
    let segmentStart: BeamStemTip | null = null;

    for (let index = 0; index < stemTips.length; index += 1) {
      const tip = stemTips[index]!;
      const note = notes[index]!;
      if (computeBeamCount(note.duration.type) <= level) {
        if (segmentStart && index > 0) {
          const previous = stemTips[index - 1]!;
          if (segmentStart !== previous) {
            pushBeamElement(elements, segmentStart, previous, layout, level, config);
          }
        }
        segmentStart = null;
        continue;
      }

      if (index > 0) {
        const betweenBeams = group.beamCounts[index - 1] ?? 0;
        const countBreak = level >= betweenBeams;
        const groupBreak = shouldBreakBeamAtLevel(
          group.timeSignature,
          note.tick - measureTick,
          level,
          beatTicks
        );

        if (countBreak || groupBreak) {
          const previous = stemTips[index - 1]!;
          if (segmentStart && segmentStart !== previous) {
            pushBeamElement(elements, segmentStart, previous, layout, level, config);
          }
          segmentStart = tip;
          continue;
        }
      }

      if (segmentStart === null) {
        segmentStart = tip;
      }
    }

    if (segmentStart) {
      const lastTip = stemTips[stemTips.length - 1]!;
      const lastNote = notes[notes.length - 1]!;
      if (segmentStart !== lastTip && computeBeamCount(lastNote.duration.type) > level) {
        pushBeamElement(elements, segmentStart, lastTip, layout, level, config);
      }
    }
  }
}
