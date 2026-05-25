export type Selection =
  | { type: "none" }
  | { type: "single"; elementId: string; staffId: string; tick: number }
  | { type: "range"; startTick: number; endTick: number; staffId: string; voiceId?: number }
  | { type: "measure"; measureIds: string[] }
  | { type: "all" };

export const emptySelection = (): Selection => ({ type: "none" });

/**
 * Extends a selection with shift-click semantics.
 *
 * @param current Current selection.
 * @param next Single selection target.
 * @returns Updated selection.
 */
export function extendSelection(current: Selection, next: Selection): Selection {
  if (next.type !== "single") {
    return next;
  }
  if (current.type === "none" || current.type === "single") {
    if (current.type === "single") {
      const startTick = Math.min(current.tick, next.tick);
      const endTick = Math.max(current.tick, next.tick);
      if (startTick === endTick) {
        return next;
      }
      return {
        type: "range",
        startTick,
        endTick,
        staffId: next.staffId
      };
    }
    return next;
  }
  if (current.type === "range" && current.staffId === next.staffId) {
    const range: Selection = {
      type: "range",
      startTick: Math.min(current.startTick, next.tick),
      endTick: Math.max(current.endTick, next.tick),
      staffId: next.staffId
    };
    if (current.voiceId !== undefined) {
      range.voiceId = current.voiceId;
    }
    return range;
  }
  return next;
}
