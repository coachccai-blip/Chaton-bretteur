import Phaser from 'phaser';

/**
 * Flammes noires d'Amaterasu superposées à une entité qui subit la Brûlure Noire.
 * Deux langues de flamme scintillantes en pixel art + gerbe de braises violettes.
 * Réutilisable par Enemy et Boss ; à détruire quand le statut s'éteint.
 */
export class BlackFlameFx {
  private flames: Phaser.GameObjects.Sprite[] = [];
  private emitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private t = Math.random() * 6;

  constructor(private scene: Phaser.Scene, private depth = 18) {}

  private ensure(): void {
    if (this.flames.length) return;
    for (let i = 0; i < 2; i++) {
      this.flames.push(
        this.scene.add.sprite(0, 0, 'black_flame').setDepth(this.depth).setOrigin(0.5, 0.85),
      );
    }
    // braises violettes montantes (lueur cursed du feu noir)
    this.emitter = this.scene.add.particles(0, 0, 'px', {
      speedY: { min: -70, max: -30 }, speedX: { min: -18, max: 18 },
      scale: { start: 1.1, end: 0 }, alpha: { start: 0.9, end: 0 },
      lifespan: 460, frequency: 60, tint: [0x2a0a3a, 0x6a1a8a, 0x9a3ada],
      blendMode: 'ADD',
    }).setDepth(this.depth - 1);
  }

  /** Positionne et anime les flammes sur l'entité (cx,cy = centre du corps). */
  update(cx: number, cy: number, bodyH: number, dt: number): void {
    this.ensure();
    this.t += dt / 1000 * 9;
    const base = Phaser.Math.Clamp(bodyH / 40, 0.7, 2.2);
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i];
      const ph = this.t + i * 2.1;
      const sway = Math.sin(ph) * (3 + i * 2);
      f.setPosition(cx + sway + (i === 0 ? -4 : 4), cy + Math.sin(ph * 1.3) * 2)
        .setScale(base * (0.9 + 0.18 * Math.sin(ph * 1.7)) * (i === 0 ? 1 : 0.8),
                  base * (1.05 + 0.25 * Math.sin(ph * 1.4)))
        .setAlpha(0.82 + 0.18 * Math.sin(ph * 2.3));
    }
    this.emitter?.setPosition(cx, cy - bodyH * 0.2);
  }

  destroy(): void {
    for (const f of this.flames) f.destroy();
    this.flames = [];
    this.emitter?.destroy();
    this.emitter = undefined;
  }
}
