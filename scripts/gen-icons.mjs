// Génère les icônes PWA (PNG) à partir du pixel art du chaton — aucun asset requis.
// Encodage PNG maison via zlib (intégré à Node). Sortie -> public/.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
mkdirSync(OUT, { recursive: true });

// ---- pixel art du chaton (copie de src/art/hero.ts) ----
const PAL = {
  '.': null, '#': '#140d12', k: '#17131c',
  W: '#efe6d0', w: '#d6c8a8', m: '#c99a68',
  B: '#8a5a38', b: '#5c3a24',
  R: '#b83b2c', r: '#7c1f18', H: '#e0604a',
  G: '#c2c6d0', g: '#868c98',
  e: '#f2c23a', i: '#7a1f12',
};
const ROWS = [
  '......k.kk.k......', '.....kRkkkkRk.....', '....kRRkkkkRRk....', '...GgRRRRRRRRgG...',
  '..GGgWWWWWWWWgGG..', '..GgWmmmmmmmmWgG..', '..GgWmeWWWWemWgG..', '..GgWmmWiiWmmWgG..',
  '...ggWmmmmmmWgg...', '..RH#WWWWWWWW#HR..', '.HRr#RRRRRRRR#rRH.', '..rR#RWWWWWWR#Rr..',
  '..#b#RRWWWWRR#b#..', '...#BB#WWWW#BB#...', '...#Bb#....#bB#...', '...bBB#....#BBb...',
  '...#bb......bb#...', '..................',
];
const CW = ROWS[0].length, CH = ROWS.length;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---- rendu du master RGBA 64x64 ----
const M = 64;
function buildMaster() {
  const px = Buffer.alloc(M * M * 4);
  const cx = M / 2, cy = M / 2;
  for (let y = 0; y < M; y++) for (let x = 0; x < M; x++) {
    // fond : dégradé radial sombre violet
    const d = Math.hypot(x - cx, y - cy) / (M * 0.72);
    const r = Math.round(36 - d * 22), g = Math.round(26 - d * 16), b = Math.round(58 - d * 34);
    const o = (y * M + x) * 4;
    px[o] = Math.max(0, r); px[o + 1] = Math.max(0, g); px[o + 2] = Math.max(0, b); px[o + 3] = 255;
  }
  // chaton centré, échelle x3 (51x54) -> léger débord vertical rogné, centré horizontalement
  const scale = 3;
  const ox = Math.round((M - CW * scale) / 2);
  const oy = Math.round((M - CH * scale) / 2) + 1;
  for (let cyi = 0; cyi < CH; cyi++) for (let cxi = 0; cxi < CW; cxi++) {
    const c = PAL[ROWS[cyi][cxi]];
    if (!c) continue;
    const [r, g, b] = hex(c);
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const X = ox + cxi * scale + sx, Y = oy + cyi * scale + sy;
      if (X < 0 || Y < 0 || X >= M || Y >= M) continue;
      const o = (Y * M + X) * 4;
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
  }
  return px;
}
const MASTER = buildMaster();

// ---- rééchantillonnage plus proche voisin vers une taille cible ----
function resample(size) {
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.min(M - 1, Math.floor(x * M / size));
    const sy = Math.min(M - 1, Math.floor(y * M / size));
    const so = (sy * M + sx) * 4, o = (y * size + x) * 4;
    out[o] = MASTER[so]; out[o + 1] = MASTER[so + 1]; out[o + 2] = MASTER[so + 2]; out[o + 3] = MASTER[so + 3];
  }
  return out;
}

// ---- encodeur PNG (RGBA 8 bits) ----
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bits, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180], ['favicon.png', 48]]) {
  writeFileSync(join(OUT, name), encodePNG(size, resample(size)));
  console.log('écrit', name, `(${size}px)`);
}
