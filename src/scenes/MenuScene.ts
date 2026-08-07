import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { button, label, panel } from '../ui/theme';
import { AudioManager } from '../systems/AudioManager';
import { SaveSystem } from '../systems/SaveSystem';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'floor_citadelle').setAlpha(0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.35);

    // étoiles/particules d'ambiance
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: GAME_WIDTH }, y: { min: 0, max: GAME_HEIGHT },
      speedY: { min: -8, max: -20 }, scale: { min: 0.3, max: 0.8 }, alpha: { start: 0.6, end: 0 },
      lifespan: 4000, frequency: 220, tint: 0xf4c430, blendMode: 'ADD',
    });

    // héros
    const cat = this.add.sprite(GAME_WIDTH / 2, 250, 'cat').setScale(4);
    this.tweens.add({ targets: cat, y: 235, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const sword = this.add.sprite(GAME_WIDTH / 2 + 60, 250, 'sword').setScale(2).setRotation(0.4);
    this.tweens.add({ targets: sword, rotation: 0.7, y: 235, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // titre
    label(this, GAME_WIDTH / 2, 90, 'LE CHATON', 52, '#f4e9c1');
    label(this, GAME_WIDTH / 2, 140, 'BRETTEUR', 52, '#f4c430');
    label(this, GAME_WIDTH / 2, 178, 'roguelite d’action', 16, '#9a8fb0');

    button(this, GAME_WIDTH / 2, 360, 240, 56, '⚔  JOUER', () => {
      AudioManager.resume();
      AudioManager.play('ui');
      this.scene.start('Hub');
    }, { fill: COLORS.panelLight, border: COLORS.gold, size: 24 });

    button(this, GAME_WIDTH / 2, 430, 200, 46, 'Options', () => {
      AudioManager.resume();
      this.openOptions();
    }, { size: 18 });

    label(this, GAME_WIDTH / 2, GAME_HEIGHT - 22,
      'Clavier/souris · Manette · Tactile  —  🐾', 13, '#9a8fb0');

    this.input.once('pointerdown', () => AudioManager.resume());
    AudioManager.startMusic('menu');
  }

  private openOptions(): void {
    const c = this.add.container(0, 0).setDepth(100);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setInteractive();
    const p = panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 420, 300);
    const title = label(this, GAME_WIDTH / 2, 170, 'Options', 26, '#f4c430');
    c.add([bg, p, title]);

    const s = SaveSystem.data.settings;
    const volLabel = label(this, GAME_WIDTH / 2, 235, `Volume : ${Math.round(s.volume * 100)}%`, 18);
    c.add(volLabel);
    const minus = button(this, GAME_WIDTH / 2 - 90, 275, 60, 44, '–', () => {
      s.volume = Math.max(0, Math.round((s.volume - 0.1) * 10) / 10); SaveSystem.save();
      AudioManager.applyVolume(); AudioManager.play('ui');
      volLabel.setText(`Volume : ${Math.round(s.volume * 100)}%`);
    });
    const plus = button(this, GAME_WIDTH / 2 + 90, 275, 60, 44, '+', () => {
      s.volume = Math.min(1, Math.round((s.volume + 0.1) * 10) / 10); SaveSystem.save();
      AudioManager.applyVolume(); AudioManager.play('ui');
      volLabel.setText(`Volume : ${Math.round(s.volume * 100)}%`);
    });
    c.add([minus.container, plus.container]);

    const reset = button(this, GAME_WIDTH / 2, 335, 320, 44, 'Réinitialiser la progression', () => {
      SaveSystem.reset();
      AudioManager.play('ui');
      reset.setLabel('Progression réinitialisée !');
    }, { border: COLORS.hp, textColor: '#ff9db0', size: 15 });
    c.add(reset.container);

    const close = button(this, GAME_WIDTH / 2, 395, 160, 44, 'Fermer', () => { c.destroy(); }, { size: 16 });
    c.add(close.container);
  }
}
