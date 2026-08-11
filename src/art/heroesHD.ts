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

/**
 * Les 8 sprites de boss HD sont dessinés à EXACTEMENT 2× (largeur ET hauteur) de
 * l'ancienne grille peinte à la main, puis rendus à ART_CELL → texture ×2. On
 * multiplie donc l'échelle d'affichage des boss (et des mini-boss « Écho » qui
 * réutilisent ces textures) par 0,5 → taille à l'écran et hitbox inchangées.
 */
export const BOSS_ART_COMP = 0.5;

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

function lighten(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const gg = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0');
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

  // Variante « reflet ténébreux » (invocations de Néantis) : même silhouette,
  // palette assombrie teintée void (violet-noir). La couleur de boon aléatoire
  // est ajoutée par un tint à l'écran (voir GameScene.summonShadowClones).
  const shadow: Grid = g.map((row) => row.map((c) => {
    if (!c) return null;
    const n = parseInt(c.slice(1), 16);
    const lum = (((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)) / 3;
    const v = Math.round(lum * 0.34);
    const r = Math.min(255, v + 26), gg = Math.round(v * 0.5), b = Math.min(255, v + 46);
    return '#' + ((r << 16) | (gg << 8) | b).toString(16).padStart(6, '0');
  }));
  render(scene, 'cat_shadow', shadow);
}

// ===================== BOSS : Gorbak — Bourbier Vivant (mud beast) =====================
// Monticule de boue amorphe, pics rocheux dégoulinants, gros yeux rouges furieux,
// large rictus denté. Dessin plein (asymétrie organique, pas de miroir).
export function genBossGorbak(scene: Phaser.Scene): void {
  const W = 64, H = 58;
  const g = mk(W, H);
  const K = '#241a0e', m = '#5a4a24', M = '#7a6636', w = '#9a8848', Wl = '#b8a666';
  const rD = '#a01810', r = '#e03018', R = '#ff6a3a', T = '#f4efe0', tS = '#c9bfa0', soc = '#160f06';

  // ---- masse de boue (disques empilés, lumpy) ----
  disc(g, 32, 40, 27, 17, m);
  disc(g, 22, 44, 17, 13, M);
  disc(g, 42, 42, 18, 14, M);
  disc(g, 32, 34, 22, 16, M);
  disc(g, 34, 30, 16, 12, w);          // haut plus clair (lumière)
  disc(g, 40, 33, 12, 10, Wl);
  disc(g, 20, 38, 10, 9, m);
  disc(g, 48, 46, 11, 8, m);
  // base
  rect(g, 10, 42, 54, 50, m);
  disc(g, 32, 46, 24, 7, m);

  // ---- queue de boue trapue (part du flanc droit, s'enroule vers le haut) ----
  for (let i = 0; i <= 7; i++) {
    const t = i / 7, tx = 52 + Math.sin(t * 1.3) * 11, ty = 42 - t * 13;
    disc(g, tx, ty, 5.6 - t * 3.4, 5 - t * 3, i % 2 ? M : w);
  }
  disc(g, 61, 27, 2, 2, Wl);   // bout clair de la queue

  // ---- deux pieds trapus + orteils/griffes ----
  for (const fx of [19, 45] as const) {
    disc(g, fx, 52, 8.5, 6, M);
    disc(g, fx, 55, 8, 3.5, m);
    for (let t = -1; t <= 1; t++) rect(g, fx + t * 4 - 1, 56, fx + t * 4 + 1, 57, Wl);
  }
  tri(g, 29, 46, 32, 57, 35, 46, soc);   // creux sombre entre les pieds
  for (const dx of [13, 51] as const) rect(g, dx - 2, 49, dx + 2, 55, m); // petites coulures latérales

  // ---- pics rocheux dégoulinants sur le dessus ----
  const spikes: [number, number, number][] = [[13, 26, 12], [20, 22, 16], [29, 18, 20], [38, 20, 17], [46, 24, 14], [53, 30, 10]];
  for (const [sx, sy, hgt] of spikes) {
    tri(g, sx - 4, sy, sx, sy - hgt, sx + 4, sy, M);
    tri(g, sx - 2, sy, sx + 0.5, sy - hgt * 0.7, sx + 2.5, sy, w);
    tri(g, sx - 1, sy, sx, sy - hgt * 0.4, sx + 1.2, sy, Wl);
  }

  // ---- yeux rouges furieux ----
  for (const [ex, dir] of [[23, -1], [42, 1]] as const) {
    disc(g, ex, 33, 6.5, 4.5, soc);                     // orbite sombre creusée
    disc(g, ex + dir * 0.6, 33.5, 5, 3.4, rD);
    disc(g, ex + dir * 0.9, 33.8, 4, 2.6, r);
    disc(g, ex + dir * 1.4, 33.4, 2.2, 1.8, R);         // éclat vif
    disc(g, ex + dir * 2, 32.7, 0.9, 0.9, '#ffd0b0');
    // sourcil de boue (surplomb agressif, incliné vers le centre)
    tri(g, ex - dir * 7, 27, ex + dir * 7, 29.5, ex + dir * 7, 31.5, M);
  }

  // ---- large rictus denté ----
  const my = 45;
  disc(g, 32, my, 15, 4.5, soc);          // bouche sombre
  disc(g, 32, my - 1.5, 14, 3.2, m);      // lèvre sup
  // dents haut (triangles pointant bas) et bas (pointant haut)
  for (let i = 0; i < 7; i++) {
    const tx = 19 + i * 4.3;
    tri(g, tx - 1.8, my - 2.5, tx, my + 1.5, tx + 1.8, my - 2.5, T);
    tri(g, tx + 0.3 - 1.6, my + 4.5, tx + 0.3, my + 0.5, tx + 0.3 + 1.6, my + 4.5, tS);
  }

  outline(g, K);
  render(scene, 'boss_gobugeant', g);
}

// ===================== BOSS : Ignis — Dragon de Lave =====================
// Dragon bipède ailé de face : corps de braise sombre, ventre-fournaise incandescent
// (fissures de lave), ailes de feu, cornes, crocs, pattes griffues. Symétrique.
export function genBossIgnis(scene: Phaser.Scene): void {
  const W = 64, H = 64, cx = W / 2;
  const g = mk(W, H);
  const kk = '#1a0e0a', kB = '#3a2018', kM = '#4e2a1e', rD = '#7a2410', o = '#d0500f', O = '#ff7a1f', Y = '#ffc23a', y = '#ffe89a', fH = '#ff9a2a';

  // ---- ailes de feu (derrière) ----
  for (const s of [-1, 1] as const) {
    tri(g, cx + s * 10, 34, cx + s * 30, 8, cx + s * 20, 40, rD);       // membrane sombre
    tri(g, cx + s * 12, 33, cx + s * 28, 12, cx + s * 19, 37, o);
    tri(g, cx + s * 13, 32, cx + s * 25, 16, cx + s * 18, 33, O);       // flammes
    tri(g, cx + s * 14, 30, cx + s * 22, 19, cx + s * 17, 30, Y);
    // langues de feu montantes
    for (let k = 0; k < 3; k++) tri(g, cx + s * (16 + k * 4), 22 - k, cx + s * (17 + k * 4), 12 - k * 2, cx + s * (18 + k * 4), 22 - k, fH);
  }

  // ---- queue (sous le corps, pointe de flèche) ----
  tri(g, cx - 6, 54, cx - 1, 60, cx + 6, 54, kB);
  tri(g, cx - 3, 58, cx, 63, cx + 3, 58, o);

  // ---- pattes griffues ----
  for (const s of [-1, 1] as const) {
    disc(g, cx + s * 8, 54, 5, 6, kB);
    disc(g, cx + s * 8, 58, 5.5, 3, kM);
    for (let k = -1; k <= 1; k++) tri(g, cx + s * 8 + k * 3, 60, cx + s * 8 + k * 3 - 0.6, 63, cx + s * 8 + k * 3 + 1.4, 60.5, y); // griffes
  }

  // ---- bras griffus ----
  for (const s of [-1, 1] as const) {
    disc(g, cx + s * 13, 36, 3.4, 7, kB);
    disc(g, cx + s * 13.5, 42, 3.6, 3.4, kM);
    for (let k = -1; k <= 1; k++) tri(g, cx + s * 13.5 + k * 2, 44, cx + s * 13.5 + k * 2 - 0.5, 47, cx + s * 13.5 + k * 2 + 1.2, 44.5, y);
  }

  // ---- corps sombre + ventre fournaise ----
  disc(g, cx, 40, 14, 15, kB);
  disc(g, cx, 38, 12, 13, kM);
  disc(g, cx, 43, 9.5, 10, rD);
  disc(g, cx, 44, 8, 8.5, o);
  disc(g, cx, 45, 6, 6.5, O);
  disc(g, cx, 46, 4, 4.5, Y);
  disc(g, cx, 46, 2, 2.4, y);
  // fissures de lave sur le torse
  for (const [ax, ay, bx, by] of [[-9, 32, -4, 40], [9, 32, 4, 40], [-6, 30, -8, 24], [6, 30, 8, 24]] as const) {
    rect(g, cx + Math.min(ax, bx), 30 + Math.min(ay - 30, by - 30), cx + Math.max(ax, bx), 30 + Math.max(ay - 30, by - 30), o);
  }
  // écailles ventrales (segments) sur la fournaise
  for (let i = 0; i < 3; i++) rect(g, cx - 5, 42 + i * 3, cx + 5, 42 + i * 3, rD);

  // ---- tête ----
  disc(g, cx, 20, 9, 8, kB);
  disc(g, cx, 21, 7.5, 6.5, kM);
  // museau
  disc(g, cx, 25, 5, 3.4, kB);
  disc(g, cx, 26.5, 3.5, 1.6, rD);
  // cornes
  for (const s of [-1, 1] as const) {
    tri(g, cx + s * 5, 15, cx + s * 10, 3, cx + s * 8, 16, kM);
    tri(g, cx + s * 5.5, 14, cx + s * 8.5, 6, cx + s * 7.5, 15, lighten(kM, 20));
  }
  // yeux incandescents furieux
  for (const s of [-1, 1] as const) {
    disc(g, cx + s * 4, 20, 2.4, 2, Y);
    disc(g, cx + s * 4.6, 20.2, 1.2, 1.3, y);
    tri(g, cx + s * 1, 16.6, cx + s * 6.5, 15.4, cx + s * 6.5, 18.4, kk); // sourcil
  }
  // crocs
  rect(g, cx - 3, 27.5, cx - 1.6, 29.5, y);
  rect(g, cx + 1.6, 27.5, cx + 3, 29.5, y);

  outline(g, kk);
  render(scene, 'boss_serpentlave', g);
}

// ===================== BOSS : Glacior — Léviathan des Abysses =====================
// Serpent-dragon de glace lové : corps bleu cristallin en boucle, crête d'épines de
// glace en couronne, tête anguleuse, yeux cyan lumineux, épines dorsales.
export function genBossGlacior(scene: Phaser.Scene): void {
  const W = 64, H = 68, cx = W / 2;
  const g = mk(W, H);
  const k = '#0a1420', iD = '#123a54', m = '#2a4a60', r = '#3a6a8a', w = '#a8c8e0', Wl = '#dcecf8', C = '#9fe0f8', Hc = '#7fdcff', e = '#e8f8ff';

  // ---- corps serpentin en S (tête en haut, queue en bas — jamais jointes) ----
  const path: [number, number, number][] = [];
  const N = 26;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = 30 + Math.sin(t * Math.PI * 2 - 0.5) * 15;
    const y = 24 + t * 40;
    path.push([x, y, Math.max(3, 8 - t * 5)]);   // rayon décroissant vers la queue
  }
  for (const [bx, by, rad] of path) {
    disc(g, bx, by, rad, rad, r);
    disc(g, bx + rad * 0.22, by - rad * 0.22, rad * 0.72, rad * 0.66, w);
    disc(g, bx + rad * 0.38, by - rad * 0.38, rad * 0.36, rad * 0.32, Wl);
    disc(g, bx - rad * 0.3, by + rad * 0.32, rad * 0.5, rad * 0.44, m);
  }
  // épines dorsales le long de la courbe (côté extérieur)
  for (let i = 3; i < path.length - 1; i += 2) {
    const [bx, by, rad] = path[i]; const [px, py] = path[i - 2];
    const dx = bx - px, dy = by - py, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    tri(g, bx + nx * rad * 0.5 - ny * 2.2, by + ny * rad * 0.5 + nx * 2.2,
      bx + nx * (rad + 7), by + ny * (rad + 7),
      bx + nx * rad * 0.5 + ny * 2.2, by + ny * rad * 0.5 - nx * 2.2, i % 4 ? C : Wl);
  }
  // nageoire caudale
  const tl = path[path.length - 1];
  tri(g, tl[0], tl[1] - 2, tl[0] - 8, tl[1] + 5, tl[0] - 1, tl[1] + 2, C);
  tri(g, tl[0], tl[1] - 2, tl[0] + 8, tl[1] + 5, tl[0] + 1, tl[1] + 2, C);

  // tête anguleuse
  disc(g, 22, 17, 9, 8, w);
  disc(g, 23, 18, 7, 6.5, Wl);
  // museau vers la gauche
  tri(g, 20, 14, 8, 18, 20, 22, w);
  disc(g, 12, 18.5, 2, 1.6, m);   // narine
  // crête d'épines de glace (couronne) derrière/au-dessus de la tête
  for (let i = 0; i < 6; i++) {
    const a = -1.2 + i * 0.42;
    const bx = 24 + Math.cos(a) * 6, by = 14 + Math.sin(a) * 6;
    const tx = 24 + Math.cos(a) * 18, ty = 14 + Math.sin(a) * 18;
    tri(g, bx - 2.4, by, tx, ty, bx + 2.4, by, i % 2 ? C : Wl);
    tri(g, bx - 1.2, by, tx, ty - 1, bx + 1.2, by, e);
  }
  // yeux cyan lumineux + sourcil
  disc(g, 19, 17, 2.4, 2, Hc);
  disc(g, 19.4, 17.2, 1.2, 1.2, e);
  tri(g, 15, 13.6, 24, 12.4, 24, 15.4, iD);
  // crocs de glace
  tri(g, 15, 21, 15.6, 24.5, 16.8, 21, e);
  tri(g, 18, 21.5, 18.6, 24.5, 19.8, 21.5, e);

  outline(g, k);
  render(scene, 'boss_leviathan', g);
}

