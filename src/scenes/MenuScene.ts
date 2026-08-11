import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, RENDER_SCALE } from '../config/game';
import { button, label, panel } from '../ui/theme';
import { AudioManager } from '../systems/AudioManager';
import { SaveSystem } from '../systems/SaveSystem';
import { HERO_ART_COMP } from '../art/heroesHD';
import { canInstall, hasNativePrompt, isIOS, onInstallAvailable, promptInstall } from '../systems/pwa';
import type { Btn } from '../ui/theme';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'floor_citadelle').setAlpha(0.5);
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0.35);

    // étoiles/particules d'ambiance
    this.add.particles(0, 0, 'px', {
      x: { min: 0, max: GAME_WIDTH }, y: { min: 0, max: GAME_HEIGHT },
      speedY: { min: -8, max: -20 }, scale: { min: 0.3, max: 0.8 }, alpha: { start: 0.6, end: 0 },
      lifespan: 4000, frequency: 220, tint: 0xf4c430, blendMode: 'ADD',
    });

    // héros (taille réduite + abaissé pour dégager le sous-titre au-dessus du casque)
    const cat = this.add.sprite(GAME_WIDTH / 2, 278, 'cat').setScale(3.2 * HERO_ART_COMP);
    this.tweens.add({ targets: cat, y: 266, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const sword = this.add.sprite(GAME_WIDTH / 2 + 52, 278, 'sword').setScale(1.6).setRotation(0.4);
    this.tweens.add({ targets: sword, rotation: 0.7, y: 266, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // titre
    label(this, GAME_WIDTH / 2, 90, 'CHATON', 52, '#f4e9c1');
    label(this, GAME_WIDTH / 2, 140, 'DE GUERRE', 52, '#f4c430');
    label(this, GAME_WIDTH / 2, 170, 'roguelite d’action', 16, '#9a8fb0');

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

    this.buildFullscreenButton();
    this.buildInstallButton();

    this.input.once('pointerdown', () => AudioManager.resume());
    AudioManager.startMusic('menu');
  }

  private installBtn?: Btn;

  /**
   * Bouton « Installer le jeu » : sur mobile ET sur PC (app de bureau via
   * Chrome/Edge). Android & desktop Chromium → prompt natif en un clic ; iOS →
   * instructions. L'événement d'installation arrive souvent APRÈS l'ouverture du
   * menu (surtout desktop) : on s'abonne pour ajouter le bouton dès qu'il est prêt.
   */
  private buildInstallButton(): void {
    const add = () => {
      if (this.installBtn || !canInstall()) return;
      const b = button(this, GAME_WIDTH / 2, 486, 250, 44, '📲  Installer le jeu', () => {
        AudioManager.resume(); AudioManager.play('ui');
        if (hasNativePrompt()) {
          promptInstall().then((r) => {
            if (r === 'accepted') { this.installBtn?.container.destroy(); this.installBtn = undefined; }
          });
        } else if (isIOS()) {
          this.showIOSInstallHelp();
        }
      }, { fill: 0x1f3d2a, border: 0x6ad46a, textColor: '#c7f2d0', size: 17 });
      this.installBtn = b;
    };
    add();
    // pas encore installable (prompt pas encore émis, fréquent sur desktop) : on
    // écoute et on ajoute le bouton dès qu'il devient disponible.
    if (!this.installBtn) {
      const off = onInstallAvailable(() => add());
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
      this.events.once(Phaser.Scenes.Events.DESTROY, off);
    }
  }

  /** Instructions d'installation iOS (pas d'API : « Ajouter à l'écran d'accueil »). */
  private showIOSInstallHelp(): void {
    const c = this.add.container(0, 0).setDepth(100);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72)
      .setInteractive();
    bg.on('pointerdown', () => c.destroy());
    const p = panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 460, 260);
    const title = label(this, GAME_WIDTH / 2, 168, 'Installer sur iPhone / iPad', 22, '#6ad46a');
    const step1 = label(this, GAME_WIDTH / 2, 214, '1.  Appuie sur le bouton Partager', 16, '#eaf4ff');
    const step1b = label(this, GAME_WIDTH / 2, 236, '(le carré avec une flèche vers le haut ⬆︎)', 12, '#9a8fb0');
    const step2 = label(this, GAME_WIDTH / 2, 270, '2.  Choisis « Sur l’écran d’accueil »', 16, '#eaf4ff');
    const step3 = label(this, GAME_WIDTH / 2, 300, '3.  Confirme avec « Ajouter »', 16, '#eaf4ff');
    c.add([bg, p, title, step1, step1b, step2, step3]);
    const close = button(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 92, 160, 42, 'Compris', () => c.destroy(), { size: 16 });
    c.add(close.container);
  }

  /** Bouton plein écran (coin haut-droit) — utile en navigateur mobile/desktop. */
  private buildFullscreenButton(): void {
    if (!this.scale.fullscreen.available) return;
    const btn = label(this, GAME_WIDTH - 20, 20, '⛶', 26, '#f4e9c1', 1, 0)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#f4c430'));
    btn.on('pointerout', () => btn.setColor('#f4e9c1'));
    btn.on('pointerup', () => {
      AudioManager.resume();
      if (this.scale.isFullscreen) this.scale.stopFullscreen();
      else this.scale.startFullscreen();
    });
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
