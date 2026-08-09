import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { BossDef, BossMove, BossPhase } from '../config/bosses';
import type { Element, IEnemyLike } from '../config/types';
import { REACTIONS, reactKey } from './Enemy';
import { BlackFlameFx } from './BlackFlameFx';
import { BOSS_ART_COMP } from '../art/heroesHD';

interface StatusInfo { expire: number; nextTick: number; }

/** Coups de corps-à-corps / approche (privilégiés en posture offensive « rush »). */
const MELEE_MOVES = new Set(['charge', 'roll', 'diveBomb', 'shockwave', 'lineSweep']);
// Sorts pouvant partir en « second » lors d'un dual-cast : effets de zone /
// invocations auto-télégraphiés qui ne nécessitent pas que le boss se déplace.
const DUAL_MOVES = new Set([
  'iceRain', 'geysers', 'glyphs', 'summon', 'mudFlood', 'arrowRain',
  'fireBurst', 'fireTornado', 'mines', 'missileRain', 'grenades', 'summonBoss', 'summonClones',
]);

/** Classement des coups pour l'ouverture : le boss lance sa MEILLEURE attaque au début. */
const OPENER_RANK: Record<string, number> = {
  missileRain: 96, icePylons: 100, fireTornado: 94, mudFlood: 92, mines: 90, nova: 88, crossBeams: 86, geysers: 84, iceRain: 82, summonBoss: 76,
  fireBurst: 80, arrowRain: 74, spiral: 72, lineSweep: 66, diveBomb: 64, ringShot: 62,
  tornadoSweep: 78, shockwave: 60, roll: 58, summon: 54, summonClones: 70, glyphs: 52, charge: 48, fan: 44, aimedBurst: 38,
  teleport: 8,
};

