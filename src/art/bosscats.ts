import type { SpriteDef } from './PixelArtGenerator';

/**
 * Boss v3 — redessinés d'après les références visuelles (Boss Fights v3).
 * Chaque boss a SA silhouette (aucune forme partagée), plus grande que le héros,
 * avec un attribut surdimensionné lisible en ombre chinoise, et la palette
 * hexadécimale officielle du document de production. Orientés vers la droite
 * (ou de face quand la référence l'est) ; le miroir gauche est géré au rendu.
 */

/** Sylvaan — Centaure Sylvestre : quadrupède cabré, bois de cerf, arc de bois. */
export const BOSS_CENTAURE: SpriteDef = {
  key: 'boss_centaure',
  pal: {
    '.': null, '#': '#3a2a18', 'a': '#8a6a3f', 'A': '#b89058', 'o': '#6a4a2a',
    's': '#d8b878', 'S': '#a8845a', 'e': '#3f8f4f',
    'w': '#c0a060', 'W': '#8a6a40', 'k': '#7a5a38', 'K': '#4a3520',
    'g': '#6fae4f', 'G': '#4f8f3f', 'd': '#2f5f2f', 'b': '#d8c890',
  },
  rows: [
    '...a....a...a....a...',
    '..#a#..#a#.#a#..#a#..',
    '...aA#..aA#.Aa..#Aa..',
    '....a#o..aoo.o..oa...',
    '.....gGg.aAa.gGg.....',
    '.....gGGgsssgGGg.....',
    '......dgssseSssg.....',
    '.......#sssssSS#.....',
    '......b#gsswwsg#b....',
    '.....bb#wwWWWWw#bb...',
    '......#wWkkkkWw#.....',
    'a....#wWkKKKKkWw#....',
    '.aA.#WkKKwwwwKKkW....',
    '..A#WkKKwwWWwwKKk#gg.',
    '...#kKKwwWWWWwwKKkGgG',
    '..#kKwwWW....WWwwKGgG',
    '..#KKwW........WKk.Gg',
    '..#Kkw..........wKk..',
    '.gG#Kw..........wK#..',
    '.GgG#w...........w#..',
    'dGg.#K...........K#..',
    '.g..bb...........bb..',
    '....b#............#b.',
    '.....................',
  ],
};

/** Gorbak — Bourbier Vivant : tas de boue amorphe cornu, large sourire blanc. */
export const BOSS_GOBU: SpriteDef = {
  key: 'boss_gobugeant',
  pal: {
    '.': null, '#': '#241a0e', 'k': '#3a2c14',
    'm': '#5a4a24', 'M': '#7a6636', 'w': '#9a8848', 'W': '#b8a666',
    'r': '#d03020', 'R': '#ff5a3a', 'e': '#141008', 'T': '#f4efe0',
  },
  rows: [
    '..#k#..............#k#....',
    '.#kmk#............#kmk#...',
    '.#kmmk#..........#kmmk#...',
    '..#kmmk#........#kmmk#....',
    '...#kmMmk#....#kmMmk#.....',
    '....#kmMMmkkkkmMMmk#......',
    '...#kmMMwwMMMMwwMMmk#.....',
    '..#kmMwwWWwwwwWWwwMmk#....',
    '.#kmMwWWwwMMMMwwWWwMmk#...',
    '#kmMwWWwwMMwwMMwwWWwMmk#..',
    '#kmMwwWreewwwwreeWwwMmk#..',
    '#kmMwwwRReWWWWeRRwwwMmk#..',
    '#kmMMwwwwwWWWWwwwwwMMmk#..',
    '#kmMMwwTTTTTTTTTTwwMMmk#..',
    '.#kmMwwTeTeTeTeTeTwwMk#...',
    '.#kmMMwwTTTTTTTTwwMMk#....',
    '..#kmMMwwwwwwwwwwMMk#.....',
    '...#kkmMMMwwwwMMMkk#......',
    '....#kkkmmMMMMmmkk#.......',
    '.....#kkkkkmmkkkk#........',
    '.......##kkkkkk##.........',
    '.........#....#...........',
    '..........................',
    '..........................',
  ],
};