// ===================== BOSS : Sylvaan — Centaure Sylvestre =====================
// Centaure de bois : corps équin en écorce (4 pattes), torse humanoïde, ramure de
// cerf, crinière/queue de feuillage. Vue 3/4 vers la droite.
export function genBossSylvaan(scene: Phaser.Scene): void {
  const W = 68, H = 78, cx = W / 2;
  const g = mk(W, H);
  const k = '#2a1c0e', o = '#5a3e1e', W1 = '#8b6534', a = '#a8824a', s = '#d0aa66', gD = '#2f5f2f', g1 = '#4f8f3f', g2 = '#7db84a', gL = '#a8d86a';

  // ---- corps équin (écorce) ----
  disc(g, 34, 50, 22, 12, W1);
  disc(g, 30, 48, 18, 10, a);
  disc(g, 40, 52, 16, 9, o);           // croupe (ombre)
  // pattes (4)
  for (const [lx, top] of [[18, 56], [26, 58], [44, 58], [52, 56]] as const) {
    rect(g, lx - 3, top, lx + 3, 72, W1);
    rect(g, lx - 3, top, lx, 72, o);   // ombre interne
    rect(g, lx - 3.5, 71, lx + 3.5, 74, k); // sabot
  }
  // queue de feuillage (arrière-gauche)
  for (const [lx, ly, rr] of [[13, 48, 5], [9, 54, 4], [12, 60, 4], [8, 44, 3]] as const) disc(g, lx, ly, rr, rr, g1);
  for (const [lx, ly] of [[10, 46], [7, 52], [11, 58]] as const) disc(g, lx, ly, 2.4, 2.4, g2);

  // ---- arc de bois vivant (à droite, DERRIÈRE le bras) ----
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, yy = 16 + t * 30, xx = 55 + Math.sin(t * Math.PI) * 6;
    disc(g, xx, yy, 1.7, 1.7, o); disc(g, xx - 0.6, yy, 0.9, 1.2, a);
  }
  for (let i = 0; i <= 18; i++) { const t = i / 18; g[Math.round(16 + t * 30)][55] = k; } // corde
  disc(g, 55, 16, 1.8, 1.8, s); disc(g, 55, 46, 1.8, 1.8, s);            // encoches

  // ---- torse humanoïde (se dresse au centre-avant) ----
  const tcx = 38;
  disc(g, tcx, 34, 8, 13, W1);
  disc(g, tcx - 1.5, 33, 6, 11, a);          // face avant plus claire
  disc(g, tcx, 26, 9.5, 5, o);               // épaules larges
  rect(g, tcx - 5, 31, tcx + 5, 31, o);      // nervures de bois (pectoraux)
  rect(g, tcx - 4, 37, tcx + 4, 37, o);
  // bras arrière (gauche, plié le long du corps)
  disc(g, tcx - 8, 30, 3, 6, o);
  disc(g, tcx - 8.5, 36, 2.6, 3, W1);
  // bras avant (droit, tendu vers l'arc)
  disc(g, tcx + 8, 30, 3, 6, W1);
  disc(g, tcx + 13, 33, 2.6, 3, a);          // main sur la corde
  rect(g, tcx + 8, 33, tcx + 13, 33, W1);    // avant-bras

  // ---- crinière de feuilles (épaules/nuque) ----
  for (const [lx, ly, rr] of [[tcx - 6, 22, 4.5], [tcx, 20, 5], [tcx + 6, 23, 4], [tcx - 2, 25, 4]] as const) disc(g, lx, ly, rr, rr * 0.9, g1);
  for (const [lx, ly] of [[tcx - 4, 21], [tcx + 2, 19], [tcx + 5, 22]] as const) disc(g, lx, ly, 2.4, 2.4, g2);

  // ---- tête (cervidé humanoïde, de face) ----
  disc(g, tcx, 14, 6.5, 7, a);
  disc(g, tcx - 1, 14, 5, 6, s);
  disc(g, tcx, 18.5, 3.2, 2.4, W1);          // museau/menton
  disc(g, tcx, 19, 0.9, 0.9, k);             // truffe
  // yeux verts lumineux
  for (const sx of [-1, 1] as const) { disc(g, tcx + sx * 2.6, 13.5, 1.7, 1.9, gD); disc(g, tcx + sx * 2.6, 13.2, 0.9, 1, gL); }
  // touffe de feuilles frontale
  for (const [lx, ly, rr] of [[tcx - 3, 8.5, 2.6], [tcx, 7.5, 3], [tcx + 3, 8.5, 2.6]] as const) disc(g, lx, ly, rr, rr, g1);

  // ---- ramure de cerf (branchue) ----
  for (const s2 of [-1, 1] as const) {
    const bx = tcx + s2 * 4, by = 9;
    tri(g, bx - 1.5, by, bx + s2 * 3, by - 15, bx + 1.5, by, o);          // tige
    tri(g, bx + s2 * 1, by - 4, bx + s2 * 8, by - 6, bx + s2 * 2, by - 3, o);   // andouiller bas
    tri(g, bx + s2 * 2, by - 8, bx + s2 * 9, by - 12, bx + s2 * 3, by - 7, o);  // andouiller mid
    tri(g, bx + s2 * 2.5, by - 12, bx + s2 * 6, by - 18, bx + s2 * 3.5, by - 11, o); // pointe
    disc(g, bx + s2 * 8, by - 6, 1.2, 1.2, g2); disc(g, bx + s2 * 9, by - 12, 1.2, 1.2, g2); // bourgeons
  }

  // feuilles éparses sur la croupe
  for (const [lx, ly] of [[30, 46], [42, 48], [24, 52]] as const) disc(g, lx, ly, 2.2, 1.6, g2);

  outline(g, k);
  render(scene, 'boss_centaure', g);
}

