import Phaser from 'phaser';
import { ART_CELL } from './PixelArtGenerator';

/**
 * Générateur paramétrique de "créatures" en pixel art.
 * Rasterise des primitives (disques, triangles) sur une grille -> pixels nets.
 * Permet des silhouettes variées (oreilles, cornes, ailes, chapeau, couronne…)
 * sans dessiner chaque monstre à la main.
 */

export type Feature =
  | 'ears' | 'horns' | 'wings' | 'hat' | 'crown' | 'spikes'
  | 'skull' | 'ghost' | 'mushroom' | 'spider' | 'none';

export interface Recipe {
  w: number;
  h: number;
  body: string;
  belly?: string;
  outline: string;
  eye: 'normal' | 'angry' | 'glow';
  eyeColor: string;
  feature: Feature;
  accent: string;
  feet?: boolean;
}

type Grid = (string | null)[][];

function makeGrid(w: number, h: number): Grid {
  return Array.from({ length: h }, () => Array<string | null>(w).fill(null));
}

/** Éclaircit une couleur hex de `amt` (0-255). */
function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

function disc(g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void {
  const h = g.length, w = g[0].length;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) g[y][x] = c;
    }
  }
}

function tri(g: Grid, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: string): void {
  const h = g.length, w = g[0].length;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx)));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy)));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / area;
      const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 >= 0 && w1 >= 0 && w2 >= 0) g[y][x] = col;
    }
  }
}

function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void {
  for (let y = Math.max(0, y0); y <= Math.min(g.length - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(g[0].length - 1, x1); x++) g[y][x] = c;
}

/** Ajoute un contour 1px sombre autour de la silhouette. */
function outlinePass(g: Grid, color: string): void {
  const h = g.length, w = g[0].length;
  const add: [number, number][] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== null) continue;
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of n) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && g[ny][nx] !== null && g[ny][nx] !== color) {
          add.push([x, y]);
          break;
        }
      }
    }
  }
  for (const [x, y] of add) g[y][x] = color;
}

function render(scene: Phaser.Scene, key: string, g: Grid): void {
  const h = g.length, w = g[0].length;
  const cw = w * ART_CELL, ch = h * ART_CELL;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, cw, ch);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, cw, ch);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * ART_CELL, y * ART_CELL, ART_CELL, ART_CELL);
    }
  }
  tex.refresh();
}

/**
 * Génère un sprite de créature orienté vers la DROITE, en vue 3/4 (norme du
 * guide de refonte : un seul asset, la version « gauche » = miroir au rendu).
 * Silhouette asymétrique volontaire (museau à droite, queue à gauche, pupilles
 * décalées, éclairage haut-droite) pour que le flip horizontal soit lisible.
 * La masse reste centrée sur l'axe du canvas : le flip ne déplace pas la bête.
 */
