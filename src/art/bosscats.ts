import type { SpriteDef } from './PixelArtGenerator';

/**
 * Boss = chats-champions (comme le héros) fusionnés avec leur thème.
 * Sprites orientés vers la DROITE (vue 3/4) : museau/bec débordant à droite,
 * yeux décalés à droite, queue/crinière en contrepoids à gauche, main avant
 * qui avance à droite. La version « gauche » est le miroir (flipX) au rendu.
 */

// corps partagé (bras/torse/jambes) — recoloré via la palette de chaque boss.
// Asymétrique : queue à gauche (b/B), main avant qui avance à droite (RH).
const BODY = [
  '..RH#WWWWWWWW#HR..',
  '.HRr#RRRRRRRR#rRH.',
  'bBrR#RWWWWWWR#Rr..',
  '.B#b#RRWWWWRR#b#..',
  '..B#BB#WWWW#BB#RH.',
  '...#Bb#....#bB#r..',
  '...bBB#....#BBb...',
  '...#bb......bb#...',
  '..................',
];

/** Sylvaan — chat-centaure archer : bois de cerf, teintes forêt. */
export const BOSS_CENTAURE: SpriteDef = {
  key: 'boss_centaure',
  pal: {
    '.': null, '#': '#14210f', 'k': '#0c1408',
    'W': '#efe6d0', 'w': '#c9bd9a', 'm': '#c99a68',
    'B': '#7a5a2a', 'b': '#4a3618',
    'R': '#3a7a3a', 'r': '#245020', 'H': '#7ad06a',
    'G': '#4a8a3a', 'e': '#f2c23a', 'i': '#3a1f0a',
  },
  rows: [
    '.b.b......b.b.....',
    '..bbb....bbbb.....',
    '...b......b.b.....',
    '..GGGGGGGGGGG.....',
    '.#WWWWWWWWWWmmm...',
    '.#WWWWWWeWWWemm...',
    '.#WWWWWmWWiiWmm...',
    '.#GWWWmmWWWWmG#...',
    '..#GGWWWWWWGG#....',
    ...BODY,
  ],
};

/** Gorbak — chat-gobu géant : grandes oreilles, peau verte, défenses. */
export const BOSS_GOBU: SpriteDef = {
  key: 'boss_gobugeant',
  pal: {
    '.': null, '#': '#14240e', 'k': '#0a1206',
    'W': '#8ab84a', 'w': '#6a962f', 'm': '#3a5a1a',
    'B': '#5a4020', 'b': '#3a2814',
    'R': '#6a4a24', 'r': '#4a3016', 'H': '#a8d06a',
    'G': '#5a9a2a', 'e': '#f2d24a', 'i': '#1a1a0a', 'T': '#efe6d0',
  },
  rows: [
    '..G.........G.....',
    '.GG.........GGG...',
    'GGG.........GGGG..',
    '.GGGGGGGGGGGGG....',
    '.#GGGGGGGGGGGmm...',
    '.#GGGGGGeGGGeGm...',
    '.#GGGGmGGGGGmGm...',
    '.#GGTkGGGGkTGGm...',
    '..#GGGGGGGGGG#....',
    ...BODY,
  ],
};

/** Ignis — chat-serpent de lave : crête de flammes, fourrure sombre, lueur. */
export const BOSS_SERPENT: SpriteDef = {
  key: 'boss_serpentlave',
  pal: {
    '.': null, '#': '#0e0704', 'k': '#241410',
    'W': '#ff9a3a', 'w': '#c96a1a', 'm': '#3a1810',
    'B': '#2a1810', 'b': '#160c08',
    'R': '#7a2a10', 'r': '#4a1508', 'H': '#ff6a1f',
    'o': '#c9500f', 'O': '#ffb020', 'y': '#ffe08a', 'e': '#ffd24a', 'i': '#0e0704',
  },
  rows: [
    '...yoyoyoy........',
    '...RoRRRRo........',
    '..R#RRRRRR#.......',
    '.#kkkkkkkkkk......',
    '#kkkkkkkkkkkoo....',
    '#keekkkkkeekOo....',
    '#kkkoOOOOokkOo....',
    '#kkokkkkkkokkO....',
    '.#kkkkkkkkkk#.....',
    ...BODY,
  ],
};