/** Ignis — Dragon de Lave : bipède ailé, ventre-fournaise, ailes de feu (de face). */
export const BOSS_SERPENT: SpriteDef = {
  key: 'boss_serpentlave',
  pal: {
    '.': null, '#': '#2a0f06', 'b': '#241009', 'k': '#3a1a10',
    'r': '#7a2a10', 'o': '#c9500f', 'H': '#ff6a1f', 'O': '#ffb020',
    'y': '#ffe08a', 'e': '#ffd24a', 'w': '#a83010', 'W': '#ff8a2a',
  },
  rows: [
    '.......#k....k#.......',
    '.w.....kbk..kbk.....w.',
    'wWw...#kbrrrrbk#...wWw',
    'WHWw..#krOeeOrk#..wWHW',
    'wWHWw.#kreyyekr#.wWHWw',
    '.wWHW.bkrOeeOrkb.WHWw.',
    '..wWH.bbkrrrrkbb.HWw..',
    '...wW#bbkkkkkkbb#Ww...',
    '....##bkoOOOOokb##....',
    '.....#bkoOyyOokb#.....',
    '.....bkroOyyOorkb.....',
    '....#brooOeeOoorb#....',
    '...#brooeyOOyeoorb#...',
    '...#kroOeyOOyeOork#...',
    '..#kroOeyyyyeeOoork#..',
    '...#krooOeyyeOoork#...',
    '....#brooOeeOoorb#....',
    '.....#bkrooooorkb#....',
    '......#bkroookb#......',
    '.....#bk#o..o#kb#.....',
    '.....bk#....#kb#......',
    '.....##......##.......',
    '......................',
  ],
};

/** Mortis — Dracoliche Archimage : chapeau immense, crâne, robe en lambeaux, bâton. */
export const BOSS_ARCHIMAGE: SpriteDef = {
  key: 'boss_archimage',
  pal: {
    '.': null, '#': '#0e0b1a', 'k': '#1a1428', 'p': '#3a2c5a', 'P': '#4a2c7a',
    'v': '#5a3a8a', 'B': '#241a3a', 'g': '#c9a23a', 'y': '#f4c430',
    'W': '#e6e2d4', 'w': '#b8b0a0', 'e': '#c78aff', 'f': '#8a5cff',
    'r': '#7a2436', 'R': '#a83048',
  },
  rows: [
    '.......#kk#..........',
    '......#kppk#.........',
    '.....#kpPPpk#..y.....',
    '....#kpPvvPpk#gyg....',
    '...#kpPvvvvPpk#g.....',
    '..#kpPvvggvvPpk#.....',
    '..#kpPvygyvPppk#.....',
    '..#BkkWWWWkkkB#......',
    '.r.#kWWeWWeWWk#.r....',
    'rRr#kWWkkkkkWWk#rRr..',
    'RRr#kWWWffWWWWk#rRR..',
    '.Rr#BkWfeefWkB#.rR...',
    'r.#BkpPvfefvPpkB#..r.',
    'rRrkpPvvyggyvvPpkrRr.',
    'RRrkpPvvygggyvvPpkRR.',
    '.RrBkpPvvvggvvvPpkBr.',
    '..#kpPvvvggvvvPpk#...',
    '..#BkpPvvggvvPpkB#...',
    '...#kkpPvvvvPpkk#....',
    '....#BkpPvvPpkB#.....',
    '.....#kkpPPpkk#......',
    '......#kkppkk#.......',
    '.......#kkkk#........',
    '........#..#.........',
  ],
};

/** Glacior — Léviathan des Abysses : serpent de glace LOVÉ, crête en couronne. */
export const BOSS_LEVIATHAN: SpriteDef = {
  key: 'boss_leviathan',
  pal: {
    '.': null, '#': '#0a1420', 'i': '#0e1826', 'k': '#14283a',
    'm': '#2a4a60', 'r': '#3a6a8a', 'w': '#a8c8e0', 'W': '#dcecf8',
    'C': '#9fe0f8', 'H': '#7fdcff', 'e': '#e8f8ff', 'y': '#cfeaff',
  },
  rows: [
    '.......C..CC..C......',
    '......CHC.HH.CHC.....',
    '.....#kHHHHHHHHk#....',
    '....#kwWWwHHwWWwk#...',
    '...#kwWWkkHHkkWWwk#..',
    '...#kwWeWkHHkWeWwkC..',
    '..#kwWWkkHHHHkkWWwkC.',
    '..#kwrWWkmmmmkWWrwk#.',
    '..#kwrrWWWWWWWWrrwk#.',
    '..#ikwrrrrmmrrrrwki#.',
    '...#iikwrrmmrrwkii#..',
    '.....##ikwwwwki##...H',
    '...H....######....HH.',
    '..HH...#kwWWwk#..CHH.',
    '.CHC..#kwWmmWwk#.CH..',
    '.CH..#kwWmrrmWwk#.C..',
    '.C..#kwWmrrrrmWwk#...',
    '...#kwWmrrHHrrmWwk#..',
    '..#kwWmrrHHHHrrmWwk#.',
    '..#kwrrmmHHHHmmrrwk#.',
    '..#ikwrrrmmmmrrrwki#.',
    '...#iikwwrrrrwwkii#..',
    '.....##iikwwkii##....',
    '........######.......',
  ],
};