export function genCritter(scene: Phaser.Scene, key: string, r: Recipe): void {
  const W = r.w, H = r.h;
  const g = makeGrid(W, H);
  const cx = W / 2;
  const bodyCy = H * 0.56;
  const rx = W * 0.34;
  const ry = H * 0.36;
  const hasFeet = r.feet !== false && r.feature !== 'ghost' && r.feature !== 'spider';
  const grounded = r.feature !== 'ghost' && r.feature !== 'spider';

  // ================= arrière-plan (derrière le corps) =================
  if (r.feature === 'wings') {
    // aile arrière (gauche) plus petite, aile avant (droite) plus grande (3/4)
    tri(g, cx - rx * 0.9, bodyCy - ry * 0.6, cx - W * 0.44, bodyCy - ry * 0.9, cx - rx * 0.3, bodyCy + ry * 0.3, lighten(r.accent, -22));
    tri(g, cx + rx, bodyCy - ry * 0.6, cx + W * 0.52, bodyCy - ry, cx + rx * 0.4, bodyCy + ry * 0.45, r.accent);
  }
  if (r.feature === 'spider') {
    for (let i = 0; i < 4; i++) {
      const ly = bodyCy - ry * 0.5 + i * ry * 0.45;
      rect(g, 1, Math.round(ly), Math.round(cx - rx * 0.7), Math.round(ly) + 1, r.outline);
      rect(g, Math.round(cx + rx * 0.7), Math.round(ly), W - 2, Math.round(ly) + 1, r.outline);
    }
  }

  // ---- queue à GAUCHE (derrière) : casse la symétrie, contrepoids du regard ----
  if (grounded && r.feature !== 'mushroom' && r.feature !== 'hat') {
    const tx = cx - rx * 0.92, ty = bodyCy + ry * 0.2;
    disc(g, tx, ty, rx * 0.26, ry * 0.3, lighten(r.body, -12));
    disc(g, tx - rx * 0.14, ty - ry * 0.55, rx * 0.2, ry * 0.24, lighten(r.body, -6));
    disc(g, tx - rx * 0.05, ty - ry * 1.12, rx * 0.15, ry * 0.18, r.accent); // pointe accentuée
  }

  // ================= corps =================
  if (r.feature === 'ghost') {
    disc(g, cx, bodyCy - ry * 0.2, rx, ry, r.body);
    rect(g, Math.round(cx - rx), Math.round(bodyCy), Math.round(cx + rx), H - 2, r.body);
    for (let x = 0; x < W; x++) {
      const wob = Math.floor(Math.sin(x * 1.4) * 1.5 + 1.5);
      for (let y = H - 1; y >= H - 1 - wob; y--) if (g[y] && g[y][x] === r.body) g[y][x] = null;
    }
    // traîne spectrale qui part vers la gauche (asymétrie du fantôme)
    disc(g, cx - rx * 0.85, bodyCy + ry * 0.4, rx * 0.3, ry * 0.4, r.body);
  } else {
    disc(g, cx, bodyCy, rx, ry, r.body);
  }

  if (r.belly) disc(g, cx + rx * 0.12, bodyCy + ry * 0.25, rx * 0.58, ry * 0.58, r.belly);

  // ---- museau/mâchoire qui DÉBORDE à droite (indicateur de direction le + lisible) ----
  if (r.feature !== 'ghost' && r.feature !== 'spider') {
    const mx = cx + rx * 0.82, my = bodyCy + ry * 0.04;
    disc(g, mx, my, rx * 0.32, ry * 0.28, r.belly ?? lighten(r.body, 10));
    disc(g, mx + rx * 0.2, my + ry * 0.04, Math.max(0.8, rx * 0.09), Math.max(0.8, ry * 0.08), r.outline); // narine
  }

  // volume : ombre basse + reflet HAUT-DROITE + éclat spéculaire (lumière haut-droite)
  if (r.feature !== 'ghost') {
    disc(g, cx - rx * 0.12, bodyCy + ry * 0.55, rx * 0.85, ry * 0.4, lighten(r.body, -24));
    disc(g, cx + rx * 0.36, bodyCy - ry * 0.42, rx * 0.38, ry * 0.3, lighten(r.body, 34));
    disc(g, cx + rx * 0.46, bodyCy - ry * 0.52, rx * 0.13, ry * 0.11, lighten(r.body, 70));
  }

  // ================= dessus / devant =================
  if (r.feature === 'ears') {
    // oreille arrière (gauche) plus petite, oreille avant (droite) plus haute
    tri(g, cx - rx * 0.85, bodyCy - ry * 0.7, cx - rx * 1.0, bodyCy - ry * 1.45, cx - rx * 0.25, bodyCy - ry, r.body);
    tri(g, cx + rx * 0.7, bodyCy - ry * 0.7, cx + rx * 1.05, bodyCy - ry * 1.75, cx + rx * 0.15, bodyCy - ry, r.body);
  }
  if (r.feature === 'horns') {
    tri(g, cx - rx * 0.55, bodyCy - ry * 0.6, cx - rx * 0.8, bodyCy - ry * 1.4, cx - rx * 0.2, bodyCy - ry * 0.7, lighten(r.accent, -18));
    tri(g, cx + rx * 0.6, bodyCy - ry * 0.6, cx + rx * 0.95, bodyCy - ry * 1.7, cx + rx * 0.2, bodyCy - ry * 0.7, r.accent);
  }
  if (r.feature === 'spikes') {
    // crête dorsale qui grandit vers l'avant (droite)
    for (let i = -1; i <= 1; i++) {
      const h = 1.2 + (i + 1) * 0.3;
      tri(g, cx + i * rx * 0.6 - 1.2, bodyCy - ry * 0.7, cx + i * rx * 0.6, bodyCy - ry * (0.8 + h * 0.5), cx + i * rx * 0.6 + 1.2, bodyCy - ry * 0.7, r.accent);
    }
  }
  if (r.feature === 'hat') {
    // chapeau pointu penché vers l'avant (droite)
    tri(g, cx - rx * 1.0, bodyCy - ry * 0.7, cx + rx * 0.35, bodyCy - ry * 2.1, cx + rx * 1.15, bodyCy - ry * 0.7, r.accent);
    rect(g, Math.round(cx - rx * 1.2), Math.round(bodyCy - ry * 0.7), Math.round(cx + rx * 1.2), Math.round(bodyCy - ry * 0.5), r.accent);
  }
  if (r.feature === 'mushroom') {
    disc(g, cx + rx * 0.1, bodyCy - ry * 0.6, rx * 1.15, ry * 0.8, r.accent);
    disc(g, cx - rx * 0.4, bodyCy - ry * 0.7, rx * 0.18, ry * 0.14, '#f6f1e4');
    disc(g, cx + rx * 0.55, bodyCy - ry * 0.6, rx * 0.16, ry * 0.13, '#f6f1e4');
    disc(g, cx + rx * 0.1, bodyCy - ry * 0.95, rx * 0.16, ry * 0.13, '#f6f1e4');
  }
  if (r.feature === 'crown') {
    const cy0 = Math.round(bodyCy - ry * 1.15);
    rect(g, Math.round(cx - rx * 0.7), cy0, Math.round(cx + rx * 0.7), cy0 + 1, r.accent);
    for (let i = -1; i <= 1; i++) {
      tri(g, cx + i * rx * 0.55 - 1, cy0, cx + i * rx * 0.55, cy0 - 2.2, cx + i * rx * 0.55 + 1, cy0, r.accent);
    }
  }

  // ================= pieds (avant/droite plus bas et avancé) =================
  if (hasFeet) {
    disc(g, cx - rx * 0.42, H - 3.2, rx * 0.28, ry * 0.19, lighten(r.body, -14)); // pied arrière (gauche)
    disc(g, cx + rx * 0.58, H - 2.2, rx * 0.32, ry * 0.22, r.body);                // pied avant (droite)
  }

  // ---- contour (avant les yeux pour ne pas les cercler) ----
  outlinePass(g, r.outline);

  // ================= yeux (décalés vers la DROITE, vue 3/4) =================
  const eyeY = bodyCy - ry * 0.06;
  const backX = cx + rx * 0.02;   // œil arrière (côté gauche du visage tourné)
  const frontX = cx + rx * 0.5;   // œil avant, proche du museau
  const er = Math.max(1.1, W * 0.09);
  const erBack = er * 0.82;       // œil arrière un peu plus petit (perspective)
  if (r.eye === 'glow') {
    disc(g, backX, eyeY, erBack, erBack, r.eyeColor);
    disc(g, frontX, eyeY, er, er, r.eyeColor);
  } else {
    disc(g, backX, eyeY, erBack, erBack, '#ffffff');
    disc(g, frontX, eyeY, er, er, '#ffffff');
    // pupilles collées au bord DROIT de l'œil + reflet 1 px en haut-droite
    disc(g, backX + erBack * 0.5, eyeY + 0.2, erBack * 0.5, erBack * 0.5, r.outline);
    disc(g, frontX + er * 0.5, eyeY + 0.2, er * 0.5, er * 0.5, r.outline);
    disc(g, frontX + er * 0.7, eyeY - er * 0.3, Math.max(0.7, er * 0.28), Math.max(0.7, er * 0.28), '#f6f1e4');
    if (r.eye === 'angry') {
      rect(g, Math.round(backX - erBack), Math.round(eyeY - erBack - 1), Math.round(backX + erBack * 0.4), Math.round(eyeY - erBack), r.outline);
      rect(g, Math.round(frontX - er * 0.4), Math.round(eyeY - er - 1), Math.round(frontX + er), Math.round(eyeY - er), r.outline);
    }
  }

  render(scene, key, g);
}

