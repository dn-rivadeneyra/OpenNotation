import type { NormalizedKeyEvent, NormalizedPointerEvent } from "../types.ts";

/**
 * Normalizes browser pointer events with device pixel ratio scaling.
 *
 * @param event Browser mouse event.
 * @param canvas Target canvas element.
 * @returns Normalized pointer payload.
 */
export function normalizePointerEvent(
  event: MouseEvent,
  canvas: HTMLCanvasElement
): NormalizedPointerEvent {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    screenX: (event.clientX - rect.left) * scaleX,
    screenY: (event.clientY - rect.top) * scaleY,
    button: event.button,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey
  };
}

/**
 * Normalizes keyboard events for the interaction state machine.
 *
 * @param event Browser keyboard event.
 * @returns Normalized key payload.
 */
export function normalizeKeyEvent(event: KeyboardEvent): NormalizedKeyEvent {
  return {
    key: event.key,
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    preventDefault: () => event.preventDefault()
  };
}