export class Boss extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  def: BossDef;
  /** Échelle d'affichage réelle = def.scale compensée (textures boss HD ×2). */
  private baseScale = 1;
  maxHp: number;
  hp: number;
  alive = true;
  isBoss = true;
  enraged = false; // clone enragé du round final (×3)
  contactDamage: number;

  private phaseIndex = 0;
  private moveCooldowns: number[] = [];
  private busy = false;
  private bobT = 0;
  private nextDashAt = 0;   // prochaine ruée disponible
  private dashingUntil = 0; // fin de la ruée en cours
  private stance: 'rush' | 'kite' = 'rush'; // posture : foncer / jouer la distance
  private nextStanceAt = 0; // prochaine bascule de posture
  private openingDone = false; // meilleure attaque lancée en début de combat
  private openingAt = 0;
  private druidHealUsed = false; // Sylvaan n'invoque ses druides soigneurs qu'une fois
  private lavaTrailAt = 0; // Ignis : prochaine flaque de lave laissée en marchant
  private statuses: Partial<Record<Element, StatusInfo>> = {};
  private aura!: Phaser.GameObjects.Image;
  private auraEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private auraRing!: Phaser.GameObjects.Graphics;
  private blackFlame?: BlackFlameFx; // flammes noires d'Amaterasu

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
    // Textures boss HD ×2 → échelle compensée ; la hitbox (this.width×…) double et
    // l'échelle est divisée par 2 : produit inchangé, boîte de collision identique.
    this.baseScale = def.scale * BOSS_ART_COMP;
    this.setScale(this.baseScale);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(this.width * 0.55, this.height * 0.45);
    body.setOffset(this.width * 0.22, this.height * 0.5);
    body.setCollideWorldBounds(true);
    body.setImmovable(false);
    body.setBounce(0.1);
    body.setDrag(200, 200);

    // AURA de boss : halo pulsant + étincelles orbitales (marque le champion)
    this.aura = scene.add.image(x, y, 'light').setBlendMode(Phaser.BlendModes.ADD).setTint(def.auraColor).setDepth(14).setScale(1.7).setAlpha(0.5);
    scene.tweens.add({ targets: this.aura, scale: 2.3, alpha: 0.25, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.auraEmitter = scene.add.particles(x, y, 'px', {
      speed: { min: 8, max: 34 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.85, end: 0 },
      lifespan: 520, frequency: 55, tint: def.auraColor, blendMode: 'ADD',
      emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 26), quantity: 14 } as any,
    }).setDepth(14);
    this.auraRing = scene.add.graphics().setDepth(6);

    this.resetMoveCooldowns();
    const t0 = performance.now();
    this.nextDashAt = t0 + 2200 + Math.random() * 1800;
    this.openingAt = t0 + 650; // laisse l'anim d'apparition se jouer
    this.nextStanceAt = t0 + 3500 + Math.random() * 3000;
    this.stance = Math.random() < 0.5 ? 'rush' : 'kite';
    // entrée
    this.setScale(this.baseScale * 0.2).setAlpha(0);
    scene.tweens.add({ targets: this, scaleX: this.baseScale, scaleY: this.baseScale, alpha: 1, duration: 500, ease: 'Back.easeOut' });
  }

  /** Flammes noires d'Amaterasu superposées au boss tant que la Brûlure Noire brûle. */
  private updateBlackFlame(dt: number): void {
    if (this.statuses.blackburn) {
      if (!this.blackFlame) this.blackFlame = new BlackFlameFx(this.gs, 18);
      this.blackFlame.update(this.x, this.y - this.displayHeight * 0.4, this.displayHeight * 1.1, dt);
    } else if (this.blackFlame) {
      this.blackFlame.destroy();
      this.blackFlame = undefined;
    }
  }

  private updateAura(): void {
    const cx = this.x, ay = this.y - this.displayHeight * 0.4;
    this.aura.setPosition(cx, ay);
    this.auraEmitter.setPosition(cx, ay);
    // anneau au sol (marqueur de boss, visible sur tout fond)
    const pulse = 0.55 + 0.45 * Math.sin(performance.now() * 0.006);
    const rx = this.displayWidth * 0.55, ry = rx * 0.42;
    this.auraRing.clear();
    this.auraRing.fillStyle(this.def.auraColor, 0.12 * pulse);
    this.auraRing.fillEllipse(cx, this.y, rx * 2, ry * 2);
    this.auraRing.lineStyle(3, 0xffffff, 0.5 * pulse);
    this.auraRing.strokeEllipse(cx, this.y, rx * 2, ry * 2);
    this.auraRing.lineStyle(2, this.def.auraColor, 0.95 * pulse);
    this.auraRing.strokeEllipse(cx, this.y, rx * 2 + 7, ry * 2 + 6);
  }

  private mergedPhase?: BossPhase; // Glacior enragé : moveset cumulé phases 1+2
  private get phase(): BossPhase { return this.mergedPhase ?? this.def.phases[this.phaseIndex]; }

  private resetMoveCooldowns(): void {
    this.moveCooldowns = this.phase.moves.map(() => performance.now() + 450 + Math.random() * 450);
  }

  isAlive(): boolean { return this.alive; }

  // Le boss n'est pas dans un groupe runChildUpdate : on pilote update() via preUpdate.
  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.alive) this.update(time, delta);
  }

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

    this.processStatuses(now);
    if (!this.alive) return;
    this.updateBlackFlame(dt);
    const frozen = !!this.statuses.freeze;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = new Phaser.Math.Vector2(dx / dist, dy / dist);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (!this.busy && !frozen) {
      // Vitesse de déplacement des boss DOUBLÉE.
      const spd = this.phase.speed * this.gs.enemyTimeScale * 2;
      if (!this.openingDone) {
        // Ouverture GARANTIE : le boss reste immobile pendant son apparition puis
        // lance sa MEILLEURE attaque en TOUT PREMIER (aucune ruée/déplacement avant).
        // Ex. Glacior invoque toujours ses pilônes de glace dès le début du combat.
        if (now >= this.openingAt) { this.openingDone = true; this.execBestMove(dir); }
        else { body.setVelocity(0, 0); }
      } else if (now < this.dashingUntil) {
        // Ruée en cours : on laisse la vélocité de dash s'appliquer (pas d'écrasement).
      } else {
        // Bascule de posture : parfois foncer (rush), parfois jouer la distance (kite).
        if (now >= this.nextStanceAt) {
          this.stance = this.stance === 'rush' ? 'kite' : 'rush';
          this.nextStanceAt = now + 3500 + Math.random() * 3500;
        }
        // Ignis reste TOUJOURS à l'assaut : il cherche sans cesse à foncer.
        if (this.def.id === 'golem') this.stance = 'rush';
        // Dash surtout en posture offensive (fonce sur le joueur).
        const wantDash = now >= this.nextDashAt && dist > 80 && (this.stance === 'rush' || Math.random() < 0.35);
        if (wantDash) {
          this.startBossDash(dir, now);
        } else {
          if (this.phase.movement === 'slither') {
            // serpente : avance vers le joueur en ondulant
            const perp = new Phaser.Math.Vector2(-dir.y, dir.x);
            const wobble = Math.sin(this.bobT * 3) * 0.9;
            const drift = this.stance === 'kite' && dist < 240 ? -0.6 : 1;
            body.setVelocity((dir.x * drift + perp.x * wobble) * spd, (dir.y * drift + perp.y * wobble) * spd);
          } else if (this.stance === 'rush') {
            // fonce et reste au contact
            if (dist > 70) body.setVelocity(dir.x * spd, dir.y * spd);
            else body.setVelocity(dir.x * spd * 0.3, dir.y * spd * 0.3);
          } else {
            // kite : garde ses distances pour canarder / lancer sa signature
            if (dist < 300) body.setVelocity(-dir.x * spd, -dir.y * spd);
            else body.setVelocity(-dir.y * spd * 0.5, dir.x * spd * 0.5);
          }
          this.pickMove(now, dir);
        }
      }
    } else if (frozen) {
      body.setVelocity(0, 0);
    }

    // Ignis : laisse une traînée de lave partout où il passe (disparaît en 8 s).
    if (this.def.id === 'golem' && !frozen && now >= this.lavaTrailAt) {
      this.lavaTrailAt = now + 420;
      this.gs.spawnHazardZone(this.x, this.y + 8, 26, 'lava', 0, 8000);
      this.gs.juice.burst(this.x, this.y + 8, 0xff6a1f, 3, 70, 0.6);
    }

    this.bobT += dt / 1000 * 5;
    const bob = Math.sin(this.bobT) * 0.03;
    if (!this.busy) this.setScale(this.baseScale * (1 - bob * 0.4), this.baseScale * (1 + bob));
    // Orientation : face au joueur (intention), figée pendant une attaque.
    if (!this.busy && Math.abs(dx) > 6) this.setFlipX(dx < 0);
    if (frozen) this.setTint(0x8fdfff);
    else if (this.gs.bossInvincible()) this.setTint(0x8fb8e8); // givre : invincible
    else if (this.enraged) this.setTint(0xff6a5a); // clone enragé (rouge furieux)
    else if (!this.phase.tint) this.clearTint(); else this.setTint(this.phase.tint);
    this.updateAura();
  }

  /** Passe le boss en mode ENRAGÉ : phase la plus agressive + teinte rouge. */
  markEnraged(): void {
    this.enraged = true;
    this.phaseIndex = this.def.phases.length - 1; // moveset le plus agressif
    // Glacior enragé : conserve l'accès à TOUS ses sorts (phases 1 & 2, dont les
    // pilônes d'invincibilité et le rayon rectiligne) — les 3 clones peuvent donc
    // chacun invoquer des pilônes qui rendent les Glacior invincibles.
    if (this.def.id === 'leviathan') {
      const seen = new Set<string>();
      const moves = [...this.def.phases[0].moves, ...this.def.phases[1].moves, ...this.def.phases[2].moves]
        .filter((m) => { const k = m.type + (m.summonId ?? ''); if (seen.has(k)) return false; seen.add(k); return true; });
      this.mergedPhase = { ...this.def.phases[this.def.phases.length - 1], moves };
    }
    this.resetMoveCooldowns();
    this.aura.setTint(0xff5a3a);
  }

  /** Lance la meilleure attaque de la phase (ouverture de combat). */
  /** Le sort d'invocation de druides soigneurs de Sylvaan est à usage unique. */
  private moveSpent(i: number): boolean {
    const m = this.phase.moves[i];
    return m.type === 'summon' && m.summonId === 'druide' && this.druidHealUsed;
  }

  private execBestMove(dir: Phaser.Math.Vector2): void {
    let best = 0, bestRank = -1;
    this.phase.moves.forEach((m, i) => {
      if (this.moveSpent(i)) return;
      const r = OPENER_RANK[m.type] ?? 30;
      if (r > bestRank) { bestRank = r; best = i; }
    });
    this.execMove(best, dir);
  }

  /** Choisit un coup prêt, en privilégiant ceux qui collent à la posture courante. */
  private pickMove(now: number, dir: Phaser.Math.Vector2): void {
    const ready: number[] = [];
    for (let i = 0; i < this.phase.moves.length; i++) if (now >= this.moveCooldowns[i] && !this.moveSpent(i)) ready.push(i);
    if (!ready.length) return;
    const wantMelee = this.stance === 'rush';
    const preferred = ready.filter((i) => MELEE_MOVES.has(this.phase.moves[i].type) === wantMelee);
    const pool = preferred.length ? preferred : ready;
    const primary = pool[Math.floor(Math.random() * pool.length)];
    this.execMove(primary, dir);
    // DUAL-CAST : tous les boss lancent parfois un SECOND sort (zone/été) en même
    // temps (ex. Glacior fait tomber des glaces PENDANT son rayon rectiligne).
    if (Math.random() < 0.32) {
      const extras = ready.filter((j) => j !== primary && DUAL_MOVES.has(this.phase.moves[j].type) && !this.moveSpent(j));
      if (extras.length) {
        const j = extras[Math.floor(Math.random() * extras.length)];
        const em = this.phase.moves[j];
        this.moveCooldowns[j] = now + em.telegraph + em.cooldown * 0.25;
        this.gs.juice.ring(this.x, this.y, 64, em.color ?? 0x9fd0ff, 320);
        this.runMove(em, dir, true); // secondaire : ne bloque pas le boss
      }
    }
  }

  /** Ruée commune à tous les boss : zone rouge télégraphiée PUIS lunge rapide. */
  private startBossDash(dir: Phaser.Math.Vector2, now: number): void {
    const WIND = 300; // amorce télégraphiée (esquivable)
    this.nextDashAt = now + 2600 + Math.random() * 1600;
    this.dashingUntil = now + WIND + 240; // reste « en ruée » (update n'écrase pas) pendant l'amorce + la ruée
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    const ang = Math.atan2(dir.y, dir.x);
    this.gs.dashTelegraph(this.x, this.y, ang, 460, 64, WIND);
    if (Math.abs(dir.x) > 0.1) this.setFlipX(dir.x < 0);
    this.gs.time.delayedCall(WIND, () => {
      if (!this.alive) return;
      const dashSpeed = 620 * this.gs.enemyTimeScale;
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(dir.x * dashSpeed, dir.y * dashSpeed);
      this.gs.juice.dashTrail(this.x, this.y, this.def.auraColor);
      this.gs.juice.burst(this.x, this.y, this.def.auraColor, 8, 150, 1);
      this.gs.sfx('bosscharge');
    });
  }

  private enterPhase(): void {
    this.gs.juice.shake(360, 0.014);
    this.gs.juice.ring(this.x, this.y, 220, this.phase.tint ?? 0xffffff, 550);
    this.gs.juice.burst(this.x, this.y, this.phase.tint ?? 0xffe0b0, 28, 240, 1.8);
    this.gs.sfx('special');
    // court arrêt dramatique — hit-stop SEUL (surtout pas timeSlow, qui est
    // l'animation « The World » et donnait l'impression que le spécial la lançait).
    this.gs.juice.hitStop(220);
    this.resetMoveCooldowns();
    // changement de style : renfort immédiat si la nouvelle phase invoque
    const summon = this.phase.moves.find((m) => m.type === 'summon');
    if (summon && !(summon.summonId === 'druide' && this.druidHealUsed)) {
      if (summon.summonId === 'druide') this.druidHealUsed = true;
      this.gs.time.delayedCall(500, () => {
        if (this.alive) this.gs.summonMinions(this.x, this.y, summon.summonId ?? 'slime', summon.summonCount ?? 3);
      });
    }
    this.gs.events.emit('bossPhase', this.phaseIndex + 1, this.def.phases.length);
  }

  private lastSpeakAt = 0;
  /** Réplique du boss (attaque signature) : bulle de texte au-dessus de lui. */
  private speak(text: string): void {
    const now = performance.now();
    if (now - this.lastSpeakAt < 1400) return; // pas de spam
    this.lastSpeakAt = now;
    this.gs.juice.popText(this.x, this.y - this.displayHeight * 0.6 - 14, `« ${text} »`, '#ffe08a', 18);
  }

  private execMove(i: number, dir: Phaser.Math.Vector2): void {
    const m = this.phase.moves[i];
    if (m.say) this.speak(m.say);
    this.busy = true;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.setTintFill(0xffffff);
    // moves à télégraphe interne : brève amorce seulement
    const selfTel = m.type === 'arrowRain' || m.type === 'mudFlood' || m.type === 'glyphs' || m.type === 'geysers' || m.type === 'diveBomb' || m.type === 'teleport' || m.type === 'iceRain' || m.type === 'icePylons';
    const windup = selfTel ? 320 : m.telegraph;
    this.gs.tweens.add({ targets: this, scaleX: this.baseScale * 1.12, scaleY: this.baseScale * 1.12, duration: windup, ease: 'Sine.easeInOut' });
    this.gs.time.delayedCall(windup, () => {
      if (!this.alive) { this.busy = false; return; }
      this.clearTint();
      this.setScale(this.baseScale);
      this.runMove(m, dir);
    });
    // Cadence d'attaque très soutenue : temps mort entre coups réduit de moitié
    // supplémentaire (soit ×0,25 du CD de base) — les boss enchaînent les sorts.
    this.moveCooldowns[i] = performance.now() + m.telegraph + m.cooldown * 0.25;
  }

  private runMove(m: BossMove, dir: Phaser.Math.Vector2, secondary = false): void {
    const p = this.gs.player;
    // Bruitage d'attaque signature selon le type de coup.
    const t = m.type;
    if (t === 'shockwave' || t === 'geysers' || t === 'mudFlood' || t === 'glyphs' || t === 'nova') this.gs.sfx('bossslam');
    else if (t === 'charge' || t === 'roll' || t === 'diveBomb') this.gs.sfx('bosscharge');
    else if (t === 'summon') this.gs.sfx('bosscast');
    else if (t === 'crossBeams' || t === 'lineSweep') this.gs.sfx('zap');
    else if (t === 'teleport') this.gs.sfx('timestop');
    else this.gs.sfx('bossshot'); // aimedBurst / fan / ringShot / spiral / arrowRain
    // En dual-cast (sort secondaire), on ne touche PAS au flag `busy` : le boss
    // reste occupé par son sort principal, le secondaire ne fait que son effet.
    const done = secondary ? (_d: number) => { /* no-op */ } : (delay: number) => this.gs.time.delayedCall(delay, () => (this.busy = false));
    const col = m.color ?? 0xff6a3a;
    const fire = (dx: number, dy: number) =>
      this.gs.spawnEnemyProjectile(this.x, this.y - 10, dx, dy, m.speed ?? 190, m.damage ?? 12, undefined, col);
    const aimAngle = () => {
      const q = this.gs.player;
      return q ? Math.atan2(q.y - this.y, q.x - this.x) : Math.atan2(dir.y, dir.x);
    };

    switch (m.type) {
      case 'aimedBurst': {
        const n = m.count ?? 1;
        for (let k = 0; k < n; k++) {
          this.gs.time.delayedCall(k * 130, () => {
            if (!this.alive || !this.gs.player) return;
            const a = Math.atan2(this.gs.player.y - this.y, this.gs.player.x - this.x);
            fire(Math.cos(a), Math.sin(a));
          });
        }
        done(n * 130 + 120);
        break;
      }
      case 'fan': {
        const n = m.count ?? 5;
        const spread = m.spread ?? 0.5;
        const base = aimAngle();
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0.5 : k / (n - 1);
          const a = base + Phaser.Math.Linear(-spread, spread, t);
          fire(Math.cos(a), Math.sin(a));
        }
        this.gs.juice.burst(this.x, this.y, col, 8, 140, 1);
        done(160);
        break;
      }
      case 'ringShot': {
        const n = m.count ?? 10;
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          fire(Math.cos(a), Math.sin(a));
        }
        this.gs.juice.ring(this.x, this.y, 70, col, 300);
        done(200);
        break;
      }
      case 'spiral': {
        const n = m.count ?? 16;
        for (let k = 0; k < n; k++) {
          this.gs.time.delayedCall(k * 55, () => {
            if (!this.alive) return;
            const a = (k / n) * Math.PI * 4;
            fire(Math.cos(a), Math.sin(a));
          });
        }
        done(n * 55 + 100);
        break;
      }
      case 'nova': {
        const n = m.count ?? 20;
        for (let ring = 0; ring < 2; ring++) {
          this.gs.time.delayedCall(ring * 280, () => {
            if (!this.alive) return;
            const off = ring * (Math.PI / n);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2 + off;
              fire(Math.cos(a), Math.sin(a));
            }
            this.gs.juice.ring(this.x, this.y, 100, col, 340);
          });
        }
        this.gs.juice.shake(200, 0.008);
        done(650);
        break;
      }
      case 'shockwave': {
        const r = m.radius ?? 150;
        this.gs.tweens.add({ targets: this, y: this.y - 24, duration: 200, yoyo: true, ease: 'Quad.easeOut', onComplete: () => {
          if (!this.alive) return;
          this.gs.juice.ring(this.x, this.y, r, col, 380);
          this.gs.juice.shake(240, 0.011);
          this.gs.juice.burst(this.x, this.y, col, 18, 220, 1.4);
          if (p && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) <= r) p.takeDamage(m.damage ?? 18, this.x, this.y);
        }});
        done(520);
        break;
      }
      case 'summon': {
        if (m.summonId === 'druide') this.druidHealUsed = true;
        this.gs.summonMinions(this.x, this.y, m.summonId ?? 'slime', m.summonCount ?? 3);
        this.gs.juice.ring(this.x, this.y, 90, 0xb26bff, 350);
        done(220);
        break;
      }
      case 'summonClones': {
        // Néantis : reflets ténébreux du héros, chacun à la MOITIÉ des PV du boss.
        this.gs.summonShadowClones(m.summonCount ?? 2, Math.round(this.maxHp * 0.5));
        this.gs.juice.ring(this.x, this.y, 110, 0xd05aff, 420);
        done(260);
        break;
      }
      case 'charge': {
        const d = p ? new Phaser.Math.Vector2(p.x - this.x, p.y - this.y).normalize() : dir;
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setVelocity(d.x * (m.chargeSpeed ?? 500), d.y * (m.chargeSpeed ?? 500));
        this.gs.juice.burst(this.x, this.y, 0xffd24a, 10, 160, 1);
        this.gs.time.delayedCall(650, () => { if (this.alive) (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0); });
        done(750);
        break;
      }
      case 'diveBomb': {
        const tx = p ? p.x : this.x, ty = p ? p.y : this.y;
        const r = m.radius ?? 90;
        this.gs.telegraphCircle(tx, ty, r, col, 450, () => {
          if (this.alive) this.gs.eruptAt(tx, ty, r, col, m.damage ?? 20);
        });
        this.gs.tweens.add({ targets: this, x: tx, y: ty, duration: 450, ease: 'Quad.easeIn' });
        done(650);
        break;
      }
      case 'lineSweep': {
        const base = aimAngle();
        // balayage : le rail pivote (effet fouet) — TROIS rayons rectilignes.
        const offs = [-0.26, 0, 0.26];
        offs.forEach((o, k) => {
          this.gs.time.delayedCall(k * 170, () => {
            if (this.alive) this.gs.telegraphLine(this.x, this.y, base + o, m.length ?? 340, m.width ?? 42, col, k === 0 ? m.telegraph : 220, m.damage ?? 18);
          });
        });
        done(offs.length * 170 + 360);
        break;
      }
      case 'crossBeams': {
        const arms = m.arms ?? 4;
        const len = m.length ?? 500;
        const w = m.width ?? 46;
        const base = m.spin ? performance.now() * 0.0012 : aimAngle();
        for (let k = 0; k < arms; k++) {
          const a = base + (k / arms) * Math.PI * 2;
          this.gs.telegraphLine(this.x, this.y, a, len, w, col, m.telegraph, m.damage ?? 20, m.hazard, m.duration ?? 2200);
        }
        done(600);
        break;
      }
      case 'geysers': {
        const n = m.count ?? 5;
        const r = m.radius ?? 50;
        const tel = Math.max(320, m.telegraph * 0.7);
        for (let k = 0; k < n; k++) {
          let tx: number, ty: number;
          if (k === 0 && p) { tx = p.x; ty = p.y; }
          else { const pt = this.gs.arenaPoint(60); tx = pt.x; ty = pt.y; }
          this.gs.time.delayedCall(k * 90, () => {
            if (!this.alive) return;
            this.gs.telegraphCircle(tx, ty, r, col, tel, () => {
              if (this.alive) this.gs.eruptAt(tx, ty, r, col, m.damage ?? 22, m.hazard, m.duration ?? 1200);
            });
          });
        }
        done(n * 90 + tel + 200);
        break;
      }
      case 'arrowRain': {
        // pluie de flèches télégraphiées un peu partout
        const n = m.count ?? 6;
        const r = m.radius ?? 46;
        for (let k = 0; k < n; k++) {
          this.gs.time.delayedCall(k * 90, () => {
            if (!this.alive) return;
            let tx: number, ty: number;
            if (k === 0 && p) { tx = p.x; ty = p.y; } else { const pt = this.gs.arenaPoint(50); tx = pt.x; ty = pt.y; }
            this.gs.telegraphCircle(tx, ty, r, col, 520, () => { if (this.alive) this.gs.eruptAt(tx, ty, r, col, m.damage ?? 16); });
          });
        }
        done(n * 90 + 300);
        break;
      }
      case 'mudFlood': {
        if (this.enraged) {
          // Gorbak enragé (round ×3) : au lieu d'inonder tout le sol, il crache
          // un barrage de boue sur la position du joueur (en ligne OU en cône) ;
          // chaque glob retombe en flaque toxique.
          const mode: 'line' | 'cone' = Math.random() < 0.5 ? 'line' : 'cone';
          const px = p ? p.x : this.x, py = p ? p.y : this.y;
          this.gs.mudBarrage(this.x, this.y - 10, px, py, mode, m.damage ?? 26);
          done(m.telegraph + 300);
        } else {
          // inonde toute l'arène SAUF quelques zones d'esquive
          this.gs.floodArena(m.safeCount ?? 3, m.radius ?? 70, m.telegraph, m.damage ?? 26, m.hazard ?? 'toxic', col);
          done(m.telegraph + 400);
        }
        break;
      }
      case 'roll': {
        // se met en boule et roule très vite en rebondissant
        const dur = m.duration ?? 1800;
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setBounce(1, 1);
        const d = p ? new Phaser.Math.Vector2(p.x - this.x, p.y - this.y).normalize() : dir;
        body.setVelocity(d.x * (m.chargeSpeed ?? 600), d.y * (m.chargeSpeed ?? 600));
        this.gs.tweens.add({ targets: this, angle: 360 * 4, duration: dur, ease: 'Linear' });
        this.gs.juice.burst(this.x, this.y, col, 12, 160, 1.2);
        this.gs.time.delayedCall(dur, () => {
          if (this.alive) { (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0).setBounce(0.1, 0.1); this.setAngle(0); }
        });
        done(dur + 200);
        break;
      }
      case 'teleport': {
        this.gs.juice.burst(this.x, this.y, col, 14, 200, 1.4);
        this.gs.juice.ring(this.x, this.y, 60, col, 300);
        const pt = this.gs.arenaPoint(90);
        this.gs.tweens.add({ targets: this, alpha: 0, duration: 160, onComplete: () => {
          if (!this.alive) return;
          this.setPosition(pt.x, pt.y);
          this.gs.juice.ring(pt.x, pt.y, 60, col, 300);
          this.gs.tweens.add({ targets: this, alpha: 1, duration: 160 });
        }});
        done(400);
        break;
      }
      case 'glyphs': {
        // pose des glyphes explosifs au sol (autour du joueur + aléatoire)
        const n = m.count ?? 3;
        const r = m.radius ?? 60;
        for (let k = 0; k < n; k++) {
          let tx: number, ty: number;
          if (p && k < 2) { tx = p.x + Phaser.Math.Between(-70, 70); ty = p.y + Phaser.Math.Between(-70, 70); }
          else { const pt = this.gs.arenaPoint(60); tx = pt.x; ty = pt.y; }
          this.gs.time.delayedCall(k * 120, () => {
            if (!this.alive) return;
            this.gs.glyph(tx, ty, r, col, m.telegraph, m.damage ?? 22);
          });
        }
        done(n * 120 + m.telegraph + 200);
        break;
      }
      case 'fireBurst': {
        // rafale de boules de feu crachées vers le joueur (à esquiver)
        const n = m.count ?? 10;
        for (let k = 0; k < n; k++) {
          this.gs.time.delayedCall(k * 110, () => {
            if (!this.alive || !this.gs.player) return;
            const a = Math.atan2(this.gs.player.y - this.y, this.gs.player.x - this.x)
              + Phaser.Math.FloatBetween(-0.09, 0.09);
            this.gs.spawnEnemyProjectile(this.x, this.y - 12, Math.cos(a), Math.sin(a), m.speed ?? 250, m.damage ?? 14, undefined, undefined, { texture: 'fireball', scale: 1.6, orient: true, radius: 7 });
            this.gs.juice.burst(this.x, this.y - 12, 0xff7a2a, 4, 90, 0.7);
            this.gs.sfx('bossshot');
          });
        }
        done(n * 110 + 160);
        break;
      }
      case 'fireTornado': {
        // Signature d'Ignis : 5 tornades de feu venant de 5 directions, chacune
        // traversant toute la map le long d'une ligne passant par le joueur.
        const px = p ? p.x : this.x, py = p ? p.y : this.y;
        this.gs.fireTornadoStorm(px, py, m.damage ?? 20);
        done((m.count ?? 5) * 200 + 700 + 400);
        break;
      }
      case 'tornadoSweep': {
        // Énorme tornade qui balaie tout l'écran — à esquiver au dash.
        this.gs.bossTornadoSweep(m.damage ?? 24, m.telegraph);
        done(m.telegraph + 1700);
        break;
      }
      case 'mines': {
        this.gs.layBossMines(m.count ?? 5, m.damage ?? 100);
        done(m.telegraph + 300);
        break;
      }
      case 'grenades': {
        this.gs.throwGrenades(m.count ?? 3, m.damage ?? 55);
        done((m.count ?? 3) * 220 + 600);
        break;
      }
      case 'missileRain': {
        this.gs.bossMissileRain(m.count ?? 8, m.damage ?? 50);
        done((m.count ?? 8) * 150 + 800);
        break;
      }
      case 'summonBoss': {
        this.gs.summonEnragedBoss();
        done(m.telegraph + 300);
        break;
      }
      case 'icePylons': {
        // 4 pilônes d'invincibilité aux coins ; à briser pour blesser le boss.
        // Chaque pilône a AUTANT de PV que Glacior lui-même (les casser est un vrai enjeu).
        this.gs.spawnIcePylons(this.maxHp);
        this.gs.juice.ring(this.x, this.y, 120, 0x7fdcff, 420);
        done(300);
        break;
      }
      case 'iceRain': {
        // pluie de stalactites du ciel, quelques zones sûres marquées en vert
        this.gs.iceRain(m.safeCount ?? 3, m.count ?? 12, m.telegraph, m.damage ?? 22, m.radius ?? 46);
        done((m.count ?? 12) * 130 + m.telegraph + 300);
        break;
      }
    }
  }

  healBy(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.gs.events.emit('bossHp', this.hp, this.maxHp);
    this.gs.juice.burst(this.x, this.y - 10, 0x6ad46a, 5, 100, 0.7);
  }

  // ---------- statuts & réactions (les boss résistent) ----------
  private processStatuses(now: number): void {
    for (const key of Object.keys(this.statuses) as Element[]) {
      const st = this.statuses[key]!;
      if (now >= st.expire) { delete this.statuses[key]; continue; }
      if (now >= st.nextTick) {
        st.nextTick = now + (key === 'burn' || key === 'blackburn' ? 400 : 500);
        const dmg = key === 'blackburn' ? 28 : key === 'burn' ? 14 : key === 'poison' ? 12 : key === 'bleed' ? 10 : 0;
        // Les DoT ne franchissent PAS l'invincibilité des pilônes (sinon on tuerait
        // Glacior par les brûlures sans jamais briser un pilône).
        if (dmg > 0 && !this.gs.bossInvincible()) {
          this.hp = Math.max(0, this.hp - dmg);
          this.gs.juice.burst(this.x, this.y - 20, key === 'blackburn' ? 0x14060a : key === 'burn' ? 0xff6a1f : key === 'poison' ? 0x8fd94a : 0xc0392b, 3, 60, 0.6);
          this.gs.events.emit('bossHp', this.hp, this.maxHp);
          if (this.hp <= 0) { this.die(); return; }
        }
      }
    }
  }

  applyStatus(status: Element, duration: number): void {
    const now = performance.now();
    const dur = status === 'freeze' ? duration * 0.4 : duration; // résistance
    if (status !== 'mark' && status !== 'bleed' && status !== 'blackburn') {
      for (const other of Object.keys(this.statuses) as Element[]) {
        if (other === status || other === 'mark' || other === 'bleed' || other === 'blackburn') continue;
        const react = REACTIONS[reactKey(status, other)];
        if (react) { delete this.statuses[other]; this.triggerReaction(react); return; }
      }
    }
    const prev = this.statuses[status];
    this.statuses[status] = { expire: Math.max(prev?.expire ?? 0, now + dur), nextTick: prev?.nextTick ?? now + (status === 'burn' || status === 'blackburn' ? 400 : 500) };
  }

  private triggerReaction(react: { name: string; base: number; hpFrac: number; color: number; aoe: number }): void {
    const bonus = Math.round(react.base + this.maxHp * react.hpFrac * 0.25); // atténué sur les boss
    this.gs.reactionVfx(this.x, this.y, react.name, react.color);
    if (this.gs.bossInvincible()) return; // pas de dégâts tant que les pilônes tiennent
    this.hp = Math.max(0, this.hp - bonus);
    this.gs.events.emit('bossHp', this.hp, this.maxHp);
    if (this.hp <= 0) this.die();
  }

  // ---------- IEnemyLike ----------
  takeDamage(amount: number, _fx: number, _fy: number, opts?: { silent?: boolean; crit?: boolean }): void {
    if (!this.alive) return;
    // Invincible tant que ses pilônes de glace tiennent (Glacior).
    if (this.gs.bossInvincible()) {
      if (!opts?.silent) {
        this.gs.juice.flash(this, 50, 0x9fd0ff);
        this.gs.juice.burst(this.x, this.y - 20, 0xbfeaff, 3, 70, 0.5);
      }
      return;
    }
    if (this.statuses.mark) amount = Math.round(amount * 1.3);
    this.hp = Math.max(0, this.hp - amount);
    if (!opts?.silent) {
      this.gs.juice.flash(this, 60);
      this.gs.juice.damageNumber(this.x, this.y - this.displayHeight * 0.75, Math.round(amount), !!opts?.crit);
      this.gs.sfx('hitmob');
    }
    this.gs.events.emit('bossHp', this.hp, this.maxHp);
    if (this.hp <= 0) this.die();
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.auraEmitter?.destroy();
    this.auraRing?.destroy();
    this.blackFlame?.destroy(); this.blackFlame = undefined;
    this.gs.tweens.killTweensOf(this.aura); // stoppe la pulsation infinie avant le fondu
    this.gs.tweens.add({ targets: this.aura, alpha: 0, duration: 600, onComplete: () => this.aura?.destroy() });
    this.gs.onBossKilled(this);
  }

  destroy(fromScene?: boolean): void {
    this.alive = false; // court-circuite les callbacks de télégraphe en attente
    if (this.aura) this.gs.tweens.killTweensOf(this.aura);
    this.aura?.destroy();
    this.auraEmitter?.destroy();
    this.auraRing?.destroy();
    this.blackFlame?.destroy();
    super.destroy(fromScene);
  }
}
