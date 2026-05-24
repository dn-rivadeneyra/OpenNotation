import type {
  BoundingBox,
  EngravingElement,
  EngravingMeasure,
  EngravingPage,
  EngravingResult,
  EngravingSpanner,
  EngravingStaffLine,
  PathCommand,
  SmuflGlyph
} from "../../engraving/index.ts";

import type {
  FontAdapterLike,
  HitElementRecord,
  IRenderer,
  Viewport
} from "../IRenderer.ts";

function getGlyphMetrics(
  glyph: SmuflGlyph,
  fonts: FontAdapterLike
) {
  const name = glyph.name ?? "unknown";

  const anchors =
    fonts.metadata?.glyphsWithAnchors?.[name];

  // fallback (safe default)
  if (!anchors) {
    return {
      anchorX: 0,
      anchorY: 0
    };
  }

  return {
    anchorX: anchors.stemUpSE?.[0] ?? 0,
    anchorY: -(anchors.stemUpSE?.[1] ?? 0)
  };
}

function toPxX(valueInStaffSpaces: number, viewport: Viewport): number {
  return valueInStaffSpaces * viewport.spatium * viewport.scale;
}

function toPxY(valueInStaffSpaces: number, viewport: Viewport): number {
  return valueInStaffSpaces * viewport.spatium * viewport.scale;
}

function normalizeBBox(b: BoundingBox): BoundingBox {
  return {
    left: Math.min(b.left, b.right),
    right: Math.max(b.left, b.right),
    top: Math.min(b.top, b.bottom),
    bottom: Math.max(b.top, b.bottom)
  };
}

function includesPoint(bbox: BoundingBox, x: number, y: number): boolean {
  const b = normalizeBBox(bbox);

  return (
    x >= b.left &&
    x <= b.right &&
    y >= b.top &&
    y <= b.bottom
  );
}

function translateBBox(bbox: BoundingBox, x: number, y: number): BoundingBox {
  return {
    left: bbox.left + x,
    right: bbox.right + x,
    top: bbox.top + y,
    bottom: bbox.bottom + y
  };
}

