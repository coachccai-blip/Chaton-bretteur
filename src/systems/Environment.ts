import Phaser from 'phaser';
import { WORLD_WIDTH, WORLD_HEIGHT } from '../config/game';
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
  private fg!: Phaser.GameObjects.Graphics;
  private fgParticles?: Phaser.GameObjects.Particles.ParticleEmitter;
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
    this.fg = scene.add.graphics().setDepth(68);
    this.shadowGfx = scene.add.graphics().setDepth(5);
    this.playerLight = scene.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'light')
      .setDepth(9).setBlendMode(Phaser.BlendModes.ADD).setScale(2.8).setAlpha(0.55);
    this.vignette = scene.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'vignette').setDepth(70).setAlpha(1)
      .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT); // couvre tout le monde dézoomé
  }

  setZone(zone: ZoneDef): void {
    this.accent = zone.palette.accent;
    const fog = zone.palette.fog;

    // fond profond : dégradé sombre, plus noir en haut
    this.bg.clear();
    this.bg.fillStyle(0x000000, 1).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.bg.fillStyle(fog, 0.9).fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.bg.fillStyle(shade(fog, -8), 1).fillRect(0, 0, WORLD_WIDTH, this.arena.y);

    // mur de fond lointain (brique, derrière l'arène) — couche de profondeur
    this.drawFarWall(zone);
    this.drawParallax(zone);
    this.setupAmbient(zone);
    this.buildDecor(zone);
    this.buildForeground(zone);
    this.playerLight.setTint(lightTint(zone.id));
  }

  /** Couche de premier plan (canopée, brume, lueur, chaînes) — profondeur. */
  private buildForeground(zone: ZoneDef): void {
    this.fg.clear();
    this.fgParticles?.destroy();
    this.fgParticles = undefined;
    const W = WORLD_WIDTH, H = WORLD_HEIGHT;
    if (zone.id === 'foret') {
      // canopée feuillue sombre en surplomb (haut) + feuilles qui tombent
      this.fg.fillStyle(0x0a1a0e, 0.92);
      for (let x = -20; x < W + 20; x += 30) { const r = 22 + ((x * 7) % 20); this.fg.fillCircle(x, 14 + ((x * 13) % 18), r); }
      this.fgParticles = this.scene.add.particles(0, 0, 'px', {
        x: { min: 0, max: W }, y: -10, speedY: { min: 18, max: 46 }, speedX: { min: -22, max: 22 },
        scale: { min: 0.5, max: 1 }, alpha: { start: 0.7, end: 0 }, lifespan: 6500, frequency: 380,
        rotate: { min: 0, max: 360 }, tint: [0x3fae63, 0x6fd68f, 0x9ee0a0],
      }).setDepth(67);
    } else if (zone.id === 'marais') {
      // brume dérivante au ras du sol
      this.fgParticles = this.scene.add.particles(0, 0, 'light', {
        x: { min: -40, max: W + 40 }, y: { min: H * 0.35, max: H }, speedX: { min: -12, max: 12 },
        scale: { min: 1.6, max: 3.2 }, alpha: { start: 0.05, end: 0 }, lifespan: 7000, frequency: 480,
        tint: 0x9fd0a0, blendMode: 'SCREEN',
      }).setDepth(67);
    } else if (zone.id === 'forge') {
      // lueur chaude au sol (premier plan)
      this.fg.fillStyle(0xff5a1f, 0.05).fillRect(0, H - 90, W, 90);
      this.fg.fillStyle(0xff8a2a, 0.04).fillRect(0, H - 50, W, 50);
    } else {
      // citadelle : chaînes suspendues aux coins hauts
      this.fg.fillStyle(0x24242c, 0.9);
      [70, W - 70].forEach((cx) => { for (let y = 0; y < 90; y += 9) this.fg.fillCircle(cx, y, 3.5); });
    }
  }

  private drawFarWall(zone: ZoneDef): void {
    this.farWall.clear();
    const top = 0, bottom = this.arena.y + 6;
    this.farWall.fillStyle(shade(zone.palette.wall, -18), 1).fillRect(0, top, WORLD_WIDTH, bottom);
    // rangées de briques faiblement visibles
    this.farWall.lineStyle(1, 0x000000, 0.35);
    for (let y = top + 12; y < bottom; y += 16) this.farWall.lineBetween(0, y, WORLD_WIDTH, y);
    for (let x = 0; x < WORLD_WIDTH; x += 40) {
      for (let y = top; y < bottom; y += 16) {
        const off = (Math.floor(y / 16) % 2) * 20;
        this.farWall.lineBetween(x + off, y, x + off, y + 16);
      }
    }
    // halo d'horizon chaud au niveau du sol
    this.farWall.fillStyle(zone.palette.accent, 0.06).fillRect(0, this.arena.y - 30, WORLD_WIDTH, 60);
  }

  private drawParallax(zone: ZoneDef): void {
    this.parallax.clear();
    const y0 = this.arena.y + 8;
    if (zone.id === 'foret' || zone.id === 'marais') {
      const far = shade(zone.palette.floor, -26);
      const near = shade(zone.palette.floor, -40);
      // couche lointaine
      for (let i = 0; i < 11; i++) {
        const x = i * 92 + 16, h = 60 + (i % 3) * 30;
        this.parallax.fillStyle(far, 0.4);
        if (zone.id === 'marais') { this.parallax.fillRect(x, y0 - h, 6, h); this.parallax.fillRect(x - 14, y0 - h * 0.7, 28, 4); this.parallax.fillRect(x - 8, y0 - h * 0.45, 16, 3); }
        else { this.parallax.fillCircle(x, y0 - h, 30); this.parallax.fillCircle(x - 18, y0 - h + 8, 20); this.parallax.fillCircle(x + 18, y0 - h + 6, 22); this.parallax.fillRect(x - 4, y0 - h, 8, h); }
      }
      // couche proche (plus sombre, plus grande)
      for (let i = 0; i < 7; i++) {
        const x = i * 140 + 60, h = 96 + (i % 3) * 40;
        this.parallax.fillStyle(near, 0.55);
        if (zone.id === 'marais') { this.parallax.fillRect(x, y0 - h, 9, h); this.parallax.fillRect(x - 20, y0 - h * 0.6, 40, 5); }
        else { this.parallax.fillCircle(x, y0 - h, 42); this.parallax.fillCircle(x - 24, y0 - h + 10, 28); this.parallax.fillCircle(x + 24, y0 - h + 8, 30); this.parallax.fillRect(x - 5, y0 - h, 11, h); }
      }
    } else if (zone.id === 'forge') {
      for (let i = 0; i < 7; i++) {
        const x = 10 + i * 132, w = 80 + (i % 3) * 28, h = 90 + (i % 4) * 60;
        this.parallax.fillStyle(shade(zone.palette.wall, -12), 0.55);
        this.parallax.fillTriangle(x - 14, y0, x + w / 2, y0 - h, x + w + 14, y0);
      }
      this.parallax.fillStyle(0xff5a1f, 0.12).fillRect(0, y0 - 42, WORLD_WIDTH, 52);
    } else {
      // citadelle : tours + arches lointaines
      for (let i = 0; i < 8; i++) {
        const x = 26 + i * 118 + (i % 2) * 22, w = 58 + (i % 3) * 26, h = 90 + (i % 4) * 56;
        this.parallax.fillStyle(shade(zone.palette.wall, -8), 0.5);
        this.parallax.fillRect(x, y0 - h, w, h);
        // créneaux
        for (let c = 0; c < w; c += 14) this.parallax.fillRect(x + c, y0 - h - 6, 8, 8);
        this.parallax.fillStyle(shade(zone.palette.accent, -30), 0.14).fillRect(x + w / 2 - 3, y0 - h + 8, 6, h - 12);
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

    // bannières (constructions humaines) uniquement forge / citadelle
    if (zone.id === 'citadelle' || zone.id === 'forge') {
      const banW = a.w;
      [a.x + banW * 0.06, a.x + banW * 0.94].forEach((bx) => {
        const ban = this.scene.add.image(bx, a.y + 26, 'deco_banner').setDepth(6).setScale(1.1).setTint(zone.palette.accent).setOrigin(0.5, 0);
        this.scene.tweens.add({ targets: ban, angle: { from: -1.5, to: 1.5 }, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.decor.push(ban);
      });
    }
  }

  private setupAmbient(zone: ZoneDef): void {
    this.ambient?.destroy();
    const base = { x: { min: 0, max: WORLD_WIDTH }, y: { min: 0, max: WORLD_HEIGHT }, blendMode: 'ADD' as const, quantity: 1 };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    switch (zone.id) {
      case 'foret':
        cfg = { ...base, speedY: { min: -14, max: -4 }, speedX: { min: -8, max: 8 }, scale: { min: 0.5, max: 1.1 }, alpha: { start: 0.8, end: 0 }, lifespan: 4200, frequency: 170, tint: [0x9ee0a0, 0x59d9a0] };
        break;
      case 'marais':
        cfg = { ...base, speedY: { min: -30, max: -12 }, scale: { min: 0.6, max: 1.4 }, alpha: { start: 0.5, end: 0 }, lifespan: 3600, frequency: 200, tint: [0x9fe04a, 0x5a8a3a] };
        break;
      case 'forge':
        cfg = { ...base, y: WORLD_HEIGHT + 10, speedY: { min: -130, max: -50 }, speedX: { min: -22, max: 22 }, scale: { min: 0.5, max: 1.3 }, alpha: { start: 1, end: 0 }, lifespan: 2600, frequency: 80, tint: [0xff7a2a, 0xffb020, 0xff3a1f] };
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
    this.fg.destroy();
    this.fgParticles?.destroy();
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