// ===================== BOSS : Mortis — Dracoliche Archimage =====================
// Liche-dragon : capuchon/col à pointes violet, crâne aux yeux violets, robe en
// lambeaux à liseré d'or + gemme losange, ailes de chauve-souris déchirées, bâton
// à flamme violette. Vue de face symétrique.
export function genBossMortis(scene: Phaser.Scene): void {
  const W = 60, H = 70, cx = W / 2;
  const g = mk(W, H);
  const k = '#0e0b1a', p = '#3a2c5a', P = '#4a2c7a', v = '#5a3a8a', B = '#241a3a', gD = '#8a6a20', g1 = '#c9a23a', y = '#f4c430', Wb = '#e6e2d4', wb = '#b8b0a0', e = '#c78aff', f = '#8a5cff';

  // ---- ailes de chauve-souris déchirées (derrière) ----
  for (const sx of [-1, 1] as const) {
    tri(g, cx + sx * 8, 30, cx + sx * 28, 22, cx + sx * 22, 46, B);
    tri(g, cx + sx * 8, 32, cx + sx * 24, 30, cx + sx * 20, 44, p);
    // nervures + festons
    for (let k2 = 0; k2 < 3; k2++) rect(g, cx + sx * (10 + k2 * 5), 34 + k2 * 2, cx + sx * (10 + k2 * 5), 44, B);
  }

  // ---- robe (corps) ----
  disc(g, cx, 44, 15, 16, p);
  disc(g, cx, 42, 12, 13, P);
  // bas en lambeaux
  for (let i = -3; i <= 3; i++) tri(g, cx + i * 4 - 2.5, 56, cx + i * 4, 66, cx + i * 4 + 2.5, 56, P);
  // liseré d'or + gemme losange
  rect(g, cx - 8, 40, cx + 8, 41.5, g1);
  tri(g, cx, 40, cx - 4, 46, cx, 52, y); tri(g, cx, 40, cx + 4, 46, cx, 52, g1);
  disc(g, cx, 46, 2, 3, e);
  // crânes suspendus
  for (const sx of [-1, 1] as const) { disc(g, cx + sx * 10, 48, 2.6, 2.8, Wb); rect(g, cx + sx * 10 - 1.4, 49.5, cx + sx * 10 + 1.4, 51, wb); }

  // ---- col/capuchon à pointes ----
  for (let i = -3; i <= 3; i++) {
    const bx = cx + i * 5;
    tri(g, bx - 3, 30, bx, 30 - (10 - Math.abs(i) * 1.5), bx + 3, 30, i === 0 ? P : p);
  }
  disc(g, cx, 30, 15, 6, p);
  rect(g, cx - 13, 29, cx + 13, 31, g1);   // liseré d'or du col
  // capuchon central
  tri(g, cx - 9, 26, cx, 4, cx + 9, 26, P);
  tri(g, cx - 6, 25, cx, 9, cx + 6, 25, p);
  disc(g, cx, 8, 3, 3, y); disc(g, cx, 8, 1.6, 1.6, e); // gemme frontale

  // ---- crâne de dragon dans le capuchon ----
  disc(g, cx, 20, 8, 8, Wb);
  disc(g, cx, 21, 6.5, 6.5, wb);
  disc(g, cx, 25, 5, 3.5, Wb);   // museau
  // cornes latérales
  for (const sx of [-1, 1] as const) tri(g, cx + sx * 6, 16, cx + sx * 13, 12, cx + sx * 7, 19, Wb);
  // yeux violets flamboyants
  for (const sx of [-1, 1] as const) { disc(g, cx + sx * 3.4, 20, 2.2, 2.4, f); disc(g, cx + sx * 3.4, 19, 1.1, 1.1, e); }
  // dents
  for (let i = -2; i <= 2; i++) rect(g, cx + i * 2, 27, cx + i * 2, 29, Wb);

  // ---- bâton à flamme violette (gauche) ----
  rect(g, cx - 20, 30, cx - 18, 60, gD);
  disc(g, cx - 19, 28, 4, 5, B);         // tête du bâton
  tri(g, cx - 23, 26, cx - 19, 14, cx - 15, 26, f); // flamme
  tri(g, cx - 21, 24, cx - 19, 18, cx - 17, 24, e);
  disc(g, cx - 19, 27, 1.6, 1.6, y);

  outline(g, k);
  render(scene, 'boss_archimage', g);
}

