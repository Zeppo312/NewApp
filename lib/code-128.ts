const CODE_128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312',
  '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222',
  '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131',
  '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321',
  '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121',
  '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224',
  '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112',
  '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113',
  '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412',
  '211214', '211232', '2331112',
] as const;

const START_CODE_B = 104;
const STOP_CODE = 106;

export type BarcodeBar = { x: number; width: number };

export type Code128Layout = {
  bars: BarcodeBar[];
  width: number;
};

export const canEncodeCode128 = (value: string) =>
  value.length > 0 && [...value].every((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code <= 126;
  });

export const code128Checksum = (value: string) => {
  if (!canEncodeCode128(value)) {
    throw new Error('Code 128 unterstützt hier nur druckbare ASCII-Zeichen.');
  }

  return (
    START_CODE_B +
    [...value].reduce(
      (sum, character, index) => sum + (character.charCodeAt(0) - 32) * (index + 1),
      0
    )
  ) % 103;
};

/** Erstellt die schwarzen Balken eines gültigen Code-128-B-Barcodes inklusive Ruhezonen. */
export const createCode128Layout = (value: string, quietZone = 10): Code128Layout => {
  const checksum = code128Checksum(value);
  const symbols = [
    START_CODE_B,
    ...[...value].map((character) => character.charCodeAt(0) - 32),
    checksum,
    STOP_CODE,
  ];

  const bars: BarcodeBar[] = [];
  let x = quietZone;

  for (const symbol of symbols) {
    const pattern = CODE_128_PATTERNS[symbol];
    let isBar = true;
    for (const widthCharacter of pattern) {
      const width = Number(widthCharacter);
      if (isBar) bars.push({ x, width });
      x += width;
      isBar = !isBar;
    }
  }

  return { bars, width: x + quietZone };
};
