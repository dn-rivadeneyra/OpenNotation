/**
 * OpenNotation — Phase 6 Test Harness
 *
 * Tests: EditorController, note entry, undo/redo, selection,
 * interaction state machine, and command dispatch.
 */

import {
  createMinimalScore,
  createNoteEvent,
  createRestEvent,
  createMeasure,
  computeTicks,
  TPQ,
} from "./src/core/model/index.ts";
import type { LayoutParameters } from "./src/core/engraving/index.ts";
import { Canvas2DRenderer } from "./src/core/rendering/index.ts";
import { LelandFontAdapter } from "./src/core/fonts/index.ts";
import { loadLeland } from "./src/core/fonts/lelandLoader.ts";
import { EditorController } from "./src/core/editor/EditorController.ts";

// ─── DOM ────────────────────────────────────────────────────────────────────

const canvas = document.getElementById("score-canvas") as HTMLCanvasElement;
const statusEl = document.getElementById("status") as HTMLDivElement;
const hitInfoEl = document.getElementById("hit-info") as HTMLDivElement;
const zoomSlider = document.getElementById("zoom") as HTMLInputElement;
const scrollSlider = document.getElementById("scroll") as HTMLInputElement;

// ─── Build score ─────────────────────────────────────────────────────────────

function buildTestScore() {
  const score = createMinimalScore();
  const staffId = score.staves[0]!.id;
  const timeSig = { numerator: 4, denominator: 4 } as const;

  // Remove default preamble events — we replace them below.
  for (const [id, event] of score.events) {
    if (event.kind === "timesig" || event.kind === "keysig" || event.kind === "clef") {
      score.events.delete(id);
    }
  }

  score.events.set("test-clef", {
    id: "test-clef",
    kind: "clef",
    tick: 0,
    staffId,
    voiceId: 1,
    clef: "treble",
    line: 2
  });

  score.events.set("test-timesig", {
    id: "test-timesig",
    kind: "timesig",
    tick: 0,
    staffId,
    voiceId: 1,
    time: timeSig
  });

  score.events.set("test-keysig", {
    id: "test-keysig",
    kind: "keysig",
    tick: 0,
    staffId,
    voiceId: 1,
    key: { fifths: 2, mode: "major" },
    cancel: false
  });

  // Two full 4/4 measures — each holds exactly 4 quarter-note beats.
  score.measures = [
    createMeasure({ number: 1, tick: 0, timeSig }),
    createMeasure({ number: 2, tick: TPQ * 4, timeSig })
  ];

  const key = `${staffId}:1`;
  const eventIds = ["test-clef", "test-timesig", "test-keysig"];

  // Measure 1: four quarter notes (4 beats).
  const m1 = [
    { step: "F" as const, octave: 4, alter: 1, tick: 0, type: "quarter" as const },
    { step: "C" as const, octave: 5, alter: 1, tick: TPQ, type: "quarter" as const },
    { step: "D" as const, octave: 4, alter: 0, tick: TPQ * 2, type: "quarter" as const },
    { step: "G" as const, octave: 4, alter: 0, tick: TPQ * 3, type: "quarter" as const }
  ];

  // Measure 2: half + quarter + quarter rest (4 beats).
  const m2Notes = [
    { step: "B" as const, octave: 4, alter: 0, tick: TPQ * 4, type: "half" as const },
    { step: "A" as const, octave: 4, alter: 1, tick: TPQ * 6, type: "quarter" as const }
  ];

  for (const n of [...m1, ...m2Notes]) {
    const event = createNoteEvent({
      staffId,
      voiceId: 1,
      tick: n.tick,
      pitch: { step: n.step, octave: n.octave, alter: n.alter },
      duration: { type: n.type, dots: 0, ticks: computeTicks(n.type, 0) }
    });
    if (n.alter !== 0) {
      event.accidental = n.alter === 1 ? "sharp" : "flat";
    }
    score.events.set(event.id, event);
    eventIds.push(event.id);
  }

  const quarterRest = createRestEvent({
    staffId,
    voiceId: 1,
    tick: TPQ * 7,
    duration: { type: "quarter", dots: 0, ticks: computeTicks("quarter", 0) }
  });
  score.events.set(quarterRest.id, quarterRest);
  eventIds.push(quarterRest.id);

  score.eventIndex.set(key, eventIds);

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

  // ─── Renderer ──────────────────────────────────────────────────────────────

  const renderer = new Canvas2DRenderer();
  await renderer.init(canvas, fontAdapter);

  // ─── Editor ────────────────────────────────────────────────────────────────

  const score = buildTestScore();

  const editor = new EditorController(
    renderer,
    LAYOUT_PARAMS,
    { glyphs: {}, engravingDefaults: {}, metadata: fontAdapter.metrics?.metadata },
    { score }
  );

  // ─── State display ─────────────────────────────────────────────────────────

  editor.subscribe((state) => {
    const mode = state.mode;
    const sel = state.selection;
    const selInfo = sel.type === "single"
      ? `selected: ${sel.elementId.slice(0, 16)}…`
      : sel.type === "none"
      ? "no selection"
      : sel.type;
    const noteEntry = state.noteEntryState
      ? `note entry | dur: ${state.noteEntryState.duration.type}`
      : "";
    hitInfoEl.textContent = [
      `mode: ${mode}`,
      selInfo,
      noteEntry
    ].filter(Boolean).join(" | ");
  });

  // ─── Zoom / Scroll ─────────────────────────────────────────────────────────

  zoomSlider.addEventListener("input", () => {
    const scale = parseFloat(zoomSlider.value);
    // Re-render with updated viewport
    const state = editor.getState();
    renderer.render(
      // Re-use last engraving result via a no-op dispatch trick:
      // access internal result via a fresh engrave
      // We call loadScore to trigger reengrave with new viewport scale
      // TODO: EditorController should expose setViewport — for now reload
      state.score,
      { ...state.viewport, scale, spatium: 10 }
    );
  });

  scrollSlider.addEventListener("input", () => {
    const scrollY = parseFloat(scrollSlider.value);
    const state = editor.getState();
    renderer.render(
      state.score,
      { ...state.viewport, scrollY, spatium: 10 }
    );
  });

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      editor.undo();
      statusEl.textContent = "Undo";
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      editor.redo();
      statusEl.textContent = "Redo";
      return;
    }
    editor.handleKeyDown(e);
  });

  // ─── Mouse ─────────────────────────────────────────────────────────────────

  canvas.addEventListener("mousedown", (e: MouseEvent) => {
    editor.handleMouseDown(e, canvas);
  });

  // ─── Status ────────────────────────────────────────────────────────────────

  const result = editor.getState();
  statusEl.textContent = `Ready | mode: ${result.mode} | Press N to enter note entry`;
}

main().catch((err) => {
  statusEl.textContent = `Error: ${String(err)}`;
  console.error(err);
});