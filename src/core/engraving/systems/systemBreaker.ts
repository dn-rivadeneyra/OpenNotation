import type { Measure } from "../../model/index.js";
import type { LayoutParameters } from "../types.js";

export type SystemLayout = {
  measureIds: string[];
  naturalWidth: number;
  justifiedWidth: number;
  stretchFactor: number;
};

export type SystemBreakResult = {
  systems: SystemLayout[];
};

/**
 * Breaks measures into systems with deterministic greedy strategy.
 *
 * @param measures Ordered measures.
 * @param measureWidths Natural widths keyed by measure id.
 * @param params Layout parameters.
 * @returns System layouts with justification metadata.
 */
export function breakIntoSystems(
  measures: Measure[],
  measureWidths: Map<string, number>,
  params: LayoutParameters
): SystemBreakResult {
  const availableWidth = params.pageWidth - params.marginLeft - params.marginRight;
  const systems: SystemLayout[] = [];
  let current: Measure[] = [];
  let currentWidth = 0;

  const flush = (isLast: boolean): void => {
    if (current.length === 0) {
      return;
    }
    const naturalWidth = currentWidth;
    const fill = naturalWidth / availableWidth;
    const justifiedWidth = isLast && fill < params.minSystemFill ? naturalWidth : availableWidth;
    systems.push({
      measureIds: current.map((measure) => measure.id),
      naturalWidth,
      justifiedWidth,
      stretchFactor: naturalWidth === 0 ? 1 : justifiedWidth / naturalWidth
    });
    current = [];
    currentWidth = 0;
  };

  for (let index = 0; index < measures.length; index += 1) {
    const measure = measures[index]!;
    const width = measureWidths.get(measure.id) ?? 8;
    const wouldOverflow = current.length > 0 && currentWidth + width > availableWidth;
    if (wouldOverflow) {
      flush(false);
    }

    current.push(measure);
    currentWidth += width;

    if (measure.systemBreak) {
      flush(false);
    }
  }

  flush(true);
  return { systems };
}
