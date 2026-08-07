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

export function genCritter(scene: Phaser.Scene, key: string, r: Recipe): void {
  const W = r.w, H = r.h;
  const g = makeGrid(W, H);
  const cx = W / 2;
  const bodyCy = H * 0.56;
  const rx = W * 0.34;
  const ry = H * 0.36;

  // ---- features derrière le corps ----
  if (r.feature === 'wings') {
    tri(g, cx - rx, bodyCy - ry * 0.6, cx - W * 0.5, bodyCy - ry, cx - rx * 0.4, bodyCy + ry * 0.4, r.accent);
    tri(g, cx + rx, bodyCy - ry * 0.6, cx + W * 0.5, bodyCy - ry, cx + rx * 0.4, bodyCy + ry * 0.4, r.accent);
  }
  if (r.feature === 'spider') {
    // 8 pattes
    for (let i = 0; i < 4; i++) {
      const ly = bodyCy - ry * 0.5 + i * ry * 0.45;
      rect(g, 1, Math.round(ly), Math.round(cx - rx * 0.7), Math.round(ly) + 1, r.outline);
      rect(g, Math.round(cx + rx * 0.7), Math.round(ly), W - 2, Math.round(ly) + 1, r.outline);
    }
  }

  // ---- corps ----
  if (r.feature === 'ghost') {
    disc(g, cx, bodyCy - ry * 0.2, rx, ry, r.body);
    rect(g, Math.round(cx - rx), Math.round(bodyCy), Math.round(cx + rx), H - 2, r.body);
    // bas ondulé
    for (let x = 0; x < W; x++) {
      const wob = Math.floor(Math.sin(x * 1.4) * 1.5 + 1.5);
      for (let y = H - 1; y >= H - 1 - wob; y--) if (g[y] && g[y][x] === r.body) g[y][x] = null;
    }
  } else {
    disc(g, cx, bodyCy, rx, ry, r.body);
  }

  if (r.belly) disc(g, cx, bodyCy + ry * 0.25, rx * 0.6, ry * 0.6, r.belly);

  // volume : ombre basse + reflet haut + éclat spéculaire
  if (r.feature !== 'ghost') {
    disc(g, cx, bodyCy + ry * 0.55, rx * 0.85, ry * 0.4, lighten(r.body, -24));
    disc(g, cx - rx * 0.33, bodyCy - ry * 0.42, rx * 0.38, ry * 0.3, lighten(r.body, 34));
    disc(g, cx - rx * 0.42, bodyCy - ry * 0.52, rx * 0.13, ry * 0.11, lighten(r.body, 70));
  }

  // ---- features devant / dessus ----
  if (r.feature === 'ears') {
    tri(g, cx - rx * 0.8, bodyCy - ry * 0.7, cx - rx * 1.1, bodyCy - ry * 1.7, cx - rx * 0.2, bodyCy - ry, r.body);
    tri(g, cx + rx * 0.8, bodyCy - ry * 0.7, cx + rx * 1.1, bodyCy - ry * 1.7, cx + rx * 0.2, bodyCy - ry, r.body);
  }
  if (r.feature === 'horns') {
    tri(g, cx - rx * 0.6, bodyCy - ry * 0.6, cx - rx * 0.9, bodyCy - ry * 1.6, cx - rx * 0.2, bodyCy - ry * 0.7, r.accent);
    tri(g, cx + rx * 0.6, bodyCy - ry * 0.6, cx + rx * 0.9, bodyCy - ry * 1.6, cx + rx * 0.2, bodyCy - ry * 0.7, r.accent);
  }
  if (r.feature === 'spikes') {
    for (let i = -1; i <= 1; i++) {
      tri(g, cx + i * rx * 0.7 - 1.2, bodyCy - ry * 0.7, cx + i * rx * 0.7, bodyCy - ry * 1.5, cx + i * rx * 0.7 + 1.2, bodyCy - ry * 0.7, r.accent);
    }
  }
  if (r.feature === 'hat') {
    tri(g, cx - rx * 1.1, bodyCy - ry * 0.7, cx, bodyCy - ry * 2.1, cx + rx * 1.1, bodyCy - ry * 0.7, r.accent);
    rect(g, Math.round(cx - rx * 1.2), Math.round(bodyCy - ry * 0.7), Math.round(cx + rx * 1.2), Math.round(bodyCy - ry * 0.5), r.accent);
  }
  if (r.feature === 'mushroom') {
    disc(g, cx, bodyCy - ry * 0.6, rx * 1.15, ry * 0.8, r.accent);
    disc(g, cx - rx * 0.5, bodyCy - ry * 0.7, rx * 0.18, ry * 0.14, '#f6f1e4');
    disc(g, cx + rx * 0.45, bodyCy - ry * 0.6, rx * 0.16, ry * 0.13, '#f6f1e4');
    disc(g, cx, bodyCy - ry * 0.95, rx * 0.16, ry * 0.13, '#f6f1e4');
  }
  if (r.feature === 'crown') {
    const cy0 = Math.round(bodyCy - ry * 1.15);
    rect(g, Math.round(cx - rx * 0.7), cy0, Math.round(cx + rx * 0.7), cy0 + 1, r.accent);
    for (let i = -1; i <= 1; i++) {
      tri(g, cx + i * rx * 0.55 - 1, cy0, cx + i * rx * 0.55, cy0 - 2.2, cx + i * rx * 0.55 + 1, cy0, r.accent);
    }
  }

  // ---- pieds ----
  if (r.feet !== false && r.feature !== 'ghost' && r.feature !== 'spider') {
    disc(g, cx - rx * 0.5, H - 2.5, rx * 0.3, ry * 0.2, r.body);
    disc(g, cx + rx * 0.5, H - 2.5, rx * 0.3, ry * 0.2, r.body);
  }

  // ---- contour (avant les yeux pour ne pas les cercler) ----
  outlinePass(g, r.outline);

  // ---- yeux ----
  const eyeY = bodyCy - ry * 0.05;
  const ex = rx * 0.45;
  const er = Math.max(1.1, W * 0.09);
  if (r.eye === 'glow') {
    disc(g, cx - ex, eyeY, er, er, r.eyeColor);
    disc(g, cx + ex, eyeY, er, er, r.eyeColor);
  } else {
    disc(g, cx - ex, eyeY, er, er, '#ffffff');
    disc(g, cx + ex, eyeY, er, er, '#ffffff');
    disc(g, cx - ex + 0.3, eyeY + 0.3, er * 0.5, er * 0.5, r.outline);
    disc(g, cx + ex + 0.3, eyeY + 0.3, er * 0.5, er * 0.5, r.outline);
    if (r.eye === 'angry') {
      rect(g, Math.round(cx - ex - er), Math.round(eyeY - er - 1), Math.round(cx - ex + er * 0.4), Math.round(eyeY - er), r.outline);
      rect(g, Math.round(cx + ex - er * 0.4), Math.round(eyeY - er - 1), Math.round(cx + ex + er), Math.round(eyeY - er), r.outline);
    }
  }

  render(scene, key, g);
}

