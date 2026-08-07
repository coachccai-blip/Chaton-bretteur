import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { PlayerStats } from '../config/game';
import type { IPlayerContext, IEnemyLike, ICombatScene, OnHitFn, OnKillFn, VoidFn, SpecialFlag, DashFlag } from '../config/types';

/** Portée d'auto-visée : au-delà, l'attaque suit la visée manuelle/déplacement. */
const AUTO_AIM_RANGE = 240;

export class Player extends Phaser.Physics.Arcade.Sprite implements IPlayerContext {
  gs: GameScene;
  stats: PlayerStats;

  hp: number;
  maxShield = 0;
  shield = 0;

  // dash
  private dashSlots: number[]; // timestamps de disponibilité par charge
  private dashing = false;
  private dashEndAt = 0;

  // combat
  private comboIndex = 0;
  private maxCombo = 3;
  private attacking = false;
  private attackEndAt = 0;
  private lastAttackAt = -9999;
  private specialReadyAt = 0;

  // état
  private invulnUntil = 0;
  dead = false;
  private lastShieldHitAt = 0;

  // épées visuelles (double lame)
  private swordR: Phaser.GameObjects.Sprite;
  private swordL: Phaser.GameObjects.Sprite;
  private facing = 1;
  private aim = new Phaser.Math.Vector2(0, 1);
  private bobT = 0;
  slowFactor = 1; // réduit par les hazards (marais)

  // hooks de pouvoirs
  private onHitFns: OnHitFn[] = [];
  private onKillFns: OnKillFn[] = [];
  private onDashFns: VoidFn[] = [];
  private onRoomClearFns: VoidFn[] = [];

  // boons divins
  private periodics: { interval: number; nextAt: number; fn: VoidFn }[] = [];
  private specialFlags = new Set<SpecialFlag>();
  private dashFlags = new Set<DashFlag>();

  constructor(scene: GameScene, x: number, y: number, stats: PlayerStats) {
    super(scene, x, y, 'cat');
    this.gs = scene;
    this.stats = stats;
    this.hp = stats.maxHp;
    this.dashSlots = new Array(Math.max(1, stats.dashCharges)).fill(0);

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(20);
    this.setOrigin(0.5, 0.85);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(28, 24);
    body.setOffset((this.width - 28) / 2, this.height - 34);
    body.setCollideWorldBounds(true);

    this.swordR = scene.add.sprite(x, y, 'sword').setOrigin(0.5, 0.85).setDepth(21).setScale(0.62);
    this.swordL = scene.add.sprite(x, y, 'sword').setOrigin(0.5, 0.85).setDepth(21).setScale(0.62).setFlipX(true);
  }

  // ---------- IPlayerContext ----------
  heal(amount: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    this.gs.events.emit('hp', this.hp, this.stats.maxHp, this.shield, this.maxShield);
  }
  grantMaxShield(amount: number): void {
    this.maxShield += amount;
    this.shield = this.maxShield;
    this.gs.events.emit('hp', this.hp, this.stats.maxHp, this.shield, this.maxShield);
  }
  addOnHit(fn: OnHitFn): void { this.onHitFns.push(fn); }
  addOnKill(fn: OnKillFn): void { this.onKillFns.push(fn); }
  addOnDash(fn: VoidFn): void { this.onDashFns.push(fn); }
  addOnRoomClear(fn: VoidFn): void { this.onRoomClearFns.push(fn); }
  addComboHit(): void { this.maxCombo += 1; }
  get combat(): ICombatScene { return this.gs; }
  addPeriodic(interval: number, fn: VoidFn): void { this.periodics.push({ interval, nextAt: performance.now() + interval, fn }); }
  addSpecialFlag(flag: SpecialFlag): void { this.specialFlags.add(flag); }
  addDashFlag(flag: DashFlag): void { this.dashFlags.add(flag); }

  // appelé quand le nombre de charges de dash change via pouvoir
  syncDashCharges(): void {
    const want = Math.max(1, this.stats.dashCharges);
    while (this.dashSlots.length < want) this.dashSlots.push(0);
  }

