import type { SpriteDef } from './PixelArtGenerator';

/**
 * Le Chaton Bretteur — guerrier-chat façon Dead Cells (18x18).
 * Casque d'acier à crête rouge, yeux turquoise, armure cramoisie, fourrure crème,
 * membres bruns. Vue 3/4 top-down.
 */
export const CAT: SpriteDef = {
  key: 'cat',
  // Guerrier-chat barbare (26×30) : heaume à crête d'épines rouges, marques
  // tribales blanches, épaulières rouges/noires, fourrure crème, membres bruns.
  // Vue 3/4 face à DROITE (œil/épaule avant plus vifs) ; flipX lisible.
  pal: {
    '.': null,
    '#': '#100a0e',
    'W': '#efe6d0', 'w': '#d6c8a8', 'm': '#c99a68',
    'B': '#8a5a38', 'b': '#5c3a24',
    'R': '#b83b2c', 'r': '#7c1f18', 'H': '#e0604a',
    'K': '#1c1622',
    'e': '#f2c23a', 'i': '#7a1f12', 'T': '#ffffff',
  },
  rows: [
    '..........##HrH##.........',
    '.........#H#rHr#H#........',
    '........#wr#K#K#rw#.......',
    '........#WK##W##KW#.......',
    '.......#w#KKKKKKK#........',
    '...#..##wWWWTTTWWW#.#..#..',
    '..#H##H#wWWWTWTWWW##H##H#.',
    '..#r##r#wW#WWWW##W##r##r#.',
    '..#K##K#wWeWWWWeeWW#K##K#.',
    '..#r##K#wWiWWWWiWW##K##r#.',
    '..#rKKRKwWWWmmmWWWKKRKKr#.',
    '..#rRRHRwWWWm#mWWWRRHRRr#.',
    '.#KRRRRRRRWWWWWWWRRRRRRRK#',
    '..#rRRRRRrWWWWWWWrRRRRRr#.',
    '...#KKRKKWWWWWWWWWKKRKK#..',
    '.##B##KBBWWWWWWWWWBBK##...',
    '#bB#.#BBBWWWWWWWWWBBB#....',
    '.#bB##BBBWWWWWWWWWBBB#....',
    '.#bB##BBBWWwwwwwWWBBB#....',
    '..#bB#BBBWWwwwwwWWBBB#....',
    '..#bB#BBBWWwwwwwWWBBB#....',
    '...#bBmmm#WWWWWWW#mmm#....',
    '...#bB###bBB#WbBB####.....',
    '....##..#bBB##bBB#........',
    '........#bBB##bBB#........',
    '........#bBB##bBB#........',
    '........#bBB##bBB#........',
    '........#bBB##bBB#........',
    '........#mmm##mmm#........',
    '.........###..###.........',
  ],
};

/**
 * Katana noir spectral (7x20), pointe en haut, tranchant lumineux à droite,
 * tsuba dorée. Utilisé par le boon « Troisième Lame » qui le fait tournoyer.
 */
export const KATANA: SpriteDef = {
  key: 'katana_black',
  pal: {
    '.': null,
    '#': '#08080c', 'B': '#1a1a24', 'e': '#9fd0e8',
    'g': '#c9a23a', 'G': '#8a6a20', 'h': '#241810',
  },
  rows: [
    '...#...',
    '..#B#..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#Be..',
    '..#B#..',
    '.ggggg.',
    '..GhG..',
    '..#h#..',
    '..#h#..',
    '..GhG..',
    '..#h#..',
    '...#...',
  ],
};

/**
 * Chat marchand du désert (18x18) : turban à joyau, robe brune, chat tigré
 * beige/marron, gourde d'eau accrochée au flanc.
 */
export const MERCHANT_CAT: SpriteDef = {
  key: 'merchant_cat',
  pal: {
    '.': null, '#': '#241810',
    'F': '#d8b483', 'f': '#a87a4a', 'W': '#f0e2c0',
    'T': '#3a9a9a', 't': '#276a6a', 'y': '#f4c430',
    'R': '#b5794a', 'r': '#8a5a2e',
    'g': '#7aa83f', 'G': '#4a6a24',
    'e': '#2a1c10', 'i': '#5a3a1a',
  },
  rows: [
    '.....TTTTTTTT.....',
    '....TtTTTTTTtT....',
    '...TtTTTyyTTTtT...',
    '..TtTTTTTTTTTTtT..',
    '..#tTTTTTTTTTTt#..',
    '...#FFFFFFFFFF#...',
    '...#FfFFFFFFfF#...',
    '...#FeFFFFFFeF#...',
    '...#FFWWiiWWFF#...',
    '...#fFWWWWWWFf#...',
    '...#FFFFFFFFFF#...',
    '..#RRRRRRRRRRR#...',
    '..#RrRRRRRRRrR#...',
    '..#RRRRRRRRRRR#gg.',
    '..#RrRRRRRRRrR#GgG',
    '..#RRRRRRRRRRR#GgG',
    '..#rRRRRRRRRr#.Gg.',
    '...##########.....',
  ],
};