// ===================== BOSS : Voltaïr — Panda-Tonnerre =====================
// Panda quadrupède caparaçonné : corps noir & blanc, crinière de nuage d'orage
// violette, liseré/emblème d'or (éclair), accents d'éclair bleu, face féroce.
export function genBossVoltair(scene: Phaser.Scene): void {
  const W = 64, H = 64, cx = W / 2;
  const g = mk(W, H);
  const k = '#141422', kk = '#0c0c16', Wl = '#f0f0f8', w = '#c8c8d8', p = '#7a4ad0', P = '#9a6ae8', pD = '#4a2a8a', g1 = '#e0b83a', y = '#ffe066', B = '#8ab8ff', b = '#3a6ad0';

  // ---- nuage d'orage violet (crinière, derrière le dos) ----
  for (const [lx, ly, rr] of [[24, 16, 8], [34, 12, 9], [44, 16, 8], [30, 20, 7], [40, 20, 7], [50, 22, 5], [18, 22, 5]] as const) {
    disc(g, lx, ly, rr, rr * 0.9, p);
    disc(g, lx + 1.5, ly - 1.5, rr * 0.55, rr * 0.5, P);
  }
  // éclairs jaunes autour du nuage
  for (const [x0, y0] of [[16, 26], [52, 28]] as const) { rect(g, x0, y0, x0 + 1, y0 + 6, y); rect(g, x0 - 2, y0 + 6, x0 + 1, y0 + 7, y); rect(g, x0 - 2, y0 + 7, x0 - 1, y0 + 12, y); }

  // ---- jambes noires (2, arrondies) + pieds blancs ----
  for (const sx of [-1, 1] as const) {
    disc(g, cx + sx * 7, 54, 5.5, 6, k);
    disc(g, cx + sx * 7, 59, 5.5, 3.5, Wl);           // pied blanc
    for (let t = -1; t <= 1; t++) rect(g, cx + sx * 7 + t * 2, 60, cx + sx * 7 + t * 2, 61, k); // orteils
  }

  // ---- corps (torse blanc) + bras noirs ----
  disc(g, cx, 44, 14, 13, Wl);
  disc(g, cx, 46, 11, 11, w);
  for (const sx of [-1, 1] as const) {
    disc(g, cx + sx * 13, 42, 4, 8, k);               // bras noir
    disc(g, cx + sx * 13, 49, 4, 3.5, Wl);            // patte blanche
  }
  // plastron d'or + emblème éclair
  disc(g, cx, 44, 8, 7, g1);
  disc(g, cx, 44, 6.5, 5.5, y);
  rect(g, cx - 0.5, 39, cx + 2, 44, g1); rect(g, cx - 3, 44, cx + 0.5, 45, g1); rect(g, cx - 3, 45, cx - 0.5, 50, g1); // éclair

  // ---- tête de panda (de face, au-dessus du corps) ----
  disc(g, cx, 27, 12, 11, Wl);
  disc(g, cx, 28, 10.5, 9.5, w);
  disc(g, cx, 27, 9.5, 9, Wl);
  // oreilles noires
  for (const sx of [-1, 1] as const) { disc(g, cx + sx * 9, 18, 4.5, 4.5, k); disc(g, cx + sx * 9, 18, 2.4, 2.4, kk); }
  // taches d'yeux noires (classiques, inclinées → féroce)
  for (const sx of [-1, 1] as const) {
    disc(g, cx + sx * 5, 27, 3.6, 4.4, k);
    tri(g, cx + sx * 1.5, 22.5, cx + sx * 8.5, 24.5, cx + sx * 8.5, 27, k);  // pointe interne (sourcil)
    disc(g, cx + sx * 5, 28, 2, 2.2, y);              // œil doré
    disc(g, cx + sx * 5.6, 28.4, 1, 1.1, kk);
  }
  // museau + nez + bouche
  disc(g, cx, 33, 4.5, 3, Wl);
  disc(g, cx, 32.5, 1.8, 1.4, kk);
  rect(g, cx - 2, 35, cx + 2, 35, kk);
  // liseré d'or frontal (diadème)
  rect(g, cx - 7, 20, cx + 7, 20.5, g1);
  disc(g, cx, 20, 1.6, 1.6, y);

  // ---- éclairs bleus (canines + arcs sur les côtés) ----
  tri(g, cx - 3.5, 35.5, cx - 5, 40, cx - 1.5, 36.5, B);
  tri(g, cx + 3.5, 35.5, cx + 5, 40, cx + 1.5, 36.5, B);
  for (const [x0, dir] of [[3, -1], [W - 3, 1]] as const) {   // arcs d'éclair bleu extérieurs
    rect(g, x0, 40, x0, 44, B); rect(g, x0 + dir, 44, x0 + dir, 45, B); rect(g, x0 + dir, 45, x0 + dir, 49, B);
  }

  outline(g, kk);
  render(scene, 'boss_rapace', g);
}

