/**
 * A score event projected into a temporal slice.
 */
export type SliceEvent = {
  eventId: string;
  staffId: string;
  voiceId: number;
  duration: number;
};

/**
 * A snapshot of all events starting at a specific absolute tick.
 */
export type TemporalSlice = {
  tick: number;
  duration: number;
  events: SliceEvent[];
};

/**
 * Ordered temporal slices with O(1) lookup by tick.
 */
export type TemporalSliceMap = {
  slices: TemporalSlice[];
  sliceByTick: Map<number, TemporalSlice>;
  totalTicks: number;
};
