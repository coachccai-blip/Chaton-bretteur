import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { button, label, panel } from '../ui/theme';
import { RunState } from '../systems/RunState';
import { ZONES } from '../config/worlds';
import { SaveSystem, formatTime } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';

export class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0x1a0f14);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'floor_forge').setAlpha(0.15);
    AudioManager.stopMusic();

    const cat = this.add.sprite(GAME_WIDTH / 2, 130, 'cat').setScale(4).setTint(0x888888).setAngle(90);
    this.tweens.add({ targets: cat, y: 120, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    label(this, GAME_WIDTH / 2, 210, 'LE CHATON EST TOMBÉ…', 30, '#ff6b6b');
    label(this, GAME_WIDTH / 2, 244, 'mais il reviendra plus fort', 14, '#9a8fb0');

    panel(this, GAME_WIDTH / 2, 360, 460, 180, COLORS.panel, COLORS.gold);
    const zone = ZONES[RunState.zoneIndex];
    const lines = [
      `Zone atteinte : ${zone.name}`,
      `Salle : ${Math.min(RunState.roomIndex + 1, zone.rooms)}/${zone.rooms}`,
      `Monstres vaincus : ${RunState.kills}`,
      `Pouvoirs obtenus : ${RunState.powers.length}`,
      `Temps : ${formatTime(RunState.durationSec())}`,
    ];
    lines.forEach((l, i) => label(this, GAME_WIDTH / 2, 300 + i * 26, l, 15, '#f4e9c1'));

    label(this, GAME_WIDTH / 2, 466, `+ ${RunState.currencyEarned} Croquettes Dorées`, 20, '#f4c430');
    label(this, GAME_WIDTH / 2, 492, `Total : ${SaveSystem.currency} 🥇`, 14, '#9a8fb0');

    // bouton à droite (les stats sont centrées) pour ne masquer aucune info
    button(this, GAME_WIDTH - 150, GAME_HEIGHT - 30, 260, 44, 'Retour au Camp', () => {
      AudioManager.play('ui');
      this.scene.start('Hub');
    }, { fill: 0x2a4a2a, border: 0x6ad46a, size: 18 });
  }
}
