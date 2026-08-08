import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { PlayerStats } from '../config/game';
import type { IPlayerContext, IEnemyLike, ICombatScene, OnHitFn, OnKillFn, VoidFn, SpecialFlag, DashFlag, BuffMods, HitInfo } from '../config/types';

/** Portée d'auto-visée : au-delà, l'attaque suit la visée manuelle/déplacement. */
const AUTO_AIM_RANGE = 260;
/** Portée de la mêlée (+150% par rapport à l'ancienne valeur de 78). */
const MELEE_RANGE = 195;

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
  private nextSparkAt = 0; // cadence des étincelles de Chidori

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
  private onRoomStartFns: VoidFn[] = [];

  // boons divins
  private periodics: { interval: number; nextAt: number; fn: VoidFn }[] = [];
  private specialFlags = new Set<SpecialFlag>();
  private dashFlags = new Set<DashFlag>();

  // extensions catalogue 100 pouvoirs
  mods: Record<string, number> = {};
  private buffs: { key: string; exp: number; spd: number; dmg: number; as: number }[] = [];
  private lastCombatAt = 0;
  private nextRegenAt = 0;
  roomDamageBonus = 0;   // accumulateurs remis à zéro en début de salle (Danse-Lames, Nettoyage…)
  roomTimeBonus = 0;     // Orgueil du Lion (par seconde)
  private blockReadyAt = 0;
  private dashCount = 0;
  private kunaiPos: { x: number; y: number; at: number } | null = null;
  private transformUsedRoom = false;

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

    this.swordR = scene.add.sprite(x, y, 'sword').setOrigin(0.5, 0.85).setDepth(21).setScale(0.9);
    this.swordL = scene.add.sprite(x, y, 'sword').setOrigin(0.5, 0.85).setDepth(21).setScale(0.9).setFlipX(true);
  }

  // ---------- IPlayerContext ----------
  heal(amount: number): void {
    this.hp = Math.min(this.stats.maxHp, this.hp + amount * this.stats.healReceivedMult);
    this.gs.events.emit('hp', this.hp, this.stats.maxHp, this.shield, this.maxShield);
  }
  /** Paye un coût en points de vie (marchand). Laisse toujours au moins 1 PV. */
  spendLife(amount: number): void {
    this.hp = Math.max(1, this.hp - amount);
    this.gs.events.emit('hp', this.hp, this.stats.maxHp, this.shield, this.maxShield);
    this.gs.juice.burst(this.x, this.y - 8, 0xe8384f, 10, 160, 1);
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
  addOnRoomStart(fn: VoidFn): void { this.onRoomStartFns.push(fn); }
  addComboHit(): void { this.maxCombo += 1; }
  get combat(): ICombatScene { return this.gs; }
  addPeriodic(interval: number, fn: VoidFn): void { this.periodics.push({ interval, nextAt: performance.now() + interval, fn }); }
  addSpecialFlag(flag: SpecialFlag): void { this.specialFlags.add(flag); }
  // --- extensions catalogue ---
  px(): number { return this.x; }
  py(): number { return this.y; }
  aimAngle(): number { return Math.atan2(this.aim.y, this.aim.x); }
  hpFrac(): number { return this.hp / this.stats.maxHp; }
  inCombat(): boolean { return performance.now() - this.lastCombatAt < 2500; }
  addBuff(key: string, ms: number, mods: BuffMods): void {
    const exp = performance.now() + ms;
    const ex = this.buffs.find((b) => b.key === key);
    if (ex) { ex.exp = exp; ex.spd = mods.spd ?? 1; ex.dmg = mods.dmg ?? 1; ex.as = mods.as ?? 1; }
    else this.buffs.push({ key, exp, spd: mods.spd ?? 1, dmg: mods.dmg ?? 1, as: mods.as ?? 1 });
  }
  private buffProduct(sel: 'spd' | 'dmg' | 'as'): number {
    const now = performance.now();
    let m = 1;
    for (const b of this.buffs) if (b.exp > now) m *= b[sel];
    return m;
  }
  /** Signale que le joueur est en combat (pour les effets hors-combat). */
  markCombat(): void { this.lastCombatAt = performance.now(); }
  /** Appelé au début d'une salle de combat. */
  onRoomStart(): void {
    this.roomDamageBonus = 0; this.roomTimeBonus = 0; this.transformUsedRoom = false;
    this.mods.firstHitRoom = 1; this.mods.baieUsed = 0; this.mods.hitThisRoom = 0;
    for (const fn of this.onRoomStartFns) fn();
  }
  /** Facteur de dégâts additionnel (buffs + accumulateurs de salle). */
  private extraDamageMult(): number {
    return this.buffProduct('dmg') * (1 + this.roomDamageBonus + this.roomTimeBonus);
  }
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

    // Orientation gauche/droite : suit le DÉPLACEMENT ; pendant une attaque,
    // suit la cible visée ; à l'arrêt, garde la dernière direction. Le sprite
    // source est orienté à droite → miroir (flipX) quand facing < 0.
    if (this.attacking) {
      if (Math.abs(this.aim.x) > 0.15) this.facing = this.aim.x >= 0 ? 1 : -1;
    } else if (Math.abs(move.x) > 0.1) {
      this.facing = move.x > 0 ? 1 : -1;
    }
    this.setFlipX(this.facing < 0);

    // déplacement (bloqué pendant le dash)
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (!this.dashing) {
      let sm = this.stats.moveSpeedMult * this.buffProduct('spd');
      if (this.mods.courseDiable && this.hpFrac() < 0.5) sm *= 1.18;   // Course du Diable
      if (this.mods.celerite && !this.inCombat()) sm *= 1.16;          // Célérité hors combat
      const spd = this.stats.speed * sm * this.slowFactor;
      body.setVelocity(move.x * spd, move.y * spd);
    } else if (now >= this.dashEndAt) {
      this.dashing = false;
      if (this.dashFlags.has('burst')) {
        // Rasengan : tornade bleue tourbillonnante en fin de dash
        this.gs.juice.spiral(this.x, this.y, 0x59c8ff, 96);
        this.gs.sfx('rasengan');
        this.gs.explosionAt(this.x, this.y, 90, Math.max(20, this.stats.dashDamage + this.stats.swordDamage[0]));
      }
    }
    // Chidori : traînée électrique pendant le dash
    if (this.dashing && this.dashFlags.has('shock') && now >= this.nextSparkAt) {
      this.nextSparkAt = now + 26;
      this.gs.juice.burst(this.x, this.y, 0xfff27a, 3, 90, 0.7);
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

    this.updateBuffsAndModes(now);
    this.animate(move, dt);
    this.updateSword(now);
  }

  /** Régénérations, accumulateurs par seconde, transformations (Titan/Gear Fifth). */
  private updateBuffsAndModes(now: number): void {
    if (now >= this.nextRegenAt) {
      this.nextRegenAt = now + 1000;
      if (this.mods.regenOoc && !this.inCombat() && this.hp < this.stats.maxHp) this.heal(this.mods.regenOoc);
      if (this.mods.regenLow && this.hpFrac() < 0.3) this.heal(this.mods.regenLow);
      // Orgueil du Lion : +1 %/s de dégâts dans la salle (plafonné à +30 %)
      if (this.mods.orgueil) this.roomTimeBonus = Math.min(0.30, this.roomTimeBonus + 0.01 * this.mods.orgueil);
      // Baie Oran : soin d'urgence sous 50 % PV (1 fois par salle)
      if (this.mods.baie && !this.mods.baieUsed && this.hpFrac() < 0.5) { this.mods.baieUsed = 1; this.heal(12); this.gs.juice.popText(this.x, this.y - 30, '+12', '#6ad46a', 14); }
    }
    // Transformations à bas PV (Titan Assaillant / Gear Fifth) : 1 fois par salle
    if (this.mods.transformAt && !this.transformUsedRoom && this.hpFrac() < this.mods.transformAt) {
      this.transformUsedRoom = true;
      const dur = this.mods.transformMs || 6000;
      this.addBuff('transform', dur, { dmg: this.mods.transformDmg || 1.5, spd: this.mods.transformSpd || 1.1 });
      this.mods.transformActive = 1;
      this.setScale(this.mods.transformScale || 1.5);
      this.gs.time.delayedCall(dur, () => { this.mods.transformActive = 0; this.setScale(1); });
      this.gs.juice.ring(this.x, this.y, 120, this.mods.transformColor || 0xffffff, 500);
      this.gs.juice.burst(this.x, this.y, this.mods.transformColor || 0xffffff, 24, 260, 1.8);
      this.gs.sfx(this.mods.transformSfx === 2 ? 'toon' : 'special');
    }
  }

  private animate(move: Phaser.Math.Vector2, dt: number): void {
    const moving = move.lengthSq() > 0.02;
    this.bobT += dt / 1000 * (moving ? 12 : 4);
    const bob = Math.sin(this.bobT) * (moving ? 0.06 : 0.03);
    // Grossissement des transformations (Titan / Gear Fifth) : appliqué ici pour
    // ne pas être écrasé par le squash/stretch de chaque frame.
    const t = this.mods.transformActive ? (this.mods.transformScale || 1.5) : 1;
    if (this.dashing) {
      this.setScale(1.15 * t, 0.85 * t);
    } else {
      this.setScale((1 - bob * 0.5) * t, (1 + bob) * t);
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
      const ax = this.x + this.aim.x * 28, ay = this.y - 10 + this.aim.y * 28;
      if (this.comboIndex % 2 === 0) {
        this.swordR.setPosition(ax, ay).setRotation(baseAngle + swing).setScale(1.25);
        this.swordL.setPosition(lx, ly).setRotation(restL).setScale(0.85);
      } else {
        this.swordL.setPosition(ax, ay).setRotation(baseAngle - swing).setScale(1.25);
        this.swordR.setPosition(rx, ly).setRotation(restR).setScale(0.85);
      }
    } else {
      this.swordR.setPosition(rx, ly).setRotation(restR).setScale(0.9);
      this.swordL.setPosition(lx, ly).setRotation(restL).setScale(0.9);
    }
  }

  private attackDuration(): number {
    return this.stats.attackDuration / (this.stats.attackSpeedMult * this.buffProduct('as'));
  }

  // ---------- actions ----------
  private tryDash(move: Phaser.Math.Vector2): void {
    const now = performance.now();
    const slot = this.dashSlots.findIndex((t) => t <= now);
    if (slot === -1 || this.dashing) return;
    this.dashSlots[slot] = now + this.stats.dashCooldown;

    let dir = move.lengthSq() > 0.02 ? move.clone().normalize() : this.aim.clone().normalize();
    if (dir.lengthSq() < 0.02) dir.set(this.facing, 0);
    // Grappin d'Exploration : légère aimantation vers l'ennemi le plus proche
    if (this.mods.dashMagnet) { const to = this.nearestTargetDir(300); if (to) dir = dir.lerp(to, 0.4).normalize(); }

    // Kunai Éclair : re-dasher dans les 3 s téléporte au kunai planté
    if (this.dashFlags.has('kunai')) {
      if (this.kunaiPos && now - this.kunaiPos.at < 3000) {
        this.setPosition(this.kunaiPos.x, this.kunaiPos.y);
        this.gs.juice.burst(this.x, this.y, 0xffe08a, 12, 170, 1.1); this.kunaiPos = null;
      } else {
        this.kunaiPos = { x: this.x, y: this.y, at: now };
        this.gs.juice.burst(this.x, this.y, 0xffe08a, 4, 90, 0.7);
      }
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = (this.stats.dashDistance / this.stats.dashDuration) * 1000;
    body.setVelocity(dir.x * speed, dir.y * speed);
    this.dashing = true;
    this.dashEndAt = now + this.stats.dashDuration;
    this.invulnUntil = Math.max(this.invulnUntil, now + this.stats.dashIFrames);
    this.dashCount++;

    const shockDash = this.dashFlags.has('shock');
    const waterDash = this.dashFlags.has('water');
    this.gs.juice.dashTrail(this.x, this.y, shockDash ? 0xfff27a : waterDash ? 0x59c8ff : 0x9fe6ff);
    this.gs.sfx(shockDash ? 'chidori' : 'dash');
    for (const fn of this.onDashFns) fn();
    if (this.stats.dashDamage > 0) this.dashHitAccumulator = new Set();

    // Queue Équilibrière : un coup d'épée tranche pendant le dash.
    if (this.mods.dashAttack) {
      this.slashVfx(dir.angle(), false);
      for (const e of this.gs.getTargets()) {
        if (e.isAlive() && Math.hypot(e.x - this.x, e.y - this.y) <= MELEE_RANGE) this.dealDamage(e, this.stats.swordDamage[0], false);
      }
    }
    // Souffle du Tonnerre : tous les 6 dashes, éclair qui traverse la ligne
    if (this.dashFlags.has('thunder6') && this.dashCount % 6 === 0) {
      const ex = this.x + dir.x * 420, ey = this.y + dir.y * 420;
      this.lineDamage(this.x, this.y, ex, ey, 34, 45, 0xfff27a);
      this.gs.sfx('zap');
    }
  }

  /** Dégâts en ligne (dash-éclair, Kamehameha instantané). */
  lineDamage(x1: number, y1: number, x2: number, y2: number, width: number, damage: number, color: number): void {
    this.gs.beam(x1, y1, x2, y2, color);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    for (const e of this.gs.getTargets()) {
      if (!e.isAlive()) continue;
      const t = Phaser.Math.Clamp(((e.x - x1) * nx + (e.y - y1) * ny), 0, len);
      const px = x1 + nx * t, py = y1 + ny * t;
      if (Math.hypot(e.x - px, e.y - py) <= width) this.dealDamage(e, damage, false);
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

  /** Croissant de coupe : visualise la portée (grande hitbox) de la mêlée. */
  private slashVfx(aimAngle: number, finisher: boolean): void {
    const g = this.gs.add.graphics().setDepth(23);
    const R = MELEE_RANGE * 0.82, cx = this.x, cy = this.y - 8;
    const col = finisher ? 0xff8a2a : 0xdff0ff;
    g.lineStyle(finisher ? 16 : 12, col, 0.5);
    g.beginPath(); g.arc(cx, cy, R, aimAngle - 1.15, aimAngle + 1.15, false); g.strokePath();
    g.lineStyle(finisher ? 6 : 4, 0xffffff, 0.75);
    g.beginPath(); g.arc(cx, cy, R, aimAngle - 1.0, aimAngle + 1.0, false); g.strokePath();
    this.gs.tweens.add({ targets: g, alpha: 0, duration: 190, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
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
    const range = MELEE_RANGE;
    const aimAngle = Math.atan2(this.aim.y, this.aim.x);
    this.slashVfx(aimAngle, isFinisher);
    let hitAny = false;
    for (const e of this.gs.getTargets()) {
      if (!e.isAlive()) continue;
      const dx = e.x - this.x, dy = e.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > range) continue;
      const ang = Math.atan2(dy, dx);
      let diff = Math.abs(Phaser.Math.Angle.Wrap(ang - aimAngle));
      if (diff > Phaser.Math.DEG_TO_RAD * 75) continue;
      this.dealDamage(e, baseDmg, isFinisher, { finisher: isFinisher, first: this.comboIndex === 0, index: this.comboIndex });
      hitAny = true;
    }
    if (hitAny) {
      this.gs.juice.hitStop(isFinisher ? 70 : 40);
      this.gs.juice.shake(isFinisher ? 140 : 80, isFinisher ? 0.008 : 0.004);
    }
  }

  /** applique dégâts + crit + rage + hooks + vol de vie + knockback + rafale. */
  dealDamage(e: IEnemyLike, baseDmg: number, finisher: boolean, info?: HitInfo): void {
    this.markCombat();
    const anyE = e as unknown as { hp?: number; maxHp?: number; applySlow?: (f: number, ms: number) => void };
    // Poing de Saitama : élimination instantanée (hors boss)
    // Page du Carnet : exécution sous un seuil de PV
    const execFrac = anyE.hp != null && anyE.maxHp ? anyE.hp / anyE.maxHp : 1;
    if (!e.isBoss && ((this.stats.instakillChance > 0 && Math.random() < this.stats.instakillChance)
        || (this.stats.execThreshold > 0 && execFrac < this.stats.execThreshold))) {
      this.gs.juice.popText(e.x, e.y - 34, 'ÉLIMINÉ !', '#ff5a5a', 20);
      this.gs.juice.burst(e.x, e.y, 0xff5a5a, 20, 260, 1.6);
      e.takeDamage(999999, this.x, this.y);
      return;
    }
    const isCrit = Math.random() < this.stats.critChance;
    const rage = this.hpFrac() < this.stats.rageBelow ? this.stats.rageDamageMult : 1;
    let dmg = baseDmg * (isCrit ? this.stats.critMult : 1) * rage * this.extraDamageMult();
    if (finisher) dmg *= 1.15;
    if (info?.first) dmg *= this.stats.firstComboMult; // Vitesse Extrême
    dmg = Math.round(dmg);
    e.takeDamage(dmg, this.x, this.y);
    if (finisher) this.applyKnockback(e, this.stats.knockback);
    // crocs élémentaires (chance on-hit) + ralentissement (Toile Légère)
    if (this.stats.fangBurn && Math.random() < this.stats.fangBurn) e.applyStatus('burn', 1500);
    if (this.stats.fangFreeze && Math.random() < this.stats.fangFreeze) e.applyStatus('freeze', 700);
    if (this.stats.fangShock && Math.random() < this.stats.fangShock) e.applyStatus('shock', 1200);
    if (this.stats.hitSlow && anyE.applySlow) anyE.applySlow(1 - this.stats.hitSlow, 800);
    for (const fn of this.onHitFns) fn(e, dmg, isCrit, info);
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
    this.castSpecial();
  }

  /**
   * Déclenche l'effet du Spécial avec TOUS ses bonus (dégâts/zone, Getsuga,
   * Megumin, The World…). Sans cooldown : réutilisé par les pouvoirs qui
   * relancent le Spécial en continu (Sanctuaire de Sukuna).
   */
  castSpecial(): void {
    if (this.dead) return;
    this.markCombat();
    const aimDir = this.nearestTargetDir(360) ?? this.aim.clone().normalize();
    // Kamehameha Ultime : REMPLACE l'explosion par un rayon balayable
    if (this.specialFlags.has('kamehameha')) {
      this.gs.beamSweep(this.x, this.y, aimDir.x, aimDir.y, 35, 1200, 0x8fd0ff);
      this.gs.sfx('rayon');
      return;
    }
    const bigExplosion = this.specialFlags.has('explosion');
    const radius = this.stats.specialRadius * (bigExplosion ? 1.3 : 1);
    this.gs.juice.heatBlast(this.x, this.y, radius);
    this.gs.juice.shake(bigExplosion ? 260 : 190, bigExplosion ? 0.014 : 0.009);
    this.gs.sfx(bigExplosion ? 'explosionbig' : 'special');
    for (const e of this.gs.getTargets()) {
      if (!e.isAlive()) continue;
      if (Math.hypot(e.x - this.x, e.y - this.y) <= radius) {
        this.dealDamage(e, this.stats.specialDamage, false);
        this.applyKnockback(e, 220);
      }
    }
    if (this.specialFlags.has('wave')) {
      this.gs.slashWave(this.x, this.y, aimDir.x, aimDir.y, Math.round(this.stats.specialDamage * 0.9));
      this.gs.slashWave(this.x, this.y, aimDir.x, aimDir.y, Math.round(this.stats.specialDamage * 0.9));
      this.gs.sfx('getsuga');
    }
    // Fulgurance de Pika : 4 éclairs en croix
    if (this.specialFlags.has('pika')) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.lineDamage(this.x, this.y, this.x + dx * 200, this.y + dy * 200, 26, 25, 0xfff27a);
      this.gs.sfx('zap');
    }
    // Rasenshuriken : shuriken de vent qui explose en dôme sur l'ennemi le plus proche
    if (this.specialFlags.has('rasenshuriken')) {
      const t = this.gs.getTargets().find((e) => e.isAlive());
      const tx = t ? t.x : this.x + aimDir.x * 160, ty = t ? t.y : this.y + aimDir.y * 160;
      this.gs.juice.spiral(tx, ty, 0xbff7f6, 110);
      this.gs.explosionAt(tx, ty, 110, 60);
      this.gs.sfx('rasengan');
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
    this.markCombat();
    const now = performance.now();
    // Nettoyage Parfait : être touché remet le bonus de salle à zéro.
    if (this.mods.nettoyage) this.roomDamageBonus = 0;
    this.mods.hitThisRoom = 1;
    // Statik : chance d'électriser l'ennemi le plus proche au contact.
    if (this.stats.contactShockChance > 0 && Math.random() < this.stats.contactShockChance) {
      const near = this.gs.enemiesNear(this.x, this.y, 70);
      if (near.length) near[0].applyStatus('shock', 1000);
    }
    // Sharingan / Ultra Instinct : esquive automatique
    if (this.stats.dodgeChance > 0 && Math.random() < this.stats.dodgeChance) {
      this.invulnUntil = now + 120;
      this.gs.juice.popText(this.x, this.y - 40, 'Esquive !', '#9fe6ff', 15);
      return;
    }
    // Susanoo : absorbe les 3 prochains coups et riposte (se reconstitue en 20 s)
    if (this.mods.susanoo > 0) {
      this.mods.susanoo--;
      this.gs.juice.ring(this.x, this.y, 100, 0xb26bff, 320);
      this.gs.explosionAt(this.x, this.y, 100, 30);
      if (this.mods.susanoo <= 0) this.gs.time.delayedCall(20000, () => { this.mods.susanoo = 3; });
      return;
    }
    // Rempart du Cœur : bloque 1 coup toutes les 2 s
    if (this.mods.rempart && now >= this.blockReadyAt) {
      this.blockReadyAt = now + 2000;
      this.gs.juice.burst(this.x, this.y, 0x8fd0ff, 8, 120, 0.9);
      return;
    }
    let dmg = amount * (1 - this.stats.armor);
    if (this.mods.rugissement) dmg *= Math.max(0.5, 1 - 0.10 * this.mods.rugissement); // Rugissement
    if (this.mods.transformActive) dmg *= 0.5; // Titan / Gear Fifth : -50% de dégâts subis
    // Peau de Vibranium : premier coup de la salle réduit
    if (this.mods.firstHitRoom && this.mods.vibranium) { dmg *= 0.5; this.mods.firstHitRoom = 0; }

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
