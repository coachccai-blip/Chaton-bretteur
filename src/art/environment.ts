import Phaser from 'phaser';
import { ART_CELL, genSprite, type SpriteDef } from './PixelArtGenerator';

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  tex.refresh();
}

/** Halo radial doux (lumière additive). */
export function genRadialLight(scene: Phaser.Scene, key: string, color: string, size = 256): void {
  canvasTex(scene, key, size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, color);
    g.addColorStop(0.5, color.replace('1)', '0.35)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Vignette (bords sombres, centre transparent). */
export function genVignette(scene: Phaser.Scene, key: string, w = 960, h = 540): void {
  canvasTex(scene, key, w, h, (ctx) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.85);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** Ombre portée molle (ellipse dégradée) à poser sous les entités. */
export function genSoftShadow(scene: Phaser.Scene, key = 'shadow', w = 64, h = 32): void {
  canvasTex(scene, key, w, h, (ctx) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Tuile de mur en relief (face avant + arête supérieure éclairée). */
export function genWallTile(scene: Phaser.Scene, key: string, top: number, face: number, dark: number, size = 48): void {
  const topHex = '#' + top.toString(16).padStart(6, '0');
  const faceHex = '#' + face.toString(16).padStart(6, '0');
  const darkHex = '#' + dark.toString(16).padStart(6, '0');
  canvasTex(scene, key, size, size, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    // face
    ctx.fillStyle = faceHex;
    ctx.fillRect(0, 0, size, size);
    // blocs de pierre
    let seed = top ^ 0x9e3779b1;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    ctx.strokeStyle = darkHex;
    ctx.lineWidth = 2;
    const bh = 16;
    for (let y = 0; y < size; y += bh) {
      const offset = (Math.floor(y / bh) % 2) * (size / 4);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      for (let x = 0; x < size; x += size / 2) {
        ctx.beginPath(); ctx.moveTo(x + offset, y); ctx.lineTo(x + offset, y + bh); ctx.stroke();
      }
      // ombrage aléatoire des blocs
      for (let x = 0; x < size; x += 8) {
        if (rnd() > 0.8) { ctx.fillStyle = darkHex; ctx.globalAlpha = 0.25; ctx.fillRect(x, y + 2, 8, bh - 2); ctx.globalAlpha = 1; }
      }
    }
    // arête supérieure éclairée (relief 3D)
    ctx.fillStyle = topHex;
    ctx.fillRect(0, 0, size, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, size, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, size - 4, size, 4);
  });
}

/** Décors non-collisionnants (props d'ambiance) — petits sprites par zone. */
export const PROPS: SpriteDef[] = [
  // Forêt : buisson + champignon lumineux
  { key: 'prop_bush', pal: { '.': null, '#': '#123018', 'g': '#2f6a37', 'G': '#3f8a48', 'l': '#6ad46a' },
    rows: ['..gg..gg..', '.gGgggGGg.', 'gGGglgGGGg', 'gGGGGGGGGg', '#gGGGGGGg#', '.#gggggg#.', '..#....#..'] },
  { key: 'prop_glowshroom', pal: { '.': null, '#': '#2a1a3a', 'p': '#b26bff', 'P': '#d9a8ff', 'w': '#e8d9b0' },
    rows: ['..pPPp..', '.pPPPPp.', 'pPP##PPp', '#pPPPPp#', '..#ww#..', '..#ww#..', '..wwww..'] },
  // Marais : roseaux + nénuphar
  { key: 'prop_reed', pal: { '.': null, '#': '#1a2810', 'g': '#4a6a2a', 'G': '#6a8a3a' },
    rows: ['..G..G..', '.G#.G#..', 'G#.G#.G.', '#.G#.#G.', '.G#.#.#.', '.#.#.#..', '..#.#...'] },
  // Forge : cristal de braise + enclume
  { key: 'prop_ember', pal: { '.': null, '#': '#3a1408', 'o': '#ff6a1f', 'O': '#ffb020', 'y': '#ffe08a' },
    rows: ['...y....', '..yO....', '.yOo#...', 'yOoo#...', '#ooo#...', '.#oo#...', '..##....'] },
  // Citadelle : bougie / crâne
  { key: 'prop_candle', pal: { '.': null, '#': '#20122a', 'w': '#e8d9b0', 'y': '#ffe08a', 'o': '#ff9a3a' },
    rows: ['...y....', '..yoy...', '..#w#...', '..#w#...', '..#w#...', '.#www#..', '.#####..'] },
  { key: 'prop_skull', pal: { '.': null, '#': '#2a2418', 'w': '#e6e2d4', 'W': '#f6f1e4', 'e': '#20122a' },
    rows: ['..WWWW..', '.WwwwwW.', 'WweWWeWw', 'WwwWWwwW', '.Ww##wW.', '..WwwW..', '..#..#..'] },
];

/** Décors d'ambiance placés délibérément (torches, bannières). */
export const DECOR: SpriteDef[] = [
  { key: 'deco_torch', pal: { '.': null, '#': '#100e0d', 'm': '#3a3a42', 'M': '#5a5a64', 'o': '#2a1a10', 'O': '#5a3a1e' },
    rows: ['..........', '...MMMM...', '..M####M..', '..MoOOoM..', '...####...', '....##....', '....##....', '...####...', '..M#..#M..', '.M#....#M.', '.#......#.'] },
  { key: 'deco_banner', pal: { '.': null, 'k': '#181818', 'C': '#c8c8c8', 'd': '#888888', 'W': '#eaeaea' },
    rows: [
      'kkkkkkkkkkkk', 'kCCCCCCCCCCk', 'kCCCCCCCCCCk', 'kCCdddddCCCk', 'kCCdWWWWdCCk',
      'kCCdWkkWdCCk', 'kCCdWWWWdCCk', 'kCCdWkkWdCCk', 'kCCdddddCCCk', 'kCCCCCCCCCCk',
      'kCCCCCCCCCCk', 'kdCCCCCCCCdk', '.kCCCCCCCCk.', '.kdCCCCCCdk.', '..kCCCCCCk..',
      '..kdCCCCdk..', '...kCCCCk...', '...kdCCdk...', '....kCCk....', '....kkkk....'] },
];

export function genProps(scene: Phaser.Scene): void {
  for (const p of PROPS) genSprite(scene, p, ART_CELL);
  for (const d of DECOR) genSprite(scene, d, ART_CELL);
}

/** Plaque de piège (sol métallique avec fentes). */
export function genTrapBase(scene: Phaser.Scene, key = 'trap_base', size = 56): void {
  canvasTex(scene, key, size, size, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#26262f'; ctx.fillRect(2, 2, size - 4, size - 4);
    ctx.fillStyle = '#3a3a46'; ctx.fillRect(4, 4, size - 8, size - 8);
    ctx.strokeStyle = '#15151c'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, size - 6, size - 6);
    // fentes sombres où sortent les pics
    ctx.fillStyle = '#101015';
    for (let i = 0; i < 3; i++) {
      const y = 12 + i * ((size - 24) / 2);
      ctx.fillRect(10, y, size - 20, 5);
    }
    // rivets
    ctx.fillStyle = '#55555f';
    [[8, 8], [size - 12, 8], [8, size - 12], [size - 12, size - 12]].forEach(([x, y]) => ctx.fillRect(x, y, 4, 4));
  });
}

/** Pics métalliques (état sorti). Origine en bas dans le jeu. */
export function genSpikes(scene: Phaser.Scene, key = 'trap_spikes', size = 56): void {
  const h = 44;
  canvasTex(scene, key, size, h, (ctx) => {
    const n = 4;
    const w = size / n;
    for (let i = 0; i < n; i++) {
      const x = i * w;
      ctx.fillStyle = '#8a90a0';
      ctx.beginPath(); ctx.moveTo(x + 2, h); ctx.lineTo(x + w / 2, 2); ctx.lineTo(x + w - 2, h); ctx.closePath(); ctx.fill();
      // reflet
      ctx.fillStyle = '#e8ecf4';
      ctx.beginPath(); ctx.moveTo(x + w / 2, 2); ctx.lineTo(x + w / 2 - 3, h - 2); ctx.lineTo(x + w / 2 + 1, h - 2); ctx.closePath(); ctx.fill();
      // ombre droite
      ctx.fillStyle = '#4a4e58';
      ctx.beginPath(); ctx.moveTo(x + w / 2, 2); ctx.lineTo(x + w - 2, h); ctx.lineTo(x + w / 2 + 4, h); ctx.closePath(); ctx.fill();
    }
  });
}

/** Bassin de lave/poison organique et lumineux. */
export function genPool(scene: Phaser.Scene, key: string, inner: string, mid: string, outer: string, crust: string, size = 112): void {
  canvasTex(scene, key, size, size, (ctx) => {
    const cx = size / 2, cy = size / 2;
    let seed = size ^ 0x1234;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    // contour blobby (croûte)
    ctx.beginPath();
    const pts = 16;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const r = size * 0.4 + (rnd() - 0.5) * size * 0.1;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = crust; ctx.fill();
    // intérieur dégradé
    ctx.save(); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.42);
    g.addColorStop(0, inner); g.addColorStop(0.4, mid); g.addColorStop(0.8, outer); g.addColorStop(1, crust);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
    // taches vives
    for (let i = 0; i < 6; i++) {
      const x = cx + (rnd() - 0.5) * size * 0.5, y = cy + (rnd() - 0.5) * size * 0.5;
      ctx.fillStyle = inner; ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(x, y, 3 + rnd() * 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  });
}
