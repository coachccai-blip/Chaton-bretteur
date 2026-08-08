import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

export type TrapType = 'spike' | 'lava' | 'toxic';

/** Piège d'environnement avec visuel dangereux (pics, lave, poison). */
export class Trap {
  private gs: GameScene;
  x: number;
  y: number;
  type: TrapType;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private spikes?: Phaser.GameObjects.Sprite;
  private base?: Phaser.GameObjects.Sprite;
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private state: 'safe' | 'warn' | 'up' = 'safe';
  private nextAt = 0;
  private nextTick = 0;
  private radius: number;
  hurtThisCycle = false;

  constructor(gs: GameScene, x: number, y: number, type: TrapType) {
    this.gs = gs;
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = type === 'spike' ? 30 : 42;
    if (type === 'spike') this.buildSpike();
    else this.buildPool(type);
    this.nextAt = performance.now() + 800 + Math.random() * 1500;
  }

  private buildSpike(): void {
    this.base = this.gs.add.sprite(this.x, this.y, 'trap_base').setDepth(3);
    this.spikes = this.gs.add.sprite(this.x, this.y + 24, 'trap_spikes').setOrigin(0.5, 1).setDepth(16);
    this.spikes.setScale(1, 0).setAlpha(0.95);
    this.objs.push(this.base, this.spikes);
  }

  private buildPool(type: TrapType): void {
    const key = type === 'lava' ? 'pool_lava' : 'pool_toxic';
    const glowColor = type === 'lava' ? 0xff6a1f : 0x8fd94a;
    const glow = this.gs.add.image(this.x, this.y, 'light').setTint(glowColor).setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setScale(0.9).setAlpha(0.5);
    const pool = this.gs.add.sprite(this.x, this.y, key).setDepth(3);
    this.gs.tweens.add({ targets: pool, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.gs.tweens.add({ targets: glow, alpha: 0.28, duration: 900, yoyo: true, repeat: -1 });
    this.emitter = this.gs.add.particles(this.x, this.y, 'px', {
      speedY: { min: -60, max: -20 }, speedX: { min: -14, max: 14 },
      scale: { start: 1.1, end: 0 }, lifespan: { min: 500, max: 1000 }, frequency: type === 'lava' ? 120 : 200,
      tint: type === 'lava' ? [0xffd24a, 0xff6a1f] : [0xbfe86a, 0x8fd94a], blendMode: 'ADD',
      emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, this.radius * 0.7) } as any,
    }).setDepth(15);
    this.objs.push(glow, pool, this.emitter);
  }

  update(now: number, px: number, py: number, playerAlive: boolean): { slow: number } {
    // Transmutation Mineure : désamorce le piège si le chaton (avec le boon) est
    // à moins de 60 px — il ne blesse plus tant qu'on reste à portée.
    if (playerAlive && this.gs.player?.mods.disarm && Phaser.Math.Distance.Between(px, py, this.x, this.y) < 60) {
      this.base?.setTint(0x59c8ff);
      return { slow: 1 };
    }
    const inside = playerAlive && Phaser.Math.Distance.Between(px, py, this.x, this.y) < this.radius;
    let slow = 1;

    if (this.type === 'spike') {
      if (this.state === 'safe' && now >= this.nextAt) {
        this.state = 'warn';
        this.nextAt = now + 550;
        this.base?.setTint(0xff5a3a);
        this.gs.tweens.add({ targets: this.base, scaleX: 1.08, scaleY: 1.08, duration: 550, yoyo: true });
      } else if (this.state === 'warn' && now >= this.nextAt) {
        this.state = 'up';
        this.nextAt = now + 650;
        this.hurtThisCycle = false;
        this.base?.clearTint();
        this.gs.tweens.add({ targets: this.spikes, scaleY: 1, duration: 90, ease: 'Back.easeOut' });
        this.gs.sfx('spike');
      } else if (this.state === 'up') {
        if (inside && !this.hurtThisCycle) {
          this.hurtThisCycle = true;
          this.gs.hurtPlayer(14);
          this.gs.juice.burst(px, py, 0xcccccc, 6, 120, 0.8);
        }
        if (now >= this.nextAt) {
          this.state = 'safe';
          this.nextAt = now + 1400 + Math.random() * 1400;
          this.gs.tweens.add({ targets: this.spikes, scaleY: 0, duration: 160 });
        }
      }
    } else {
      // lave / poison : dégâts continus tant qu'on est dedans
      if (inside) {
        if (this.type === 'toxic') slow = 0.55;
        if (now >= this.nextTick) {
          this.nextTick = now + (this.type === 'lava' ? 450 : 600);
          this.gs.hurtPlayer(this.type === 'lava' ? 9 : 5);
          if (this.type === 'toxic') this.gs.poisonPlayer();
        }
      }
    }
    return { slow };
  }

  destroy(): void {
    this.objs.forEach((o) => o.destroy());
    this.objs = [];
  }
}
