import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';

export class Projectile extends Phaser.Physics.Arcade.Sprite {
  gs: GameScene;
  damage: number;
  status?: 'poison' | 'freeze';
  private dieAt: number;

  constructor(scene: GameScene, x: number, y: number, vx: number, vy: number, damage: number, status?: 'poison' | 'freeze') {
    super(scene, x, y, 'orb');
    this.gs = scene;
    this.damage = damage;
    this.status = status;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(14);
    this.setScale(1.1);
    this.setTint(status === 'poison' ? 0x8fd94a : 0xff5a8a);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(5, this.width / 2 - 5, this.height / 2 - 5);
    body.setVelocity(vx, vy);
    body.setAllowGravity(false);
    this.dieAt = performance.now() + 4000;
    // petite traînée
    scene.tweens.add({ targets: this, scale: 1.4, duration: 300, yoyo: true, repeat: -1 });
  }

  preUpdate(t: number, dt: number): void {
    super.preUpdate(t, dt);
    this.setRotation(this.rotation + dt * 0.01);
    if (performance.now() > this.dieAt) this.destroy();
  }

  hitPlayer(): void {
    const p = this.gs.player;
    if (p && !p.dead) {
      p.takeDamage(this.damage, this.x, this.y);
      if (this.status === 'poison') this.gs.poisonPlayer();
    }
    this.gs.juice.burst(this.x, this.y, 0xff8aa8, 5, 90, 0.7);
    this.destroy();
  }
}
