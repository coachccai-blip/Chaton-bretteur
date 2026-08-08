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

type RNG = () => number;
function seeded(seed: number): RNG {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}
function hex(c: number): string { return '#' + (c >>> 0).toString(16).padStart(6, '0'); }

/** Sol thématique par zone (herbe, boue, roche, dalles) — sans grille visible. */
export function genFloorThemed(scene: Phaser.Scene, zoneId: string, base: number, alt: number, size = 256): void {
  const key = `floor_${zoneId}`;
  canvasTex(scene, key, size, size, (ctx) => {
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = hex(base); ctx.fillRect(0, 0, size, size);
    const rnd = seeded(base ^ 0x51ed);
    // nuages doux communs
    for (let i = 0; i < 22; i++) {
      const x = rnd() * size, y = rnd() * size, r = 40 + rnd() * 90;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const lighter = rnd() > 0.5;
      g.addColorStop(0, lighter ? hex(alt) : '#000000');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = lighter ? 0.1 : 0.08; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (zoneId === 'foret') {
      // touffes d'herbe + terre
      for (let i = 0; i < 120; i++) {
        const x = rnd() * size, y = rnd() * size;
        ctx.strokeStyle = rnd() > 0.5 ? hex(alt + 0x0a1a0a) : hex(base + 0x081008);
        ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 4, y - 3 - rnd() * 3); ctx.stroke();
      }
      for (let i = 0; i < 8; i++) { const x = rnd() * size, y = rnd() * size; ctx.fillStyle = 'rgba(60,40,20,0.18)'; ctx.beginPath(); ctx.ellipse(x, y, 14 + rnd() * 16, 8 + rnd() * 10, rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
    } else if (zoneId === 'marais') {
      // flaques / ondulations d'eau
      for (let i = 0; i < 10; i++) { const x = rnd() * size, y = rnd() * size; ctx.strokeStyle = 'rgba(120,160,110,0.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 16 + rnd() * 24, 8 + rnd() * 12, 0, 0, Math.PI * 2); ctx.stroke(); }
      for (let i = 0; i < 6; i++) { const x = rnd() * size, y = rnd() * size; ctx.fillStyle = 'rgba(20,40,20,0.25)'; ctx.beginPath(); ctx.arc(x, y, 8 + rnd() * 12, 0, Math.PI * 2); ctx.fill(); }
    } else if (zoneId === 'forge') {
      // fissures de lave incandescentes
      for (let i = 0; i < 7; i++) {
        let x = rnd() * size, y = rnd() * size;
        ctx.strokeStyle = 'rgba(255,110,30,0.55)'; ctx.lineWidth = 1 + rnd() * 2; ctx.beginPath(); ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,200,90,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      }
      for (let i = 0; i < 40; i++) { const x = rnd() * size, y = rnd() * size; ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 3); }
    } else {
      // citadelle : grandes dalles subtiles
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      for (let g = 0; g <= size; g += 64) { ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, size); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, g); ctx.lineTo(size, g); ctx.stroke(); }
      for (let i = 0; i < 30; i++) { const x = rnd() * size, y = rnd() * size; ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fillRect(x, y, 3, 3); }
    }
    ctx.globalAlpha = 1;
  });
}

