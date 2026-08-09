import Phaser from 'phaser';
import { ART_CELL } from './PixelArtGenerator';

/**
 * Héros & boss « HD » : dessinés procéduralement à ~2× la résolution des anciens
 * sprites peints à la main, pour exploiter le rendu 1920×1080 natif. Les formes
 * sont posées en primitives (disques, triangles, rectangles) sur une grille fine,
 * puis rasterisées net. L'échelle d'affichage est réduite d'autant côté entités
 * → taille à l'écran et hitbox strictement inchangées.
 */

/**
 * Facteur de compensation d'échelle du héros : l'ancien sprite 'cat' faisait 30
 * lignes, le nouveau en fait 52 (~1,73× plus haut). En multipliant les échelles
 * d'affichage de 'cat' par ce facteur, la taille à l'écran reste identique tout
 * en gagnant en détail. (28/24 px de hitbox → ×1/comp pour rester invariant.)
 */
export const HERO_ART_COMP = 30 / 52;

type Grid = (string | null)[][];
const mk = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string | null>(w).fill(null));

function disc(g: Grid, cx: number, cy: number, rx: number, ry: number, c: string): void {
  const h = g.length, w = g[0].length;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1) g[y][x] = c;
  }
}
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string): void {
  for (let y = Math.max(0, Math.round(y0)); y <= Math.min(g.length - 1, Math.round(y1)); y++)
    for (let x = Math.max(0, Math.round(x0)); x <= Math.min(g[0].length - 1, Math.round(x1)); x++) g[y][x] = c;
}
function tri(g: Grid, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, col: string): void {
  const h = g.length, w = g[0].length;
  const minX = Math.max(0, Math.floor(Math.min(ax, bx, cx))), maxX = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx)));
  const minY = Math.max(0, Math.floor(Math.min(ay, by, cy))), maxY = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
  const area = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  if (area === 0) return;
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const px = x + 0.5, py = y + 0.5;
    const w0 = ((bx - px) * (cy - py) - (cx - px) * (by - py)) / area;
    const w1 = ((cx - px) * (ay - py) - (ax - px) * (cy - py)) / area;
    const w2 = 1 - w0 - w1;
    if (w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02) g[y][x] = col;
  }
}
/** Symétrie miroir gauche→droite (dessiner une moitié, refléter). */
function mirror(g: Grid): void {
  const h = g.length, w = g[0].length;
  for (let y = 0; y < h; y++) for (let x = 0; x < Math.floor(w / 2); x++) g[y][w - 1 - x] = g[y][x];
}
/** Contour 1px autour de la silhouette. */
function outline(g: Grid, color: string): void {
  const h = g.length, w = g[0].length;
  const add: [number, number][] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (g[y][x] !== null) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && g[ny][nx] !== null && g[ny][nx] !== color) { add.push([x, y]); break; }
    }
  }
  for (const [x, y] of add) g[y][x] = color;
}

function render(scene: Phaser.Scene, key: string, g: Grid, cell = ART_CELL): void {
  const h = g.length, w = g[0].length;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w * cell, h * cell);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w * cell, h * cell);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = g[y][x];
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect(x * cell, y * cell, cell, cell);
  }
  tex.refresh();
}

// ===================== palettes =====================
const P = {
  out: '#0d0a0e',
  furD: '#3a2416', furM: '#8a5a34', furL: '#a8794a', furX: '#c99a68',
  creamL: '#efe6d0', creamM: '#d2c2a0', muzzle: '#c99a68',
  redD: '#7c2018', redM: '#c8402c', redH: '#e86a4a',
  boneL: '#f4efe0', boneM: '#c7bca4',
  amber: '#f4c838', dark: '#2a1208',
  leatherD: '#4a3722', leatherM: '#7a5e38', steel: '#8f96a2', steelD: '#5a606c',
};

