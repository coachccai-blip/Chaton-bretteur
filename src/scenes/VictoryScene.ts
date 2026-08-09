import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, RENDER_SCALE } from '../config/game';
import { button, label, panel } from '../ui/theme';
import { RunState } from '../systems/RunState';
import { SaveSystem, formatTime } from '../systems/SaveSystem';
import { DIFFICULTIES } from '../config/difficulty';
import { AudioManager } from '../systems/AudioManager';

export class VictoryScene extends Phaser.Scene {
  constructor() { super('Victory'); }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.cameras.main.setBackgroundColor(0x1a1430);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'floor_citadelle').setAlpha(0.25);
    AudioManager.play('victory');
    AudioManager.startMusic('hub');

    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: GAME_WIDTH }, y: -10, speedY: { min: 40, max: 120 }, speedX: { min: -40, max: 40 },
      scale: { min: 0.4, max: 1 }, lifespan: 3500, frequency: 60,
      tint: [0xf4c430, 0x6ad46a, 0x59a8ff, 0xff6b6b], blendMode: 'ADD',
    });

    const cat = this.add.sprite(GAME_WIDTH / 2, 150, 'cat').setScale(5);
    this.tweens.add({ targets: cat, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const sword = this.add.sprite(GAME_WIDTH / 2 + 70, 130, 'sword').setScale(2.4).setRotation(-0.6);
    this.tweens.add({ targets: sword, rotation: -0.9, duration: 700, yoyo: true, repeat: -1 });

    label(this, GAME_WIDTH / 2, 250, 'VICTOIRE !', 44, '#f4c430');
    label(this, GAME_WIDTH / 2, 292, 'Le Roi des Monstres est vaincu.', 18, '#f4e9c1');
    label(this, GAME_WIDTH / 2, 316, 'Le royaume est sauvé par le Chaton de guerre !', 14, '#9a8fb0');

    // chrono du run + record par difficulté
    const time = RunState.durationSec();
    const isRecord = SaveSystem.recordTime(RunState.difficultyId, time);
    const best = SaveSystem.bestTime(RunState.difficultyId) ?? time;
    const diffName = DIFFICULTIES.find((d) => d.id === RunState.difficultyId)?.name ?? RunState.difficultyId;

    panel(this, GAME_WIDTH / 2, 410, 440, 120, COLORS.panel, COLORS.gold);
    label(this, GAME_WIDTH / 2, 372, `Temps : ${formatTime(time)}${isRecord ? '   ⭐ NOUVEAU RECORD !' : ''}`, 15, isRecord ? '#f4c430' : '#f4e9c1');
    label(this, GAME_WIDTH / 2, 396, `Record ${diffName} : ${formatTime(best)}`, 12, '#9a8fb0');
    label(this, GAME_WIDTH / 2, 420, `Monstres vaincus : ${RunState.kills}`, 14, '#f4e9c1');
    label(this, GAME_WIDTH / 2, 442, `+ ${RunState.currencyEarned} Croquettes Dorées`, 16, '#f4c430');

    // bouton à droite (les stats sont centrées) pour ne masquer aucune info
    button(this, GAME_WIDTH - 150, GAME_HEIGHT - 30, 260, 46, 'Retour au Camp', () => {
      AudioManager.play('ui');
      this.scene.start('Hub');
    }, { fill: 0x2a4a2a, border: 0x6ad46a, size: 18 });

    if (SaveSystem.data.unlockedExtreme) {
      label(this, GAME_WIDTH / 2, GAME_HEIGHT - 30, 'Difficulté Extrême débloquée !', 13, '#ff9db0');
    }
  }
}
