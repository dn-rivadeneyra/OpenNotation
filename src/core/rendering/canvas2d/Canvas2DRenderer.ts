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
} from "../../engraving/index.js";
import type { FontAdapterLike, HitElementRecord, IRenderer, Viewport } from "../IRenderer.js";

function toPxX(valueInStaffSpaces: number, viewport: Viewport): number {
  return valueInStaffSpaces * viewport.spatium * viewport.scale;
}

function toPxY(valueInStaffSpaces: number, viewport: Viewport): number {
  return valueInStaffSpaces * viewport.spatium * viewport.scale;
}

function translateBBox(bbox: BoundingBox, x: number, y: number): BoundingBox {
  return {
    left: x + bbox.left,
    top: y + bbox.top,
    right: x + bbox.right,
    bottom: y + bbox.bottom
  };
}

function includesPoint(bbox: BoundingBox, x: number, y: number): boolean {
  return x >= bbox.left && x <= bbox.right && y >= bbox.top && y <= bbox.bottom;
}

export class Canvas2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D | null = null;
  private fonts: FontAdapterLike | null = null;
  private lastResult: EngravingResult | null = null;
  private lastViewport: Viewport | null = null;
  private readonly elementMap = new Map<string, HitElementRecord>();
  private highlights = new Set<string>();

  /**
   * Initializes the canvas 2D backend.
   *
   * @param canvas Target HTML canvas.
   * @param fonts Font adapter for SMuFL rendering.
   */
  async init(canvas: HTMLCanvasElement, fonts: FontAdapterLike): Promise<void> {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context is not available.");
    }
    this.ctx = context;
    this.fonts = fonts;
  }

  /**
   * Renders all pages in the engraving result.
   *
   * @param result Engraving geometry tree.
   * @param viewport Viewport transform.
   */
  render(result: EngravingResult, viewport: Viewport): void {
    if (!this.ctx) {
      throw new Error("Renderer not initialized.");
    }
    this.lastResult = result;
    this.lastViewport = viewport;
    this.elementMap.clear();

    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    for (const page of result.pages) {
      this.renderPage(page, viewport);
    }
  }

  /**
   * Renders only selected pages.
   *
   * @param pageIndices Page indices to draw.
   * @param result Engraving geometry tree.
   * @param viewport Viewport transform.
   */
  renderPages(pageIndices: number[], result: EngravingResult, viewport: Viewport): void {
    if (!this.ctx) {
      throw new Error("Renderer not initialized.");
    }
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

  /**
   * Resizes canvas dimensions and redraws.
   *
   * @param width Width in pixels.
   * @param height Height in pixels.
   */
  resize(width: number, height: number): void {
    if (!this.ctx) {
      throw new Error("Renderer not initialized.");
    }
    this.ctx.canvas.width = width;
    this.ctx.canvas.height = height;
    if (this.lastResult && this.lastViewport) {
      this.render(this.lastResult, this.lastViewport);
    }
  }

  /**
   * Hit tests an element at screen coordinates.
   *
   * @param screenX X in screen pixels.
   * @param screenY Y in screen pixels.
   * @returns Hit engraving element or null.
   */
  hitTest(screenX: number, screenY: number): EngravingElement | null {
    for (const { element, screenBBox } of this.elementMap.values()) {
      if (includesPoint(screenBBox, screenX, screenY)) {
        return element;
      }
    }
    return null;
  }

  /**
   * Sets highlighted element IDs and re-renders current frame.
   *
   * @param elementIds Element IDs to highlight.
   */
  setHighlights(elementIds: string[]): void {
    this.highlights = new Set(elementIds);
    if (this.lastResult && this.lastViewport) {
      this.render(this.lastResult, this.lastViewport);
    }
  }

  /**
   * Releases renderer state.
   */
  dispose(): void {
    this.ctx = null;
    this.fonts = null;
    this.lastResult = null;
    this.lastViewport = null;
    this.elementMap.clear();
    this.highlights.clear();
  }

  private renderPage(page: EngravingPage, viewport: Viewport): void {
    if (!this.ctx) {
      return;
    }

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
      this.renderSystem(system.x, system.y, system.width, system.height, system.staffLines, system.measures, viewport, pageOriginX, pageOriginY);
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

  private renderElement(element: EngravingElement, parentScreenX: number, parentScreenY: number, viewport: Viewport): void {
    const screenX = parentScreenX + toPxX(element.x, viewport);
    const screenY = parentScreenY + toPxY(element.y, viewport);
    const bbox = {
      left: screenX + toPxX(element.bbox.left, viewport),
      top: screenY + toPxY(element.bbox.top, viewport),
      right: screenX + toPxX(element.bbox.right, viewport),
      bottom: screenY + toPxY(element.bbox.bottom, viewport)
    };

    this.elementMap.set(element.id, { element, screenBBox: bbox });

    if (element.glyph) {
      this.drawGlyph(element.glyph, screenX, screenY, viewport);
    } else if (element.path) {
      // Pass the explicit element type down to handle stroke vs fill decisions
      this.drawPath(element.path, screenX, screenY, viewport, element.type);
    }

    if (this.highlights.has(element.id)) {
      this.drawHighlight(bbox);
    }

    for (const child of element.children ?? []) {
      this.renderElement(child, screenX, screenY, viewport);
    }
  }

  private renderSpanner(spanner: EngravingSpanner, baseX: number, baseY: number, viewport: Viewport): void {
    this.drawPath(spanner.path, baseX, baseY, viewport, "spanner");
  }

  private drawGlyph(glyph: SmuflGlyph, screenX: number, screenY: number, viewport: Viewport): void {
    if (!this.ctx || !this.fonts) {
      return;
    }

    const fontSize = 4 * viewport.spatium * viewport.scale * (glyph.scale ?? 1);
    this.ctx.font = `${fontSize}px "${this.fonts.fontFamily}"`;
    this.ctx.fillStyle = "#000000";
    this.ctx.textBaseline = "middle";
    this.ctx.fillText(String.fromCodePoint(glyph.codepoint), screenX, screenY);
  }

  private drawPath(path: PathCommand[], baseX: number, baseY: number, viewport: Viewport, elementType?: string): void {
    if (!this.ctx) {
      return;
    }
    
    this.ctx.beginPath();
    for (const command of path) {
      switch (command.type) {
        case "M":
          this.ctx.moveTo(baseX + toPxX(command.x, viewport), baseY + toPxY(command.y, viewport));
          break;
        case "L":
          this.ctx.lineTo(baseX + toPxX(command.x, viewport), baseY + toPxY(command.y, viewport));
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

    // Explicitly differentiate between line-based paths (stems/spanners) and fill shapes
    if (elementType === "stem" || elementType === "spanner" || elementType === "barline") {
      this.ctx.strokeStyle = "#000000";
      // Scale line thickness dynamically with the viewport magnification zoom layer
      this.ctx.lineWidth = 1.5 * viewport.scale;
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = "#000000";
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
    if (!this.ctx) {
      return;
    }
    this.ctx.lineWidth = viewport.scale;
    this.ctx.strokeStyle = "#000000";
    for (let i = 0; i < line.lineCount; i += 1) {
      const yUnits = line.y + systemY + i * 1;
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
    if (!this.ctx) {
      return;
    }
    const normalized = {
      left: Math.min(bbox.left, bbox.right),
      top: Math.min(bbox.top, bbox.bottom),
      right: Math.max(bbox.left, bbox.right),
      bottom: Math.max(bbox.top, bbox.bottom)
    };
    const finalBox = translateBBox(normalized, 0, 0);
    this.ctx.strokeStyle = "#2f6dff";
    this.ctx.lineWidth = 1.5;
    this.ctx.strokeRect(
      finalBox.left,
      finalBox.top,
      finalBox.right - finalBox.left,
      finalBox.bottom - finalBox.top
    );
  }
}