/** Mur/obstacle thématique par zone (bois, roche moussue, obsidienne, brique). */
export function genWallThemed(scene: Phaser.Scene, zoneId: string, base: number, size = 48): void {
  const key = `wall_${zoneId}`;
  canvasTex(scene, key, size, size, (ctx) => {
    ctx.imageSmoothingEnabled = false;
    const rnd = seeded(base ^ 0x1abc);
    ctx.fillStyle = hex(base); ctx.fillRect(0, 0, size, size);
    if (zoneId === 'foret') {
      // écorce verticale + mousse
      for (let x = 0; x < size; x += 6) { ctx.fillStyle = rnd() > 0.5 ? hex(base + 0x0a0805) : hex(base - 0x080604); ctx.fillRect(x, 0, 5, size); }
      ctx.fillStyle = 'rgba(60,120,60,0.5)'; ctx.fillRect(0, 0, size, 8);
      ctx.fillStyle = 'rgba(80,160,80,0.35)'; for (let i = 0; i < 10; i++) ctx.fillRect(rnd() * size, rnd() * size, 4, 4);
    } else if (zoneId === 'marais') {
      ctx.fillStyle = hex(base - 0x060806); ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = rnd() > 0.5 ? 'rgba(50,90,50,0.4)' : 'rgba(0,0,0,0.25)'; ctx.fillRect(rnd() * size, rnd() * size, 3 + rnd() * 4, 3 + rnd() * 4); }
      ctx.fillStyle = 'rgba(70,130,70,0.45)'; ctx.fillRect(0, 0, size, 6);
    } else if (zoneId === 'forge') {
      // obsidienne + veines de lave
      ctx.fillStyle = hex(base - 0x060402); ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(rnd() * size, rnd() * size, 3, 3); }
      ctx.strokeStyle = 'rgba(255,110,30,0.7)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { let x = rnd() * size, y = 0; ctx.beginPath(); ctx.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 14; y += size / 4; ctx.lineTo(x, y); } ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,90,20,0.5)'; ctx.fillRect(0, 0, size, 3);
    } else {
      // brique (citadelle)
      const top = hex(base + 0x282828), dark = hex(base - 0x181818);
      ctx.strokeStyle = dark; ctx.lineWidth = 2; const bh = 16;
      for (let y = 0; y < size; y += bh) {
        const off = (Math.floor(y / bh) % 2) * (size / 4);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
        for (let x = 0; x < size; x += size / 2) { ctx.beginPath(); ctx.moveTo(x + off, y); ctx.lineTo(x + off, y + bh); ctx.stroke(); }
      }
      ctx.fillStyle = top; ctx.fillRect(0, 0, size, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(0, 0, size, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, size - 4, size, 4);
    }
  });
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

/**
 * Mine anti-personnel (13x13) : sphère métallique hérissée de pointes avec un
 * cœur rouge lumineux. Posée sur les zones dangereuses au sol pour signaler
 * clairement le danger (le clignotement rouge est géré au rendu).
 */
export const MINE: SpriteDef = {
  key: 'mine',
  pal: {
    '.': null, '#': '#0a0c10', 'k': '#2a3038', 'm': '#454e58', 'w': '#6a7480',
    'r': '#ff2a2a', 'R': '#ff9a7a', 'y': '#ffe08a',
  },
  rows: [
    '......#......',
    '.....#k#.....',
    '..#..kkk..#..',
    '...#kmmmk#...',
    '..kkmmwmmkk..',
    '.#kmmwrwmmk#.',
    '#kmmwrRrwmmk#',
    '.#kmmwrwmmk#.',
    '..kkmmwmmkk..',
    '...#kmmmk#...',
    '..#..kkk..#..',
    '.....#k#.....',
    '......#......',
  ],
};

/**
 * Flamme noire d'Amaterasu (10x14) : corps noir-violacé, liseré violet cursed.
 * Superposée en boucle scintillante sur les monstres qui brûlent (Brûlure Noire).
 */
export const BLACK_FLAME: SpriteDef = {
  key: 'black_flame',
  pal: {
    '.': null, '#': '#050208', 'k': '#12081a', 'p': '#241033', 'v': '#4a1a5a',
  },
  rows: [
    '....##....',
    '....kk....',
    '...#kk#...',
    '...pkkp...',
    '..#pkkp#..',
    '..pkkkkp..',
    '.#pkkkkp#.',
    '.pkkkkkkp.',
    '.pkkkkkkp.',
    '#pkkkkkkp#',
    '#pvkkkkvp#',
    '.pvkkkkvp.',
    '.#vpkkpv#.',
    '..#vvvv#..',
  ],
};

