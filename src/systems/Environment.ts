import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/game';
import type { ZoneDef } from '../config/worlds';

interface Rect { x: number; y: number; w: number; h: number; }

/** Ambiance en couches (façon Dead Cells) : fond profond, parallaxe, torches,
 *  bannières, brume, lumière dynamique, ombres portées. */
export class Environment {
  private scene: Phaser.Scene;
  private arena: Rect;
  private bg!: Phaser.GameObjects.Graphics;
  private farWall!: Phaser.GameObjects.Graphics;
  private parallax!: Phaser.GameObjects.Graphics;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  private playerLight!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Image;
  private shadowGfx!: Phaser.GameObjects.Graphics;
  private decor: Phaser.GameObjects.GameObject[] = [];
  private accent = 0xffffff;

  constructor(scene: Phaser.Scene, arena: Rect) {
    this.scene = scene;
    this.arena = arena;
    this.bg = scene.add.graphics().setDepth(-12);
    this.farWall = scene.add.graphics().setDepth(-11);
    this.parallax = scene.add.graphics().setDepth(-10);
    this.shadowGfx = scene.add.graphics().setDepth(5);
    this.playerLight = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'light')
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setScale(2.8).setAlpha(0.55);
    this.vignette = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'vignette').setDepth(70).setAlpha(1);
  }

  setZone(zone: ZoneDef): void {
    this.accent = zone.palette.accent;
    const fog = zone.palette.fog;

    // fond profond : dégradé sombre, plus noir en haut
    this.bg.clear();
    this.bg.fillStyle(0x000000, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.bg.fillStyle(fog, 0.9).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.bg.fillStyle(shade(fog, -8), 1).fillRect(0, 0, GAME_WIDTH, this.arena.y);

    // mur de fond lointain (brique, derrière l'arène) — couche de profondeur
    this.drawFarWall(zone);
    this.drawParallax(zone);
    this.setupAmbient(zone);
    this.buildDecor(zone);
    this.playerLight.setTint(lightTint(zone.id));
  }

  private drawFarWall(zone: ZoneDef): void {
    this.farWall.clear();
    const top = 0, bottom = this.arena.y + 6;
    this.farWall.fillStyle(shade(zone.palette.wall, -18), 1).fillRect(0, top, GAME_WIDTH, bottom);
    // rangées de briques faiblement visibles
    this.farWall.lineStyle(1, 0x000000, 0.35);
    for (let y = top + 12; y < bottom; y += 16) this.farWall.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      for (let y = top; y < bottom; y += 16) {
        const off = (Math.floor(y / 16) % 2) * 20;
        this.farWall.lineBetween(x + off, y, x + off, y + 16);
      }
    }
    // halo d'horizon chaud au niveau du sol
    this.farWall.fillStyle(zone.palette.accent, 0.06).fillRect(0, this.arena.y - 30, GAME_WIDTH, 60);
  }

  private drawParallax(zone: ZoneDef): void {
    this.parallax.clear();
    const wall = shade(zone.palette.wall, -6);
    for (let i = 0; i < 8; i++) {
      const x = 30 + i * 120 + (i % 2) * 24;
      const w = 60 + (i % 3) * 24;
      const h = 90 + (i % 4) * 50;
      this.parallax.fillStyle(wall, 0.4);
      if (zone.id === 'citadelle' || zone.id === 'forge') {
        this.parallax.fillRect(x, this.arena.y - h, w, h);
        this.parallax.fillStyle(shade(zone.palette.accent, -30), 0.15);
        this.parallax.fillRect(x + w / 2 - 3, this.arena.y - h, 6, h);
      } else {
        this.parallax.fillTriangle(x - 12, this.arena.y, x + w / 2, this.arena.y - h, x + w + 12, this.arena.y);
      }
    }
  }

  private buildDecor(zone: ZoneDef): void {
    this.decor.forEach((d) => d.destroy());
    this.decor = [];
    const a = this.arena;

    // torches le long du haut, avec flamme et halo chaud
    const torchXs = [a.x + a.w * 0.16, a.x + a.w * 0.5, a.x + a.w * 0.84];
    for (const tx of torchXs) {
      const ty = a.y - 4;
      const torch = this.scene.add.image(tx, ty, 'deco_torch').setDepth(6).setScale(1);
      const glow = this.scene.add.image(tx, ty - 20, 'light').setTint(0xffb04a).setBlendMode(Phaser.BlendModes.ADD).setDepth(8).setScale(1.1).setAlpha(0.6);
      this.scene.tweens.add({ targets: glow, alpha: 0.38, scale: 1.35, duration: 500 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const flame = this.scene.add.particles(tx, ty - 20, 'px', {
        speedY: { min: -60, max: -30 }, speedX: { min: -8, max: 8 },
        scale: { start: 1.3, end: 0 }, lifespan: { min: 260, max: 460 }, frequency: 40,
        tint: [0xffe08a, 0xff9a2a, 0xff5a1f], blendMode: 'ADD',
      }).setDepth(8);
      this.decor.push(torch, glow, flame);
    }

    // bannières aux coins hauts, teintées par l'accent de la zone
    const banW = a.w;
    [a.x + banW * 0.06, a.x + banW * 0.94].forEach((bx) => {
      const ban = this.scene.add.image(bx, a.y + 26, 'deco_banner').setDepth(6).setScale(1.1).setTint(zone.palette.accent).setOrigin(0.5, 0);
      this.scene.tweens.add({ targets: ban, angle: { from: -1.5, to: 1.5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.decor.push(ban);
    });
  }

  private setupAmbient(zone: ZoneDef): void {
    this.ambient?.destroy();
    const base = { x: { min: 0, max: GAME_WIDTH }, y: { min: 0, max: GAME_HEIGHT }, blendMode: 'ADD' as const, quantity: 1 };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    switch (zone.id) {
      case 'foret':
        cfg = { ...base, speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 }, scale: { min: 0.5, max: 1.1 }, alpha: { start: 0.8, end: 0 }, lifespan: 4200, frequency: 170, tint: [0x9ee0a0, 0x59d9a0] };
        break;
      case 'marais':
        cfg = { ...base, speedY: { min: -30, max: -12 }, scale: { min: 0.6, max: 1.4 }, alpha: { start: 0.5, end: 0 }, lifespan: 3600, frequency: 200, tint: [0x9fe04a, 0x5a8a3a] };
        break;
      case 'forge':
        cfg = { ...base, y: GAME_HEIGHT + 10, speedY: { min: -130, max: -50 }, speedX: { min: -22, max: 22 }, scale: { min: 0.5, max: 1.3 }, alpha: { start: 1, end: 0 }, lifespan: 2600, frequency: 80, tint: [0xff7a2a, 0xffb020, 0xff3a1f] };
        break;
      default:
        cfg = { ...base, speedY: { min: -10, max: 12 }, speedX: { min: -12, max: 12 }, scale: { min: 0.5, max: 1.2 }, alpha: { start: 0.45, end: 0 }, lifespan: 5200, frequency: 150, tint: [0x8a5cff, 0x8fa8ff, 0xf2a53a] };
    }
    this.ambient = this.scene.add.particles(0, 0, 'px', cfg).setDepth(8);
  }

  update(px: number, py: number, entities: { x: number; y: number; displayHeight: number; scaleX: number }[]): void {
    this.playerLight.setPosition(px, py);
    this.shadowGfx.clear();
    this.shadowGfx.fillStyle(0x000000, 0.4);
    this.shadowGfx.fillEllipse(px, py + 6, 34, 14);
    for (const e of entities) {
      const w = Math.max(16, e.displayHeight * 0.5);
      this.shadowGfx.fillEllipse(e.x, e.y + 4, w, w * 0.42);
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.farWall.destroy();
    this.parallax.destroy();
    this.ambient?.destroy();
    this.playerLight.destroy();
    this.vignette.destroy();
    this.shadowGfx.destroy();
    this.decor.forEach((d) => d.destroy());
  }
}

function shade(c: number, amt: number): number {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) + amt));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (c & 255) + amt));
  return (r << 16) | (g << 8) | b;
}
function lightTint(zoneId: string): number {
  switch (zoneId) {
    case 'foret': return 0xd8f0d0;
    case 'marais': return 0xd8f0b0;
    case 'forge': return 0xffd0a0;
    default: return 0xd0d8ff;
  }
}
