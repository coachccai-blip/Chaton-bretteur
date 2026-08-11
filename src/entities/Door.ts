import Phaser from 'phaser';
import { label, iconBadge } from '../ui/theme';
import { glyphTexture } from '../art/icons';

export type RoomType = 'combat' | 'fountain' | 'shop' | 'treasure' | 'boss';

export const ROOM_TYPE_INFO: Record<RoomType, { icon: string; color: number; label: string }> = {
  combat: { icon: 'sword', color: 0x59a8ff, label: 'Combat' },
  fountain: { icon: 'heart', color: 0x6ad46a, label: 'Fontaine' },
  shop: { icon: 'coin', color: 0xf4c430, label: 'Marchand' },
  treasure: { icon: 'star', color: 0xb26bff, label: 'Trésor' },
  boss: { icon: 'boom', color: 0xe8384f, label: 'BOSS' },
};

export class Door {
  scene: Phaser.Scene;
  x: number;
  y: number;
  type: RoomType;
  container: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Image;
  used = false;

  constructor(scene: Phaser.Scene, x: number, y: number, type: RoomType) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    const info = ROOM_TYPE_INFO[type];

    const c = scene.add.container(x, y).setDepth(12);
    // lueur du portail
    this.glow = scene.add.image(0, -8, 'light').setTint(info.color).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setAlpha(0.6);
    c.add(this.glow);

    // arche de pierre
    const g = scene.add.graphics();
    g.fillStyle(0x2a2436, 1);
    g.fillRoundedRect(-32, -70, 64, 78, { tl: 30, tr: 30, bl: 6, br: 6 });
    g.lineStyle(4, info.color, 0.9);
    g.strokeRoundedRect(-32, -70, 64, 78, { tl: 30, tr: 30, bl: 6, br: 6 });
    // intérieur du portail
    g.fillStyle(info.color, 0.28);
    g.fillRoundedRect(-24, -60, 48, 66, { tl: 24, tr: 24, bl: 4, br: 4 });
    c.add(g);

    const badge = iconBadge(scene, 0, -34, glyphTexture(info.icon), 0xffffff, info.color, 18);
    c.add(badge);

    const lbl = label(scene, 0, 22, info.label, 13, '#f4e9c1');
    c.add(lbl);

    this.container = c;
    c.setScale(0);
    scene.tweens.add({ targets: c, scale: 1, duration: 320, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: this.glow, alpha: 0.35, scale: 1.35, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  destroy(): void {
    this.container.destroy();
  }
}
