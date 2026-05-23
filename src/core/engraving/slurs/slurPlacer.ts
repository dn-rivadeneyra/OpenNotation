import type { SlurSpan, TieSpan } from "../../model/index.js";
import type { PathCommand } from "../types.js";
import type { Skyline } from "../collision/skyline.js";
import { querySkyline } from "../collision/skyline.js";

/**
 * Computes cubic bezier geometry for slurs/ties.
 *
 * @param span Slur or tie span.
 * @param startPos Start point.
 * @param endPos End point.
 * @param skylineTop Top skyline.
 * @param skylineBot Bottom skyline.
 * @returns Path commands for renderer.
 */
export function computeSlurGeometry(
  span: SlurSpan | TieSpan,
  startPos: { x: number; y: number },
  endPos: { x: number; y: number },
  skylineTop: Skyline,
  skylineBot: Skyline
): PathCommand[] {
  const spanWidth = Math.abs(endPos.x - startPos.x);
  const direction = span.placement === "above" ? -1 : 1;
  let archHeight = 0.5 * Math.sqrt(Math.max(spanWidth, 0.01));

  const c1x = startPos.x + spanWidth / 3;
  const c2x = startPos.x + (2 * spanWidth) / 3;

  if (span.kind === "slur" && span.bezier) {
    return [
      { type: "M", x: startPos.x, y: startPos.y },
      {
        type: "C",
        x1: startPos.x + span.bezier.x1,
        y1: startPos.y + span.bezier.y1,
        x2: endPos.x + span.bezier.x2,
        y2: endPos.y + span.bezier.y2,
        x: endPos.x,
        y: endPos.y
      }
    ];
  }

  const midpointStart = Math.min(c1x, c2x);
  const midpointEnd = Math.max(c1x, c2x);
  if (direction < 0) {
    const top = querySkyline(skylineTop, midpointStart, midpointEnd);
    const desired = Math.min(startPos.y, endPos.y) - archHeight;
    if (desired >= top) {
      archHeight += desired - top + 0.5;
    }
  } else {
    const bottom = querySkyline(skylineBot, midpointStart, midpointEnd);
    const desired = Math.max(startPos.y, endPos.y) + archHeight;
    if (desired <= bottom) {
      archHeight += bottom - desired + 0.5;
    }
  }

  const c1y = startPos.y + direction * archHeight;
  const c2y = endPos.y + direction * archHeight;

  return [
    { type: "M", x: startPos.x, y: startPos.y },
    { type: "C", x1: c1x, y1: c1y, x2: c2x, y2: c2y, x: endPos.x, y: endPos.y }
  ];
}
