import { describe, expect, it } from "vitest";

import type { EngravingResult } from "../../../src/core/engraving/index.js";
import { Canvas2DRenderer, type FontAdapterLike, type Viewport } from "../../../src/core/rendering/index.js";

class MockCanvasContext2D {
  canvas = { width: 800, height: 600 };
  fillStyle = "#000000";
  strokeStyle = "#000000";
  lineWidth = 1;
  font = "";
  textBaseline: CanvasTextBaseline = "alphabetic";
  commands: string[] = [];

  clearRect(): void {
    this.commands.push("clearRect");
  }

  fillRect(): void {
    this.commands.push("fillRect");
  }

  beginPath(): void {
    this.commands.push("beginPath");
  }

  moveTo(): void {
    this.commands.push("moveTo");
  }

  lineTo(): void {
    this.commands.push("lineTo");
  }

  bezierCurveTo(): void {
    this.commands.push("bezierCurveTo");
  }

  closePath(): void {
    this.commands.push("closePath");
  }

  fill(): void {
    this.commands.push("fill");
  }

  stroke(): void {
    this.commands.push("stroke");
  }

  fillText(): void {
    this.commands.push("fillText");
  }

  strokeRect(): void {
    this.commands.push("strokeRect");
  }
}

function createMockCanvas(context: MockCanvasContext2D): HTMLCanvasElement {
  return {
    width: context.canvas.width,
    height: context.canvas.height,
    getContext: (kind: string): CanvasRenderingContext2D | null =>
      kind === "2d" ? (context as unknown as CanvasRenderingContext2D) : null
  } as unknown as HTMLCanvasElement;
}

function createFontAdapter(): FontAdapterLike {
  return {
    fontFamily: "Leland",
    getGlyphChar: () => "\uE0A4",
    getGlyphMetrics: () => ({}),
    engravingDefaults: {},
    isReady: true
  };
}

function createResult(): EngravingResult {
  return {
    totalPages: 1,
    pages: [
      {
        index: 0,
        width: 100,
        height: 120,
        pageElements: [],
        systems: [
          {
            id: "sys-1",
            x: 2,
            y: 2,
            width: 80,
            height: 20,
            bracketElements: [],
            staffLines: [
              {
                staffId: "staff-1",
                x: 0,
                y: 0,
                width: 40,
                lineCount: 5
              }
            ],
            measures: [
              {
                measureId: "m1",
                x: 0,
                y: 0,
                width: 20,
                elements: [
                  {
                    id: "note-1",
                    type: "notehead",
                    x: 2,
                    y: 1,
                    bbox: { left: -0.25, top: -0.25, right: 0.25, bottom: 0.25 },
                    glyph: { codepoint: 0xe0a4 }
                  }
                ],
                spanners: []
              }
            ]
          }
        ]
      }
    ]
  };
}

const viewport: Viewport = {
  pageIndex: 0,
  scrollY: 0,
  scale: 1,
  spatium: 10
};

describe("Canvas2DRenderer", () => {
  it("renders glyphs and staff lines", async () => {
    const ctx = new MockCanvasContext2D();
    const renderer = new Canvas2DRenderer();
    await renderer.init(createMockCanvas(ctx), createFontAdapter());
    renderer.render(createResult(), viewport);
    expect(ctx.commands).toContain("fillText");
    expect(ctx.commands).toContain("lineTo");
  });

  it("hit testing uses accumulated parent offsets", async () => {
    const ctx = new MockCanvasContext2D();
    const renderer = new Canvas2DRenderer();
    await renderer.init(createMockCanvas(ctx), createFontAdapter());
    renderer.render(createResult(), viewport);

    const hit = renderer.hitTest(40, 30);
    expect(hit?.id).toBe("note-1");
  });

  it("setHighlights triggers highlight drawing", async () => {
    const ctx = new MockCanvasContext2D();
    const renderer = new Canvas2DRenderer();
    await renderer.init(createMockCanvas(ctx), createFontAdapter());
    renderer.render(createResult(), viewport);
    renderer.setHighlights(["note-1"]);
    expect(ctx.commands).toContain("strokeRect");
  });

  it("applies viewport scroll and zoom", async () => {
    const ctx = new MockCanvasContext2D();
    const renderer = new Canvas2DRenderer();
    await renderer.init(createMockCanvas(ctx), createFontAdapter());
    renderer.render(createResult(), { ...viewport, scrollY: 20, scale: 1.5 });
    expect(ctx.commands).toContain("fillText");
  });
});
