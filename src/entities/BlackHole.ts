import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { Element, IEnemyLike } from '../config/types';

/**
 * TROU NOIR de Néantis. Apparaît sur un coin de l'arène, tourne sur lui-même et
 * ASPIRE très fort le joueur (l'aspiration est pilotée par GameScene). Le joueur
 * est retenu tant qu'il ne l'a pas détruit. PV = moitié de ceux de Néantis.
 * Immunisé aux statuts (objet du néant).
 */
export class BlackHole extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  maxHp: number;
  hp: number;
  alive = true;
  isBoss = false;
  /** Rayon d'aspiration/hitbox utilisé par la scène. */
  readonly pullRadius = 42;

  private hpBg: Phaser.GameObjects.Rectangle;
  private hpFill: Phaser.GameObjects.Rectangle;
  private aura: Phaser.GameObjects.Image;
  private spawnX = 0;
  private spawnY = 0;

  constructor(scene: GameScene, x: number, y: number, hp: number) {
    super(scene, x, y, 'blackhole');
    this.gs = scene;
    this.maxHp = Math.max(1, Math.round(hp));
    this.hp = this.maxHp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(15);
    this.setOrigin(0.5, 0.5);
    this.setScale(1.6);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.moves = false; // rivé à sa position (aucune dérive sur knockback)
    body.setVelocity(0, 0);
    body.setSize(this.width * 0.7, this.height * 0.7);
    body.setOffset(this.width * 0.15, this.height * 0.15);
    this.spawnX = x; this.spawnY = y;

    // halo violet pulsant + rotation continue (le trou « tourne sur lui-même »)
    this.aura = scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x8a2ec8).setDepth(14).setScale(2).setAlpha(0.5);
    scene.tweens.add({ targets: this.aura, alpha: 0.22, scale: 2.6, duration: 700, yoyo: true, repeat: -1 });
    scene.tweens.add({ targets: this, angle: 360, duration: 900, repeat: -1, ease: 'Linear' });

    const w = 52;
    this.hpBg = scene.add.rectangle(x, y - this.displayHeight * 0.62 - 6, w, 5, 0x000000, 0.6).setDepth(30);
    this.hpFill = scene.add.rectangle(x - w / 2, y - this.displayHeight * 0.62 - 6, w, 4, 0xc850f0).setOrigin(0, 0.5).setDepth(31);

    // apparition (implosion)
    this.setScale(0.2).setAlpha(0);
    scene.tweens.add({ targets: this, scaleX: 1.6, scaleY: 1.6, alpha: 1, duration: 360, ease: 'Back.easeOut' });
    scene.juice.ring(x, y, 90, 0xb040e0, 420);
  }

  isAlive(): boolean { return this.alive; }

  /** Ré-ancre le trou noir (sécurité : aucune force ne doit le déplacer). */
  protected preUpdate(t: number, dt: number): void {
    super.preUpdate(t, dt);
    if (this.alive && (this.x !== this.spawnX || this.y !== this.spawnY)) this.setPosition(this.spawnX, this.spawnY);
  }

  // Objet du néant : insensible aux statuts élémentaires.
  applyStatus(_status: Element, _duration: number): void { /* no-op */ }

  takeDamage(amount: number, _fx: number, _fy: number, opts?: { silent?: boolean; crit?: boolean; magic?: boolean }): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (!opts?.silent) {
      this.gs.juice.flash(this, 70, 0xe0a0ff);
      this.gs.juice.burst(this.x, this.y, 0xd8a0ff, 5, 120, 0.7);
      this.gs.juice.damageNumber(this.x, this.y - this.displayHeight * 0.5, Math.round(amount), !!opts?.crit);
      this.gs.sfx('hitmob');
    }
    const w = 52;
    this.hpFill.width = w * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    if (this.hp <= 0) this.collapse();
  }

  private collapse(): void {
    if (!this.alive) return;
    this.alive = false;
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.gs.juice.burst(this.x, this.y, 0xd8a0ff, 26, 280, 1.8);
    this.gs.juice.ring(this.x, this.y, 70, 0xb040e0, 340);
    this.gs.juice.shake(200, 0.01);
    this.gs.sfx('reaction');
    this.hpBg.destroy();
    this.hpFill.destroy();
    this.gs.tweens.killTweensOf(this.aura);
    this.gs.tweens.add({ targets: this.aura, alpha: 0, duration: 300, onComplete: () => this.aura.destroy() });
    this.gs.tweens.killTweensOf(this);
    this.gs.tweens.add({ targets: this, scaleX: 0, scaleY: 0, angle: this.angle + 220, alpha: 0, duration: 260, onComplete: () => this.destroy() });
  }

  destroy(fromScene?: boolean): void {
    this.hpBg?.destroy();
    this.hpFill?.destroy();
    if (this.aura) this.gs.tweens.killTweensOf(this.aura);
    this.aura?.destroy();
    this.gs.tweens.killTweensOf(this);
    super.destroy(fromScene);
  }
}
