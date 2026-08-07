import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { BossDef, BossMove, BossPhase } from '../config/bosses';
import type { IEnemyLike } from '../config/types';

export class Boss extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  def: BossDef;
  maxHp: number;
  hp: number;
  alive = true;
  contactDamage: number;

  private phaseIndex = 0;
  private moveCooldowns: number[] = [];
  private busy = false;
  private bobT = 0;
  private frozenUntil = 0;

  constructor(scene: GameScene, x: number, y: number, def: BossDef, hpMul: number, dmgMul: number) {
    super(scene, x, y, `boss_${def.sprite}`);
    this.gs = scene;
    this.def = def;
    this.maxHp = Math.round(def.hp * hpMul);
    this.hp = this.maxHp;
    this.contactDamage = def.contactDamage * dmgMul;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(16);
    this.setOrigin(0.5, 0.9);
    this.setScale(def.scale);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.55, this.height * 0.45);
    body.setOffset(this.width * 0.22, this.height * 0.5);
    body.setCollideWorldBounds(true);
    body.setImmovable(false);
    body.setBounce(0.1);
    body.setDrag(200, 200);

    this.resetMoveCooldowns();
    // entrée
    this.setScale(def.scale * 0.2).setAlpha(0);
    scene.tweens.add({ targets: this, scaleX: def.scale, scaleY: def.scale, alpha: 1, duration: 500, ease: 'Back.easeOut' });
  }

  private get phase(): BossPhase { return this.def.phases[this.phaseIndex]; }

  private resetMoveCooldowns(): void {
    this.moveCooldowns = this.phase.moves.map(() => performance.now() + 900 + Math.random() * 800);
  }

  isAlive(): boolean { return this.alive; }

  update(time: number, dt: number): void {
    if (!this.alive) return;
    const now = performance.now();
    const p = this.gs.player;
    if (!p || p.dead) { (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0); return; }

    // transition de phase
    const frac = this.hp / this.maxHp;
    while (this.phaseIndex < this.def.phases.length - 1 && frac <= this.def.phases[this.phaseIndex + 1].hpFrac) {
      this.phaseIndex++;
      this.enterPhase();
    }

    const frozen = now < this.frozenUntil;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = new Phaser.Math.Vector2(dx / dist, dy / dist);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (!this.busy && !frozen) {
      // maintien d'une distance moyenne
      const spd = this.phase.speed;
      if (dist > 220) body.setVelocity(dir.x * spd, dir.y * spd);
      else if (dist < 120) body.setVelocity(-dir.x * spd * 0.6, -dir.y * spd * 0.6);
      else body.setVelocity(-dir.y * spd * 0.4, dir.x * spd * 0.4);

      // choisir un move prêt
      for (let i = 0; i < this.phase.moves.length; i++) {
        if (now >= this.moveCooldowns[i]) {
          this.execMove(i, dir);
          break;
        }
      }
    } else if (frozen) {
      body.setVelocity(0, 0);
    }

    this.bobT += dt / 1000 * 5;
    const bob = Math.sin(this.bobT) * 0.03;
    if (!this.busy) this.setScale(this.def.scale * (1 - bob * 0.4), this.def.scale * (1 + bob));
    if (Math.abs(body.velocity.x) > 5) this.setFlipX(body.velocity.x < 0);
    if (frozen) this.setTint(0x8fdfff); else if (!this.phase.tint) this.clearTint(); else this.setTint(this.phase.tint);
  }

  private enterPhase(): void {
    this.gs.juice.shake(300, 0.012);
    this.gs.juice.ring(this.x, this.y, 200, this.phase.tint ?? 0xffffff, 500);
    this.gs.juice.burst(this.x, this.y, this.phase.tint ?? 0xffe0b0, 24, 220, 1.6);
    this.gs.sfx('special');
    this.resetMoveCooldowns();
    this.gs.events.emit('bossPhase', this.phaseIndex + 1, this.def.phases.length);
  }

  private execMove(i: number, dir: Phaser.Math.Vector2): void {
    const m = this.phase.moves[i];
    this.busy = true;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.setTintFill(0xffffff);
    this.gs.tweens.add({ targets: this, scaleX: this.def.scale * 1.12, scaleY: this.def.scale * 1.12, duration: m.telegraph, ease: 'Sine.easeInOut' });
    this.gs.time.delayedCall(m.telegraph, () => {
      if (!this.alive) { this.busy = false; return; }
      this.clearTint();
      this.setScale(this.def.scale);
      this.runMove(m, dir);
    });
    this.moveCooldowns[i] = performance.now() + m.telegraph + m.cooldown;
  }

  private runMove(m: BossMove, dir: Phaser.Math.Vector2): void {
    const p = this.gs.player;
    const done = (delay: number) => this.gs.time.delayedCall(delay, () => (this.busy = false));
    switch (m.type) {
      case 'aimedBurst': {
        const n = m.count ?? 1;
        for (let k = 0; k < n; k++) {
          this.gs.time.delayedCall(k * 120, () => {
            if (!this.alive || !p) return;
            const d = new Phaser.Math.Vector2(p.x - this.x, p.y - this.y).normalize();
            this.gs.spawnEnemyProjectile(this.x, this.y - 20, d.x, d.y, m.speed ?? 220, m.damage ?? 12);
          });
        }
        done(n * 120 + 100);
        break;
      }
      case 'ringShot': {
        const n = m.count ?? 10;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          this.gs.spawnEnemyProjectile(this.x, this.y - 10, Math.cos(a), Math.sin(a), m.speed ?? 180, m.damage ?? 12);
        }
        this.gs.juice.ring(this.x, this.y, 70, 0xff6a3a, 300);
        done(200);
        break;
      }
      case 'spiral': {
        const n = m.count ?? 16;
        for (let k = 0; k < n; k++) {
          this.gs.time.delayedCall(k * 60, () => {
            if (!this.alive) return;
            const a = (k / n) * Math.PI * 4;
            this.gs.spawnEnemyProjectile(this.x, this.y - 10, Math.cos(a), Math.sin(a), m.speed ?? 170, m.damage ?? 12);
          });
        }
        done(n * 60 + 100);
        break;
      }
      case 'shockwave': {
        const r = m.radius ?? 150;
        this.gs.tweens.add({ targets: this, y: this.y - 20, duration: 200, yoyo: true, ease: 'Quad.easeOut', onComplete: () => {
          if (!this.alive) return;
          this.gs.juice.ring(this.x, this.y, r, 0xffa53a, 350);
          this.gs.juice.shake(220, 0.01);
          if (p && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) <= r) p.takeDamage(m.damage ?? 18, this.x, this.y);
        }});
        done(500);
        break;
      }
      case 'summon': {
        this.gs.summonMinions(this.x, this.y, m.summonId ?? 'slime', m.summonCount ?? 3);
        this.gs.juice.ring(this.x, this.y, 90, 0xb26bff, 350);
        done(200);
        break;
      }
      case 'charge': {
        const d = p ? new Phaser.Math.Vector2(p.x - this.x, p.y - this.y).normalize() : dir;
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(d.x * (m.chargeSpeed ?? 500), d.y * (m.chargeSpeed ?? 500));
        this.gs.juice.burst(this.x, this.y, 0xffd24a, 10, 160, 1);
        this.gs.time.delayedCall(600, () => { if (this.alive) (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0); });
        done(700);
        break;
      }
    }
  }

  // ---------- IEnemyLike ----------
  takeDamage(amount: number, _fx: number, _fy: number, opts?: { silent?: boolean }): void {
    if (!this.alive) return;
    this.hp = Math.max(0, this.hp - amount);
    if (!opts?.silent) {
      this.gs.juice.flash(this, 60);
      this.gs.sfx('hitmob');
    }
    this.gs.events.emit('bossHp', this.hp, this.maxHp);
    if (this.hp <= 0) this.die();
  }

  applyStatus(status: 'bleed' | 'freeze' | 'poison', duration: number): void {
    // les boss résistent : gel raccourci, saignement léger
    if (status === 'freeze') this.frozenUntil = Math.max(this.frozenUntil, performance.now() + duration * 0.4);
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.gs.onBossKilled(this);
  }
}