/**
 * Recettes des monstres, regroupées par thème de zone (couleurs cohérentes,
 * ambiance sombre façon Dead Cells, yeux lumineux).
 */
export const MONSTER_RECIPES: Record<string, Recipe> = {
  // -- Forêt : émeraude / mousse, yeux turquoise --
  slime: { w: 18, h: 16, body: '#3fae63', belly: '#6fd68f', outline: '#0f2418', eye: 'glow', eyeColor: '#bff7f6', feature: 'none', accent: '#2a8a4e' },
  champignon: { w: 18, h: 18, body: '#d8cba8', belly: '#efe6cf', outline: '#2a2014', eye: 'normal', eyeColor: '#fff', feature: 'mushroom', accent: '#a83a34' },
  chauvesouris: { w: 20, h: 15, body: '#2f4a52', outline: '#0e1c20', eye: 'glow', eyeColor: '#59d9a0', feature: 'wings', accent: '#1e343a' },
  // -- Marais : vert acide toxique --
  gobelin: { w: 18, h: 18, body: '#6a9a3f', belly: '#9fd04a', outline: '#1a2810', eye: 'angry', eyeColor: '#dfff9a', feature: 'ears', accent: '#4a6a2a' },
  crapaud: { w: 20, h: 16, body: '#4f7a3a', belly: '#b8d97a', outline: '#16240e', eye: 'glow', eyeColor: '#dfff9a', feature: 'none', accent: '#33591f' },
  bulle: { w: 18, h: 17, body: '#7aa83f', belly: '#c9f07a', outline: '#1e2a10', eye: 'normal', eyeColor: '#fff', feature: 'none', accent: '#557a2a' },
  // -- Forge : charbon + braise orangée --
  diablotin: { w: 17, h: 18, body: '#8a2a20', belly: '#e05a2a', outline: '#200a08', eye: 'glow', eyeColor: '#ffd24a', feature: 'horns', accent: '#ff6a1f' },
  chienlave: { w: 20, h: 16, body: '#221614', belly: '#ff6a1f', outline: '#0e0705', eye: 'glow', eyeColor: '#ffb020', feature: 'spikes', accent: '#ff5522' },
  armure: { w: 18, h: 20, body: '#4a5058', belly: '#6a727e', outline: '#12161a', eye: 'glow', eyeColor: '#ff9a3a', feature: 'spikes', accent: '#ff7a2a' },
  // -- Citadelle : pierre bleu-nuit + spectres violets, accents chauds --
  fantome: { w: 18, h: 18, body: '#aeb8d6', outline: '#3a4258', eye: 'glow', eyeColor: '#bff7f6', feature: 'ghost', accent: '#8a94b8' },
  squelette: { w: 18, h: 20, body: '#dcd8c8', belly: '#b8b2a0', outline: '#2a2820', eye: 'glow', eyeColor: '#f2a53a', feature: 'skull', accent: '#7a8290' },
  sorcier: { w: 18, h: 20, body: '#3a2c5a', belly: '#5a4a7a', outline: '#160f28', eye: 'glow', eyeColor: '#c78aff', feature: 'hat', accent: '#8a5cff' },
  // rôles de soutien
  fee: { w: 15, h: 15, body: '#cdeaa8', belly: '#f2fbe0', outline: '#2a3a1a', eye: 'glow', eyeColor: '#bff7f6', feature: 'wings', accent: '#eaffc0' },
  bombardier: { w: 20, h: 17, body: '#5a7a3a', belly: '#9fd04a', outline: '#16240e', eye: 'angry', eyeColor: '#dfff9a', feature: 'none', accent: '#3a5a24' },
  gardien: { w: 18, h: 20, body: '#5a4038', belly: '#8a5a3a', outline: '#160d0a', eye: 'glow', eyeColor: '#ff9a3a', feature: 'spikes', accent: '#ff7a2a' },
  // bestiaire créatif
  loup: { w: 22, h: 15, body: '#5a5560', belly: '#8a8490', outline: '#161318', eye: 'angry', eyeColor: '#ffd24a', feature: 'ears', accent: '#3a3640' },
  archer: { w: 17, h: 20, body: '#3a4a58', belly: '#5a6a78', outline: '#12181e', eye: 'glow', eyeColor: '#bff7f6', feature: 'ears', accent: '#c78aff' },
  drake: { w: 22, h: 18, body: '#7a2a20', belly: '#e0603a', outline: '#200a08', eye: 'glow', eyeColor: '#ffd24a', feature: 'horns', accent: '#ff6a1f' },
  // adds de boss
  druide: { w: 16, h: 19, body: '#3a5a3a', belly: '#7aae5a', outline: '#12200e', eye: 'glow', eyeColor: '#dfffa0', feature: 'hat', accent: '#9ee06a' },
  bebeserpent: { w: 14, h: 13, body: '#7a2a14', belly: '#ff8a3a', outline: '#1a0a05', eye: 'glow', eyeColor: '#ffd24a', feature: 'spikes', accent: '#ff5522' },
  zombie: { w: 17, h: 19, body: '#5a6a4a', belly: '#7a8a5a', outline: '#161d10', eye: 'glow', eyeColor: '#9ee06a', feature: 'none', accent: '#3a4a2a' },
  araigneemini: { w: 16, h: 13, body: '#3a2c5a', belly: '#5a4a7a', outline: '#140f24', eye: 'glow', eyeColor: '#c78aff', feature: 'spider', accent: '#8a5cff' },

  // ==================================================================
  //  Monde 5 — Abysses de Givre (bleus glaciers, blancs, cyan)
  // ==================================================================
  yeti: { w: 24, h: 22, body: '#dce8f0', belly: '#9fc0d8', outline: '#1a2634', eye: 'angry', eyeColor: '#7fdcff', feature: 'spikes', accent: '#b8d4e8' },
  spectregivre: { w: 18, h: 18, body: '#bfd8e8', outline: '#2a3a4a', eye: 'glow', eyeColor: '#7fdcff', feature: 'ghost', accent: '#8fb8d8' },
  stalactite: { w: 16, h: 20, body: '#9fd0e8', belly: '#cfeaf8', outline: '#1e3644', eye: 'glow', eyeColor: '#e8f8ff', feature: 'spikes', accent: '#6ab0d8' },
  pingouin: { w: 18, h: 18, body: '#1c2430', belly: '#f0f4f8', outline: '#0a0e14', eye: 'glow', eyeColor: '#ffd24a', feature: 'none', accent: '#ffa53a' },
  sculpteur: { w: 17, h: 21, body: '#d8e8f4', belly: '#b0cce0', outline: '#2a3e4e', eye: 'glow', eyeColor: '#7fdcff', feature: 'hat', accent: '#9fd0e8' },
  sorciereblizzard: { w: 18, h: 21, body: '#2a3a50', belly: '#3a4e68', outline: '#101824', eye: 'glow', eyeColor: '#7fdcff', feature: 'hat', accent: '#cfe8ff' },
  brochet: { w: 24, h: 15, body: '#3a5a6a', belly: '#7fb0c8', outline: '#122430', eye: 'angry', eyeColor: '#e8f8ff', feature: 'spikes', accent: '#9fd0e8' },

  // ==================================================================
  //  Monde 6 — Nécropole Céleste (or terni, marbre nocturne, éclair)
  // ==================================================================
  harpie: { w: 22, h: 18, body: '#3a3a5a', belly: '#5a5a7a', outline: '#141428', eye: 'angry', eyeColor: '#ffe08a', feature: 'wings', accent: '#ffe08a' },
  nuagetonnerre: { w: 20, h: 16, body: '#2a2a3f', belly: '#5a5a7a', outline: '#101018', eye: 'glow', eyeColor: '#b0c8ff', feature: 'none', accent: '#8a9aff' },
  djinn: { w: 19, h: 20, body: '#4a4a6a', belly: '#6a6a8a', outline: '#161624', eye: 'glow', eyeColor: '#ffe08a', feature: 'crown', accent: '#b0c8ff' },
  chevalierceleste: { w: 18, h: 21, body: '#8a7a4a', belly: '#b0a068', outline: '#241e10', eye: 'glow', eyeColor: '#ffe08a', feature: 'horns', accent: '#ffe08a' },
  idole: { w: 20, h: 22, body: '#2a2a3a', belly: '#3a3a52', outline: '#0e0e18', eye: 'glow', eyeColor: '#59b8ff', feature: 'crown', accent: '#ffe08a' },
  oiseauplasma: { w: 20, h: 15, body: '#b0c8ff', belly: '#e8f0ff', outline: '#4a5a8a', eye: 'glow', eyeColor: '#ffffff', feature: 'wings', accent: '#ffffff' },
  porteursarco: { w: 22, h: 20, body: '#3a3a5a', belly: '#ffe08a', outline: '#141428', eye: 'glow', eyeColor: '#b0c8ff', feature: 'wings', accent: '#ffe08a' },
  momie: { w: 15, h: 17, body: '#c9b878', belly: '#e8dca8', outline: '#2a2410', eye: 'glow', eyeColor: '#b0c8ff', feature: 'none', accent: '#8a9aff' },

  // ==================================================================
  //  Monde 7 — Faille du Néant (magenta du néant, cyan froid, obsidienne)
  // ==================================================================
  oeilneant: { w: 20, h: 18, body: '#0c0a16', belly: '#1a1428', outline: '#040209', eye: 'glow', eyeColor: '#d05aff', feature: 'none', accent: '#d05aff' },
  golemstellaire: { w: 22, h: 22, body: '#1c1830', belly: '#2a2444', outline: '#0a0812', eye: 'glow', eyeColor: '#59d9ff', feature: 'spikes', accent: '#d05aff' },
  doppelchat: { w: 18, h: 18, body: '#14101f', belly: '#241c34', outline: '#d05aff', eye: 'glow', eyeColor: '#ffffff', feature: 'ears', accent: '#d05aff' },
  mangeurames: { w: 20, h: 17, body: '#1c1428', belly: '#3a2c50', outline: '#0a0612', eye: 'angry', eyeColor: '#7fff9a', feature: 'none', accent: '#d05aff' },
  faucheurdim: { w: 18, h: 20, body: '#0c0a16', outline: '#2a1440', eye: 'glow', eyeColor: '#d05aff', feature: 'ghost', accent: '#d05aff' },
  etoilenaine: { w: 16, h: 16, body: '#ffffff', belly: '#ffe8ff', outline: '#7a2ab0', eye: 'glow', eyeColor: '#d05aff', feature: 'spikes', accent: '#d05aff' },
  larvechaos: { w: 19, h: 16, body: '#14101f', belly: '#3a2c50', outline: '#080510', eye: 'glow', eyeColor: '#d05aff', feature: 'none', accent: '#59d9ff' },
};

