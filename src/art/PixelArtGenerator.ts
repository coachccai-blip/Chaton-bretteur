import Phaser from 'phaser';

/** Un art pixel = un bloc de ART_CELL px dans la texture (rendu net via pixelArt). */
export const ART_CELL = 4;

/** Sprite multicolore : chaque caractère de `rows` renvoie à une couleur de `pal`. */
export interface SpriteDef {
  key: string;
  pal: Record<string, string | null>; // null = transparent
  rows: string[];
}

/** Masque monochrome (icônes) : 'X' opaque blanc, '.' transparent. Tinté à l'usage. */
export interface MaskDef {
  key: string;
  rows: string[];
}

function makeCanvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, Math.max(1, w), Math.max(1, h));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  draw(ctx);
  tex.refresh();
}

/** Génère une texture depuis un sprite grille multicolore. */
export function genSprite(scene: Phaser.Scene, def: SpriteDef, cell = ART_CELL): void {
  const h = def.rows.length;
  const w = def.rows[0]?.length ?? 0;
  makeCanvasTexture(scene, def.key, w * cell, h * cell, (ctx) => {
    for (let y = 0; y < h; y++) {
      const row = def.rows[y];
      for (let x = 0; x < row.length; x++) {
        const c = def.pal[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  });
}

/** Génère une texture blanche depuis un masque (à tinter ensuite). */
export function genMask(scene: Phaser.Scene, def: MaskDef, cell = 3): void {
  const h = def.rows.length;
  const w = def.rows[0]?.length ?? 0;
  makeCanvasTexture(scene, def.key, w * cell, h * cell, (ctx) => {
    ctx.fillStyle = '#ffffff';
    for (let y = 0; y < h; y++) {
      const row = def.rows[y];
      for (let x = 0; x < row.length; x++) {
        if (row[x] === 'X') ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  });
}

/** Petit orbe de projectile avec halo, tinté par couleur. */
export function genOrb(scene: Phaser.Scene, key: string, color: string, r = 6): void {
  const size = r * 2 + 4;
  makeCanvasTexture(scene, key, size, size, (ctx) => {
    const cx = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cx, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cx - r * 0.3, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Simple carré de particule blanche (tinté à l'usage). */
export function genPixel(scene: Phaser.Scene, key = 'px', s = 4): void {
  makeCanvasTexture(scene, key, s, s, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
  });
}

/**
 * Tuile de sol procédurale d'une zone : base + variations bruitées, bord sombre.
 * Déterministe (seedé) pour un rendu stable.
 */
export function genFloorTile(scene: Phaser.Scene, key: string, base: number, alt: number, size = 64): void {
  makeCanvasTexture(scene, key, size, size, (ctx) => {
    const baseHex = '#' + base.toString(16).padStart(6, '0');
    const altHex = '#' + alt.toString(16).padStart(6, '0');
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, size, size);
    // damier de blocs 8px avec bruit pseudo-aléatoire seedé
    let seed = base ^ (size * 2654435761);
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const b = 8;
    for (let y = 0; y < size; y += b) {
      for (let x = 0; x < size; x += b) {
        const r = rnd();
        if (r > 0.72) {
          ctx.fillStyle = altHex;
          ctx.fillRect(x, y, b, b);
        } else if (r > 0.62) {
          ctx.fillStyle = 'rgba(0,0,0,0.10)';
          ctx.fillRect(x, y, b, b);
        }
      }
    }
    // liseré sombre pour lecture de grille
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  });
}