/** Voltaïr — Panda-Tonnerre : quadrupède caparaçonné + nuage d'orage, éclairs. */
export const BOSS_RAPACE: SpriteDef = {
  key: 'boss_rapace',
  pal: {
    '.': null, '#': '#12121f', 'k': '#0c0c16', 'W': '#f0f0f8', 'w': '#c8c8d8',
    'p': '#7a4ad0', 'P': '#9a6ae8', 'g': '#e0b83a', 'y': '#ffe066',
    'L': '#fff2a0', 'b': '#3a6ad0', 'B': '#8ab8ff', 'e': '#ffd24a',
  },
  rows: [
    '.....y....pPp....y...',
    '....yLy..pPPPp..yLy..',
    '.y...y..pPPPPPp..y..y',
    '..y....pPPpPPpPp....y',
    '...L..pPPPPPPPPp.L...',
    '..y..pPPPgggPPPp..y..',
    '.L..#PPPgyygPPP#..L..',
    '...##kkPPeggePPkk##..',
    '..#kkWWkkppppkkWWkk#.',
    '.#kWWWWkkPeePkkWWWWk#',
    '.#kWkkWWkppppkWWkkWk#',
    '.#WkkkkWWWWWWWkkkkkW#',
    '.#WkeWWWygggyWWWekkW#',
    '.#WWWWWggyyyggWWWWWW#',
    '..#WWWggyLLLyggWWWk#.',
    '..#kWWggyyeeyyggWWk#.',
    '...#kWWWggeeggWWWk#..',
    '...#WkkWWWWWWWWkkW#..',
    '..#Wk#WkkWWkkWk#kW#..',
    '..#Wk#.#kWWWk#.#kW#..',
    '..WWk...#WWWW#...kWW.',
    '..###....####....###.',
    '.....................',
    '.....................',
  ],
};

/** Néantis — Roi du Néant : rongeur royal doré, spirale de vide ventrale, épée du vide. */
export const BOSS_REFLET: SpriteDef = {
  key: 'boss_reflet',
  pal: {
    '.': null, '#': '#0a0612', 'k': '#141021', 'g': '#c99a2a', 'G': '#e0b83a',
    'y': '#ffe066', 'p': '#7a2ad0', 'P': '#b060ff', 'v': '#4a1a8a',
    'W': '#f0e6c8', 'w': '#c8b890', 'e': '#e0a0ff', 'b': '#241830',
  },
  rows: [
    '....G....GG....G.....',
    '...GyG..GyyG..GyG....',
    '...GgG.#GyyG#.GgG....',
    '....G#kkGGGGkk#G.....',
    '....#kbggGGggbk#.....',
    '...#kbgGyeeyGgbk#....',
    '..p#kbgGyeeyGgbk#p...',
    '.pPp#kwWkGGkWwk#pPp..',
    'PPPv#kwWWWWWWwk#vPPP.',
    '.pPvkbwWWggWWwbkvPp..',
    '..p#kbwWgGGgWwbk#p...',
    '...#kbwWgvvgWwbk#....',
    '...#kbwWvPPvWwbk#....',
    '...#kbwWvPePvWbk#g...',
    '..g#kbwWvPPPvWbk#Gy..',
    '.Gy#kbwWWvPvWWbk#yg..',
    '.yg#kkbwWWWWwbkk#g...',
    '..g#kkbbwwwwbbkk#....',
    '...#kkGkbbbbkGkk#....',
    '...#GkkkWkkWkkkG#....',
    '..y#kk#WWkkWW#kk#y...',
    '..yGkk#.#WWWk#.#kkGy.',
    '...##k...#WWk...k##..',
    '.........####........',
  ],
};

export const BOSS_CATS: SpriteDef[] = [
  BOSS_CENTAURE, BOSS_GOBU, BOSS_SERPENT, BOSS_ARCHIMAGE,
  BOSS_LEVIATHAN, BOSS_RAPACE, BOSS_REFLET,
];
