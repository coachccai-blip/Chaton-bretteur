import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { ARENA_RECT } from '../scenes/GameScene';
import type { PlayerStats } from '../config/game';
import type { IPlayerContext, IEnemyLike, ICombatScene, OnHitFn, OnKillFn, VoidFn, SpecialFlag, DashFlag, BuffMods, HitInfo } from '../config/types';

/** Portée d'auto-visée : au-delà, l'attaque suit la visée manuelle/déplacement. */
const AUTO_AIM_RANGE = 260;
/** Portée de base de la mêlée (réduite de 20% ; rallongée par Bras Élastique / Susanoo). */
const MELEE_RANGE = 156;
/** Sprite héros haute résolution (26×30) : on le rend à cette échelle pour garder
 * une taille à l'écran raisonnable tout en profitant du surcroît de détail. */
const HERO_SCALE = 0.72;

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
  private transformUsedRoom = false;
  private transformToken = 0;
  // Armes orbitales : katana noir (Troisième Lame) et Mjölnir (marteau).
  private orbitBlades: Phaser.GameObjects.Sprite[] = [];
  private orbitHammers: Phaser.GameObjects.Sprite[] = [];
  private orbitAngle = 0;
  private orbitHit = new WeakMap<object, number>();
  private nextOrbitSpark = 0;
  // Susanoo : aura violette + buste spectral tant que le boon est actif.
  private susanooAura?: Phaser.GameObjects.Image;
  private susanooSprite?: Phaser.GameObjects.Sprite;
  // Kage Bunshin : clone d'ombre visible qui suit le chaton et frappe.
  private kageClone?: Phaser.GameObjects.Sprite;
  private kageNextAt = 0;
  private kageAngle = 0;

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
  /** Vrai pendant un dash : sert à traverser les obstacles (pas les murs d'arène). */
  isDashing(): boolean { return this.dashing; }

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
    this.updateOrbitBlades(now, dt);
    this.updateSusanooVfx(now);
    this.updateKageClone(now);

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
      // Jeton : une transformation d'une salle antérieure ne doit pas couper
      // court une nouvelle transformation déclenchée dans une salle suivante.
      const tok = ++this.transformToken;
      this.gs.time.delayedCall(dur, () => {
        if (this.transformToken !== tok) return;
        this.mods.transformActive = 0; this.setScale(1);
      });
      this.gs.juice.ring(this.x, this.y, 120, this.mods.transformColor || 0xffffff, 500);
      this.gs.juice.burst(this.x, this.y, this.mods.transformColor || 0xffffff, 24, 260, 1.8);
      this.gs.sfx(this.mods.transformSfx === 2 ? 'toon' : 'special');
    }
    // Kaf Gear V : buff SOUTENU tant que les PV sont ≤ 40% (pas une seule fois).
    if (this.mods.kafGear) {
      const on = !this.dead && this.hpFrac() <= 0.40;
      if (on) {
        // rafraîchi en continu (fenêtre courte) : reste actif sous 40% PV
        this.addBuff('kafgear', 300, { dmg: this.mods.transformDmg || 1.8, spd: this.mods.transformSpd || 1.2 });
        if (!this.mods.transformActive) { // effets d'entrée une seule fois par activation
          this.gs.juice.ring(this.x, this.y, 120, this.mods.transformColor || 0xfff2a0, 450);
          this.gs.sfx('toon');
        }
        this.mods.transformActive = 1;
      } else if (this.mods.transformActive) {
        this.mods.transformActive = 0;
      }
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
      this.setScale(1.15 * t * HERO_SCALE, 0.85 * t * HERO_SCALE);
    } else {
      this.setScale((1 - bob * 0.5) * t * HERO_SCALE, (1 + bob) * t * HERO_SCALE);
    }
    // Clignotement franc pendant l'invincibilité (période ~140 ms).
    if (this.isInvulnerable() && !this.dead) {
      this.setAlpha(Math.sin(performance.now() * 0.045) > 0 ? 1 : 0.3);
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

  /** Portée de mêlée effective : base + Bras Élastique (+12%/stack, max 3) + Susanoo (+15%). */
  private meleeRange(): number {
    const arm = 1 + 0.12 * Math.min(3, this.mods.armReach || 0);
    const susanoo = this.mods.susanoo > 0 ? 1.15 : 1;
    return MELEE_RANGE * arm * susanoo;
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

    const body = this.body as Phaser.Physics.Arcade.Body;
    const speed = (this.stats.dashDistance / this.stats.dashDuration) * 1000;
    // Kunai Éclair : le dash devient une TÉLÉPORTATION instantanée jusqu'au point
    // d'arrivée (avec bruitage d'éclair). Tous les boons de dash s'appliquent
    // quand même le long du trajet (dégâts, âmes ramassées, effets de fin).
    const teleport = this.dashFlags.has('kunai');
    if (teleport) {
      const sx = this.x, sy = this.y;
      const A = ARENA_RECT, m = 18;
      const ex = Phaser.Math.Clamp(sx + dir.x * this.stats.dashDistance, A.x + m, A.x + A.w - m);
      const ey = Phaser.Math.Clamp(sy + dir.y * this.stats.dashDistance, A.y + m, A.y + A.h - m);
      this.setPosition(ex, ey);
      body.setVelocity(0, 0);
      this.gs.kunaiBlink(sx, sy, ex, ey); // éclair + son + ramassage des âmes traversées
      // dégâts de dash infligés sur toute la ligne parcourue (début → fin)
      if (this.stats.dashDamage > 0) this.lineDamage(sx, sy, ex, ey, 30, this.stats.dashDamage, 0xfff27a);
    } else {
      body.setVelocity(dir.x * speed, dir.y * speed);
    }
    this.dashing = true;
    // Téléport = dash « instantané » : il se termine dès la frame suivante, ce qui
    // déclenche quand même les effets de fin de dash (Rasengan, etc.) à l'arrivée.
    this.dashEndAt = now + (teleport ? 1 : this.stats.dashDuration);
    this.invulnUntil = Math.max(this.invulnUntil, now + this.stats.dashIFrames);
    this.dashCount++;

    const shockDash = this.dashFlags.has('shock');
    const waterDash = this.dashFlags.has('water');
    this.gs.juice.dashTrail(this.x, this.y, shockDash ? 0xfff27a : waterDash ? 0x59c8ff : 0x9fe6ff);
    this.gs.sfx(shockDash ? 'chidori' : 'dash');
    if (waterDash) this.waterDashVfx(dir);
    for (const fn of this.onDashFns) fn();
    // En téléport (Kunai), les dégâts du trajet sont déjà appliqués par lineDamage :
    // pas d'accumulateur d'overlap, sinon l'ennemi à l'arrivée est frappé 2 fois.
    if (!teleport && this.stats.dashDamage > 0) this.dashHitAccumulator = new Set();

    // Queue Équilibrière : un coup d'épée tranche pendant le dash.
    if (this.mods.dashAttack) {
      this.slashVfx(dir.angle(), 0, this.maxCombo);
      for (const e of this.gs.getTargets()) {
        if (e.isAlive() && Math.hypot(e.x - this.x, e.y - this.y) <= this.meleeRange()) this.dealDamage(e, this.stats.swordDamage[0], false);
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

  /**
   * Armes qui tournoient autour du chaton : katana noir (Troisième Lame) et
   * marteau Mjölnir (traînée électrique). Chaque arme tranche/écrase les ennemis
   * qu'elle croise (cooldown par ennemi).
   */
  private updateOrbitBlades(now: number, dt: number): void {
    this.orbitAngle += (dt / 1000) * (Math.PI * 2); // référence : 1 tour / s
    // Katana : 1 tour / 1,2 s, pointe vers l'extérieur. Rayon DOUBLÉ (132).
    this.syncOrbitWeapon(this.orbitBlades, this.mods.orbitBlade || 0, 'katana_black', 132,
      this.orbitAngle / 1.2, 8 + this.stats.swordDamage[0] * 0.3, 24, now, (a) => a + Math.PI / 2, false);
    // Mjölnir : 1 tour / 1,6 s, culbute + traînée électrique. Rayon DOUBLÉ (116).
    this.syncOrbitWeapon(this.orbitHammers, this.mods.orbitHammer || 0, 'hammer_thor', 116,
      this.orbitAngle / 1.6, 10, 27, now, () => this.orbitAngle * 2.4, true);
  }

  private syncOrbitWeapon(
    arr: Phaser.GameObjects.Sprite[], count: number, tex: string, R: number, angle: number,
    dmg: number, hitR: number, now: number, rot: (a: number) => number, electric: boolean,
  ): void {
    if (count <= 0) {
      if (arr.length) { arr.forEach((b) => b.destroy()); arr.length = 0; }
      return;
    }
    while (arr.length < count) arr.push(this.gs.add.sprite(this.x, this.y, tex).setDepth(22).setOrigin(0.5, 0.5));
    for (let i = 0; i < arr.length; i++) {
      const a = angle + (i / arr.length) * Math.PI * 2;
      const bx = this.x + Math.cos(a) * R, by = this.y - 8 + Math.sin(a) * R;
      arr[i].setPosition(bx, by).setRotation(rot(a)).setVisible(!this.dead);
      if (this.dead) continue;
      for (const e of this.gs.getTargets()) {
        if (!e.isAlive()) continue;
        if (Math.hypot(e.x - bx, e.y - by) <= hitR) {
          const wk = e as unknown as object;
          if (now - (this.orbitHit.get(wk) ?? 0) > 350) { this.orbitHit.set(wk, now); this.dealDamage(e, dmg, false); }
        }
      }
      // Les armes orbitales DÉTRUISENT les projectiles ennemis qu'elles croisent.
      const projs = this.gs.projectiles.getChildren();
      for (let j = projs.length - 1; j >= 0; j--) {
        const pr = projs[j] as Phaser.GameObjects.Sprite;
        if (pr.active && Math.hypot(pr.x - bx, pr.y - by) <= hitR + 6) {
          this.gs.juice.burst(pr.x, pr.y, electric ? 0xbff7f6 : 0x9a5cff, 4, 100, 0.7);
          pr.destroy();
        }
      }
    }
    // Traînée électrique du marteau (étincelles cyan qui suivent la tête).
    if (electric && arr.length && now >= this.nextOrbitSpark) {
      this.nextOrbitSpark = now + 55;
      const h = arr[0];
      this.gs.juice.burst(h.x, h.y, 0xbff7f6, 3, 100, 0.7);
    }
  }

  /** Aura violette + buste spectral de Susanoo tant que le boon est chargé. */
  private updateSusanooVfx(now: number): void {
    const active = (this.mods.susanoo || 0) > 0 && !this.dead;
    if (active) {
      if (!this.susanooAura) {
        this.susanooAura = this.gs.add.image(this.x, this.y, 'light').setTint(0x9a5cff)
          .setBlendMode(Phaser.BlendModes.ADD).setDepth(18).setScale(2.2).setAlpha(0.4);
        this.susanooSprite = this.gs.add.sprite(this.x, this.y - 20, 'susanoo').setDepth(19).setAlpha(0.5).setScale(2.4);
      }
      this.susanooAura.setPosition(this.x, this.y - 6).setAlpha(0.32 + 0.12 * Math.sin(now * 0.006)).setScale(2.2 + 0.12 * Math.sin(now * 0.005));
      this.susanooSprite!.setPosition(this.x, this.y - 22).setAlpha(0.42 + 0.1 * Math.sin(now * 0.006)).setFlipX(this.facing < 0);
    } else if (this.susanooAura) {
      this.susanooAura.destroy(); this.susanooAura = undefined;
      this.susanooSprite?.destroy(); this.susanooSprite = undefined;
    }
  }

  /** Kage Bunshin : clone d'ombre qui flotte près du chaton et tranche. */
  private updateKageClone(now: number): void {
    const active = (this.mods.kageClone || 0) > 0 && !this.dead;
    if (!active) {
      if (this.kageClone) { this.kageClone.destroy(); this.kageClone = undefined; }
      return;
    }
    if (!this.kageClone) {
      this.kageClone = this.gs.add.sprite(this.x, this.y, 'kage_bunshin').setDepth(19).setAlpha(0.7);
      this.kageNextAt = now + 500;
    }
    const c = this.kageClone;
    // suit le chaton avec un léger décalage orbital (effet de double dans le dos)
    this.kageAngle += 0.015;
    const tx = this.x + Math.cos(this.kageAngle) * 48;
    const ty = this.y - 6 + Math.sin(this.kageAngle) * 30;
    c.setPosition(Phaser.Math.Linear(c.x, tx, 0.12), Phaser.Math.Linear(c.y, ty, 0.12));
    c.setAlpha(0.58 + 0.12 * Math.sin(now * 0.006));
    // frappe périodique : coup de sabre spectral vers un ennemi à portée
    if (now >= this.kageNextAt) {
      const near = this.gs.enemiesNear(c.x, c.y, 175);
      if (near.length) {
        this.kageNextAt = now + 620;
        const t = near[Math.floor(Math.random() * near.length)];
        const ang = Math.atan2(t.y - c.y, t.x - c.x);
        c.setFlipX(Math.cos(ang) < 0);
        this.gs.spectralSlash(c.x, c.y - 8, ang, 150, 10 + this.stats.swordDamage[0] * 0.5);
        this.gs.sfx('slash1');
        this.gs.tweens.add({ targets: c, scaleX: 1.2, scaleY: 1.2, duration: 90, yoyo: true });
      } else {
        this.kageNextAt = now + 220; // scrute à nouveau bientôt
      }
    }
  }

  /** Première Danse de l'Eau : une vague écumeuse jaillit le long du dash. */
  private waterDashVfx(dir: Phaser.Math.Vector2): void {
    const ang = Math.atan2(dir.y, dir.x);
    const wx = this.x + dir.x * 34, wy = this.y - 8 + dir.y * 34;
    const wave = this.gs.add.sprite(wx, wy, 'water_wave').setDepth(23).setOrigin(0.5, 0.5)
      .setRotation(ang + Math.PI / 2).setScale(1.3).setAlpha(0.95);
    this.gs.tweens.add({ targets: wave, scaleX: 2.8, scaleY: 2.2, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    for (let k = 0; k < 5; k++) {
      const px = this.x + dir.x * (10 + k * 22), py = this.y - 8 + dir.y * (10 + k * 22);
      this.gs.juice.burst(px, py, 0x59b8ff, 4, 120, 0.7);
    }
    this.gs.sfx('splash');
  }

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
    // Son différent par coup du combo (1, 2, 3…) + claquement du coup final.
    const isFinisher = this.comboIndex === this.maxCombo - 1;
    this.gs.sfx(isFinisher ? 'slashfin' : `slash${(this.comboIndex % 3) + 1}`);

    // résolution des dégâts au milieu du swing
    this.gs.time.delayedCall(this.attackDuration() * 0.35, () => {
      if (this.dead) return;
      this.resolveArcHit();
    });
  }

  /** Couleur de croissant par coup du combo (pour LIRE la progression). */
  private static SLASH_COLORS = [0xbfe6ff, 0x4fa8ff, 0xb98cff];

  /**
   * Croissant de coupe PLEIN : chaque coup du combo a une couleur, une largeur
   * d'arc et un SENS DE BALAYAGE différents (le 1er fend vers le bas, le 2e en
   * revers, le 3e/final en grand arc doré-orangé), pour qu'on VOIE le combo au
   * lieu de spammer sans retour visuel.
   */
  private slashVfx(aimAngle: number, comboIndex: number, maxCombo: number): void {
    const finisher = comboIndex === maxCombo - 1;
    const dir = comboIndex % 2 === 0 ? 1 : -1; // alterne le côté du swing
    const cx = this.x, cy = this.y - 8;
    const R = this.meleeRange() * (finisher ? 0.95 : 0.82);
    const span = finisher ? 1.5 : 1.0;
    // Décale le centre de l'arc selon le coup : les croissants successifs
    // apparaissent de part et d'autre (fend à droite, revers à gauche…).
    const center = aimAngle + (finisher ? 0 : dir * 0.36);
    const col = finisher ? 0xff9a2a : Player.SLASH_COLORS[comboIndex % Player.SLASH_COLORS.length];
    const g = this.gs.add.graphics().setDepth(23);
    // halo coloré large + fil de lame blanc net (rendu en coordonnées absolues).
    g.lineStyle(finisher ? 20 : 14, col, 0.6);
    g.beginPath(); g.arc(cx, cy, R, center - span, center + span, false); g.strokePath();
    g.lineStyle(finisher ? 9 : 5, 0xffffff, 0.92);
    g.beginPath(); g.arc(cx, cy, R, center - span * 0.8, center + span * 0.8, false); g.strokePath();
    // easeIn : le croissant reste BRILLANT puis s'efface d'un coup (lisible même
    // en plein enchaînement rapide), au lieu de pâlir tout de suite.
    this.gs.tweens.add({
      targets: g, alpha: 0, duration: finisher ? 340 : 250,
      ease: 'Cubic.easeIn', onComplete: () => g.destroy(),
    });
    // Le coup final claque : anneau + étincelles dans la couleur de la lame.
    if (finisher) {
      const tipX = cx + Math.cos(aimAngle) * R, tipY = cy + Math.sin(aimAngle) * R;
      this.gs.juice.ring(cx, cy, R * 0.92, col, 240);
      this.gs.juice.burst(tipX, tipY, col, 12, 220, 1.2);
    }
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
    const range = this.meleeRange();
    const aimAngle = Math.atan2(this.aim.y, this.aim.x);
    this.slashVfx(aimAngle, this.comboIndex, this.maxCombo);
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
    // Susanoo : une lame spectrale VIOLETTE prolonge l'attaque (+portée, +dégâts).
    if (this.mods.susanoo > 0) {
      const R = range * 1.45;
      this.lineDamage(this.x, this.y - 8, this.x + this.aim.x * R, this.y - 8 + this.aim.y * R, 26, Math.round(baseDmg * 0.7), 0x9a5cff);
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
    e.takeDamage(dmg, this.x, this.y, { crit: isCrit });
    if (finisher) this.applyKnockback(e, this.stats.knockback);
    // crocs élémentaires (chance on-hit) + ralentissement (Toile Légère)
    if (this.stats.fangBurn && Math.random() < this.stats.fangBurn) e.applyStatus('burn', 1500);
    if (this.stats.fangFreeze && Math.random() < this.stats.fangFreeze) e.applyStatus('freeze', 700);
    if (this.stats.fangShock && Math.random() < this.stats.fangShock) e.applyStatus('shock', 1200);
    if (this.stats.hitSlow && anyE.applySlow) anyE.applySlow(1 - this.stats.hitSlow, 800);
    for (const fn of this.onHitFns) fn(e, dmg, isCrit, info);
    if (this.stats.lifesteal > 0) this.heal(dmg * this.stats.lifesteal);
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
  castSpecial(auto = false): void {
    if (this.dead) return;
    this.markCombat();
    const aimDir = this.nearestTargetDir(360) ?? this.aim.clone().normalize();
    // Kamehameha Ultime : REMPLACE l'explosion par un rayon balayable. Ses dégâts
    // et sa portée dérivent de specialDamage/specialRadius, donc TOUS les boons
    // qui augmentent le Spécial (Gant Réacteur, Marteau, Tourbillon Ample, Ultra
    // Instinct…) se cumulent bien sur le rayon.
    if (this.specialFlags.has('kamehameha')) {
      const tick = Math.max(35, Math.round(this.stats.specialDamage * (35 / 30)));
      const ms = 1200 + Math.round((this.stats.specialRadius - 150) * 2); // + de portée = + long
      this.gs.beamSweep(this.x, this.y, aimDir.x, aimDir.y, tick, ms, 0x8fd0ff);
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
    // Rasenshuriken : shuriken de vent lancé sur l'ennemi le plus proche, qui
    // tournoie puis explose en dôme. Dégâts/portée dérivés du Spécial (cumulables).
    if (this.specialFlags.has('rasenshuriken')) {
      const t = this.gs.getTargets().find((e) => e.isAlive());
      const tx = t ? t.x : this.x + aimDir.x * 180, ty = t ? t.y : this.y + aimDir.y * 180;
      const rasenR = Math.max(96, this.stats.specialRadius * 0.72);
      this.gs.rasenshuriken(this.x, this.y, tx, ty, Math.round(this.stats.specialDamage * 0.9), rasenR);
    }
    // The World : l'arrêt du temps ne se déclenche QUE sur un spécial volontaire,
    // jamais via une relance automatique (Sanctuaire de Sukuna) — sinon il se
    // lançait « tout seul » en boucle.
    if (!auto && this.specialFlags.has('timestop')) this.gs.timeSlow(2200, 0.12);
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
    // Statik : chance d'électriser l'ennemi le plus proche au contact.
    if (this.stats.contactShockChance > 0 && Math.random() < this.stats.contactShockChance) {
      const near = this.gs.enemiesNear(this.x, this.y, 70);
      if (near.length) near[0].applyStatus('shock', 1000);
    }
    // Sharingan / Ultra Instinct : esquive automatique (aucun dégât subi)
    if (this.stats.dodgeChance > 0 && Math.random() < this.stats.dodgeChance) {
      this.invulnUntil = now + 120;
      this.gs.juice.popText(this.x, this.y - 40, 'Esquive !', '#9fe6ff', 15);
      return;
    }
    // Susanoo : absorbe les 3 prochains coups DISTINCTS et riposte (reconstitué
    // en 20 s). Compteur SÉPARÉ de l'indicateur d'activation (mods.susanoo), sinon
    // épuiser les charges couperait l'aura et le bonus de portée pendant 20 s.
    if (this.mods.susanoo > 0 && this.mods.susanooCharges > 0) {
      this.mods.susanooCharges--;
      this.invulnUntil = now + this.stats.hurtIFrames;
      this.gs.juice.ring(this.x, this.y, 100, 0xb26bff, 320);
      this.gs.explosionAt(this.x, this.y, 100, 30);
      if (this.mods.susanooCharges <= 0) this.gs.time.delayedCall(20000, () => { if (!this.dead) this.mods.susanooCharges = 3; });
      return;
    }
    // Rempart du Cœur : bloque 1 coup toutes les 2 s (aucun dégât subi)
    if (this.mods.rempart && now >= this.blockReadyAt) {
      this.blockReadyAt = now + 2000;
      this.gs.juice.burst(this.x, this.y, 0x8fd0ff, 8, 120, 0.9);
      return;
    }
    // À partir d'ici, un coup est RÉELLEMENT encaissé.
    // Nettoyage Parfait : être touché remet le bonus de salle à zéro.
    if (this.mods.nettoyage) this.roomDamageBonus = 0;
    this.mods.hitThisRoom = 1;
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
    // Retour d'impact : le chaton vire ROUGE ~1 frame, l'écran tremble, un flash
    // rouge pulse sur les bords (via UIScene) et un bruitage marque le dégât.
    // Le clignotement d'invincibilité est géré dans animate() tant qu'i-frames.
    this.gs.juice.flash(this, 70, 0xff2a2a);
    const sev = Phaser.Math.Clamp(dmg / Math.max(1, this.stats.maxHp), 0, 1);
    this.gs.juice.shake(150, 0.006 + sev * 0.006);
    this.gs.juice.burst(this.x, this.y, 0xff4a4a, 7, 130, 0.9);
    this.gs.sfx('hurt');
    this.gs.events.emit('hurt', sev);
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
    if (dmg > 0) this.gs.events.emit('hurt', 0.14); // léger pulse rouge de bord
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
    // La boucle update() s'arrête à la mort : on nettoie ici les VFX persistants
    // (armes orbitales, Susanoo, clone d'ombre) pour qu'ils ne restent pas figés.
    this.clearPersistentVfx();
    this.gs.tweens.add({ targets: [this, this.swordR, this.swordL], alpha: 0, angle: 90, duration: 800 });
    this.gs.onPlayerDead();
  }

  /** Détruit toutes les décorations persistantes (mort / fin de scène). */
  private clearPersistentVfx(): void {
    this.orbitBlades.forEach((b) => b.destroy()); this.orbitBlades = [];
    this.orbitHammers.forEach((b) => b.destroy()); this.orbitHammers = [];
    this.susanooAura?.destroy(); this.susanooAura = undefined;
    this.susanooSprite?.destroy(); this.susanooSprite = undefined;
    this.kageClone?.destroy(); this.kageClone = undefined;
  }

  destroy(fromScene?: boolean): void {
    this.swordR?.destroy(); this.swordL?.destroy();
    this.clearPersistentVfx();
    super.destroy(fromScene);
  }
}
