import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { EnemyDef } from '../config/enemies';
import type { IEnemyLike } from '../config/types';

type State = 'idle' | 'telegraph' | 'charging' | 'recover';

export class Enemy extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  def: EnemyDef;
  maxHp: number;
  hp: number;
  damage: number;
  alive = true;

  private aiState: State = 'idle';
  private nextActionAt = 0;
  private aiStateUntil = 0;
  private chargeDir = new Phaser.Math.Vector2();
  private bobT = Math.random() * 6;

  // statuts
  private frozenUntil = 0;
  private bleedUntil = 0;
  private nextBleedTick = 0;

  // barre de vie
  private hpBg?: Phaser.GameObjects.Rectangle;
  private hpFill?: Phaser.GameObjects.Rectangle;

  constructor(scene: GameScene, x: number, y: number, def: EnemyDef, hpMul: number, dmgMul: number) {
    super(scene, x, y, `mob_${def.sprite}`);
    this.gs = scene;
    this.def = def;
    this.maxHp = Math.round(def.hp * hpMul);
    this.hp = this.maxHp;
    this.damage = def.damage * dmgMul;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(15);
    this.setOrigin(0.5, 0.9);
    this.setScale(def.scale);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const bw = this.width * def.scale * 0.5;
    const bh = this.height * def.scale * 0.4;
    body.setSize(bw / def.scale, bh / def.scale);
    body.setOffset((this.width - bw / def.scale) / 2, this.height * 0.55);
    body.setCollideWorldBounds(true);
    body.setBounce(0.2);

    this.nextActionAt = performance.now() + 400 + Math.random() * 800;
    // apparition
    this.setScale(def.scale * 0.2);
    scene.tweens.add({ targets: this, scaleX: def.scale, scaleY: def.scale, duration: 220, ease: 'Back.easeOut' });
  }

  isAlive(): boolean { return this.alive; }

  update(time: number, dt: number): void {
    if (!this.alive) return;
    const now = performance.now();
    const player = this.gs.player;
    if (!player || player.dead) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    // statuts
    const frozen = now < this.frozenUntil;
    if (now < this.bleedUntil && now >= this.nextBleedTick) {
      this.nextBleedTick = now + 500;
      this.hp -= Math.max(1, Math.round(this.maxHp * 0.03));
      this.gs.juice.burst(this.x, this.y - 12, 0xc0392b, 3, 60, 0.5);
      if (this.hp <= 0) { this.kill(true); return; }
    }

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = new Phaser.Math.Vector2(dx / dist, dy / dist);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const spd = this.def.speed * (frozen ? 0 : 1);

    switch (this.def.behavior) {
      case 'chaser': body.setVelocity(dir.x * spd, dir.y * spd); break;
      case 'tank': body.setVelocity(dir.x * spd, dir.y * spd); break;
      case 'exploder': this.updateExploder(now, dir, dist, spd); break;
      case 'shooter': this.updateShooter(now, dir, dist, spd, false); break;
      case 'summoner': this.updateShooter(now, dir, dist, spd, true); break;
      case 'charger': this.updateCharger(now, dir, dist, spd); break;
    }

    if (frozen) this.setTint(0x8fdfff);
    else if (this.tintTopLeft === 0x8fdfff) this.clearTint();

    this.animate(dt, body);
    this.updateHpBar();
  }

  private animate(dt: number, body: Phaser.Physics.Arcade.Body): void {
    this.bobT += dt / 1000 * 8;
    const moving = body.velocity.lengthSq() > 100;
    const bob = Math.sin(this.bobT) * (moving ? 0.08 : 0.04);
    const s = this.def.scale;
    if (this.aiState !== 'telegraph') this.setScale(s * (1 - bob * 0.4), s * (1 + bob));
    if (Math.abs(body.velocity.x) > 5) this.setFlipX(body.velocity.x < 0);
  }

  private updateExploder(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const r = this.def.attack?.explodeRadius ?? 60;
    if (this.aiState === 'idle') {
      body.setVelocity(dir.x * spd, dir.y * spd);
      if (dist < r * 0.6) this.beginTelegraph(now, this.def.attack?.telegraph ?? 600, 0xff5a3a, () => this.explode(r));
    } else if (this.aiState === 'telegraph') {
      body.setVelocity(dir.x * spd * 0.3, dir.y * spd * 0.3);
    }
  }

  private explode(r: number): void {
    if (!this.alive) return;
    this.gs.juice.ring(this.x, this.y, r, 0xff5a3a, 260);
    this.gs.juice.burst(this.x, this.y, 0xff7a3a, 14, 200, 1.2);
    this.gs.juice.shake(140, 0.006);
    const p = this.gs.player;
    if (p && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) <= r) {
      p.takeDamage(this.damage, this.x, this.y);
      if (this.def.attack?.status === 'poison') this.gs.poisonPlayer();
    }
    this.kill(false);
  }

  private updateShooter(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number, summoner: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 240;
    if (this.aiState === 'idle') {
      // garder ses distances
      if (dist < range * 0.6) body.setVelocity(-dir.x * spd, -dir.y * spd);
      else if (dist > range) body.setVelocity(dir.x * spd, dir.y * spd);
      else body.setVelocity(-dir.y * spd * 0.5, dir.x * spd * 0.5); // strafe
      if (now >= this.nextActionAt && dist <= range * 1.2) {
        this.beginTelegraph(now, this.def.attack?.telegraph ?? 500, 0xff4a7a, () => {
          if (summoner && Math.random() < 0.5) this.summon();
          else this.shoot(dir);
          this.nextActionAt = performance.now() + (this.def.attack?.cooldown ?? 1800);
        });
      }
    }
  }

  private shoot(dir: Phaser.Math.Vector2): void {
    if (!this.alive) return;
    const a = this.def.attack!;
    this.gs.spawnEnemyProjectile(this.x, this.y - 16, dir.x, dir.y, a.projectileSpeed ?? 180, a.projectileDamage ?? 8, a.status);
  }

  private summon(): void {
    const a = this.def.attack!;
    this.gs.summonMinions(this.x, this.y, a.summonId ?? 'fantome', a.summonCount ?? 2);
    this.gs.juice.ring(this.x, this.y, 60, 0xb26bff, 300);
  }

  private updateCharger(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 300;
    if (this.aiState === 'idle') {
      if (dist > range) body.setVelocity(dir.x * spd, dir.y * spd);
      else body.setVelocity(dir.x * spd * 0.4, dir.y * spd * 0.4);
      if (now >= this.nextActionAt && dist <= range) {
        this.chargeDir.copy(dir);
        this.beginTelegraph(now, this.def.attack?.telegraph ?? 700, 0xffd24a, () => this.startCharge());
      }
    } else if (this.aiState === 'charging') {
      if (now >= this.aiStateUntil) {
        this.aiState = 'recover';
        this.aiStateUntil = now + 600;
        body.setVelocity(0, 0);
      } else {
        const cs = this.def.attack?.chargeSpeed ?? 440;
        body.setVelocity(this.chargeDir.x * cs, this.chargeDir.y * cs);
      }
    } else if (this.aiState === 'recover') {
      body.setVelocity(0, 0);
      if (now >= this.aiStateUntil) {
        this.aiState = 'idle';
        this.nextActionAt = now + (this.def.attack?.cooldown ?? 2200);
      }
    }
  }

  private startCharge(): void {
    if (!this.alive) return;
    this.aiState = 'charging';
    this.aiStateUntil = performance.now() + 500;
    this.gs.juice.burst(this.x, this.y, 0xffd24a, 6, 120, 0.8);
  }

  private beginTelegraph(now: number, ms: number, color: number, cb: () => void): void {
    this.aiState = 'telegraph';
    this.setTintFill(color);
    const s = this.def.scale;
    this.gs.tweens.add({ targets: this, scaleX: s * 1.25, scaleY: s * 1.25, duration: ms, yoyo: false, ease: 'Sine.easeInOut' });
    this.gs.time.delayedCall(ms, () => {
      if (!this.alive) return;
      this.clearTint();
      this.setScale(s);
      if (this.aiState === 'telegraph') this.aiState = 'idle';
      cb();
    });
  }

  // ---------- IEnemyLike ----------
  takeDamage(amount: number, fromX: number, fromY: number, opts?: { silent?: boolean }): void {
    if (!this.alive) return;
    this.hp -= amount;
    if (!opts?.silent) {
      this.gs.juice.flash(this, 80);
      this.gs.juice.burst(this.x, this.y - 10, 0xffffff, 5, 120, 0.7);
      this.gs.sfx('hitmob');
    }
    if (this.hp <= 0) this.kill(true);
  }

  applyStatus(status: 'bleed' | 'freeze' | 'poison', duration: number): void {
    const now = performance.now();
    if (status === 'freeze') this.frozenUntil = Math.max(this.frozenUntil, now + duration);
    else if (status === 'bleed' || status === 'poison') {
      this.bleedUntil = Math.max(this.bleedUntil, now + duration);
      this.nextBleedTick = Math.min(this.nextBleedTick || now, now + 500);
    }
  }

  kill(byPlayer: boolean): void {
    if (!this.alive) return;
    this.alive = false;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.gs.juice.burst(this.x, this.y - 10, 0xffe0b0, 12, 180, 1.2);
    this.gs.onEnemyKilled(this, byPlayer);
    this.hpBg?.destroy();
    this.hpFill?.destroy();
    this.gs.tweens.add({
      targets: this, scaleX: this.def.scale * 1.3, scaleY: 0, alpha: 0, duration: 200,
      onComplete: () => this.destroy(),
    });
  }

  private updateHpBar(): void {
    if (this.hp >= this.maxHp) {
      this.hpBg?.setVisible(false);
      this.hpFill?.setVisible(false);
      return;
    }
    const w = 30;
    const y = this.y - this.displayHeight * 0.9 - 6;
    if (!this.hpBg) {
      this.hpBg = this.gs.add.rectangle(this.x, y, w, 4, 0x000000, 0.6).setDepth(30);
      this.hpFill = this.gs.add.rectangle(this.x - w / 2, y, w, 3, 0xe8384f).setOrigin(0, 0.5).setDepth(31);
    }
    this.hpBg.setPosition(this.x, y).setVisible(true);
    this.hpFill!.setPosition(this.x - w / 2, y).setVisible(true);
    this.hpFill!.width = w * Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
  }

  destroy(fromScene?: boolean): void {
    this.hpBg?.destroy();
    this.hpFill?.destroy();
    super.destroy(fromScene);
  }
}