  notifyKill(target: IEnemyLike): void {
    for (const fn of this.onKillFns) fn(target);
    if (this.stats.specialCdOnKill > 0) {
      this.specialReadyAt = Math.max(0, this.specialReadyAt - this.stats.specialCdOnKill);
    }
  }
  onRoomClear(): void {
    for (const fn of this.onRoomClearFns) fn();
  }

  // ---------- boucle ----------
  isInvulnerable(): boolean { return performance.now() < this.invulnUntil; }

  dashCharges(): number {
    const now = performance.now();
    return this.dashSlots.filter((t) => t <= now).length;
  }
  dashCooldownFrac(): number {
    const now = performance.now();
    // charge la plus proche d'être prête
    let best = 1;
    let anyReady = false;
    for (const t of this.dashSlots) {
      if (t <= now) { anyReady = true; break; }
      best = Math.min(best, (t - now) / this.stats.dashCooldown);
    }
    return anyReady ? 0 : best;
  }
  specialCooldownFrac(): number {
    const now = performance.now();
    if (now >= this.specialReadyAt) return 0;
    return (this.specialReadyAt - now) / this.stats.specialCooldown;
  }

  update(time: number, dt: number): void {
    if (this.dead) return;
    const now = performance.now();
    const input = this.gs.controls;
    const move = input.getMove();
    this.aim = input.getAim(this.x, this.y, move);

    // Auto-visée : pendant une attaque, oriente vers la cible la plus proche.
    if (this.attacking) {
      const to = this.nearestTargetDir(AUTO_AIM_RANGE);
      if (to) this.aim = to;
    }

    // facing
    if (Math.abs(this.aim.x) > 0.1) this.facing = this.aim.x >= 0 ? 1 : -1;
    this.setFlipX(this.facing < 0);

    // déplacement (bloqué pendant le dash)
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!this.dashing) {
      const spd = this.stats.speed * this.stats.moveSpeedMult * this.slowFactor;
      body.setVelocity(move.x * spd, move.y * spd);
    } else if (now >= this.dashEndAt) {
      this.dashing = false;
      if (this.dashFlags.has('burst')) {
        this.gs.explosionAt(this.x, this.y, 90, Math.max(20, this.stats.dashDamage + this.stats.swordDamage[0]));
      }
    }

    // effets récurrents (clone, domaine…)
    for (const pe of this.periodics) {
      if (now >= pe.nextAt) { pe.nextAt = now + pe.interval; pe.fn(); }
    }

    // actions
    if (input.consumeDash()) this.tryDash(move);
    if (input.consumeAttack()) this.tryAttack();
    if (input.consumeSpecial()) this.trySpecial();

    // fin d'attaque
    if (this.attacking && now >= this.attackEndAt) this.attacking = false;

    // recharge bouclier hors combat
    if (this.maxShield > 0 && this.shield < this.maxShield && now - this.lastShieldHitAt > 3500) {
      this.shield = Math.min(this.maxShield, this.shield + 0.02 * this.maxShield);
      this.gs.events.emit('hp', this.hp, this.stats.maxHp, this.shield, this.maxShield);
    }

