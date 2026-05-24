/**
 * OpenNotation — Phase 5 visual demo
 *
 * Builds a real Score with notes across multiple measures,
 * runs the full engrave() pipeline, and renders it to canvas
 * via Canvas2DRenderer. Uses the actual Leland OTF font.
 */

import {
  createMinimalScore,
  createNoteEvent,
  computeTicks,
} from "./src/core/model/index.ts";
import { engrave } from "./src/core/engraving/index.ts";
import type { LayoutParameters } from "./src/core/engraving/index.ts";
import { Canvas2DRenderer } from "./src/core/rendering/index.ts";
import type { Viewport } from "./src/core/rendering/index.ts";
import { LelandFontAdapter } from "./src/core/fonts/index.ts";
import { loadLeland } from "./src/core/fonts/lelandLoader.ts";

// ─── DOM ────────────────────────────────────────────────────────────────────

const canvas = document.getElementById("score-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const hitInfoEl = document.getElementById("hit-info") as HTMLDivElement;
const zoomSlider = document.getElementById("zoom") as HTMLInputElement;
const scrollSlider = document.getElementById("scroll") as HTMLInputElement;

// ─── Build score ─────────────────────────────────────────────────────────────

function buildDemoScore() {
  const score = createMinimalScore();
  const staffId = score.staves[0]!.id;
  const q = computeTicks("quarter", 0);

  const m1Notes: Array<{ step: "C"|"D"|"E"|"F"|"G"|"A"|"B"; octave: number; tick: number }> = [
    { step: "C", octave: 4, tick: 0 },
    { step: "D", octave: 4, tick: 480 },
    { step: "E", octave: 4, tick: 960 },
    { step: "F", octave: 4, tick: 1440 },
  ];

  const m2Notes: Array<{ step: "C"|"D"|"E"|"F"|"G"|"A"|"B"; octave: number; tick: number }> = [
    { step: "G", octave: 4, tick: 1920 },
    { step: "A", octave: 4, tick: 2400 },
    { step: "B", octave: 4, tick: 2880 },
    { step: "C", octave: 5, tick: 3360 },
  ];

  const m3Notes: Array<{ step: "C"|"D"|"E"|"F"|"G"|"A"|"B"; octave: number; tick: number; type: "quarter"|"half" }> = [
    { step: "E", octave: 4, tick: 3840, type: "half" },
    { step: "G", octave: 4, tick: 4800, type: "half" },
  ];

  const m4Notes: Array<{ step: "C"|"D"|"E"|"F"|"G"|"A"|"B"; octave: number; tick: number; type: "quarter"|"whole" }> = [
    { step: "C", octave: 4, tick: 5760, type: "whole" },
  ];

  const addMeasure = (tick: number, number: number) => {
    const id = `measure-${number}`;
    score.measures.push({
      id,
      number,
      tick,
      duration: 1920,
      repeatStart: false,
      repeatEnd: false,
      repeatCount: 2,
    });
    return id;
  };

  const key = `${staffId}:1`;
  const existingIndex = score.eventIndex.get(key) ?? [];

  const allNotes = [
    ...m1Notes.map(n => ({ ...n, type: "quarter" as const })),
    ...m2Notes.map(n => ({ ...n, type: "quarter" as const })),
    ...m3Notes,
    ...m4Notes,
  ];

  for (const n of allNotes) {
    const noteType = n.type ?? "quarter";
    const event = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: n.tick,
      pitch: { step: n.step, octave: n.octave, alter: 0 },
      duration: { type: noteType, dots: 0, ticks: computeTicks(noteType, 0) },
    });
    score.events.set(event.id, event);
    existingIndex.push(event.id);
  }
  score.eventIndex.set(key, existingIndex);

  return score;
}

// ─── Layout params ───────────────────────────────────────────────────────────

const LAYOUT_PARAMS: LayoutParameters = {
  pageWidth: 90,
  pageHeight: 60,
  marginTop: 8,
  marginBottom: 8,
  marginLeft: 6,
  marginRight: 6,
  staffSpacing: 10,
  systemSpacing: 14,
  spatium: 10,
  minSystemFill: 0.6,
  stretchFactor: 1,
};

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  statusEl.textContent = "Loading Leland font…";
  let fontAdapter: LelandFontAdapter;

  try {
    const face = new FontFace("Leland", "url(/Leland.otf)");
    await face.load();
    document.fonts.add(face);
    await document.fonts.ready;

    const metrics = await loadLeland("/Leland.metadata.json");
    fontAdapter = new LelandFontAdapter(metrics);
    
    statusEl.textContent = "Font loaded ✓";
  } catch (err) {
    statusEl.textContent = `Font load failed — rendering without SMuFL glyphs. (${String(err)})`;
    fontAdapter = new LelandFontAdapter(null);
  }

  // 2. Build score and engrave
  statusEl.textContent = "Engraving…";
  const score = buildDemoScore();

  // Re-fetch or pass metrics from the adapter to satisfy the engrave signature
  const engravingResult = engrave(score, LAYOUT_PARAMS, {
    glyphs: {},
    engravingDefaults: {},
    metadata: fontAdapter.metrics.metadata,
  });

  statusEl.textContent = `Engraved: ${engravingResult.totalPages} page(s), ${engravingResult.pages[0]?.systems.length ?? 0} system(s)`;

  // 3. Init renderer
  const renderer = new Canvas2DRenderer();
  await renderer.init(canvas, fontAdapter);

  // 4. Initial viewport states
  let currentScale = 1.0;
  let currentScrollY = 0;

  function buildViewport(): Viewport {
    return {
      pageIndex: 0,
      scrollY: currentScrollY,
      scale: currentScale,
      spatium: 10,
    };
  }

  function redraw() {
    renderer.render(engravingResult, buildViewport());
  }

  redraw();

  // 5–7. Event Listeners
  zoomSlider.addEventListener("input", () => {
    currentScale = parseFloat(zoomSlider.value);
    redraw();
  });

  scrollSlider.addEventListener("input", () => {
    currentScrollY = parseFloat(scrollSlider.value);
    redraw();
  });

  canvas.addEventListener("click", (e: MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const hit = renderer.hitTest(x, y);
    if (hit) {
      hitInfoEl.textContent = `hit: type="${hit.type}" id="${hit.id}" sourceId="${hit.sourceId ?? "—"}" x=${hit.x.toFixed(2)} y=${hit.y.toFixed(2)}`;
      renderer.setHighlights([hit.id]);
    } else {
      hitInfoEl.textContent = "no element at click position";
      renderer.setHighlights([]);
    }
  });
}

main().catch((err) => {
  statusEl.textContent = `Error: ${String(err)}`;
  console.error(err);
});