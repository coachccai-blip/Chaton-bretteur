import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, RENDER_SCALE } from '../config/game';
import { button, label, panel } from '../ui/theme';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import type { GameScene } from './GameScene';

export class PauseScene extends Phaser.Scene {
  private gs!: GameScene;
  constructor() { super('Pause'); }
  init(data: { gameScene: GameScene }): void { this.gs = data.gameScene; }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 400, 360);
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 138, 'PAUSE', 32, '#f4c430');

    const s = SaveSystem.data.settings;
    const vol = label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 84, `Volume : ${Math.round(s.volume * 100)}%`, 16);
    // Boutons volume plus grands et plus espacés (faciles à toucher).
    button(this, GAME_WIDTH / 2 - 96, GAME_HEIGHT / 2 - 34, 72, 52, '–', () => {
      s.volume = Math.max(0, Math.round((s.volume - 0.1) * 10) / 10); SaveSystem.save(); AudioManager.applyVolume();
      vol.setText(`Volume : ${Math.round(s.volume * 100)}%`);
    }, { size: 24 });
    button(this, GAME_WIDTH / 2 + 96, GAME_HEIGHT / 2 - 34, 72, 52, '+', () => {
      s.volume = Math.min(1, Math.round((s.volume + 0.1) * 10) / 10); SaveSystem.save(); AudioManager.applyVolume();
      vol.setText(`Volume : ${Math.round(s.volume * 100)}%`);
    }, { size: 24 });

    button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40, 280, 56, 'Reprendre', () => this.resume(),
      { fill: 0x2a4a2a, border: 0x6ad46a, size: 18 });
    button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 116, 280, 52, 'Abandonner le run', () => {
      AudioManager.play('ui');
      this.scene.stop();
      this.gs.abandon();
    }, { border: COLORS.hp, textColor: '#ff9db0', size: 16 });

    this.input.keyboard?.on('keydown-ESC', () => this.resume());
  }

  private resume(): void {
    AudioManager.play('ui');
    this.gs.controls.clearQueued();
    this.scene.resume('Game');
    this.scene.stop();
  }
}