/** Recettes des boss (plus grands), accordées à leur nouvelle identité. */
export const BOSS_RECIPES: Record<string, Recipe> = {
  // Centaure archer — bête sylvestre à bois, teintes terreuses/vertes
  centaure: { w: 30, h: 30, body: '#6a4a2e', belly: '#a67a44', outline: '#1a0f08', eye: 'glow', eyeColor: '#dfffa0', feature: 'horns', accent: '#59d9a0' },
  // Gobu géant — énorme gobelin vert à grandes oreilles
  gobugeant: { w: 34, h: 30, body: '#5a7a3a', belly: '#a8d06a', outline: '#16240e', eye: 'angry', eyeColor: '#dfff9a', feature: 'ears', accent: '#33591f' },
  // Serpent de lave — créature ophidienne incandescente
  serpentlave: { w: 30, h: 26, body: '#2a120a', belly: '#ff7a2a', outline: '#0e0503', eye: 'glow', eyeColor: '#ffe08a', feature: 'spikes', accent: '#ff5522' },
  // Archimage mort-vivant — sorcier squelettique à chapeau
  archimage: { w: 30, h: 32, body: '#2a2440', belly: '#5a4a7a', outline: '#0e0b1a', eye: 'glow', eyeColor: '#c78aff', feature: 'hat', accent: '#8a5cff' },
};