/** Boule de feu (12x12) crachée par Ignis : cœur blanc incandescent, couronne rouge. */
export const FIREBALL: SpriteDef = {
  key: 'fireball',
  pal: {
    '.': null, '#': '#5a1400', 'r': '#d43410', 'o': '#ff7a1f', 'y': '#ffc24a', 'w': '#fff2c0',
  },
  rows: [
    '....####....',
    '..#rrrrrr#..',
    '.#rroooorr#.',
    '#roooooooor#',
    '#rooyyyyoor#',
    '#royywwyyor#',
    '#royywwyyor#',
    '#rooyyyyoor#',
    '#roooooooor#',
    '.#rroooorr#.',
    '..#rrrrrr#..',
    '....####....',
  ],
};

/** Boomerang (12x12) : lame recourbée du boon Lame Boomerang (aller-retour). */
export const BOOMERANG: SpriteDef = {
  key: 'boomerang',
  pal: { '.': null, '#': '#3a2408', 'W': '#c98f3a', 'y': '#f4d98a' },
  rows: [
    '.....###....',
    '....#yWW#...',
    '....#WWy#...',
    '....#WyW#...',
    '...#Wy#Wy#..',
    '...#yW#yW#..',
    '..#yW#.#Wy#.',
    '..#WW#.#yW#.',
    '.#WW#...#Wy#',
    '.#Wy#...#yW#',
    '#Wy#.....#Wy',
    '.##.......##',
  ],
};

/** Patte de chat (12x12) : projectile du boon Poing Pistolet (patte projetée). */
export const CAT_PAW: SpriteDef = {
  key: 'cat_paw',
  pal: { '.': null, '#': '#3a1a20', 'p': '#e88aa0', 'P': '#ffb0c0', 'w': '#ffe0e8' },
  rows: [
    '...#######..',
    '####PP#PP##.',
    '#PPPPPPPPP##',
    '#PPPPP#PPPPP',
    '#PPP#####PPP',
    '#PP#######PP',
    '###PPwPPP###',
    '.##PPwwPP##.',
    '.#PPPPPPPP#.',
    '.##PPPPPP##.',
    '..#pppppp#..',
    '..########..',
  ],
};

/** Glob de boue (10x10) : projectile craché par Gorbak et les mini-gorbaks. */
export const MUD_BLOB: SpriteDef = {
  key: 'mud_blob',
  pal: {
    '.': null, '#': '#2a1c0a', 'm': '#6a4a22', 'M': '#8a6a34', 'g': '#7a8a3a', 'h': '#a7c24a', 'w': '#c9e07a',
  },
  rows: [
    '...####...',
    '..#mMhg#..',
    '.#mMMwgh#.',
    '#mmMMhggh#',
    '#mMMMwgggM',
    '#mmMMhgggM',
    '#mmmMgggM#',
    '.#mmMggh#.',
    '..#mmgg#..',
    '...####...',
  ],
};

/** Éclaboussure de boue (6x6) : particule du crachat en cône. */
export const MUD_SPLAT: SpriteDef = {
  key: 'mud_splat',
  pal: { '.': null, '#': '#2a1c0a', 'm': '#6a4a22', 'g': '#7a8a3a', 'h': '#a7c24a' },
  rows: [
    '..##..',
    '.#mh#.',
    '#mggh#',
    '#gmmg#',
    '.#mm#.',
    '..##..',
  ],
};

/** Tornade (12x15) : projectile en entonnoir du boon Dernier Souffle. */
export const TORNADO: SpriteDef = {
  key: 'tornado',
  pal: { '.': null, 'b': '#4a86a8', 'c': '#9fd6f0', 'w': '#ffffff' },
  rows: [
    'bcwbcwbcwbcw',
    'wcbwcbwcbwcb',
    '.cbwcbwcbwc.',
    '.wbcwbcwbcw.',
    '.bcwbcwbcwb.',
    '..cbwcbwcb..',
    '..wbcwbcwb..',
    '..bcwbcwbc..',
    '...cbwcbw...',
    '...wbcwbc...',
    '...bcwbcw...',
    '....cbwc....',
    '....wbcw....',
    '.....bc.....',
    '.....wc.....',
  ],
};