// ===================== HÉROS : Chaton de guerre =====================
// Guerrier-chat féroce : couronne d'os à pointes, crinière tribale rouge,
// yeux ambre furieux, museau clair, pattes griffues. Vue de face symétrique.
export function genHeroCat(scene: Phaser.Scene): void {
  const W = 44, H = 52, cx = W / 2;
  const g = mk(W, H);

  // ---- jambes (brun) ----
  rect(g, cx - 8, 40, cx - 2, 50, P.furM);
  rect(g, cx + 1, 40, cx + 7, 50, P.furM);
  rect(g, cx - 8, 47, cx - 1, 50, P.furD);   // ombre basse
  rect(g, cx + 1, 47, cx + 8, 50, P.furD);
  disc(g, cx - 5, 50, 4, 2.2, P.furL);        // pattes-pieds
  disc(g, cx + 5, 50, 4, 2.2, P.furL);

  // ---- torse + bras (brun) ----
  disc(g, cx, 35, 10, 10, P.furM);            // masse du corps
  disc(g, cx, 39, 7.5, 7, P.creamL);          // ventre clair
  for (const s of [-1, 1] as const) {
    disc(g, cx + s * 11, 34, 3.4, 5.5, P.furM);      // bras
    disc(g, cx + s * 11.5, 34, 2, 5, P.furD);        // ombre interne du bras
    disc(g, cx + s * 12.5, 39, 3.6, 3.4, P.furL);    // poing
    for (let k = -1; k <= 1; k++) tri(g, cx + s * 12.5 + k * 2, 41, cx + s * 12.5 + k * 2 - 0.5, 44, cx + s * 12.5 + k * 2 + 1.3, 41.5, P.boneL); // griffes
  }

  // ---- crinière tribale rouge : col à pointes couvrant les épaules (DERRIÈRE le plastron) ----
  const maneCy = 27;
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * (0.46 + (i / 8) * 0.6);   // moitié gauche ; mirror gère la droite
    const ox = cx + Math.cos(a) * 10, oy = maneCy + Math.sin(a) * 4.4;
    const bx = cx + Math.cos(a) * 16.5, by = maneCy + 1 + Math.sin(a) * 5.5;
    tri(g, ox - 2.4, oy - 1.2, ox + 2.4, oy - 1.2, bx, by, i % 2 ? P.redD : P.redM);
  }
  disc(g, cx, maneCy, 10.5, 4, P.redM);
  disc(g, cx, maneCy - 0.8, 9.5, 3.2, P.redH);
  disc(g, cx, maneCy + 1.6, 9, 3, P.redD);

  // ---- plastron d'os clair PAR-DESSUS la crinière (poitrine armurée visible) ----
  disc(g, cx, 34, 6.2, 6, P.boneM);
  disc(g, cx, 34.5, 5, 5, P.boneL);
  disc(g, cx, 40, 6.5, 5, P.creamL);          // ventre clair (recouvre bas)
  rect(g, cx - 5, 33.5, cx + 5, 35, P.leatherM); // sangle de cuir
  tri(g, cx - 2.6, 32, cx + 2.6, 32, cx, 37, P.leatherM); // motif en V
  disc(g, cx, 32.5, 1.9, 1.9, P.amber);       // gemme
  disc(g, cx - 0.4, 32, 0.8, 0.8, P.boneL);
  disc(g, cx, 24.5, 3.6, 2.8, P.creamM);      // gorge visible au-dessus du plastron
  disc(g, cx, 24, 2.8, 2.2, P.creamL);

  // ---- tête ----
  disc(g, cx, 16, 9.5, 8.5, P.creamM);
  disc(g, cx, 15, 9, 8, P.creamL);
  // oreilles
  for (const s of [-1, 1] as const) {
    tri(g, cx + s * 7, 10, cx + s * 11, 2, cx + s * 3, 8, P.furM);
    tri(g, cx + s * 7.5, 9, cx + s * 9.5, 4, cx + s * 5, 8, P.redD); // intérieur
  }
  // couronne d'os (pointes)
  for (let i = -2; i <= 2; i++) {
    const bx = cx + i * 3.4;
    const hgt = 7 + (2 - Math.abs(i)) * 2;
    tri(g, bx - 2, 8, bx, 8 - hgt, bx + 2, 8, i === 0 ? P.redM : P.boneL);
    tri(g, bx - 1, 8, bx, 8 - hgt * 0.6, bx + 1, 8, i === 0 ? P.redH : P.boneM);
  }
  // yeux ambre furieux + sourcils
  for (const s of [-1, 1] as const) {
    disc(g, cx + s * 4, 16, 2.4, 2.6, P.boneL);
    disc(g, cx + s * 4.4, 16.4, 1.5, 1.8, P.amber);
    disc(g, cx + s * 4.8, 16.6, 0.8, 1.1, P.dark);
    tri(g, cx + s * 1.5, 13.6, cx + s * 7, 12.4, cx + s * 7, 14.8, P.out); // sourcil
    // peinture de guerre (barre rouge sous l'œil)
    rect(g, cx + s * 3 - 1, 19.5, cx + s * 3 + 1, 20, P.redM);
  }
  // museau + nez + crocs
  disc(g, cx, 19.5, 3.4, 2.4, P.muzzle);
  tri(g, cx - 1.4, 19.5, cx + 1.4, 19.5, cx, 21, P.dark);
  rect(g, cx - 2, 21.5, cx - 0.5, 23, P.boneL); // croc gauche
  rect(g, cx + 0.5, 21.5, cx + 2, 23, P.boneL); // croc droit

  mirror(g);
  outline(g, P.out);
  render(scene, 'cat', g);
}