/**
 * Susanoo (18x16) : buste de guerrier spectral cornu (armure éthérée). Affiché
 * en violet translucide derrière le chaton tant que le boon Susanoo est actif.
 */
export const SUSANOO: SpriteDef = {
  key: 'susanoo',
  pal: { '.': null, '#': '#2a1440', 'p': '#7a4ad0', 'P': '#b98cff', 'e': '#e8d8ff', 'k': '#4a2c7a' },
  rows: [
    '..p..........p....',
    '..pp........pp....',
    '..ppp......ppp....',
    '...pkkkkkkkkkp....',
    '...pkPPPPPPPPkp...',
    '...pkPeePPeePkp...',
    '...pkPPPPPPPPkp...',
    '...pkPPkkkkPPkp...',
    '..ppkPPPPPPPPkpp..',
    '.pp.kPPPPPPPPk.pp.',
    'pp..kPPPPPPPPk..pp',
    'p...kkPPPPPPkk...p',
    '....kPPPPPPPPk....',
    '....kkkkkkkkkk....',
    '.....pppppppp.....',
    '..................',
  ],
};

/** Mjölnir (10x14) : marteau de guerre à tête d'acier runique, manche cuir. */
export const HAMMER: SpriteDef = {
  key: 'hammer_thor',
  pal: {
    '.': null, '#': '#0e1016', 'k': '#3a424c', 'm': '#5a636e', 'w': '#8b96a2',
    'e': '#bff7f6', 'y': '#cfe0ff', 'h': '#6a4a2a', 'H': '#4a3018',
  },
  rows: [
    '.wwwwwwww.',
    'wmmmmmmmmw',
    'wmkkwwkkmw',
    'wmkeewwkmw',
    'wmkkwwkkmw',
    'wmmmmmmmmw',
    '.wwwwwwww.',
    '...hHHh...',
    '...hHHh...',
    '...hHHh...',
    '...hHHh...',
    '..HHHHHH..',
    '...####...',
    '..........',
  ],
};

/** Vague d'eau (12x6) : crête écumeuse, tracée par la Première Danse de l'Eau. */
export const WATER_WAVE: SpriteDef = {
  key: 'water_wave',
  pal: { '.': null, '#': '#0a3048', 'b': '#2a7ab0', 'B': '#59b8ff', 'w': '#bfe8ff', 'W': '#eaffff' },
  rows: [
    '..W..WW..W..',
    '.wBBBBBBBBw.',
    'WBBbbbbbbBBW',
    'wBb##..##bBw',
    '.b#......#b.',
    '..w......w..',
  ],
};

/**
 * Kage Bunshin (18x18) : clone d'ombre du chaton. Même silhouette que le héros
 * mais en tons violet-nuit translucides, yeux luisants — dessiné à part pour
 * rester lisible comme « double spectral » qui frappe aux côtés du joueur.
 */
export const KAGE_BUNSHIN: SpriteDef = {
  key: 'kage_bunshin',
  pal: {
    '.': null,
    '#': '#080510', 'k': '#0c0818',
    'W': '#2a1840', 'w': '#20122f', 'm': '#241436',
    'B': '#180d24', 'b': '#100818',
    'R': '#3a2058', 'r': '#241338', 'H': '#4a2c70',
    'G': '#160c20', 'g': '#241436',
    'e': '#c9a0ff', 'i': '#7a4ad0',
  },
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

/**
 * Rasenshuriken (18x18) : shuriken de vent-chakra à quatre lames, cœur blanc
 * incandescent, corps bleu-cyan. Tournoie puis explose en dôme de vent.
 */
export const RASENSHURIKEN: SpriteDef = {
  key: 'rasenshuriken',
  pal: {
    '.': null, '#': '#1a4a6a', 'b': '#2a8ac0', 'B': '#59c8ff', 'c': '#bff7f6', 'w': '#ffffff',
  },
  rows: [
    '........##........',
    '.......#cc#.......',
    '.......#cc#.......',
    '......#bccb#......',
    '......#bccb#......',
    '.....#bBccBb#.....',
    '.....#bBccBb#.....',
    '#####bBBccBBb#####',
    'ccccBBBBwwBBBBcccc',
    'ccccBBBBwwBBBBcccc',
    '#####bBBccBBb#####',
    '.....#bBccBb#.....',
    '.....#bBccBb#.....',
    '......#bccb#......',
    '......#bccb#......',
    '.......#cc#.......',
    '.......#cc#.......',
    '........##........',
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
