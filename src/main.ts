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
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
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
    RewardScene, PauseScene, GameOverScene, VictoryScene,
  ],
};

const game = new Phaser.Game(config);
// exposé pour le débogage / tests
(window as any).__game = game;
