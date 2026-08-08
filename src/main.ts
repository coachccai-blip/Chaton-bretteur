import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config/game';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { HubScene } from './scenes/HubScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { RewardScene } from './scenes/RewardScene';
import { PauseScene } from './scenes/PauseScene';
import { GameOverScene } from './scenes/GameOverScene';
import { VictoryScene } from './scenes/VictoryScene';
import { FinalChoiceScene } from './scenes/FinalChoiceScene';
import { RunState } from './systems/RunState';
import { SaveSystem } from './systems/SaveSystem';
import { POWERS } from './config/powers';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.bg,
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.FIT,
    // Le conteneur #game (flex) centre déjà le canvas ; laisser Phaser AUSSI
    // centrer (CENTER_BOTH) ajoutait une marge → double décalage (plus de noir
    // d'un côté). NO_CENTER = centrage uniquement par le flex → bordures égales.
    autoCenter: Phaser.Scale.NO_CENTER,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    // Plein écran sur le conteneur #game (stable) plutôt que sur le seul <canvas> :
    // ainsi l'overlay des boutons tactiles (enfant de #game) reste visible en plein
    // écran au lieu d'être masqué par le canvas fullscreené seul.
    fullscreenTarget: 'game',
  },
  input: {
    gamepad: true,
    activePointers: 3,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene, MenuScene, HubScene, GameScene, UIScene,
    RewardScene, PauseScene, GameOverScene, VictoryScene, FinalChoiceScene,
  ],
};

const game = new Phaser.Game(config);
// exposé pour le débogage / tests
(window as any).__game = game;
(window as any).__debug = {
  run(diff = 'normal') {
    RunState.reset(diff);
    RunState.setConsumables(SaveSystem.loadout);
    game.scene.stop('Menu'); game.scene.stop('Hub');
    game.scene.start('Game');
  },
  boss(index = 0) {
    const g = game.scene.getScene('Game') as unknown as { debugBossZone(i: number): void };
    g.debugBossZone(index);
  },
  finalBoss() {
    const g = game.scene.getScene('Game') as unknown as { startFinalBoss(): void };
    g.startFinalBoss();
  },
  grant(id: string) {
    const g = game.scene.getScene('Game') as any;
    const p = g?.player; if (!p) return;
    const def = POWERS.find((x) => x.id === id);
    if (def) { def.apply(p); p.syncDashCharges(); }
  },
};

// PWA : enregistre le service worker (installable + hors-ligne) en production.
if ((import.meta as any).env?.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* non bloquant */ });
  });
}
