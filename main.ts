/**
 * OpenNotation — Phase 5 Full Test
 *
 * Tests: different time signatures, accidentals, barlines,
 * rests, key signatures, and bounding box hit testing.
 */

import {
  createMinimalScore,
  createNoteEvent,
  createRestEvent,
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
// Score: 3/4 time, D major (2 sharps: F#, C#)
// Measure 1: F#4 (sharp), C#5 (sharp), D4, rest quarter
// Measure 2: G4, A4, B4
// Measure 3: C#5 (sharp), D5, rest half

function buildTestScore() {
  const score = createMinimalScore();
  const staffId = score.staves[0]!.id;

  // Remove default timesig and keysig added by createMinimalScore
for (const [id, event] of score.events) {
  if (event.kind === "timesig" || event.kind === "keysig") {
    score.events.delete(id);
  }
}

  // Override time signature to 3/4
  const timeSigId = "test-timesig";
  score.events.set(timeSigId, {
    id: timeSigId,
    kind: "timesig",
    tick: 0,
    staffId,
    voiceId: 1,
    time: { numerator: 3, denominator: 4 },
  });

  // Set key signature to D major (2 sharps)
  const keySigId = "test-keysig";
  score.events.set(keySigId, {
    id: keySigId,
    kind: "keysig",
    tick: 0,
    staffId,
    voiceId: 1,
    key: { fifths: 2, mode: "major" },
    cancel: false,
  });

  // 3/4 measure duration = 3 quarter notes = 3 * 480 = 1440 ticks
  const measureDuration = 1440;

  // Replace the 4 default measures with 3/4 measures
  score.measures = [];
  for (let i = 0; i <= 3; i++) {
    score.measures.push({
      id: `measure-${i + 1}`,
      number: i + 1,
      tick: i * measureDuration,
      duration: measureDuration,
      repeatStart: false,
      repeatEnd: false,
      repeatCount: 2,
    });
    
  }

  const key = `${staffId}:1`;
  const existingIndex = score.eventIndex.get(key) ?? [];

  // Measure 1: F#4, C#5, D4, rest (but 3/4 so 3 beats — F#4, C#5, D4)
  // F# has alter: 1, C# has alter: 1 — these will show accidentals
  const m1 = [
    { step: "F" as const, octave: 4, alter: 1, tick: 0,   type: "quarter" as const },
    { step: "C" as const, octave: 5, alter: 1, tick: 480,  type: "quarter" as const },
    { step: "D" as const, octave: 4, alter: 0, tick: 960,  type: "quarter" as const },
  ];

  // Measure 2: G4, A4 half note
  const m2 = [
    { step: "G" as const, octave: 4, alter: 0, tick: 1440, type: "quarter" as const },
    { step: "A" as const, octave: 4, alter: 0, tick: 1920, type: "half" as const },
  ];

  // Measure 3: C#5, then a half rest
  const m3notes = [
    { step: "C" as const, octave: 5, alter: 1, tick: 2880, type: "quarter" as const },
  ];

  for (const n of [...m1, ...m2, ...m3notes]) {
    const event = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: n.tick,
      pitch: { step: n.step, octave: n.octave, alter: n.alter },
      duration: { type: n.type, dots: 0, ticks: computeTicks(n.type, 0) },
    });
    // Force accidental display for altered notes
    if (n.alter !== 0) {
      event.accidental = n.alter === 1 ? "sharp" : "flat";
    }
    score.events.set(event.id, event);
    existingIndex.push(event.id);
  }

  // Add a half rest in measure 3 at tick 2880 + 480 = 3360
  const halfRest = createRestEvent({
    staffId,
    voiceId: 1,
    tick: 3360,
    duration: { type: "half", dots: 0, ticks: computeTicks("half", 0) },
  });
  score.events.set(halfRest.id, halfRest);
  existingIndex.push(halfRest.id);

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
    statusEl.textContent = `Font load failed. (${String(err)})`;
    fontAdapter = new LelandFontAdapter(null);
  }

  const score = buildTestScore();

  const engravingResult = engrave(score, LAYOUT_PARAMS, {
    glyphs: {},
    engravingDefaults: {},
    metadata: fontAdapter.metrics?.metadata,
  });

  statusEl.textContent = `Engraved: ${engravingResult.totalPages} page(s), ${engravingResult.pages[0]?.systems.length ?? 0} system(s)`;

  const renderer = new Canvas2DRenderer();
  await renderer.init(canvas, fontAdapter);

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