export class Canvas2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private fonts: FontAdapterLike | null = null;
  private lastResult: EngravingResult | null = null;
  private lastViewport: Viewport | null = null;

  

  private readonly elementMap = new Map<string, HitElementRecord>();
  private highlights = new Set<string>();

  private currentViewport: Viewport | null = null;

  async init(canvas: HTMLCanvasElement, fonts: FontAdapterLike): Promise<void> {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context is not available.");

    this.ctx = context;
    this.fonts = fonts;
  }

  render(result: EngravingResult, viewport: Viewport): void {
    if (!this.ctx) throw new Error("Renderer not initialized.");
    

    this.lastResult = result;
    this.lastViewport = viewport;
    this.currentViewport = viewport;
    this.elementMap.clear();

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    for (const page of result.pages) {
      this.renderPage(page, viewport);
    }
    
  }

  renderPages(pageIndices: number[], result: EngravingResult, viewport: Viewport): void {
    if (!this.ctx) throw new Error("Renderer not initialized.");

    this.lastResult = result;
    this.lastViewport = viewport;
    this.elementMap.clear();

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);

    const include = new Set(pageIndices);

    for (const page of result.pages) {
      if (include.has(page.index)) {
        this.renderPage(page, viewport);
      }
    }
  }

  resize(width: number, height: number): void {
    if (!this.ctx) throw new Error("Renderer not initialized.");

    this.ctx.canvas.width = width;
    this.ctx.canvas.height = height;

    if (this.lastResult && this.lastViewport) {
      this.render(this.lastResult, this.lastViewport);
    }
  }

  /**
   * FIXED HIT TEST
   */
  hitTest(screenX: number, screenY: number): EngravingElement | null {
    let best: EngravingElement | null = null;
    let bestArea = Infinity;
  
    for (const { element, screenBBox } of this.elementMap.values()) {
      const b = normalizeBBox(screenBBox);
  
      if (
        screenX >= b.left &&
        screenX <= b.right &&
        screenY >= b.top &&
        screenY <= b.bottom
      ) {
        const area =
          (b.right - b.left) *
          (b.bottom - b.top);
  
        if (area < bestArea) {
          best = element;
          bestArea = area;
        }
      }
    }
  
    return best;
  }

  setHighlights(elementIds: string[]): void {
    this.highlights = new Set(elementIds);

    if (this.lastResult && this.lastViewport) {
      this.render(this.lastResult, this.lastViewport);
    }
  }

  dispose(): void {
    this.ctx = null;
    this.fonts = null;
    this.lastResult = null;
    this.lastViewport = null;

    this.elementMap.clear();
    this.highlights.clear();
  }

  private renderPage(page: EngravingPage, viewport: Viewport): void {
    if (!this.ctx) return;

    const pageOriginX = 0;
    const pageOriginY = -viewport.scrollY;

    this.ctx.fillStyle = "#ffffff";
    this.ctx.fillRect(
      pageOriginX,
      pageOriginY,
      toPxX(page.width, viewport),
      toPxY(page.height, viewport)
    );

    for (const system of page.systems) {
      this.renderSystem(
        system.x,
        system.y,
        system.width,
        system.height,
        system.staffLines,
        system.measures,
        viewport,
        pageOriginX,
        pageOriginY
      );
    }
  }

  private renderSystem(
    systemX: number,
    systemY: number,
    systemWidth: number,
    systemHeight: number,
    staffLines: EngravingStaffLine[],
    measures: EngravingMeasure[],
    viewport: Viewport,
    pageOriginX: number,
    pageOriginY: number
  ): void {
    void systemWidth;
    void systemHeight;

    for (const line of staffLines) {
      this.drawStaffLines(line, systemX, systemY, pageOriginX, pageOriginY, viewport);
    }

    for (const measure of measures) {
      this.renderMeasure(measure, systemX, systemY, pageOriginX, pageOriginY, viewport);
    }
  }

  private renderMeasure(
    measure: EngravingMeasure,
    systemX: number,
    systemY: number,
    pageOriginX: number,
    pageOriginY: number,
    viewport: Viewport
  ): void {
    const baseX = pageOriginX + toPxX(systemX + measure.x, viewport);
    const baseY = pageOriginY + toPxY(systemY + measure.y, viewport);

    for (const element of measure.elements) {
      this.renderElement(element, baseX, baseY, viewport);
    }

    for (const spanner of measure.spanners) {
      this.renderSpanner(spanner, baseX, baseY, viewport);
    }
  }

  private renderElement(
    element: EngravingElement,
    parentScreenX: number,
    parentScreenY: number,
    viewport: Viewport
  ): void {
  
    const screenX =
      parentScreenX + toPxX(element.x, viewport);
  
    const screenY =
      parentScreenY + toPxY(element.y, viewport);
  
    const raw = element.bbox;
  
    // ✅ FIX: bbox is in element-local space → convert consistently
    const scale = viewport.spatium * viewport.scale;
  
    const bbox: BoundingBox = {
      left: screenX + raw.left * scale,
      right: screenX + raw.right * scale,
      top: screenY + raw.top * scale,
      bottom: screenY + raw.bottom * scale
    };
  
    // DEBUG VISUAL 
    /* this.ctx!.strokeStyle = "red";
    this.ctx!.strokeRect(
      bbox.left,
      bbox.top,
      bbox.right - bbox.left,
      bbox.bottom - bbox.top
    ); */
  
    this.elementMap.set(element.id, {
      element,
      screenBBox: bbox
    });
  
    if (element.glyph) {
      this.drawGlyph(element.glyph, screenX, screenY, viewport);
    } else if (element.path) {
      this.drawPath(element.path, screenX, screenY, viewport, element.type);
    }
  
    if (this.highlights.has(element.id)) {
      this.drawHighlight(bbox);
    }
  } 

  private renderSpanner(
    spanner: EngravingSpanner,
    baseX: number,
    baseY: number,
    viewport: Viewport
  ): void {
    this.drawPath(spanner.path, baseX, baseY, viewport, "spanner");
  }

  private drawGlyph(
    glyph: SmuflGlyph,
    screenX: number,
    screenY: number,
    viewport: Viewport
  ): void {
    if (!this.ctx || !this.fonts) return;
  
    const fontSize =
      4 * viewport.spatium * viewport.scale * (glyph.scale ?? 1);
  
    const metrics = getGlyphMetrics(glyph, this.fonts);
  
    this.ctx.font = `${fontSize}px "${this.fonts.fontFamily}"`;
    this.ctx.fillStyle = "#000";
  
    // IMPORTANT: baseline must be stable for math consistency
    this.ctx.textBaseline = "alphabetic";
  
    this.ctx.fillText(
      String.fromCodePoint(glyph.codepoint),
      screenX + metrics.anchorX * viewport.spatium * viewport.scale,
      screenY + metrics.anchorY * viewport.spatium * viewport.scale
    );
  }

  private drawPath(
    path: PathCommand[],
    baseX: number,
    baseY: number,
    viewport: Viewport,
    elementType?: string
  ): void {
    if (!this.ctx) return;

    this.ctx.beginPath();

    for (const command of path) {
      switch (command.type) {
        case "M":
          this.ctx.moveTo(
            baseX + toPxX(command.x, viewport),
            baseY + toPxY(command.y, viewport)
          );
          break;

        case "L":
          this.ctx.lineTo(
            baseX + toPxX(command.x, viewport),
            baseY + toPxY(command.y, viewport)
          );
          break;

        case "C":
          this.ctx.bezierCurveTo(
            baseX + toPxX(command.x1, viewport),
            baseY + toPxY(command.y1, viewport),
            baseX + toPxX(command.x2, viewport),
            baseY + toPxY(command.y2, viewport),
            baseX + toPxX(command.x, viewport),
            baseY + toPxY(command.y, viewport)
          );
          break;

        case "Z":
          this.ctx.closePath();
          break;
      }
    }

    if (elementType === "stem" || elementType === "spanner" || elementType === "barline") {
      this.ctx.strokeStyle = "#000";
      this.ctx.lineWidth = 1.5 * viewport.scale;
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = "#000";
      this.ctx.fill();
    }
  }

  private drawStaffLines(
    line: EngravingStaffLine,
    systemX: number,
    systemY: number,
    pageOriginX: number,
    pageOriginY: number,
    viewport: Viewport
  ): void {
    if (!this.ctx) return;

    this.ctx.lineWidth = viewport.scale;
    this.ctx.strokeStyle = "#000";

    for (let i = 0; i < line.lineCount; i++) {
      //Positions notes in the staff
      const yUnits = line.y + systemY + i;

      const y = pageOriginY + toPxY(yUnits, viewport);
      const x1 = pageOriginX + toPxX(systemX + line.x, viewport);
      const x2 = pageOriginX + toPxX(systemX + line.x + line.width, viewport);

      this.ctx.beginPath();
      this.ctx.moveTo(x1, y);
      this.ctx.lineTo(x2, y);
      this.ctx.stroke();
    }
  }

  private drawHighlight(bbox: BoundingBox): void {
    if (!this.ctx) return;

    const b = normalizeBBox(bbox);

    this.ctx.strokeStyle = "#2f6dff";
    this.ctx.lineWidth = 1.5;

    this.ctx.strokeRect(
      b.left,
      b.top,
      b.right - b.left,
      b.bottom - b.top
    );
  }
}