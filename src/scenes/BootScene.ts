import Phaser from 'phaser';
import { generateAll } from '../art';
import { SaveSystem } from '../systems/SaveSystem';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create(): void {
    SaveSystem.load();
    generateAll(this);
    const el = document.getElementById('loading');
    if (el) el.style.display = 'none';
    this.scene.start('Menu');
  }
}
