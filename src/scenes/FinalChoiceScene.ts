import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from '../config/game';
import { button, label, panel } from '../ui/theme';
import { AudioManager } from '../systems/AudioManager';
import type { GameScene } from './GameScene';

/**
 * Après avoir vaincu Néantis ×3 : le chaton choisit entre rentrer au camp
 * (compté comme VICTOIRE) ou défier le boss final (l'Ombre Militaire).
 */
export class FinalChoiceScene extends Phaser.Scene {
  private gs!: GameScene;
  constructor() { super('FinalChoice'); }
  init(data: { gameScene: GameScene }): void { this.gs = data.gameScene; }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.82);
    panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 300);
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 108, 'LE NÉANT EST VAINCU', 26, '#f4c430');
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 74,
      'Une présence militaire rôde dans l’ombre…', 15, '#c9c0d8');
    label(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 48,
      'Rentrer au camp scelle ta victoire. Rester, c’est défier l’ultime menace.', 13, '#9a8fb0');

    button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 6, 380, 52, '🏕  Rentrer au camp (Victoire)', () => {
      AudioManager.play('ui');
      this.scene.stop();
      this.gs.finishRunVictory();
    }, { fill: 0x2a4a2a, border: 0x6ad46a, size: 18 });

    button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 74, 380, 52, '☠  Affronter le Boss Final', () => {
      AudioManager.play('ui');
      this.scene.stop();
      this.gs.startFinalBoss();
    }, { fill: 0x4a2020, border: 0xff6a5a, textColor: '#ffd0c8', size: 18 });
  }
}
