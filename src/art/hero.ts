import type { SpriteDef } from './PixelArtGenerator';

/**
 * Le Chaton Bretteur — guerrier-chat façon Dead Cells (18x18).
 * Casque d'acier à crête rouge, yeux turquoise, armure cramoisie, fourrure crème,
 * membres bruns. Vue 3/4 top-down.
 */
export const CAT: SpriteDef = {
  key: 'cat',
  pal: {
    '.': null,
    '#': '#160f14', 'k': '#0c080c',
    'W': '#efe6d0', 'w': '#d6c8a8', 'm': '#f6efdc',
    'B': '#8a5a38', 'b': '#5c3a24',
    'R': '#b83b2c', 'r': '#7c1f18', 'H': '#e0604a',
    'S': '#c6ccd6', 's': '#6b7180', 'M': '#8a909e',
    'e': '#43d0cf', 'i': '#bff7f6',
  },
  rows: [
    '........HH........',
    '.......HRRH.......',
    '......HRRRRH......',
    '.....#RRRRRR#.....',
    '...#SSSSSSSSSS#...',
    '...#SSssMSssMS#...',
    '...#SeiSSSSieS#...',
    '...#SSWWmmWWSS#...',
    '...#SwWmkkmWwS#...',
    '..RH#WWWWWWWW#HR..',
    '..Rr#RRRRRRRR#rR..',
    '..rR#RWWWWWWR#Rr..',
    '..#b#RRWWWWRR#b#..',
    '...#BB#WWWW#BB#...',
    '...#Bb#....#bB#...',
    '...bBB#....#BBb...',
    '...#bb......bb#...',
    '..................',
  ],
};

/** Épée cramoisie dentelée (8x18), pointe en haut, gemme turquoise. */
export const SWORD: SpriteDef = {
  key: 'sword',
  pal: {
    '.': null,
    '#': '#120c10', 'k': '#0c080c',
    'R': '#b83b2c', 'r': '#7c1f18', 'H': '#e0604a',
    's': '#d2d8e2', 'S': '#8a909e',
    'y': '#e0a53a', 'Y': '#ffdf8a', 'b': '#5c3a24',
    'e': '#43d0cf', 'i': '#bff7f6',
  },
  rows: [
    '...##...',
    '..#Rs#..',
    '.#HRs#k.',
    '.#RRs#..',
    '.#kRs#k.',
    '.#RRs#..',
    '.#kRs#k.',
    '.#RRs#..',
    '.#rRs#k.',
    '#yYYYYy#',
    '..#be#..',
    '..#bi#..',
    '..#bb#..',
    '..#yY#..',
    '...##...',
    '........',
    '........',
    '........',
  ],
};
