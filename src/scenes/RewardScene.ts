import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { label, iconBadge } from '../ui/theme';
import { rollChoices } from '../systems/PowerSystem';
import { RARITY_COLORS, RARITY_NAMES, type PowerDef } from '../config/powers';
import { glyphTexture } from '../art/icons';
import { AudioManager } from '../systems/AudioManager';
import type { GameScene } from './GameScene';

export class RewardScene extends Phaser.Scene {
  private gameScene!: GameScene;
  constructor() { super('Reward'); }

  init(data: { gameScene: GameScene }): void { this.gameScene = data.gameScene; }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);
    label(this, GAME_WIDTH / 2, 70, 'CHOISIS UN POUVOIR', 30, '#f4c430');
    label(this, GAME_WIDTH / 2, 104, 'Les pouvoirs durent le temps du run', 13, '#9a8fb0');

    const luck = this.gameScene.player.stats.luck;
    const choices = rollChoices(3, luck);
    AudioManager.play('power');

    const cw = 240, ch = 300, gap = 30;
    const startX = GAME_WIDTH / 2 - ((cw + gap) * choices.length - gap) / 2 + cw / 2;
    choices.forEach((power, i) => this.makeCard(power, startX + i * (cw + gap), GAME_HEIGHT / 2 + 30, cw, ch, i));

    // relance : si aucun choix (cas limite), passe direct
    if (choices.length === 0) this.pick(null);
  }

  private makeCard(power: PowerDef, x: number, y: number, w: number, h: number, index: number): void {
    const col = RARITY_COLORS[power.rarity];
    const c = this.add.container(x, y + 40).setAlpha(0);

    const g = this.add.graphics();
    g.fillStyle(COLORS.panel, 0.98);
    g.lineStyle(4, col, 1);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    // bandeau rareté
    g.fillStyle(col, 0.9);
    g.fillRoundedRect(-w / 2, -h / 2, w, 34, { tl: 12, tr: 12, bl: 0, br: 0 });
    c.add(g);

    c.add(label(this, 0, -h / 2 + 17, RARITY_NAMES[power.rarity].toUpperCase(), 14, '#1a1224'));
    const badge = iconBadge(this, 0, -h / 2 + 90, glyphTexture(power.icon), col, COLORS.panelLight, 34);
    c.add(badge);
    c.add(label(this, 0, -h / 2 + 150, power.name, 18, '#f4e9c1'));
    const desc = label(this, 0, -h / 2 + 210, power.description, 14, '#c9c0d8');
    desc.setWordWrapWidth(w - 30);
    c.add(desc);

    c.setSize(w, h);
    c.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    c.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.05, duration: 120 }));
    c.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    c.on('pointerdown', () => { AudioManager.play('ui'); this.pick(power); });

    this.tweens.add({ targets: c, alpha: 1, y, duration: 300, delay: index * 90, ease: 'Back.easeOut' });
  }

  private pick(power: PowerDef | null): void {
    this.scene.stop();
    this.gameScene.onPowerPicked(power ?? rollChoices(1, 0)[0] ?? null);
  }
}
