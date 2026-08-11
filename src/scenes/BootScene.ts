import Phaser from 'phaser';
import { RENDER_SCALE, GAME_WIDTH, GAME_HEIGHT, HERO_ART_TEST } from '../config/game';
import { generateAll } from '../art';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload(): void {
    // TEST piste B : illustration du héros + sa carte de normales (éclairage 3D).
    if (HERO_ART_TEST) this.load.image('hero_art', ['hero_art.png', 'hero_art_n.png']);
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    SaveSystem.load();
    generateAll(this);
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
    this.scene.start('Menu');
  }
}