/** Mortis — chat-archimage mort-vivant : chapeau, face de crâne, robe violette. */
export const BOSS_ARCHIMAGE: SpriteDef = {
  key: 'boss_archimage',
  pal: {
    '.': null, '#': '#0e0b1a', 'k': '#1a1428',
    'W': '#e6e2d4', 'w': '#c2beac', 'm': '#8a5cff',
    'B': '#3a2c5a', 'b': '#241a3a',
    'R': '#5a3a8a', 'r': '#3a2560', 'H': '#8a5cff',
    'p': '#4a2c7a', 'e': '#c78aff', 'i': '#0e0b1a', 'y': '#f4c430',
  },
  rows: [
    '.......y..........',
    '......ppp.........',
    '.....ppppp........',
    '....ppppppp.......',
    '...pppppppppp.....',
    '..pppppppppppp....',
    '..#WWWWWWWWWWm....',
    '..#WWWWeWWeWWm....',
    '..#WWkkkkkkWW#....',
    ...BODY,
  ],
};

/** Glacior — chat-léviathan des glaces : crinière de cristaux, fanons de givre. */
export const BOSS_LEVIATHAN: SpriteDef = {
  key: 'boss_leviathan',
  pal: {
    '.': null, '#': '#0e1826', 'k': '#14283a',
    'W': '#dcecf8', 'w': '#a8c8e0', 'm': '#2a4a60',
    'B': '#2a4258', 'b': '#182a3c',
    'R': '#3a6a8a', 'r': '#254a64', 'H': '#7fdcff',
    'C': '#9fe0f8', 'e': '#e8f8ff', 'i': '#0a1420', 'y': '#cfeaff',
  },
  rows: [
    '..C..C..C.C.......',
    '...CC..CC.CC......',
    '....HHHHHHHH......',
    '...#kkkkkkkkk.....',
    '..#kWWkkkkkWkkC...',
    '..#kWeWkkkWeWkC...',
    '..#kkkHHHHkkkCC...',
    '..#kkCkkkkkkkCC...',
    '...#kkkkkkkkk#....',
    ...BODY,
  ],
};

/** Voltaïr — chat-rapace du jugement : couronne-heaume, rémiges d'or, éclairs. */
export const BOSS_RAPACE: SpriteDef = {
  key: 'boss_rapace',
  pal: {
    '.': null, '#': '#12121f', 'k': '#1c1c30',
    'W': '#e8e8ff', 'w': '#b0b0d0', 'm': '#8a7a4a',
    'B': '#2a2a44', 'b': '#181828',
    'R': '#3a3a5a', 'r': '#24243a', 'H': '#ffe08a',
    'e': '#ffffff', 'y': '#ffe08a', 'i': '#0c0c16', 'L': '#b0c8ff',
  },
  rows: [
    '....y..y..y.......',
    '...yHy.LL.Ly......',
    '....yHHHHHHy......',
    '...#kkkkkkkkk.....',
    '..#kkHkkkkHkky....',
    '..#keekkkkeekyy...',
    '..#kkkyHHHykkmm...',
    '..#kkkkkmmkkmm....',
    '...#kkLkkkkLk#....',
    ...BODY,
  ],
};

/** Néantis — le reflet noir : double du chaton en négatif, contour magenta. */
export const BOSS_REFLET: SpriteDef = {
  key: 'boss_reflet',
  pal: {
    '.': null, '#': '#d05aff', 'k': '#14101f',
    'W': '#241c34', 'w': '#1a1428', 'm': '#3a2c50',
    'B': '#1a1428', 'b': '#100a1a',
    'R': '#14101f', 'r': '#0c0a16', 'H': '#d05aff',
    'e': '#ffffff', 'y': '#59d9ff', 'i': '#0a0612', 'S': '#d05aff',
  },
  rows: [
    '..#kk#.....#kk#...',
    '..#kkk#...#kkk#...',
    '...#kkk#.#kkk#....',
    '....#kkkkkkkk#....',
    '...#kkkkkkkkkk....',
    '..#kkeekkkeekkm...',
    '..#kkkkkkkkkkkm...',
    '..#kSkkkkkkkSkm...',
    '...#kkkkkkkkk#....',
    ...BODY,
  ],
};

export const BOSS_CATS: SpriteDef[] = [
  BOSS_CENTAURE, BOSS_GOBU, BOSS_SERPENT, BOSS_ARCHIMAGE,
  BOSS_LEVIATHAN, BOSS_RAPACE, BOSS_REFLET,
];
