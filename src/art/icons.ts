import type { MaskDef } from './PixelArtGenerator';

/** Glyphes 8x8 monochromes ('X' plein) tintés à l'usage. */
export const GLYPHS: MaskDef[] = [
  { key: 'glyph_heart', rows: ['.XX..XX.', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...', '........'] },
  { key: 'glyph_sword', rows: ['......XX', '.....XX.', '....XX..', '...XX...', '..XX....', 'XXX.....', 'XX......', 'X.......'] },
  { key: 'glyph_star', rows: ['...XX...', '...XX...', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '.XX..XX.', 'XX....XX', '........'] },
  { key: 'glyph_drop', rows: ['...XX...', '...XX...', '..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'] },
  { key: 'glyph_snow', rows: ['...XX...', 'X..XX..X', '.X.XX.X.', '..XXXX..', '..XXXX..', '.X.XX.X.', 'X..XX..X', '...XX...'] },
  { key: 'glyph_chevron', rows: ['X...X...', '.X...X..', '..X...X.', '...X...X', '..X...X.', '.X...X..', 'X...X...', '........'] },
  { key: 'glyph_claw', rows: ['X..X..X.', 'X..X..X.', 'X..X..X.', 'X..X..X.', '.X..X..X', '.X..X..X', '..X..X..', '........'] },
  { key: 'glyph_clock', rows: ['..XXXX..', '.X....X.', 'X...X..X', 'X...X..X', 'X...XXXX', 'X......X', '.X....X.', '..XXXX..'] },
  { key: 'glyph_crit', rows: ['X......X', '.X....X.', '..X..X..', '...XX...', '...XX...', '..X..X..', '.X....X.', 'X......X'] },
  { key: 'glyph_shield', rows: ['XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '.XXXXXX.', '..XXXX..', '..XXXX..', '...XX...', '........'] },
  { key: 'glyph_spike', rows: ['.X..X..X', '.X..X..X', 'XX.XX.XX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX', 'XXXXXXXX'] },
  { key: 'glyph_clover', rows: ['.XX.XX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '.XXXXX..', 'XXXXXXX.', 'XXXXXXX.', '...X....'] },
  { key: 'glyph_coin', rows: ['..XXXX..', '.XXXXXX.', 'XXXXXXXX', 'XXX..XXX', 'XXX..XXX', 'XXXXXXXX', '.XXXXXX.', '..XXXX..'] },
  { key: 'glyph_lightning', rows: ['...XX...', '..XX....', '.XX.....', 'XXXXX...', '...XX...', '..XX....', '.XX.....', '.X......'] },
  { key: 'glyph_pause', rows: ['.XX.XX..', '.XX.XX..', '.XX.XX..', '.XX.XX..', '.XX.XX..', '.XX.XX..', '.XX.XX..', '........'] },
  { key: 'glyph_flame', rows: ['...X....', '..XX....', '..XXX...', '.XXXX...', '.XXXXX..', 'XX.XXX..', 'XX.XXXX.', '.XXXXX..'] },
  { key: 'glyph_fist', rows: ['........', '.XXXX...', 'XXXXXX..', 'XXXXXXX.', 'XXXXXXX.', 'XXXXXX..', '.XXXXX..', '..XXX...'] },
  { key: 'glyph_wave', rows: ['.....XX.', '...XXXX.', '..XXX...', '.XXX....', '.XX.....', '.XXX....', '..XXXX..', '....XXX.'] },
  { key: 'glyph_boom', rows: ['X..X..X.', '.X.X.X..', '..XXX...', 'XXXXXXX.', '..XXX...', '.X.X.X..', 'X..X..X.', '........'] },
  { key: 'glyph_hourglass', rows: ['XXXXXXX.', '.XXXXX..', '..XXX...', '...X....', '...X....', '..XXX...', '.XXXXX..', 'XXXXXXX.'] },
  { key: 'glyph_spiral', rows: ['.XXXXX..', 'X.....X.', 'X.XXX.X.', 'X.X.X.X.', 'X.X.XXX.', 'X.X.....', 'X.XXXXX.', '.XXXXXX.'] },
  { key: 'glyph_eye', rows: ['........', '.XXXXXX.', 'XX....XX', 'X..XX..X', 'X..XX..X', 'XX....XX', '.XXXXXX.', '........'] },
  { key: 'glyph_domain', rows: ['...X....', '..XXX...', '.XXXXX..', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X....', '........'] },
  { key: 'glyph_clone', rows: ['.X...X..', 'XXX.XXX.', '.X...X..', 'XXX.XXX.', '.X...X..', '.X...X..', '........', '........'] },
];

/** icon logique (dans powers/meta) -> glyphe. */
const ICON_MAP: Record<string, string> = {
  heart: 'glyph_heart', heartplus: 'glyph_heart', revive: 'glyph_heart',
  sword: 'glyph_sword', combo: 'glyph_sword',
  crit: 'glyph_crit', special: 'glyph_star', focus: 'glyph_clock',
  bleed: 'glyph_drop', lifesteal: 'glyph_drop',
  freeze: 'glyph_snow',
  dash: 'glyph_chevron', movespeed: 'glyph_chevron', clawtrail: 'glyph_claw',
  cooldown: 'glyph_clock', atkspeed: 'glyph_lightning', lightning: 'glyph_lightning',
  armor: 'glyph_shield', shield: 'glyph_shield', thorns: 'glyph_spike',
  luck: 'glyph_clover', coin: 'glyph_coin',
  // boons divins
  flame: 'glyph_flame', poison: 'glyph_drop', fist: 'glyph_fist', wave: 'glyph_wave',
  boom: 'glyph_boom', hourglass: 'glyph_hourglass', spiral: 'glyph_spiral',
  clone: 'glyph_clone', domain: 'glyph_domain', rage: 'glyph_flame', eye: 'glyph_eye',
};

export function glyphTexture(icon: string): string {
  return ICON_MAP[icon] ?? 'glyph_star';
}
