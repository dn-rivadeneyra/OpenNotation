import type {
  EngravingElement,
  EngravingSystem
} from "../../engraving/index.ts";
import {
  getMeasureAtTick,
  staffPositionToPitch,
  type ClefType,
  type Pitch,
  type Score
} from "../../model/index.ts";
import { buildSliceMap } from "../../temporal/index.ts";
import type { EditorViewport } from "../EditorState.ts";

// One staff position (line→adjacent space, or space→adjacent line) is
// one staff-space (1 Y unit) apart in engraving coordinates.
const STAFF_SPACE_Y = 1.0;
const STAFF_POSITIONS = 4;

function screenToPageStaffSpace(valuePx: number, viewport: EditorViewport): number {
  return valuePx / (viewport.spatium * viewport.scale);
}

function screenToPageY(valuePx: number, viewport: EditorViewport): number {
  return (valuePx + viewport.scrollY) / (viewport.spatium * viewport.scale);
}

function findMeasureAtSystemX(system: EngravingSystem, localX: number) {
  for (const measure of system.measures) {
    if (localX >= measure.x && localX < measure.x + measure.width) {
      return measure;
    }
  }
  return system.measures.at(-1);
}

/**
 * Resolves nearest tick from a horizontal click in system coordinates.
 *
 * @param score Score root.
 * @param system Engraving system.
 * @param localX X in system staff spaces.
 * @returns Absolute tick.
 */
export function xToNearestTick(score: Score, system: EngravingSystem, localX: number): number {
  const measure = findMeasureAtSystemX(system, localX);
  if (!measure) {
    return 0;
  }

  const measureLocalX = Math.max(0, localX - measure.x);
  const ratio = measure.width > 0 ? measureLocalX / measure.width : 0;
  const modelMeasure = score.measures.find((candidate) => candidate.id === measure.measureId);
  if (!modelMeasure) {
    return 0;
  }

  const estimatedTick = modelMeasure.tick + Math.round(ratio * modelMeasure.duration);
  const sliceMap = buildSliceMap(score);
  let nearest = estimatedTick;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const slice of sliceMap.slices) {
    if (slice.tick < modelMeasure.tick || slice.tick >= modelMeasure.tick + modelMeasure.duration) {
      continue;
    }
    const distance = Math.abs(slice.tick - estimatedTick);
    if (distance < nearestDistance) {
      nearest = slice.tick;
      nearestDistance = distance;
    }
  }

  return nearest;
}

/**
 * Converts a mouse click on a staff into pitch and tick targets.
 *
 * @param screenX Screen X in canvas pixels.
 * @param screenY Screen Y in canvas pixels.
 * @param hitElement Optional hit element from renderer.
 * @param system Engraving system containing the staff.
 * @param staffId Target staff identifier.
 * @param clef Active clef at click position.
 * @param viewport Current viewport transform.
 * @param score Score root for tick quantization.
 * @returns Pitch and tick for note entry.
 */
export function pitchFromMousePosition(
  screenX: number,
  screenY: number,
  hitElement: EngravingElement | null,
  system: EngravingSystem,
  staffId: string,
  clef: ClefType,
  viewport: EditorViewport,
  score: Score
): { pitch: Pitch; tick: number } {
  void hitElement;

  const staffLine = system.staffLines.find((line) => line.staffId === staffId);
  if (!staffLine) {
    throw new Error(`Staff line not found for staffId ${staffId}`);
  }

  const pageY = screenToPageY(screenY, viewport);
  const pageX = screenToPageStaffSpace(screenX, viewport);
  const staffTopY = system.y + staffLine.y;
  const relYFromTop = pageY - staffTopY;
  const staffPositionFromBottom = STAFF_POSITIONS - relYFromTop / STAFF_SPACE_Y;
  const quantizedPosition = Math.round(staffPositionFromBottom * 2) / 2;
  const pitch = staffPositionToPitch(quantizedPosition, clef);

  const localX = pageX - system.x;
  const tick = xToNearestTick(score, system, localX);
  const measure = getMeasureAtTick(score, tick);
  if (!measure) {
    return { pitch, tick: 0 };
  }

  return { pitch, tick };
}