// ===================== BOSS : Néantis — Roi du Néant =====================
// Rongeur royal doré : grandes oreilles, couronne, cape violette, spirale de vide
// ventrale, sceptre du néant. Vue de face.
export function genBossNeantis(scene: Phaser.Scene): void {
  const W = 60, H = 68, cx = W / 2;
  const g = mk(W, H);
  const k = '#0a0612', gD = '#8a6a1a', g1 = '#c99a2a', G = '#e0b83a', y = '#ffe066', p = '#7a2ad0', P = '#b060ff', v = '#3a1470', Wc = '#f0e6c8', wc = '#c8b890', b = '#180f28';

  // ---- cape violette (derrière) ----
  disc(g, cx, 44, 22, 18, v);
  disc(g, cx, 42, 19, 15, p);
  for (let i = -3; i <= 3; i++) tri(g, cx + i * 6 - 3, 58, cx + i * 6, 66, cx + i * 6 + 3, 58, v);
  rect(g, cx - 16, 34, cx + 16, 36, G);   // liseré d'or

  // ---- oreilles (grandes, dressées) ----
  for (const sx of [-1, 1] as const) {
    tri(g, cx + sx * 5, 18, cx + sx * 12, -2, cx + sx * 11, 20, g1);
    tri(g, cx + sx * 6, 17, cx + sx * 10, 3, cx + sx * 9.5, 18, G);
    rect(g, cx + sx * 8, 2, cx + sx * 9, 8, k);  // pointe sombre
  }

  // ---- corps doré ----
  disc(g, cx, 40, 15, 16, g1);
  disc(g, cx, 42, 12.5, 14, G);
  disc(g, cx, 46, 10, 11, y);        // ventre plus clair
  // bras + pieds
  for (const sx of [-1, 1] as const) {
    disc(g, cx + sx * 14, 40, 3.4, 6, g1);
    disc(g, cx + sx * 8, 58, 5, 3.4, g1);
    for (let kf = -1; kf <= 1; kf++) rect(g, cx + sx * 8 + kf * 2, 59, cx + sx * 8 + kf * 2, 61, k);
  }

  // ---- spirale de vide (ventre) ----
  for (let i = 0; i < 26; i++) {
    const t = i / 26, a = t * Math.PI * 5, rr = 9 * (1 - t * 0.9);
    const sx = cx + Math.cos(a) * rr, sy = 46 + Math.sin(a) * rr;
    disc(g, sx, sy, 1.6, 1.6, i % 2 ? P : v);
  }
  disc(g, cx, 46, 2, 2, b);

  // ---- tête + couronne ----
  disc(g, cx, 20, 10, 9, g1);
  disc(g, cx, 21, 8.5, 7.5, G);
  disc(g, cx, 24, 5, 3.4, y);   // museau clair
  // couronne
  rect(g, cx - 8, 12, cx + 8, 14, G);
  for (let i = -2; i <= 2; i++) tri(g, cx + i * 4 - 2, 12, cx + i * 4, 6, cx + i * 4 + 2, 12, G);
  disc(g, cx, 9, 1.8, 1.8, P);  // gemme violette
  for (const sx of [-1, 1] as const) disc(g, cx + sx * 6, 10, 1, 1, P);
  // yeux violets féroces
  for (const sx of [-1, 1] as const) { disc(g, cx + sx * 4, 20, 2.2, 2, P); disc(g, cx + sx * 4.4, 20, 1, 1, '#f0d0ff'); tri(g, cx + sx * 1, 16.6, cx + sx * 6.5, 15.6, cx + sx * 6.5, 18.4, gD); }
  // dents de rongeur
  rect(g, cx - 1.6, 26, cx - 0.2, 29, Wc); rect(g, cx + 0.2, 26, cx + 1.6, 29, Wc);

  // ---- sceptre du néant (gauche) ----
  rect(g, cx - 19, 30, cx - 17, 60, gD);
  disc(g, cx - 18, 27, 4, 5, v);
  disc(g, cx - 18, 27, 2.4, 3, P);
  disc(g, cx - 18, 27, 1, 1.4, b);

  outline(g, k);
  render(scene, 'boss_reflet', g);
}