/** Recettes des monstres (clé sprite -> recette). */
export const MONSTER_RECIPES: Record<string, Recipe> = {
  slime: { w: 18, h: 16, body: '#5fd06a', belly: '#7ee08a', outline: '#173a20', eye: 'normal', eyeColor: '#fff', feature: 'none', accent: '#3fa84e' },
  champignon: { w: 18, h: 18, body: '#e8d9b0', belly: '#f2e8cf', outline: '#4a3520', eye: 'normal', eyeColor: '#fff', feature: 'mushroom', accent: '#d6423f' },
  chauvesouris: { w: 20, h: 15, body: '#4a3a6a', outline: '#1a1428', eye: 'glow', eyeColor: '#f4c430', feature: 'wings', accent: '#332852' },
  gobelin: { w: 18, h: 18, body: '#6a9a3f', belly: '#87b356', outline: '#25381a', eye: 'angry', eyeColor: '#fff', feature: 'ears', accent: '#4a6a2a' },
  crapaud: { w: 20, h: 16, body: '#5a8a4a', belly: '#c9d98d', outline: '#25381a', eye: 'normal', eyeColor: '#fff', feature: 'none', accent: '#3a5a2a' },
  bulle: { w: 18, h: 17, body: '#9d6ad6', belly: '#c39bea', outline: '#3a2050', eye: 'normal', eyeColor: '#fff', feature: 'none', accent: '#7a4ab0' },
  diablotin: { w: 17, h: 18, body: '#d6423f', belly: '#e87a5a', outline: '#3a1420', eye: 'angry', eyeColor: '#ffd24a', feature: 'horns', accent: '#8f281d' },
  chienlave: { w: 20, h: 16, body: '#3a2420', belly: '#ff6a1f', outline: '#1a0d0a', eye: 'glow', eyeColor: '#ffb020', feature: 'spikes', accent: '#ff5522' },
  armure: { w: 18, h: 20, body: '#7a8494', belly: '#9aa4b4', outline: '#20262e', eye: 'glow', eyeColor: '#59c8ff', feature: 'spikes', accent: '#c8d0dc' },
  fantome: { w: 18, h: 18, body: '#dfe6f2', outline: '#5a6478', eye: 'normal', eyeColor: '#fff', feature: 'ghost', accent: '#b8c4dc' },
  squelette: { w: 18, h: 20, body: '#e6e2d4', belly: '#cfc9b8', outline: '#3a3428', eye: 'glow', eyeColor: '#59c8ff', feature: 'skull', accent: '#9aa4b4' },
  sorcier: { w: 18, h: 20, body: '#3a2c5a', belly: '#5a4a7a', outline: '#1a1030', eye: 'glow', eyeColor: '#b26bff', feature: 'hat', accent: '#2a1f45' },
};

/** Recettes des boss (plus grands, plus détaillés). */
export const BOSS_RECIPES: Record<string, Recipe> = {
  araignee: { w: 30, h: 26, body: '#5a3a7a', belly: '#8a5aca', outline: '#1a1028', eye: 'glow', eyeColor: '#ff4a7a', feature: 'spider', accent: '#3a2450' },
  crapaudroi: { w: 32, h: 28, body: '#4a7a3a', belly: '#c9d98d', outline: '#1a2810', eye: 'angry', eyeColor: '#fff', feature: 'none', accent: '#2a5a20' },
  golem: { w: 32, h: 30, body: '#5a4a3a', belly: '#8a6a4a', outline: '#1a120a', eye: 'glow', eyeColor: '#ff6a1f', feature: 'spikes', accent: '#ff5522' },
  roi: { w: 32, h: 30, body: '#2a2440', belly: '#4a3a6a', outline: '#0f0b1e', eye: 'glow', eyeColor: '#ff3a3a', feature: 'crown', accent: '#f4c430' },
};