    this.animate(move, dt);
    this.updateSword(now);
  }

  private animate(move: Phaser.Math.Vector2, dt: number): void {
    const moving = move.lengthSq() > 0.02;
    this.bobT += dt / 1000 * (moving ? 12 : 4);
    const bob = Math.sin(this.bobT) * (moving ? 0.06 : 0.03);
    if (this.dashing) {
      this.setScale(1.15, 0.85);
    } else {
      this.setScale(1 - bob * 0.5, 1 + bob);
    }
    if (this.isInvulnerable() && !this.dead) {
      this.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(this.bobT * 3)));
    } else {
      this.setAlpha(1);
    }
  }

  private updateSword(now: number): void {
    const aimA = Math.atan2(this.aim.y, this.aim.x);
    const baseAngle = aimA + Math.PI / 2;
    const handOff = 13, handY = -8;
    const rx = this.x + this.facing * handOff, ly = this.y + handY;
    const lx = this.x - this.facing * handOff;
    // au repos : lames tenues vers l'extérieur-bas
    const restR = Math.PI / 2 + 0.55 * this.facing;
    const restL = Math.PI / 2 - 0.55 * this.facing;
    const depth = this.aim.y < 0 ? 19 : 22;
    this.swordR.setDepth(depth);
    this.swordL.setDepth(depth);

    if (this.attacking) {
      const p = 1 - Math.max(0, (this.attackEndAt - now) / this.attackDuration());
      const swing = Phaser.Math.Linear(-1.3, 1.3, p);
      const ax = this.x + this.aim.x * 16, ay = this.y - 10 + this.aim.y * 16;
      if (this.comboIndex % 2 === 0) {
        this.swordR.setPosition(ax, ay).setRotation(baseAngle + swing).setScale(0.82);
        this.swordL.setPosition(lx, ly).setRotation(restL).setScale(0.58);
      } else {
        this.swordL.setPosition(ax, ay).setRotation(baseAngle - swing).setScale(0.82);
        this.swordR.setPosition(rx, ly).setRotation(restR).setScale(0.58);
      }
    } else {
      this.swordR.setPosition(rx, ly).setRotation(restR).setScale(0.62);
      this.swordL.setPosition(lx, ly).setRotation(restL).setScale(0.62);
    }
  }

  private attackDuration(): number {
    return this.stats.attackDuration / this.stats.attackSpeedMult;
  }

  // ---------- actions ----------
  private tryDash(move: Phaser.Math.Vector2): void {
    const now = performance.now();
    const slot = this.dashSlots.findIndex((t) => t <= now);
    if (slot === -1 || this.dashing) return;
    this.dashSlots[slot] = now + this.stats.dashCooldown;

    let dir = move.lengthSq() > 0.02 ? move.clone().normalize() : this.aim.clone().normalize();
    if (dir.lengthSq() < 0.02) dir.set(this.facing, 0);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = (this.stats.dashDistance / this.stats.dashDuration) * 1000;
    body.setVelocity(dir.x * speed, dir.y * speed);
    this.dashing = true;
    this.dashEndAt = now + this.stats.dashDuration;
    this.invulnUntil = Math.max(this.invulnUntil, now + this.stats.dashIFrames);

    this.gs.juice.dashTrail(this.x, this.y, 0x9fe6ff);
    this.gs.sfx('dash');
    for (const fn of this.onDashFns) fn();

    // dégâts de dash (traînée de griffes)
    if (this.stats.dashDamage > 0) {
      this.gs.time.delayedCall(0, () => {});
      this.dashHitAccumulator = new Set();
    }
  }
  private dashHitAccumulator: Set<IEnemyLike> | null = null;

  private tryAttack(): void {
    const now = performance.now();
    if (this.attacking && now < this.attackEndAt) return;
    // gestion de la fenêtre de combo
    if (now - this.lastAttackAt > this.stats.comboWindow + this.attackDuration()) {
      this.comboIndex = 0;
    } else {
      this.comboIndex = (this.comboIndex + 1) % this.maxCombo;
    }
    this.lastAttackAt = now;
    this.attacking = true;
    this.attackEndAt = now + this.attackDuration();
    // vise immédiatement l'ennemi le plus proche (essentiel sans souris/visée)
    const to = this.nearestTargetDir(AUTO_AIM_RANGE);
    if (to) { this.aim = to; if (Math.abs(to.x) > 0.1) { this.facing = to.x >= 0 ? 1 : -1; this.setFlipX(this.facing < 0); } }
    this.gs.sfx('sword');

    // résolution des dégâts au milieu du swing
    this.gs.time.delayedCall(this.attackDuration() * 0.35, () => {
      if (this.dead) return;
      this.resolveArcHit();
    });
  }

  /** Direction normalisée vers l'ennemi vivant le plus proche (ou null). */
  private nearestTargetDir(maxRange: number): Phaser.Math.Vector2 | null {
    let best: IEnemyLike | null = null;
    let bestD2 = maxRange * maxRange;
    for (const e of this.gs.getTargets()) {
      if (!e.isAlive()) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) { bestD2 = d2; best = e; }
    }
    if (!best) return null;
    return new Phaser.Math.Vector2(best.x - this.x, best.y - this.y).normalize();
  }

  private resolveArcHit(): void {
    const dmgTable = this.stats.swordDamage;
    const idxForDamage = Math.min(this.comboIndex, dmgTable.length - 1);
    const isFinisher = this.comboIndex === this.maxCombo - 1 || this.comboIndex >= dmgTable.length - 1;
    const baseDmg = dmgTable[idxForDamage] ?? dmgTable[dmgTable.length - 1];
    const range = 78;
    const aimAngle = Math.atan2(this.aim.y, this.aim.x);
    let hitAny = false;
    for (const e of this.gs.getTargets()) {
      if (!e.isAlive()) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const ang = Math.atan2(dy, dx);
      let diff = Math.abs(Phaser.Math.Angle.Wrap(ang - aimAngle));
      if (diff > Phaser.Math.DEG_TO_RAD * 75) continue;
      this.dealDamage(e, baseDmg, isFinisher);
      hitAny = true;
    }
    if (hitAny) {
      this.gs.juice.hitStop(isFinisher ? 70 : 40);
      this.gs.juice.shake(isFinisher ? 140 : 80, isFinisher ? 0.008 : 0.004);
    }
  }

  /** applique dégâts + crit + rage + hooks + vol de vie + knockback + rafale. */
  dealDamage(e: IEnemyLike, baseDmg: number, finisher: boolean): void {
    // Poing de Saitama : élimination instantanée (hors boss)
    if (!e.isBoss && this.stats.instakillChance > 0 && Math.random() < this.stats.instakillChance) {
      this.gs.juice.popText(e.x, e.y - 34, 'ÉLIMINÉ !', '#ff5a5a', 20);
      this.gs.juice.burst(e.x, e.y, 0xff5a5a, 20, 260, 1.6);
      e.takeDamage(999999, this.x, this.y);
      return;
    }
    const isCrit = Math.random() < this.stats.critChance;
    const rage = (this.hp / this.stats.maxHp) < this.stats.rageBelow ? this.stats.rageDamageMult : 1;
    let dmg = baseDmg * (isCrit ? this.stats.critMult : 1) * rage;
    if (finisher) dmg *= 1.15;
    dmg = Math.round(dmg);
    e.takeDamage(dmg, this.x, this.y);
    if (finisher) this.applyKnockback(e, this.stats.knockback);
    for (const fn of this.onHitFns) fn(e, dmg, isCrit);
    if (this.stats.lifesteal > 0) this.heal(dmg * this.stats.lifesteal);
    if (isCrit) this.gs.juice.popText(e.x, e.y - 30, `${dmg}!`, '#ffe066', 18);
    // ORA ORA : coups instantanés supplémentaires (dégâts bruts)
    for (let i = 0; i < this.stats.extraHits; i++) {
      if (!e.isAlive()) break;
      e.takeDamage(Math.round(baseDmg * rage * 0.5), this.x, this.y, { silent: true });
      this.gs.juice.burst(e.x, e.y - 8, 0xffd24a, 3, 90, 0.6);
    }
  }

  private applyKnockback(e: IEnemyLike, force: number): void {
    const anyE = e as unknown as { body?: Phaser.Physics.Arcade.Body };
    if (anyE.body) {
      const d = new Phaser.Math.Vector2(e.x - this.x, e.y - this.y).normalize();
      anyE.body.velocity.x += d.x * force;
      anyE.body.velocity.y += d.y * force;
    }
  }

  private trySpecial(): void {
    const now = performance.now();
    if (now < this.specialReadyAt) return;
    this.specialReadyAt = now + this.stats.specialCooldown;
    const radius = this.stats.specialRadius;
    const bigExplosion = this.specialFlags.has('explosion');
    this.gs.juice.ring(this.x, this.y, radius, bigExplosion ? 0xffa53a : 0xb26bff, 320);
    this.gs.juice.shake(bigExplosion ? 240 : 160, bigExplosion ? 0.012 : 0.007);
    this.gs.juice.burst(this.x, this.y, bigExplosion ? 0xffd24a : 0xb26bff, bigExplosion ? 24 : 16, 240, 1.6);
    this.gs.sfx('special');
    // dégâts de zone du tourbillon
    for (const e of this.gs.getTargets()) {
      if (!e.isAlive()) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= radius) {
        this.dealDamage(e, this.stats.specialDamage, false);
        this.applyKnockback(e, 220);
      }
    }
    // boons de spécial
    if (this.specialFlags.has('wave')) {
      const a = this.nearestTargetDir(360) ?? this.aim.clone().normalize();
      this.gs.slashWave(this.x, this.y, a.x, a.y, Math.round(this.stats.specialDamage * 0.9));
      this.gs.slashWave(this.x, this.y, a.x, a.y, Math.round(this.stats.specialDamage * 0.9)); // double lame
    }
    if (this.specialFlags.has('timestop')) this.gs.timeSlow(2200, 0.12);
  }

  /** appelé par la scène quand le dash traverse un ennemi. */
  tryDashHit(e: IEnemyLike): void {
    if (!this.dashing || this.stats.dashDamage <= 0 || !this.dashHitAccumulator) return;
    if (this.dashHitAccumulator.has(e)) return;
    this.dashHitAccumulator.add(e);
    this.dealDamage(e, this.stats.dashDamage, false);
    if (this.dashFlags.has('shock')) e.applyStatus('shock', 2200);
  }

  // ---------- dégâts subis ----------
  takeDamage(amount: number, fromX = this.x, fromY = this.y): void {
    if (this.dead || this.isInvulnerable() || amount <= 0) return;
    // Sharingan / Ultra Instinct : esquive automatique
    if (this.stats.dodgeChance > 0 && Math.random() < this.stats.dodgeChance) {
      this.invulnUntil = performance.now() + 120;
      this.gs.juice.popText(this.x, this.y - 40, 'Esquive !', '#9fe6ff', 15);
      return;
    }
    const now = performance.now();
    let dmg = amount * (1 - this.stats.armor);

    if (this.stats.thorns > 0) this.gs.thornsHit(fromX, fromY, amount * this.stats.thorns);

    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
      this.lastShieldHitAt = now;
    }
    if (dmg > 0) this.hp -= dmg;

    this.invulnUntil = now + this.stats.hurtIFrames;
    this.gs.juice.flash(this, 100);
    this.gs.juice.shake(120, 0.006);
    this.gs.juice.burst(this.x, this.y, 0xffffff, 6, 100, 0.8);
    this.gs.sfx('hurt');
    this.gs.events.emit('hp', Math.max(0, this.hp), this.stats.maxHp, this.shield, this.maxShield);

    if (this.hp <= 0) this.die();
  }

  /** dégâts d'environnement : ignore les i-frames, feedback léger. */
  takeHazardDamage(amount: number): void {
    if (this.dead) return;
    let dmg = amount * (1 - this.stats.armor);
    if (this.shield > 0) { const a = Math.min(this.shield, dmg); this.shield -= a; dmg -= a; }
    if (dmg > 0) this.hp -= dmg;
    this.setTintFill(0xff5a3a);
    this.gs.time.delayedCall(80, () => { if (this.active && !this.dead) this.clearTint(); });
    this.gs.events.emit('hp', Math.max(0, this.hp), this.stats.maxHp, this.shield, this.maxShield);
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    if (this.dead) return;
    // seconde chance (méta)
    if (this.gs.canRevive()) {
      this.gs.consumeRevive();
      this.hp = Math.round(this.stats.maxHp * 0.4);
      this.invulnUntil = performance.now() + 1500;
      this.gs.juice.ring(this.x, this.y, 140, 0xf4c430, 500);
      this.gs.juice.popText(this.x, this.y - 40, 'Neuf vies !', '#f4c430', 20);
      this.gs.events.emit('hp', this.hp, this.stats.maxHp, this.shield, this.maxShield);
      return;
    }
    this.dead = true;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.setTint(0x888888);
    this.gs.sfx('dead');
    this.gs.tweens.add({ targets: [this, this.swordR, this.swordL], alpha: 0, angle: 90, duration: 800 });
    this.gs.onPlayerDead();
  }

  destroy(fromScene?: boolean): void {
    this.swordR?.destroy(); this.swordL?.destroy();
    super.destroy(fromScene);
  }
}
