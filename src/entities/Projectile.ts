import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  gs: GameScene;
  damage: number;
  status?: 'poison' | 'freeze';
  private dieAt: number;

  constructor(scene: GameScene, x: number, y: number, vx: number, vy: number, damage: number, status?: 'poison' | 'freeze', tint?: number) {
    super(scene, x, y, 'orb');
    this.gs = scene;
    this.damage = damage;
    this.status = status;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(14);
    this.setScale(1.2);
    this.setTint(tint ?? (status === 'poison' ? 0x8fd94a : 0xff5a8a));
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(5, this.width / 2 - 5, this.height / 2 - 5);
    body.setVelocity(vx, vy);
    body.setAllowGravity(false);
    this.dieAt = performance.now() + 4000;
    // petite traînée
    scene.tweens.add({ targets: this, scale: 1.4, duration: 300, yoyo: true, repeat: -1 });
  }

  private slowed = false;

  preUpdate(t: number, dt: number): void {
    super.preUpdate(t, dt);
    this.setRotation(this.rotation + dt * 0.01);
    // Moustaches Radar : ralentit une fois les projectiles qui entrent dans le rayon.
    const p = this.gs.player;
    if (!this.slowed && p && !p.dead && p.mods.projSlow) {
      const rr = p.stats.projSlowRadius || 70;
      if (Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y) < rr) {
        this.slowed = true;
        (this.body as Phaser.Physics.Arcade.Body).velocity.scale(0.85);
      }
    }
    if (performance.now() > this.dieAt) this.destroy();
  }

  hitPlayer(): void {
    const p = this.gs.player;
    if (p && !p.dead) {
      // Portail Miroitant : chance d'avaler le projectile et de le renvoyer (×1,5).
      if (p.mods.reflect && Math.random() < p.mods.reflect) {
        const b = this.body as Phaser.Physics.Arcade.Body;
        const sp = Math.hypot(b.velocity.x, b.velocity.y) || 220;
        this.gs.friendlyShot(this.x, this.y, -b.velocity.x / sp, -b.velocity.y / sp, sp * 1.1, Math.round(this.damage * 1.5), { color: 0xb26bff, pierce: false });
        this.gs.juice.ring(this.x, this.y, 30, 0xb26bff, 260);
        this.destroy();
        return;
      }
      p.takeDamage(this.damage, this.x, this.y);
      if (this.status === 'poison') this.gs.poisonPlayer();
    }
    this.gs.juice.burst(this.x, this.y, 0xff8aa8, 5, 90, 0.7);
    this.destroy();
  }
}
