export const SMUFL = {
  noteheadBlack: 0xe0a4,
  noteheadHalf: 0xe0a3,
  noteheadWhole: 0xe0a2,
  noteheadDoubleWhole: 0xe0a0,
  noteheadXBlack: 0xe0a9,
  restWhole: 0xe4e3,
  restHalf: 0xe4e4,
  restQuarter: 0xe4e5,
  rest8th: 0xe4e6,
  rest16th: 0xe4e7,
  rest32nd: 0xe4e8,
  rest64th: 0xe4e9,
  flag8thUp: 0xe240,
  flag8thDown: 0xe241,
  flag16thUp: 0xe242,
  flag16thDown: 0xe243,
  flag32ndUp: 0xe244,
  flag32ndDown: 0xe245,
  accidentalSharp: 0xe262,
  accidentalFlat: 0xe260,
  accidentalNatural: 0xe261,
  accidentalDoubleSharp: 0xe263,
  accidentalDoubleFlat: 0xe264,
  gClef: 0xe050,
  fClef: 0xe062,
  cClef: 0xe05c,
  gClef8vb: 0xe052,
  unpitchedPercussionClef: 0xe069,
  timeSig0: 0xe080,
  timeSig1: 0xe081,
  timeSig2: 0xe082,
  timeSig3: 0xe083,
  timeSig4: 0xe084,
  timeSig5: 0xe085,
  timeSig6: 0xe086,
  timeSig7: 0xe087,
  timeSig8: 0xe088,
  timeSig9: 0xe089,
  timeSigCommon: 0xe08a,
  timeSigCut: 0xe08b,
  articStaccatoAbove: 0xe4a2,
  articTenutoAbove: 0xe4a4,
  articAccentAbove: 0xe4a0,
  articMarcatoAbove: 0xe4ac,
  articStaccatissimoAbove: 0xe4a6,
  dynamicPP: 0xe52b,
  dynamicP: 0xe520,
  dynamicMP: 0xe52c,
  dynamicMF: 0xe52d,
  dynamicF: 0xe522,
  dynamicFF: 0xe52f,
  dynamicSForzando: 0xe526,
  augmentationDot: 0xe1e7,
  barlineSingle: 0xe030,
  barlineDouble: 0xe031,
  barlineFinal: 0xe032,
  repeatDot: 0xe044,
  brace: 0xe000,
  tremolo1: 0xe220,
  tremolo2: 0xe221,
  tremolo3: 0xe222,
  ornamentTrill: 0xe566,
  ornamentTurn: 0xe567,
  ornamentMordent: 0xe56c
} as const;

export type SmuflName = keyof typeof SMUFL;

/**
 * Gets a SMuFL glyph character from its symbolic name.
 *
 * @param name SMuFL glyph name.
 * @returns Unicode character string for the glyph.
 */
export function glyphChar(name: SmuflName): string {
  return String.fromCodePoint(SMUFL[name]);
}
