import type { FontCalibration } from "../../engraving/types.js";

export const LELAND_CALIBRATION: FontCalibration = {
  stemAnchors: {
    up: {
      xScale: 1 / 1.38,
      xOffset: 0,
      yOffset: 0
    },

    down: {
      xScale: 1,
      xOffset: 0.065,
      yOffset: 0
    }
  }
};