// ===================== BOSS : Général Kaptain Miaou — chat militaire (final) =====================
// Chat de guerre : béret à étoile, cache-œil, balafre, treillis camo, bandoulière
// dorée, face féroce. Vue de face symétrique.
export function genBossMilitaire(scene: Phaser.Scene): void {
  const W = 60, H = 68, cx = W / 2;
  const g = mk(W, H);
  const k = '#0a0e08', bD = '#234523', b = '#2e5a2e', B = '#3f7a3f', fD = '#5a6058', f = '#8a8f86', F = '#b8beb0', kk = '#101010', y = '#ffd24a', r = '#d0402a', cD = '#3a4a28', c = '#5a6a38', v = '#7a8a4a';

  // ---- corps (treillis camo) ----
  disc(g, cx, 46, 18, 16, c);
  disc(g, cx, 48, 15, 14, cD);
  disc(g, cx, 44, 14, 10, '#4a5a30');
  // taches de camo
  for (const [lx, ly, rr] of [[24, 42, 4], [38, 48, 5], [28, 54, 4], [40, 40, 3], [20, 50, 3]] as const) disc(g, lx, ly, rr, rr * 0.8, v);
  // bandoulière dorée
  for (let i = 0; i < 10; i++) rect(g, cx - 12 + i * 3, 38 + i * 1.6, cx - 10 + i * 3, 40 + i * 1.6, y);
  // pattes
  for (const sx of [-1, 1] as const) { disc(g, cx + sx * 12, 58, 5, 4, cD); for (let kf = -1; kf <= 1; kf++) rect(g, cx + sx * 12 + kf * 2, 60, cx + sx * 12 + kf * 2, 62, F); }

  // ---- tête (fourrure grise) ----
  disc(g, cx, 24, 12, 11, f);
  disc(g, cx, 25, 10, 9, F);
  // oreilles
  for (const sx of [-1, 1] as const) { tri(g, cx + sx * 7, 16, cx + sx * 11, 6, cx + sx * 3, 15, f); tri(g, cx + sx * 7, 15, cx + sx * 9, 9, cx + sx * 5, 14, fD); }
  // museau + nez + moustaches
  disc(g, cx, 28, 4.5, 3, F);
  disc(g, cx, 27.5, 1.6, 1.3, kk);
  rect(g, cx - 2, 30, cx + 2, 30, kk);
  // œil droit féroce (jaune) + cache-œil gauche
  disc(g, cx + 5, 24, 2.4, 2.2, y); disc(g, cx + 5.4, 24, 1.1, 1.3, kk);
  tri(g, cx + 1.5, 21, cx + 8, 20, cx + 8, 22.5, kk);          // sourcil droit
  disc(g, cx - 5, 24, 3, 3, kk);                                // cache-œil
  rect(g, cx - 12, 21, cx - 2, 22, kk);                        // sangle du cache-œil
  rect(g, cx - 7, 28, cx - 2, 29, r);                          // balafre

  // ---- béret vert à étoile (incliné) ----
  disc(g, cx + 1, 13, 12, 5, b);
  disc(g, cx + 1, 12, 10.5, 4, B);
  disc(g, cx - 9, 12, 2.4, 2.4, bD);   // pli
  disc(g, cx - 3, 11, 2.4, 2.2, r);    // étoile (disque rouge)
  tri(g, cx - 3, 8.5, cx - 4.6, 13, cx - 1.4, 13, y);
  tri(g, cx - 3, 13.5, cx - 4.6, 9.5, cx - 1.4, 9.5, y);

  outline(g, k);
  render(scene, 'boss_militaire', g);
}
