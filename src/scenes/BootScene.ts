import Phaser from 'phaser';
import { RENDER_SCALE, GAME_WIDTH, GAME_HEIGHT } from '../config/game';
import { generateAll } from '../art';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    SaveSystem.load();
    generateAll(this);
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
    this.scene.start('Menu');
  }
}
