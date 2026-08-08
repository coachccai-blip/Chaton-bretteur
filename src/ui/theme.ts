import Phaser from 'phaser';
import { COLORS } from '../config/game';

export const FONT = 'monospace';

export function label(
  scene: Phaser.Scene, x: number, y: number, text: string,
  size = 18, color: string = '#f4e9c1', origin = 0.5, originY?: number,
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: 'bold',
    stroke: '#000000', strokeThickness: Math.max(2, size / 8),
    align: 'center', wordWrap: { width: 600 },
  });
  t.setOrigin(origin, originY ?? origin);
  return t;
}

export function panel(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  fill = COLORS.panel, border = COLORS.gold, alpha = 0.95,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, alpha);
  g.lineStyle(3, border, 1);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  return g;
}

export interface Btn {
  container: Phaser.GameObjects.Container;
  setEnabled(v: boolean): void;
  setLabel(s: string): void;
}

export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  text: string, onClick: () => void,
  opts: { fill?: number; border?: number; textColor?: string; size?: number } = {},
): Btn {
  const fill = opts.fill ?? COLORS.panelLight;
  const border = opts.border ?? COLORS.gold;
  const bg = scene.add.graphics();
  const draw = (f: number, b: number, a = 1) => {
    bg.clear();
    bg.fillStyle(f, a);
    bg.lineStyle(3, b, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
  };
  draw(fill, border);
  const txt = label(scene, 0, 0, text, opts.size ?? 18, opts.textColor ?? '#f4e9c1');
  // La zone cliquable est un objet dédié (Zone) enfant du conteneur, JAMAIS le
  // conteneur lui-même : rendre un Container interactif donne une hitbox qui ne
  // répond correctement qu'au centre (quirk Phaser) — on pouvait donc cliquer
  // « à côté » d'un bouton sans déclencher l'action. Une Zone, comme dans les
  // autres écrans, couvre toute la surface de façon fiable.
  // Zone cliquable un peu PLUS GRANDE que le visuel (marge de confort tactile) :
  // les petits boutons (« – », « + ») restent faciles à toucher au doigt.
  const HITPAD = 16;
  const zone = scene.add.zone(0, 0, w + HITPAD, h + HITPAD).setInteractive({ useHandCursor: true });
  const c = scene.add.container(x, y, [bg, txt, zone]);
  c.setSize(w, h);
  let enabled = true;
  let pressed = false;
  const restore = () => { pressed = false; txt.setY(0); draw(fill, border); };
  zone.on('pointerover', () => { if (enabled && !pressed) draw(border, border, 0.35); });
  zone.on('pointerout', () => { if (enabled) restore(); });
  zone.on('pointerdown', () => { if (!enabled) return; pressed = true; txt.setY(1); draw(border, border, 0.5); });
  zone.on('pointerup', () => {
    if (!enabled) return;
    const fire = pressed;
    restore();
    if (fire) onClick();
  });
  // relâchement en dehors du bouton (glissé puis lâché ailleurs) : on annule
  zone.on('pointerupoutside', () => { if (enabled) restore(); });
  return {
    container: c,
    setEnabled(v: boolean) {
      enabled = v;
      c.setAlpha(v ? 1 : 0.45);
      if (v) zone.setInteractive({ useHandCursor: true }); else zone.disableInteractive();
      draw(fill, border);
    },
    setLabel(s: string) { txt.setText(s); },
  };
}

/** Icône pixel (glyphe tinté) posée dans un disque coloré. */
export function iconBadge(
  scene: Phaser.Scene, x: number, y: number, glyphKey: string, tint: number, bg: number, r = 20,
): Phaser.GameObjects.Container {
  const disc = scene.add.circle(0, 0, r, bg).setStrokeStyle(2, 0x000000, 0.4);
  const icon = scene.add.image(0, 0, glyphKey).setTint(tint);
  const scale = (r * 1.3) / icon.width;
  icon.setScale(scale);
  return scene.add.container(x, y, [disc, icon]);
}
