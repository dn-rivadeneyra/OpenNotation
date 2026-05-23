export type SkylineSegment = {
  xStart: number;
  xEnd: number;
  y: number;
};

export type Skyline = {
  segments: SkylineSegment[];
  direction: "up" | "down";
};

function overlaps(segment: SkylineSegment, xStart: number, xEnd: number): boolean {
  return segment.xStart < xEnd && segment.xEnd > xStart;
}

/**
 * Queries skyline extremum across an x range.
 *
 * @param skyline Skyline structure.
 * @param xStart Range start.
 * @param xEnd Range end.
 * @returns Extremal y for the range.
 */
export function querySkyline(skyline: Skyline, xStart: number, xEnd: number): number {
  const intersecting = skyline.segments.filter((segment) => overlaps(segment, xStart, xEnd));
  if (intersecting.length === 0) {
    return skyline.direction === "up" ? 0 : 0;
  }

  if (skyline.direction === "up") {
    return Math.min(...intersecting.map((segment) => segment.y));
  }
  return Math.max(...intersecting.map((segment) => segment.y));
}

/**
 * Updates skyline with a new object envelope.
 *
 * @param skyline Skyline structure.
 * @param xStart Range start.
 * @param xEnd Range end.
 * @param y New extremal y.
 * @returns Updated skyline.
 */
export function updateSkyline(skyline: Skyline, xStart: number, xEnd: number, y: number): Skyline {
  const retained = skyline.segments.filter((segment) => !overlaps(segment, xStart, xEnd));
  return {
    direction: skyline.direction,
    segments: [...retained, { xStart, xEnd, y }].sort((left, right) => left.xStart - right.xStart)
  };
}

/**
 * Places an object above (toward negative y) a skyline and updates it.
 *
 * @param skyline Top skyline.
 * @param xStart Range start.
 * @param xEnd Range end.
 * @param objectHeight Object height.
 * @param minMargin Required margin.
 * @returns Placement y and updated skyline.
 */
export function placeAboveSkyline(
  skyline: Skyline,
  xStart: number,
  xEnd: number,
  objectHeight: number,
  minMargin: number
): { y: number; updatedSkyline: Skyline } {
  const ceiling = querySkyline(skyline, xStart, xEnd);
  const y = ceiling - minMargin - objectHeight;
  return {
    y,
    updatedSkyline: updateSkyline(skyline, xStart, xEnd, y)
  };
}

/**
 * Places an object below (toward positive y) a skyline and updates it.
 *
 * @param skyline Bottom skyline.
 * @param xStart Range start.
 * @param xEnd Range end.
 * @param objectHeight Object height.
 * @param minMargin Required margin.
 * @returns Placement y and updated skyline.
 */
export function placeBelowSkyline(
  skyline: Skyline,
  xStart: number,
  xEnd: number,
  objectHeight: number,
  minMargin: number
): { y: number; updatedSkyline: Skyline } {
  const floor = querySkyline(skyline, xStart, xEnd);
  const y = floor + minMargin + objectHeight;
  return {
    y,
    updatedSkyline: updateSkyline(skyline, xStart, xEnd, y)
  };
}
