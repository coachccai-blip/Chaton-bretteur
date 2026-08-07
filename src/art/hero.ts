import type { SpriteDef } from './PixelArtGenerator';

/** Le Chaton Bretteur — chibi chevalier détaillé (18x18), vue 3/4. */
export const CAT: SpriteDef = {
  key: 'cat',
  pal: {
    '.': null,
    '#': '#1a1226', 'K': '#0e0a16',
    'W': '#f8f3e7', 'H': '#ffffff', 'w': '#d9cfb8', 's': '#b3a789',
    'n': '#ef9ab0', 'N': '#d97a92',
    'A': '#3f74c0', 'a': '#24467e', 'L': '#6fa0e0',
    'y': '#f4c430', 'Y': '#ffe27a',
    'R': '#cf4230', 'r': '#8f281d',
    'e': '#14324a', 'i': '#bfe8ff',
  },
  rows: [
    '...##........##...',
    '..#WW#......#WW#..',
    '.#WnW#......#WnW#.',
    '.#WWWWWWWWWWWWWW#.',
    '#WWWWWWWWWWWWWWWW#',
    '#HWWWWWWWWWWWWWWH#',
    '#WWeeeWWWWWWeeeWW#',
    '#WWeieWWnnWWeieWW#',
    '#WsWWWWNnnNWWWWsW#',
    '.#WssWWWWWWWWssW#.',
    '..R#AAAAAAAAAA#R..',
    '.rRALAAyyAAAALARr.',
    '.rRAAALYYLAAAAARr.',
    '..RAAAAAAAAAAAAR..',
    '..sRAAAAAAAAAARs..',
    '...#WWWs..sWWW#...',
    '...#WWs#..#sWW#...',
    '...KK##....##KK...',
  ],
};

/** Épée du chaton (8x18, pointe en haut, lame à liseré lumineux). */
export const SWORD: SpriteDef = {
  key: 'sword',
  pal: {
    '.': null,
    '#': '#14101a', 'k': '#4a2c14',
    's': '#cbd6e6', 'S': '#9aa6bc', 'H': '#ffffff',
    'y': '#f4c430', 'Y': '#ffe27a', 'h': '#7a4b26',
  },
  rows: [
    '...HH...',
    '..#ss#..',
    '..#sH#..',
    '..#ss#..',
    '..#sH#..',
    '..#ss#..',
    '..#sH#..',
    '..#ss#..',
    '..#sH#..',
    '..#ss#..',
    '.#yYYy#.',
    '#yYyyYy#',
    '..#hh#..',
    '..#hh#..',
    '..#kh#..',
    '..#hh#..',
    '.#yYy#..',
    '..##....',
  ],
};
