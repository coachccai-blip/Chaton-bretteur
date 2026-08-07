import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game';
import type { ZoneDef } from '../config/worlds';

interface Rect { x: number; y: number; w: number; h: number; }

/** Gère l'ambiance visuelle (lumière, particules, parallaxe, vignette, ombres). */
export class Environment {
  private scene: Phaser.Scene;
  private arena: Rect;
  private bg!: Phaser.GameObjects.Graphics;
  private parallax!: Phaser.GameObjects.Graphics;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  private playerLight!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private shadowGfx!: Phaser.GameObjects.Graphics;
  private accent = 0xffffff;

  constructor(scene: Phaser.Scene, arena: Rect) {
    this.scene = scene;
    this.arena = arena;
    this.bg = scene.add.graphics().setDepth(-10);
    this.parallax = scene.add.graphics().setDepth(-9);
    this.shadowGfx = scene.add.graphics().setDepth(5);
    this.playerLight = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'light')
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setScale(2.6).setAlpha(0.5);
    this.vignette = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setDepth(70).setAlpha(0.9);
  }

  setZone(zone: ZoneDef): void {
    this.accent = zone.palette.accent;
    // ciel/dégradé de fond
    this.bg.clear();
    const fog = zone.palette.fog;
    this.bg.fillStyle(fog, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.bg.fillStyle(shadeHex(fog, 22), 0.6).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.5);

    this.drawParallax(zone);
    this.setupAmbient(zone);
    this.playerLight.setTint(lightTint(zone.id));
  }

  private drawParallax(zone: ZoneDef): void {
    this.parallax.clear();
    const wall = shadeHex(zone.palette.wall, -10);
    // grandes silhouettes derrière (troncs / piliers / montagnes)
    for (let i = 0; i < 7; i++) {
      const x = 60 + i * 130 + (i % 2) * 30;
      const w = 70 + (i % 3) * 20;
      const h = 120 + (i % 4) * 60;
      this.parallax.fillStyle(wall, 0.35);
      if (zone.id === 'citadelle' || zone.id === 'forge') {
        this.parallax.fillRect(x, GAME_HEIGHT - h, w, h); // piliers/tours
        this.parallax.fillStyle(shadeHex(zone.palette.accent, -40), 0.2);
        this.parallax.fillRect(x + w / 2 - 4, GAME_HEIGHT - h, 8, h);
      } else {
        this.parallax.fillTriangle(x - 10, GAME_HEIGHT, x + w / 2, GAME_HEIGHT - h, x + w + 10, GAME_HEIGHT); // arbres/collines
      }
    }
  }

  private setupAmbient(zone: ZoneDef): void {
    this.ambient?.destroy();
    const base = {
      x: { min: 0, max: GAME_WIDTH }, y: { min: 0, max: GAME_HEIGHT },
      blendMode: 'ADD' as const, quantity: 1,
    };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    switch (zone.id) {
      case 'foret': // lucioles
        cfg = { ...base, speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 }, scale: { min: 0.5, max: 1.1 }, alpha: { start: 0.9, end: 0 }, lifespan: 4200, frequency: 160, tint: [0xf4e08a, 0x9ee06a] };
        break;
      case 'marais': // bulles toxiques
        cfg = { ...base, speedY: { min: -30, max: -12 }, scale: { min: 0.6, max: 1.4 }, alpha: { start: 0.5, end: 0 }, lifespan: 3600, frequency: 200, tint: [0x8fd94a, 0x5a8a3a] };
        break;
      case 'forge': // braises
        cfg = { ...base, y: GAME_HEIGHT + 10, speedY: { min: -120, max: -50 }, speedX: { min: -20, max: 20 }, scale: { min: 0.5, max: 1.3 }, alpha: { start: 1, end: 0 }, lifespan: 2600, frequency: 90, tint: [0xff6a1f, 0xffb020, 0xff3a1f] };
        break;
      default: // citadelle : poussière spectrale
        cfg = { ...base, speedY: { min: -10, max: 10 }, speedX: { min: -12, max: 12 }, scale: { min: 0.5, max: 1.2 }, alpha: { start: 0.5, end: 0 }, lifespan: 5000, frequency: 150, tint: [0xb26bff, 0x8fa8ff, 0xf4c430] };
    }
    this.ambient = this.scene.add.particles(0, 0, 'px', cfg).setDepth(8);
  }

  /** ombres portées + lumière suivant le joueur. */
  update(px: number, py: number, entities: { x: number; y: number; displayHeight: number; scaleX: number }[]): void {
    this.playerLight.setPosition(px, py);
    this.shadowGfx.clear();
    this.shadowGfx.fillStyle(0x000000, 0.35);
    this.shadowGfx.fillEllipse(px, py + 6, 34, 14);
    for (const e of entities) {
      const w = Math.max(16, e.displayHeight * 0.5);
      this.shadowGfx.fillEllipse(e.x, e.y + 4, w, w * 0.42);
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.parallax.destroy();
    this.ambient?.destroy();
    this.playerLight.destroy();
    this.vignette.destroy();
    this.shadowGfx.destroy();
  }
}

function shadeHex(c: number, amt: number): number {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) + amt));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (c & 255) + amt));
  return (r << 16) | (g << 8) | b;
}
function lightTint(zoneId: string): number {
  switch (zoneId) {
    case 'foret': return 0xfff2c8;
    case 'marais': return 0xd8f0b0;
    case 'forge': return 0xffd0a0;
    default: return 0xd8c8ff;
  }
}
