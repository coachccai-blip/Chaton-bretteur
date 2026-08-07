import Phaser from 'phaser';

/** Effets de "game feel" : shake, hit-stop, particules, flash. */
export class JuiceManager {
  private scene: Phaser.Scene;
  private frozenUntil = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  shake(duration = 120, intensity = 0.006): void {
    this.scene.cameras.main.shake(duration, intensity);
  }

  /** Micro-pause pour donner du poids aux impacts. */
  hitStop(ms = 45): void {
    const world = this.scene.physics.world;
    const now = performance.now();
    if (now < this.frozenUntil) {
      this.frozenUntil = Math.max(this.frozenUntil, now + ms);
      return;
    }
    this.frozenUntil = now + ms;
    world.pause();
    window.setTimeout(() => {
      if (this.scene.scene.isActive() && performance.now() >= this.frozenUntil - 5) {
        world.resume();
      }
    }, ms);
  }

  /** Flash blanc sur une entité touchée. */
  flash(obj: Phaser.GameObjects.Sprite, ms = 90): void {
    obj.setTintFill(0xffffff);
    this.scene.time.delayedCall(ms, () => {
      if (obj.active) obj.clearTint();
    });
  }

  /** Explosion de particules courtes. */
  burst(x: number, y: number, color: number, count = 8, speed = 140, scale = 1): void {
    const p = this.scene.add.particles(x, y, 'px', {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: scale, end: 0 },
      lifespan: { min: 200, max: 380 },
      quantity: count,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });
    p.setDepth(60);
    p.explode(count);
    this.scene.time.delayedCall(500, () => p.destroy());
  }

  /** Traînée directionnelle (dash). */
  dashTrail(x: number, y: number, color: number): void {
    const p = this.scene.add.particles(x, y, 'px', {
      speed: 20,
      scale: { start: 1.2, end: 0 },
      lifespan: 260,
      quantity: 6,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });
    p.setDepth(6);
    p.explode(6);
    this.scene.time.delayedCall(400, () => p.destroy());
  }

  /** Anneau de choc qui s'agrandit (spécial, ondes de boss). */
  ring(x: number, y: number, radius: number, color: number, ms = 300): void {
    const g = this.scene.add.circle(x, y, 8, color, 0.25);
    g.setStrokeStyle(3, color, 0.9);
    g.setDepth(55);
    this.scene.tweens.add({
      targets: g,
      radius,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onUpdate: () => g.setStrokeStyle(3, color, g.alpha),
      onComplete: () => g.destroy(),
    });
  }

  /** Texte flottant (dégâts, gains). */
  popText(x: number, y: number, text: string, color: string, size = 16): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    t.setOrigin(0.5).setDepth(80);
    this.scene.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
