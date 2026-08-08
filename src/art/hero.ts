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
    '#': '#140d12', 'k': '#17131c',
    'W': '#efe6d0', 'w': '#d6c8a8', 'm': '#c99a68',
    'B': '#8a5a38', 'b': '#5c3a24',
    'R': '#b83b2c', 'r': '#7c1f18', 'H': '#e0604a',
    'G': '#c2c6d0', 'g': '#868c98',
    'e': '#f2c23a', 'i': '#7a1f12',
  },
  // Sprite orienté à droite (vue 3/4 top-down) : une queue part vers la GAUCHE
  // (l'arrière), l'œil/museau droit reçoit la lumière — la silhouette est donc
  // asymétrique et le miroir gauche/droite (flipX) est parfaitement lisible.
  rows: [
    '......k.kk.k......',
    '.....kRkkkkRk.....',
    '....kRRkkkkRRk....',
    '...GgRRRRRRRRgG...',
    '..GGgWWWWWWWWgGG..',
    '..GgWmmmmmmmmWgG..',
    '..GgWmeWWWWeemgG..',
    '..GgWmmWiiWmmWgG..',
    '.b.ggWmmmmmmWgg...',
    'bBRH#WWWWWWWW#HR..',
    '.bRr#RRRRRRRR#rRH.',
    '.B#R#RWWWWWWR#Rr..',
    '.B#b#RRWWWWRR#b#..',
    '.bB#BB#WWWW#BB#...',
    '..B#Bb#....#bB#...',
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
