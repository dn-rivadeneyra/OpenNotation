import { describe, expect, it } from "vitest";

import { TPQ, createMinimalScore } from "../../../src/core/model/index.js";
import { engrave, type FontMetrics, type LayoutParameters } from "../../../src/core/engraving/index.js";
import { EditorController, InsertNoteCommand, type EditorRendererPort } from "../../../src/core/editor/index.js";

const params: LayoutParameters = {
  pageWidth: 100,
  pageHeight: 140,
  marginTop: 6,
  marginBottom: 6,
  marginLeft: 6,
  marginRight: 6,
  staffSpacing: 8,
  systemSpacing: 12,
  spatium: 10,
  minSystemFill: 0.7,
  stretchFactor: 1
};

const fonts: FontMetrics = {
  glyphs: {},
  engravingDefaults: {},
  metadata: {
    glyphsWithAnchors: {
      noteheadBlack: { stemUpSE: [1.3, 0.16], stemDownNW: [0, -0.168] },
      noteheadHalf: { stemUpSE: [1.3, 0.16], stemDownNW: [0, -0.168] }
    }
  }
};

class MockRenderer implements EditorRendererPort {
  renderCount = 0;
  lastHighlights: string[] = [];

  render(): void {
    this.renderCount += 1;
  }

  hitTest(): null {
    return null;
  }

  setHighlights(elementIds: string[]): void {
    this.lastHighlights = elementIds;
  }
}

describe("EditorController", () => {
  it("dispatches commands, re-engraves, and re-renders", () => {
    const renderer = new MockRenderer();
    const score = createMinimalScore();
    const controller = new EditorController(renderer, params, fonts, { score });
    const staffId = score.staves[0]!.id;
    const initialRenders = renderer.renderCount;

    controller.dispatch(
      new InsertNoteCommand({
        staffId,
        voiceId: 1,
        tick: 0,
        pitch: { step: "E", octave: 4, alter: 0 },
        duration: { type: "quarter", dots: 0, ticks: TPQ }
      })
    );

    expect(renderer.renderCount).toBeGreaterThan(initialRenders);
    expect([...controller.getState().score.events.values()].some((event) => event.kind === "note")).toBe(true);
  });

  it("reengrave pipeline completes quickly for a 4-measure score", () => {
    const renderer = new MockRenderer();
    const score = createMinimalScore();
    const controller = new EditorController(renderer, params, fonts, { score });
    const start = performance.now();
    controller.dispatch(
      new InsertNoteCommand({
        staffId: score.staves[0]!.id,
        voiceId: 1,
        tick: 0,
        pitch: { step: "F", octave: 4, alter: 0 },
        duration: { type: "quarter", dots: 0, ticks: TPQ }
      })
    );
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(250);
    expect(engrave(controller.getState().score, params, fonts).totalPages).toBeGreaterThan(0);
  });
});
