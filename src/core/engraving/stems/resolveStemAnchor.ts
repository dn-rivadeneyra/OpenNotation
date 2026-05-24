import type { FontMetrics } from "../types.js";

export function resolveStemAnchor(
  fonts: FontMetrics,
  notehead: string,
  direction: "up" | "down"
) {
  const anchors =
    fonts.metadata?.glyphsWithAnchors?.[notehead];

  if (!anchors) {
    throw new Error(
      `Missing SMuFL anchors for ${notehead}`
    );
  }

  const raw =
    direction === "up"
      ? anchors.stemUpSE
      : anchors.stemDownNW;

  if (!raw) {
    throw new Error(
      `Missing stem anchors for ${notehead}`
    );
  }

  const calibration =
    fonts.calibration?.stemAnchors[
      direction
    ];

  return {
    x:
      raw[0] *
        (calibration?.xScale ?? 1) +
      (calibration?.xOffset ?? 0),

    y:
      -raw[1] +
      (calibration?.yOffset ?? 0)
  };
}