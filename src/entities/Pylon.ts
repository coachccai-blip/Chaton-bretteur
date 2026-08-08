import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Element, IEnemyLike } from '../config/types';

/**
 * Pilône de glace invoqué par Glacior. Tant qu'au moins un pilône est debout, le
 * boss est invincible. Le joueur doit tous les briser. Immunisé aux statuts.
 */
export class Pylon extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  maxHp: number;
  hp: number;
  alive = true;
  isBoss = false;

  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private aura: Phaser.GameObjects.Image;

  constructor(scene: GameScene, x: number, y: number, hp: number) {
    super(scene, x, y, 'ice_pylon');
    this.gs = scene;
    this.maxHp = hp;
    this.hp = hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(15);
    this.setOrigin(0.5, 0.92);
    this.setScale(2);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setSize(this.width * 0.6, this.height * 0.5);
    body.setOffset(this.width * 0.2, this.height * 0.45);

    this.aura = scene.add.image(x, y - 24, 'light').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x7fdcff).setDepth(14).setScale(1.4).setAlpha(0.45);
    scene.tweens.add({ targets: this.aura, alpha: 0.2, scale: 1.8, duration: 800, yoyo: true, repeat: -1 });

    const w = 44;
    this.hpBg = scene.add.rectangle(x, y - this.displayHeight - 6, w, 5, 0x000000, 0.6).setDepth(30);
    this.hpFill = scene.add.rectangle(x - w / 2, y - this.displayHeight - 6, w, 4, 0x7fdcff).setOrigin(0, 0.5).setDepth(31);

    // apparition
    this.setScale(0.2).setAlpha(0);
    scene.tweens.add({ targets: this, scaleX: 2, scaleY: 2, alpha: 1, duration: 380, ease: 'Back.easeOut' });
  }

  isAlive(): boolean { return this.alive; }

  // Immunisé aux statuts élémentaires (bloc de glace pur).
  applyStatus(_status: Element, _duration: number): void { /* no-op */ }

  takeDamage(amount: number, _fx: number, _fy: number, opts?: { silent?: boolean }): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (!opts?.silent) {
      this.gs.juice.flash(this, 70, 0xbfeaff);
      this.gs.juice.burst(this.x, this.y - 24, 0xbfeaff, 5, 120, 0.7);
      this.gs.sfx('hitmob');
    }
    const w = 44;
    this.hpFill.width = w * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    if (this.hp <= 0) this.shatter();
  }

  private shatter(): void {
    if (!this.alive) return;
    this.alive = false;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.gs.juice.burst(this.x, this.y - 24, 0xbfeaff, 22, 240, 1.6);
    this.gs.juice.ring(this.x, this.y - 20, 50, 0x7fdcff, 320);
    this.gs.sfx('freeze');
    this.hpBg.destroy();
    this.hpFill.destroy();
    this.gs.tweens.add({ targets: this.aura, alpha: 0, duration: 300, onComplete: () => this.aura.destroy() });
    this.gs.tweens.add({ targets: this, scaleY: 0, alpha: 0, duration: 240, onComplete: () => this.destroy() });
  }

  destroy(fromScene?: boolean): void {
    this.hpBg?.destroy();
    this.hpFill?.destroy();
    this.aura?.destroy();
    super.destroy(fromScene);
  }
}