/** Tornade de feu (14x18) : grosse attaque télégraphiée d'Ignis, traverse la map. */
export const FIRE_TORNADO: SpriteDef = {
  key: 'fire_tornado',
  pal: { '.': null, 'r': '#7a1e08', 'o': '#ff5a1f', 'y': '#ffb020', 'w': '#fff2c0' },
  rows: [
    'rywroyoywroyor',
    'rroyoywroyoywr',
    'ryoywroyoywror',
    '.rywroyoywror.',
    '.rroyoywroyor.',
    '.ryoywroyoywr.',
    '..rywroyoywr..',
    '..rroyoywror..',
    '..ryoywroyor..',
    '...rywroyor...',
    '...rroyoywr...',
    '...ryoywror...',
    '....rywror....',
    '....rroyor....',
    '....ryoywr....',
    '.....rywr.....',
    '.....rror.....',
    '......rr......',
  ],
};

/** Bloc de glace (10x10) : projectile cristallin tiré par les monstres de givre. */
export const ICE_SHARD: SpriteDef = {
  key: 'ice_shard',
  pal: {
    '.': null, '#': '#0a2438', 'b': '#2a6a9a', 'B': '#59b8e8', 'c': '#bfeaff', 'w': '#ffffff',
  },
  rows: [
    '...####...',
    '..#BccB#..',
    '.#BcwccB#.',
    '#BccwccbB#',
    '#Bcwccccb#',
    '#Bccccwcb#',
    '#BbccccbB#',
    '.#Bbccbb#.',
    '..#Bbbb#..',
    '...####...',
  ],
};

/** Éclat de givre (6x6) : particule de la nappe de glace en cône. */
export const FROST: SpriteDef = {
  key: 'frost',
  pal: { '.': null, '#': '#1a4a6a', 'B': '#7fdcff', 'c': '#dff6ff' },
  rows: [
    '..##..',
    '.#BB#.',
    '#BccB#',
    '#BccB#',
    '.#BB#.',
    '..##..',
  ],
};

/** Stalactite de glace (10x16) qui tombe du ciel — pointe vers le bas. */
export const ICE_STALACTITE: SpriteDef = {
  key: 'ice_stalactite',
  pal: {
    '.': null, '#': '#0a2438', 'b': '#2a6a9a', 'B': '#59b8e8', 'c': '#bfeaff', 'w': '#ffffff',
  },
  rows: [
    '#BBBBBBBB#',
    '#BccccccB#',
    '#BcwwcccB#',
    '.#BccccB#.',
    '.#BcwccB#.',
    '.#BccccB#.',
    '..#BccB#..',
    '..#BcwB#..',
    '..#BccB#..',
    '...#BB#...',
    '...#cB#...',
    '....##....',
    '....##....',
    '....#c....',
    '....#.....',
    '..........',
  ],
};

/** Pilône de glace (12x22) : totem invoqué par Glacior, cœur luisant à briser. */
export const ICE_PYLON: SpriteDef = {
  key: 'ice_pylon',
  pal: {
    '.': null, '#': '#0a2438', 'k': '#123a54', 'b': '#2a6a9a', 'B': '#59b8e8',
    'c': '#bfeaff', 'w': '#ffffff', 'e': '#9fe8ff',
  },
  rows: [
    '.....##.....',
    '....#cc#....',
    '....#cc#....',
    '...#BccB#...',
    '...#BccB#...',
    '..#BcwwcB#..',
    '..#BceecB#..',
    '..#BceecB#..',
    '..#BcwwcB#..',
    '.#BbccccbB#.',
    '.#BbceecbB#.',
    '.#BbceecbB#.',
    '.#BbccccbB#.',
    '#BbccccccbB#',
    '#BbcceeccbB#',
    '#BbcceeccbB#',
    '#BbccccccbB#',
    '#BbbccccbbB#',
    '#kBBbbbbBBk#',
    '#kkBBBBBBkk#',
    '.#kkkkkkkk#.',
    '..########..',
  ],
};

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
