import Phaser from 'phaser';
import { ART_CELL } from './PixelArtGenerator';

/**
 * Suréchantillonnage du dessin des créatures : la grille de tracé est agrandie
 * de ce facteur (formes plus fines), MAIS la texture finale garde EXACTEMENT la
 * même taille en pixels qu'avant (rendu via des cellules fractionnaires ART_CELL/DETAIL).
 * → +détail visuel, ZÉRO impact sur la taille à l'écran, la hitbox ou le gameplay.
 */
const CRITTER_DETAIL = 3;

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
  // --- traits d'espèce (optionnels : composables par-dessus `feature`) ---
  mouth?: 'fangs' | 'wide' | 'beak' | 'grin' | 'tusks' | 'maw'; // bouche/mâchoire caractéristique
  arms?: boolean;                                               // deux petits bras sur les flancs
  snout?: boolean;                                              // museau allongé (loup, dragon, serpent)
  tail?: 'plain' | 'forked' | 'tuft' | 'fin' | 'none';         // forme de queue (défaut = plain si au sol)
  pattern?: 'spots' | 'stripes';                                // motifs sur le corps
  wingStyle?: 'membrane';                                       // ailes membranées (chauve-souris)
  earStyle?: 'long';                                            // oreilles longues/tombantes
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

function render(scene: Phaser.Scene, key: string, g: Grid, superscale = 1): void {
  const h = g.length, w = g[0].length;
  // Taille de texture INCHANGÉE : la grille suréchantillonnée (w = w_logique × superscale)
  // est rendue avec des cellules de ART_CELL/superscale px, tuilées sur des bornes ENTIÈRES
  // (aucune couture) → même taille finale, mais dessin plus fin.
  const s = ART_CELL / superscale;
  const cw = Math.round(w * s), ch = Math.round(h * s);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, cw, ch);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, cw, ch);
  for (let y = 0; y < h; y++) {
    const py0 = Math.round(y * s), py1 = Math.round((y + 1) * s);
    for (let x = 0; x < w; x++) {
      const c = g[y][x];
      if (!c) continue;
      const px0 = Math.round(x * s), px1 = Math.round((x + 1) * s);
      ctx.fillStyle = c;
      ctx.fillRect(px0, py0, Math.max(1, px1 - px0), Math.max(1, py1 - py0));
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
  // Grille de tracé suréchantillonnée : toutes les primitives sont placées en
  // fractions de W/H, donc le dessin gagne en finesse sans autre changement.
  const W = r.w * CRITTER_DETAIL, H = r.h * CRITTER_DETAIL;
  const g = makeGrid(W, H);
  const cx = W / 2;
  const bodyCy = H * 0.56;
  const rx = W * 0.34;
  const ry = H * 0.36;
  const hasFeet = r.feet !== false && r.feature !== 'ghost' && r.feature !== 'spider';
  const grounded = r.feature !== 'ghost' && r.feature !== 'spider';

  // ================= arrière-plan (derrière le corps) =================
  if (r.feature === 'wings') {
    if (r.wingStyle === 'membrane') {
      // ailes membranées (chauve-souris) : voile festonnée + doigts en contour
      for (const dir of [-1, 1] as const) {
        const base = dir < 0 ? cx - rx * 0.5 : cx + rx * 0.5;
        const tipX = base + dir * W * 0.5;
        const topY = bodyCy - ry * 1.0, botY = bodyCy + ry * 0.5;
        tri(g, base, bodyCy - ry * 0.5, tipX, topY, tipX, botY, dir < 0 ? lighten(r.accent, -18) : r.accent);
        // doigts (nervures) de l'aile
        for (let k = 0; k <= 2; k++) {
          const fx = base + (tipX - base) * (0.35 + k * 0.32);
          const fy = topY + (botY - topY) * (0.2 + k * 0.28);
          rect(g, Math.round(Math.min(base, fx)), Math.round(fy), Math.round(Math.max(base, fx)), Math.round(fy), r.outline);
        }
      }
    } else {
      // aile arrière (gauche) plus petite, aile avant (droite) plus grande (3/4)
      tri(g, cx - rx * 0.9, bodyCy - ry * 0.6, cx - W * 0.44, bodyCy - ry * 0.9, cx - rx * 0.3, bodyCy + ry * 0.3, lighten(r.accent, -22));
      tri(g, cx + rx, bodyCy - ry * 0.6, cx + W * 0.52, bodyCy - ry, cx + rx * 0.4, bodyCy + ry * 0.45, r.accent);
    }
  }
  if (r.feature === 'spider') {
    for (let i = 0; i < 4; i++) {
      const ly = bodyCy - ry * 0.5 + i * ry * 0.45;
      rect(g, 1, Math.round(ly), Math.round(cx - rx * 0.7), Math.round(ly) + 1, r.outline);
      rect(g, Math.round(cx + rx * 0.7), Math.round(ly), W - 2, Math.round(ly) + 1, r.outline);
    }
  }

  // ---- queue à GAUCHE (derrière) : casse la symétrie, contrepoids du regard ----
  const tailStyle = r.tail ?? ((grounded && r.feature !== 'mushroom' && r.feature !== 'hat') ? 'plain' : 'none');
  if (tailStyle !== 'none') {
    const tx = cx - rx * 0.92, ty = bodyCy + ry * 0.2;
    if (tailStyle === 'fin') {
      // nageoire caudale (poisson) : éventail vers la gauche
      tri(g, cx - rx * 0.7, bodyCy, cx - rx * 1.5, bodyCy - ry * 0.7, cx - rx * 1.5, bodyCy + ry * 0.7, lighten(r.body, -8));
      tri(g, cx - rx * 0.7, bodyCy, cx - rx * 1.28, bodyCy - ry * 0.42, cx - rx * 1.28, bodyCy + ry * 0.42, r.accent);
    } else if (tailStyle === 'tuft') {
      // queue touffue (loup) : base fine + gros plumeau accentué
      disc(g, tx, ty, rx * 0.2, ry * 0.24, lighten(r.body, -12));
      disc(g, tx - rx * 0.22, ty - ry * 0.7, rx * 0.32, ry * 0.4, lighten(r.body, -4));
      disc(g, tx - rx * 0.3, ty - ry * 1.3, rx * 0.24, ry * 0.28, r.accent);
    } else if (tailStyle === 'forked') {
      // queue de diable : tige + pointe en flèche (deux triangles)
      disc(g, tx + rx * 0.1, ty, rx * 0.16, ry * 0.2, lighten(r.body, -10));
      disc(g, tx - rx * 0.1, ty - ry * 0.6, rx * 0.13, ry * 0.16, lighten(r.body, -6));
      tri(g, tx - rx * 0.05, ty - ry * 1.0, tx - rx * 0.45, ty - ry * 1.3, tx - rx * 0.1, ty - ry * 1.4, r.accent);
      tri(g, tx - rx * 0.05, ty - ry * 1.0, tx + rx * 0.35, ty - ry * 1.3, tx + rx * 0.0, ty - ry * 1.4, r.accent);
    } else {
      // plain (défaut)
      disc(g, tx, ty, rx * 0.26, ry * 0.3, lighten(r.body, -12));
      disc(g, tx - rx * 0.14, ty - ry * 0.55, rx * 0.2, ry * 0.24, lighten(r.body, -6));
      disc(g, tx - rx * 0.05, ty - ry * 1.12, rx * 0.15, ry * 0.18, r.accent);
    }
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
    if (r.snout) {
      // museau allongé (loup/dragon/serpent) : prolonge la silhouette vers la droite
      disc(g, mx + rx * 0.18, my + ry * 0.06, rx * 0.4, ry * 0.24, r.body);
      disc(g, mx + rx * 0.52, my + ry * 0.06, rx * 0.24, ry * 0.18, lighten(r.body, 8));
      disc(g, mx + rx * 0.74, my + ry * 0.02, Math.max(0.9, rx * 0.1), Math.max(0.9, ry * 0.09), r.outline); // truffe
    } else {
      disc(g, mx, my, rx * 0.32, ry * 0.28, r.belly ?? lighten(r.body, 10));
      disc(g, mx + rx * 0.2, my + ry * 0.04, Math.max(0.8, rx * 0.09), Math.max(0.8, ry * 0.08), r.outline); // narine
    }
  }

  // volume : ombre basse + reflet HAUT-DROITE + éclat spéculaire (lumière haut-droite)
  if (r.feature !== 'ghost') {
    disc(g, cx - rx * 0.12, bodyCy + ry * 0.55, rx * 0.85, ry * 0.4, lighten(r.body, -24));
    disc(g, cx + rx * 0.36, bodyCy - ry * 0.42, rx * 0.38, ry * 0.3, lighten(r.body, 34));
    disc(g, cx + rx * 0.46, bodyCy - ry * 0.52, rx * 0.13, ry * 0.11, lighten(r.body, 70));
  }

  // ---- motifs sur le corps (taches / rayures) ----
  if (r.pattern === 'spots') {
    const sp = lighten(r.body, -30);
    disc(g, cx - rx * 0.3, bodyCy - ry * 0.1, rx * 0.16, ry * 0.14, sp);
    disc(g, cx + rx * 0.15, bodyCy + ry * 0.35, rx * 0.14, ry * 0.12, sp);
    disc(g, cx + rx * 0.42, bodyCy - ry * 0.15, rx * 0.12, ry * 0.11, sp);
    disc(g, cx - rx * 0.05, bodyCy + ry * 0.05, rx * 0.1, ry * 0.09, sp);
  } else if (r.pattern === 'stripes') {
    const st = lighten(r.body, -30);
    for (let i = -1; i <= 2; i++) {
      const sx = cx + i * rx * 0.35;
      disc(g, sx, bodyCy - ry * 0.1, rx * 0.06, ry * 0.62, st);
    }
  }

  // ---- bras : arrière (gauche, plus petit) + avant (droite) ----
  if (r.arms) {
    disc(g, cx - rx * 0.78, bodyCy + ry * 0.35, rx * 0.16, ry * 0.34, lighten(r.body, -14));
    disc(g, cx - rx * 0.8, bodyCy + ry * 0.78, rx * 0.14, ry * 0.16, lighten(r.body, -8)); // main arrière
    disc(g, cx + rx * 0.86, bodyCy + ry * 0.3, rx * 0.18, ry * 0.38, r.body);
    disc(g, cx + rx * 0.9, bodyCy + ry * 0.78, rx * 0.16, ry * 0.18, lighten(r.body, 6));   // main avant
  }

  // ================= dessus / devant =================
  if (r.feature === 'ears') {
    if (r.earStyle === 'long') {
      // grandes oreilles pointues (gobelin / lutin) qui partent sur les côtés
      tri(g, cx - rx * 0.75, bodyCy - ry * 0.9, cx - rx * 1.6, bodyCy - ry * 1.2, cx - rx * 0.35, bodyCy - ry * 0.5, r.body);
      tri(g, cx + rx * 0.6, bodyCy - ry * 0.9, cx + rx * 1.55, bodyCy - ry * 1.35, cx + rx * 0.25, bodyCy - ry * 0.5, r.body);
      disc(g, cx - rx * 1.15, bodyCy - ry * 1.02, rx * 0.1, ry * 0.12, lighten(r.body, 18));
      disc(g, cx + rx * 1.12, bodyCy - ry * 1.12, rx * 0.11, ry * 0.13, lighten(r.body, 24));
    } else {
      // oreille arrière (gauche) plus petite, oreille avant (droite) plus haute
      tri(g, cx - rx * 0.85, bodyCy - ry * 0.7, cx - rx * 1.0, bodyCy - ry * 1.45, cx - rx * 0.25, bodyCy - ry, r.body);
      tri(g, cx + rx * 0.7, bodyCy - ry * 0.7, cx + rx * 1.05, bodyCy - ry * 1.75, cx + rx * 0.15, bodyCy - ry, r.body);
    }
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
  if (r.feature === 'skull') {
    // dôme crânien osseux + cavité nasale près du museau (identité squelette)
    disc(g, cx + rx * 0.05, bodyCy - ry * 0.5, rx * 0.92, ry * 0.72, lighten(r.body, 22));
    disc(g, cx + rx * 0.5, bodyCy + ry * 0.12, Math.max(0.9, rx * 0.12), Math.max(0.9, ry * 0.14), r.outline);
  }

  // ================= pieds (avant/droite plus bas et avancé) =================
  if (hasFeet) {
    disc(g, cx - rx * 0.42, H - 3.2, rx * 0.28, ry * 0.19, lighten(r.body, -14)); // pied arrière (gauche)
    disc(g, cx + rx * 0.58, H - 2.2, rx * 0.32, ry * 0.22, r.body);                // pied avant (droite)
  }

  // ---- contour (avant les yeux pour ne pas les cercler) ----
  outlinePass(g, r.outline);

  // ================= bouche / mâchoire caractéristique =================
  if (r.mouth) {
    const mox = cx + rx * (r.snout ? 1.02 : 0.5);
    const moy = bodyCy + ry * 0.42;
    const mw = rx * (r.mouth === 'wide' || r.mouth === 'maw' ? 0.7 : 0.42);
    const tooth = '#f6f1e4';
    if (r.mouth === 'beak') {
      tri(g, mox - rx * 0.12, moy - ry * 0.18, mox + rx * 0.62, moy + ry * 0.02, mox - rx * 0.12, moy + ry * 0.18, r.accent);
      tri(g, mox - rx * 0.12, moy + ry * 0.03, mox + rx * 0.44, moy + ry * 0.06, mox - rx * 0.12, moy + ry * 0.2, lighten(r.accent, -34));
    } else if (r.mouth === 'wide') {
      disc(g, mox - rx * 0.18, moy, mw, ry * 0.15, r.outline);
      disc(g, mox - rx * 0.18, moy - ry * 0.12, mw * 0.92, ry * 0.12, r.belly ?? r.body); // croissant (sourire)
    } else if (r.mouth === 'maw') {
      disc(g, mox - rx * 0.05, moy + ry * 0.04, mw, ry * 0.32, r.outline);
      disc(g, mox - rx * 0.05, moy + ry * 0.08, mw * 0.6, ry * 0.17, lighten(r.outline, 34));
      for (let k = -1; k <= 1; k++) tri(g, mox + k * mw * 0.5 - 1, moy - ry * 0.14, mox + k * mw * 0.5, moy + ry * 0.06, mox + k * mw * 0.5 + 1, moy - ry * 0.14, tooth);
    } else {
      rect(g, Math.round(mox - mw), Math.round(moy), Math.round(mox + mw * 0.4), Math.round(moy), r.outline); // ligne de bouche
      if (r.mouth === 'fangs') {
        tri(g, mox - mw * 0.5, moy, mox - mw * 0.25, moy + ry * 0.24, mox - mw * 0.02, moy, tooth);
        tri(g, mox + mw * 0.02, moy, mox + mw * 0.22, moy + ry * 0.22, mox + mw * 0.4, moy, tooth);
      } else if (r.mouth === 'grin') {
        for (let k = 0; k < 4; k++) { const gx = Math.round(mox - mw + k * (mw * 1.4 / 3)); rect(g, gx, Math.round(moy), gx, Math.round(moy + ry * 0.13), tooth); }
      } else if (r.mouth === 'tusks') {
        tri(g, mox - mw * 0.4, moy, mox - mw * 0.62, moy - ry * 0.3, mox - mw * 0.18, moy, tooth);
        tri(g, mox + mw * 0.18, moy, mox + mw * 0.02, moy - ry * 0.3, mox + mw * 0.4, moy, tooth);
      }
    }
  }

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

  render(scene, key, g, CRITTER_DETAIL);
}

/**
 * Recettes des monstres, regroupées par thème de zone (couleurs cohérentes,
 * ambiance sombre façon Dead Cells, yeux lumineux).
 */
export const MONSTER_RECIPES: Record<string, Recipe> = {
  // -- Forêt : émeraude / mousse, yeux turquoise --
  slime: { w: 18, h: 16, body: '#3fae63', belly: '#6fd68f', outline: '#0f2418', eye: 'glow', eyeColor: '#bff7f6', feature: 'none', accent: '#2a8a4e', mouth: 'wide' },
  champignon: { w: 18, h: 18, body: '#d8cba8', belly: '#efe6cf', outline: '#2a2014', eye: 'normal', eyeColor: '#fff', feature: 'mushroom', accent: '#a83a34', mouth: 'wide' },
  chauvesouris: { w: 20, h: 15, body: '#2f4a52', outline: '#0e1c20', eye: 'glow', eyeColor: '#59d9a0', feature: 'wings', accent: '#1e343a', wingStyle: 'membrane', mouth: 'fangs' },
  // -- Marais : vert acide toxique --
  gobelin: { w: 18, h: 18, body: '#6a9a3f', belly: '#9fd04a', outline: '#1a2810', eye: 'angry', eyeColor: '#dfff9a', feature: 'ears', accent: '#4a6a2a', earStyle: 'long', arms: true, mouth: 'grin' },
  crapaud: { w: 20, h: 16, body: '#4f7a3a', belly: '#b8d97a', outline: '#16240e', eye: 'glow', eyeColor: '#dfff9a', feature: 'none', accent: '#33591f', mouth: 'wide', pattern: 'spots' },
  bulle: { w: 18, h: 17, body: '#7aa83f', belly: '#c9f07a', outline: '#1e2a10', eye: 'normal', eyeColor: '#fff', feature: 'none', accent: '#557a2a', mouth: 'wide' },
  // -- Forge : charbon + braise orangée --
  diablotin: { w: 17, h: 18, body: '#8a2a20', belly: '#e05a2a', outline: '#200a08', eye: 'glow', eyeColor: '#ffd24a', feature: 'horns', accent: '#ff6a1f', mouth: 'fangs', tail: 'forked', arms: true },
  chienlave: { w: 20, h: 16, body: '#221614', belly: '#ff6a1f', outline: '#0e0705', eye: 'glow', eyeColor: '#ffb020', feature: 'spikes', accent: '#ff5522', snout: true, mouth: 'fangs', tail: 'tuft' },
  armure: { w: 18, h: 20, body: '#4a5058', belly: '#6a727e', outline: '#12161a', eye: 'glow', eyeColor: '#ff9a3a', feature: 'spikes', accent: '#ff7a2a', arms: true },
  // -- Citadelle : pierre bleu-nuit + spectres violets, accents chauds --
  fantome: { w: 18, h: 18, body: '#aeb8d6', outline: '#3a4258', eye: 'glow', eyeColor: '#bff7f6', feature: 'ghost', accent: '#8a94b8', mouth: 'wide' },
  squelette: { w: 18, h: 20, body: '#dcd8c8', belly: '#b8b2a0', outline: '#2a2820', eye: 'glow', eyeColor: '#f2a53a', feature: 'skull', accent: '#7a8290', mouth: 'grin', arms: true },
  sorcier: { w: 18, h: 20, body: '#3a2c5a', belly: '#5a4a7a', outline: '#160f28', eye: 'glow', eyeColor: '#c78aff', feature: 'hat', accent: '#8a5cff', arms: true },
  // rôles de soutien
  fee: { w: 15, h: 15, body: '#cdeaa8', belly: '#f2fbe0', outline: '#2a3a1a', eye: 'glow', eyeColor: '#bff7f6', feature: 'wings', accent: '#eaffc0' },
  bombardier: { w: 20, h: 17, body: '#5a7a3a', belly: '#9fd04a', outline: '#16240e', eye: 'angry', eyeColor: '#dfff9a', feature: 'none', accent: '#3a5a24', mouth: 'wide', pattern: 'spots' },
  gardien: { w: 18, h: 20, body: '#5a4038', belly: '#8a5a3a', outline: '#160d0a', eye: 'glow', eyeColor: '#ff9a3a', feature: 'spikes', accent: '#ff7a2a', arms: true },
  // bestiaire créatif
  loup: { w: 22, h: 15, body: '#5a5560', belly: '#8a8490', outline: '#161318', eye: 'angry', eyeColor: '#ffd24a', feature: 'ears', accent: '#3a3640', snout: true, mouth: 'fangs', tail: 'tuft' },
  archer: { w: 17, h: 20, body: '#3a4a58', belly: '#5a6a78', outline: '#12181e', eye: 'glow', eyeColor: '#bff7f6', feature: 'ears', accent: '#c78aff', arms: true },
  drake: { w: 22, h: 18, body: '#7a2a20', belly: '#e0603a', outline: '#200a08', eye: 'glow', eyeColor: '#ffd24a', feature: 'horns', accent: '#ff6a1f', snout: true, mouth: 'fangs' },
  // adds de boss
  druide: { w: 16, h: 19, body: '#3a5a3a', belly: '#7aae5a', outline: '#12200e', eye: 'glow', eyeColor: '#dfffa0', feature: 'hat', accent: '#9ee06a', arms: true },
  bebeserpent: { w: 14, h: 13, body: '#7a2a14', belly: '#ff8a3a', outline: '#1a0a05', eye: 'glow', eyeColor: '#ffd24a', feature: 'spikes', accent: '#ff5522', snout: true, mouth: 'fangs', feet: false, tail: 'none' },
  zombie: { w: 17, h: 19, body: '#5a6a4a', belly: '#7a8a5a', outline: '#161d10', eye: 'glow', eyeColor: '#9ee06a', feature: 'none', accent: '#3a4a2a', arms: true, mouth: 'grin' },
  araigneemini: { w: 16, h: 13, body: '#3a2c5a', belly: '#5a4a7a', outline: '#140f24', eye: 'glow', eyeColor: '#c78aff', feature: 'spider', accent: '#8a5cff' },
  minigorbak: { w: 18, h: 18, body: '#5f8a34', belly: '#b8d97a', outline: '#16240e', eye: 'angry', eyeColor: '#dfff9a', feature: 'horns', accent: '#3a5a24', arms: true, mouth: 'grin' },

  // ==================================================================
  //  Monde 5 — Abysses de Givre (bleus glaciers, blancs, cyan)
  // ==================================================================
  yeti: { w: 24, h: 22, body: '#dce8f0', belly: '#9fc0d8', outline: '#1a2634', eye: 'angry', eyeColor: '#7fdcff', feature: 'spikes', accent: '#b8d4e8', arms: true, mouth: 'fangs' },
  spectregivre: { w: 18, h: 18, body: '#bfd8e8', outline: '#2a3a4a', eye: 'glow', eyeColor: '#7fdcff', feature: 'ghost', accent: '#8fb8d8', mouth: 'wide' },
  stalactite: { w: 16, h: 20, body: '#9fd0e8', belly: '#cfeaf8', outline: '#1e3644', eye: 'glow', eyeColor: '#e8f8ff', feature: 'spikes', accent: '#6ab0d8' },
  pingouin: { w: 18, h: 18, body: '#1c2430', belly: '#f0f4f8', outline: '#0a0e14', eye: 'glow', eyeColor: '#ffd24a', feature: 'none', accent: '#ffa53a', mouth: 'beak' },
  sculpteur: { w: 17, h: 21, body: '#d8e8f4', belly: '#b0cce0', outline: '#2a3e4e', eye: 'glow', eyeColor: '#7fdcff', feature: 'hat', accent: '#9fd0e8', arms: true },
  sorciereblizzard: { w: 18, h: 21, body: '#2a3a50', belly: '#3a4e68', outline: '#101824', eye: 'glow', eyeColor: '#7fdcff', feature: 'hat', accent: '#cfe8ff', arms: true },
  brochet: { w: 24, h: 15, body: '#3a5a6a', belly: '#7fb0c8', outline: '#122430', eye: 'angry', eyeColor: '#e8f8ff', feature: 'spikes', accent: '#9fd0e8', snout: true, mouth: 'fangs', tail: 'fin', feet: false },

  // ==================================================================
  //  Monde 6 — Nécropole Céleste (or terni, marbre nocturne, éclair)
  // ==================================================================
  harpie: { w: 22, h: 18, body: '#3a3a5a', belly: '#5a5a7a', outline: '#141428', eye: 'angry', eyeColor: '#ffe08a', feature: 'wings', accent: '#ffe08a', arms: true, mouth: 'beak' },
  nuagetonnerre: { w: 20, h: 16, body: '#2a2a3f', belly: '#5a5a7a', outline: '#101018', eye: 'glow', eyeColor: '#b0c8ff', feature: 'none', accent: '#8a9aff' },
  djinn: { w: 19, h: 20, body: '#4a4a6a', belly: '#6a6a8a', outline: '#161624', eye: 'glow', eyeColor: '#ffe08a', feature: 'crown', accent: '#b0c8ff', arms: true },
  chevalierceleste: { w: 18, h: 21, body: '#8a7a4a', belly: '#b0a068', outline: '#241e10', eye: 'glow', eyeColor: '#ffe08a', feature: 'horns', accent: '#ffe08a', arms: true },
  idole: { w: 20, h: 22, body: '#2a2a3a', belly: '#3a3a52', outline: '#0e0e18', eye: 'glow', eyeColor: '#59b8ff', feature: 'crown', accent: '#ffe08a' },
  oiseauplasma: { w: 20, h: 15, body: '#b0c8ff', belly: '#e8f0ff', outline: '#4a5a8a', eye: 'glow', eyeColor: '#ffffff', feature: 'wings', accent: '#ffffff', mouth: 'beak' },
  porteursarco: { w: 22, h: 20, body: '#3a3a5a', belly: '#ffe08a', outline: '#141428', eye: 'glow', eyeColor: '#b0c8ff', feature: 'wings', accent: '#ffe08a', arms: true },
  momie: { w: 15, h: 17, body: '#c9b878', belly: '#e8dca8', outline: '#2a2410', eye: 'glow', eyeColor: '#b0c8ff', feature: 'none', accent: '#8a9aff', arms: true },

  // ==================================================================
  //  Monde 7 — Faille du Néant (magenta du néant, cyan froid, obsidienne)
  // ==================================================================
  oeilneant: { w: 20, h: 18, body: '#0c0a16', belly: '#1a1428', outline: '#040209', eye: 'glow', eyeColor: '#d05aff', feature: 'none', accent: '#d05aff' },
  golemstellaire: { w: 22, h: 22, body: '#1c1830', belly: '#2a2444', outline: '#0a0812', eye: 'glow', eyeColor: '#59d9ff', feature: 'spikes', accent: '#d05aff', arms: true },
  doppelchat: { w: 18, h: 18, body: '#14101f', belly: '#241c34', outline: '#d05aff', eye: 'glow', eyeColor: '#ffffff', feature: 'ears', accent: '#d05aff', tail: 'plain' },
  mangeurames: { w: 20, h: 17, body: '#1c1428', belly: '#3a2c50', outline: '#0a0612', eye: 'angry', eyeColor: '#7fff9a', feature: 'none', accent: '#d05aff', mouth: 'maw' },
  faucheurdim: { w: 18, h: 20, body: '#0c0a16', outline: '#2a1440', eye: 'glow', eyeColor: '#d05aff', feature: 'ghost', accent: '#d05aff', mouth: 'maw' },
  etoilenaine: { w: 16, h: 16, body: '#ffffff', belly: '#ffe8ff', outline: '#7a2ab0', eye: 'glow', eyeColor: '#d05aff', feature: 'spikes', accent: '#d05aff' },
  larvechaos: { w: 19, h: 16, body: '#14101f', belly: '#3a2c50', outline: '#080510', eye: 'glow', eyeColor: '#d05aff', feature: 'none', accent: '#59d9ff', mouth: 'maw', pattern: 'stripes' },
};
