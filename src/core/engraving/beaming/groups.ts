import type { TimeSignature } from "../../model/index.js";
import { TPQ } from "../../model/index.js";

type GroupNode = {
  pos: number;
  action: number;
};

const PRIMARY_BREAK = 0x200;
const SECONDARY_BREAK = 0x110;
const ALL_BREAK = 0x111;

const NOTE_GROUPS: { timeSig: TimeSignature; nodes: GroupNode[] }[] = [
  {
    timeSig: { numerator: 2, denominator: 4 },
    nodes: [{ pos: 4, action: PRIMARY_BREAK }, { pos: 8, action: ALL_BREAK }, { pos: 12, action: PRIMARY_BREAK }]
  },
  {
    timeSig: { numerator: 3, denominator: 4 },
    nodes: [
      { pos: 4, action: PRIMARY_BREAK },
      { pos: 8, action: ALL_BREAK },
      { pos: 12, action: PRIMARY_BREAK },
      { pos: 16, action: ALL_BREAK },
      { pos: 20, action: PRIMARY_BREAK }
    ]
  },
  {
    timeSig: { numerator: 4, denominator: 4 },
    nodes: [
      { pos: 4, action: PRIMARY_BREAK },
      { pos: 8, action: SECONDARY_BREAK },
      { pos: 12, action: PRIMARY_BREAK },
      { pos: 16, action: ALL_BREAK },
      { pos: 20, action: PRIMARY_BREAK },
      { pos: 24, action: SECONDARY_BREAK },
      { pos: 28, action: PRIMARY_BREAK }
    ]
  },
  {
    timeSig: { numerator: 6, denominator: 8 },
    nodes: [
      { pos: 4, action: PRIMARY_BREAK },
      { pos: 8, action: PRIMARY_BREAK },
      { pos: 12, action: ALL_BREAK },
      { pos: 16, action: PRIMARY_BREAK },
      { pos: 20, action: PRIMARY_BREAK }
    ]
  }
];

function posUnitTicks(timeSig: TimeSignature): number {
  switch (timeSig.denominator) {
    case 2:
      return TPQ * 2;
    case 4:
      return TPQ / 2;
    case 8:
      return TPQ / 4;
    case 16:
      return TPQ / 8;
    default:
      return TPQ / 2;
  }
}

function defaultGroupNodes(timeSig: TimeSignature): GroupNode[] {
  const beatPos = timeSig.denominator === 4 ? 8 : timeSig.denominator === 8 ? 4 : 16;
  const nodes: GroupNode[] = [];
  for (let beat = 1; beat < timeSig.numerator; beat += 1) {
    nodes.push({ pos: beat * beatPos, action: ALL_BREAK });
  }
  return nodes;
}

export function getGroupsForTimeSignature(timeSig: TimeSignature): GroupNode[] {
  const match = NOTE_GROUPS.find(
    (entry) => entry.timeSig.numerator === timeSig.numerator && entry.timeSig.denominator === timeSig.denominator
  );
  return match?.nodes ?? defaultGroupNodes(timeSig);
}

export function getBeatTicks(_tick: number, timeSig: TimeSignature): number {
  return (TPQ * 4) / timeSig.denominator;
}

export function primaryGroupSizeInTicks(timeSig: TimeSignature): number {
  if (timeSig.denominator === 8 && timeSig.numerator % 3 === 0 && timeSig.numerator >= 6) {
    return getBeatTicks(0, timeSig) * 3;
  }

  if (timeSig.denominator === 4 && timeSig.numerator === 4) {
    return getBeatTicks(0, timeSig) * 2;
  }

  if (timeSig.denominator === 4 && timeSig.numerator === 3) {
    return getBeatTicks(0, timeSig) * 2;
  }

  return getBeatTicks(0, timeSig);
}

function breakMaskForLevel(level: number): number {
  if (level === 0) {
    return PRIMARY_BREAK;
  }
  if (level === 1) {
    return SECONDARY_BREAK | ALL_BREAK;
  }
  return ALL_BREAK;
}

export function shouldBreakBeamAtLevel(
  timeSig: TimeSignature,
  tickInMeasure: number,
  level: number,
  beatTicks: number
): boolean {
  if (tickInMeasure <= 0) {
    return false;
  }

  const pos = Math.round(tickInMeasure / posUnitTicks(timeSig));
  const mask = breakMaskForLevel(level);
  const nodes = getGroupsForTimeSignature(timeSig);
  if (nodes.some((node) => node.pos === pos && (node.action & mask) !== 0)) {
    return true;
  }

  if (level >= 1 && tickInMeasure % beatTicks === 0) {
    return true;
  }

  return false;
}
