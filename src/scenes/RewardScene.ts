import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { label, iconBadge } from '../ui/theme';
import { rollChoices } from '../systems/PowerSystem';
import { RARITY_COLORS, RARITY_NAMES, FALLBACK_BOONS, type PowerDef, type Rarity } from '../config/powers';
import { glyphTexture } from '../art/icons';
import { AudioManager } from '../systems/AudioManager';
import type { GameScene } from './GameScene';

export class RewardScene extends Phaser.Scene {
  private gameScene!: GameScene;
  private minRarity: Rarity = 'common';
  constructor() { super('Reward'); }

  init(data: { gameScene: GameScene; minRarity?: Rarity }): void {
    this.gameScene = data.gameScene;
    this.minRarity = data.minRarity ?? 'common';
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);

    const luck = this.gameScene.player.stats.luck;
    const boons = rollChoices(3, luck, this.minRarity);
    // complète avec des cartes de repli (PV max / soin) si pas assez de boons neufs
    const choices: PowerDef[] = [...boons];
    for (const fb of FALLBACK_BOONS) { if (choices.length >= 3) break; choices.push(fb); }

    const noBoon = boons.length === 0;
    label(this, GAME_WIDTH / 2, 70, noBoon ? 'PLUS DE POUVOIR DISPONIBLE' : 'CHOISIS UN POUVOIR', 28, '#f4c430');
    label(this, GAME_WIDTH / 2, 104, noBoon ? 'Choisis une récompense de vie' : 'Les pouvoirs durent le temps du run', 13, '#9a8fb0');
    AudioManager.play('power');

    const cw = 240, ch = 300, gap = 30;
    const startX = GAME_WIDTH / 2 - ((cw + gap) * choices.length - gap) / 2 + cw / 2;
    choices.forEach((power, i) => this.makeCard(power, startX + i * (cw + gap), GAME_HEIGHT / 2 + 30, cw, ch, i));

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
    const badge = iconBadge(this, 0, -h / 2 + 88, glyphTexture(power.icon), col, COLORS.panelLight, 34);
    c.add(badge);
    c.add(label(this, 0, -h / 2 + 146, power.name, 18, '#f4e9c1'));
    if (power.god) c.add(label(this, 0, -h / 2 + 168, `« ${power.god} »`, 11, '#f4c430'));
    // étiquette unique / cumulable (avec le nombre déjà possédé)
    if (!power.fallback) {
      const owned = this.gameScene.ownedCount(power.id);
      const tag = power.repeatable
        ? (owned > 0 ? `↺ Cumulable (×${owned})` : '↺ Cumulable')
        : '★ Unique';
      c.add(label(this, 0, -h / 2 + 186, tag, 10, power.repeatable ? '#8fd0ff' : '#f4a020'));
    }
    const desc = label(this, 0, -h / 2 + 214, power.description, 13, '#c9c0d8');
    desc.setWordWrapWidth(w - 28);
    c.add(desc);

    c.setSize(w, h);
    // zone cliquable couvrant toute la carte (large marge)
    const hit = this.add.zone(0, 0, w + 20, h + 20).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => this.tweens.add({ targets: c, scale: 1.06, duration: 120 }));
    hit.on('pointerout', () => this.tweens.add({ targets: c, scale: 1, duration: 120 }));
    hit.on('pointerdown', () => { AudioManager.play('ui'); this.pick(power); });

    this.tweens.add({ targets: c, alpha: 1, y, duration: 300, delay: index * 90, ease: 'Back.easeOut' });
  }

  private pick(power: PowerDef | null): void {
    this.scene.stop();
    this.gameScene.onPowerPicked(power ?? rollChoices(1, 0)[0] ?? null);
  }
}
