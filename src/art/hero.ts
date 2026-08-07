import type { SpriteDef } from './PixelArtGenerator';

/** Le Chaton Bretteur — chibi chevalier, vue de face 3/4 (16x16). */
export const CAT: SpriteDef = {
  key: 'cat',
  pal: {
    '.': null,
    '#': '#241a2e',
    'W': '#f6f1e4',
    'w': '#dcd3bf',
    'n': '#ef9ab0',
    'A': '#3b6fb8',
    'a': '#284c86',
    'y': '#f4c430',
    'R': '#c8402f',
    'r': '#8f281d',
  },
  rows: [
    '...##......##...',
    '..#WW#....#WW#..',
    '.#WnWWWWWWWWnW#.',
    '.#WWWWWWWWWWWW#.',
    '#WWWWWWWWWWWWWW#',
    '#WW#WWWWWWWW#WW#',
    '#WWWWWnnWWWWWWW#',
    '#WWWWWWWWWWWWWW#',
    '.#wWWWWWWWWWWw#.',
    '..r#AAAAAAAA#r..',
    '..rRAaAAAAaARr..',
    '..rRAAAyyAAARr..',
    '...RAAAAAAAAR...',
    '...#WWW##WWW#...',
    '...#WW#..#WW#...',
    '....##....##....',
  ],
};

/** Épée du chaton (6x16, pointe en haut) — pivotée par code pour les swings. */
export const SWORD: SpriteDef = {
  key: 'sword',
  pal: {
    '.': null,
    '#': '#20161f',
    's': '#d8e0ec',
    'S': '#9aa4b8',
    'y': '#f4c430',
    'h': '#7a4b26',
  },
  rows: [
    '..##..',
    '.#ss#.',
    '.#ss#.',
    '.#ss#.',
    '.#ss#.',
    '.#Ss#.',
    '.#ss#.',
    '.#Ss#.',
    '.#ss#.',
    '#yyyy#',
    '.#hh#.',
    '.#hh#.',
    '.#hh#.',
    '.#yy#.',
    '..##..',
    '......',
  ],
};
