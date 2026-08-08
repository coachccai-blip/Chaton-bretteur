import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import { ARENA_RECT } from '../scenes/GameScene';
import type { EnemyDef, EnemySignature } from '../config/enemies';
import type { Element, IEnemyLike } from '../config/types';
import { getDifficulty } from '../config/difficulty';
import { RunState } from '../systems/RunState';
import { BlackFlameFx } from './BlackFlameFx';

type State = 'idle' | 'telegraph' | 'charging' | 'recover' | 'signature';

/** Limite globale du son d'élément (évite la saturation quand plusieurs ennemis sont touchés). */
let lastElemSfxAt = 0;
/** Limite globale des sons d'attaque des monstres (évite la cacophonie). */
let lastAtkSfxAt = 0;

interface StatusInfo { expire: number; nextTick: number; }

/** Réactions élémentaires (combo de deux statuts) : nom + dégâts + couleur + AoE. */
export const REACTIONS: Record<string, { name: string; base: number; hpFrac: number; color: number; aoe: number }> = {
  'freeze+shock': { name: 'SURCHARGE', base: 24, hpFrac: 0.20, color: 0x9fe6ff, aoe: 0 },
  'burn+poison': { name: 'TOXINE !', base: 20, hpFrac: 0.15, color: 0x8fd94a, aoe: 70 },
  'burn+freeze': { name: 'VAPEUR', base: 18, hpFrac: 0.14, color: 0xffffff, aoe: 0 },
  'poison+shock': { name: 'CORROSION', base: 18, hpFrac: 0.13, color: 0xb26bff, aoe: 0 },
  'burn+shock': { name: 'PLASMA', base: 20, hpFrac: 0.15, color: 0xffa53a, aoe: 60 },
};

export function reactKey(a: Element, b: Element): string {
  return [a, b].sort().join('+');
}

export class Enemy extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  def: EnemyDef;
  maxHp: number;
  hp: number;
  damage: number;
  private dmgMul = 1;
  private speedMul = 1;      // accélération par salle (de plus en plus rapide)
  private canDash = false;   // ruée vers le joueur (mondes glacés et au-delà)
  private canBurst = false;  // rafales de projectiles à distance
  private nextDashAt = 0;
  private dashingUntil = 0;
  private nextBurstAt = 0;
  alive = true;
  isBoss = false;

  private aiState: State = 'idle';
  private nextActionAt = 0;
  private aiStateUntil = 0;
  private chargeDir = new Phaser.Math.Vector2();
  private bobT = Math.random() * 6;
  private facingSign = 1; // +1 = orienté droite (défaut), -1 = miroir vers la gauche

  private statuses: Partial<Record<Element, StatusInfo>> = {};
  private sigNextAt = 0;
  private shieldedUntil = 0;

  private hpBg?: Phaser.GameObjects.Rectangle;
  private hpFill?: Phaser.GameObjects.Rectangle;
  private blackFlame?: BlackFlameFx; // flammes noires d'Amaterasu (Brûlure Noire)

  constructor(scene: GameScene, x: number, y: number, def: EnemyDef, hpMul: number, dmgMul: number,
              opts?: { speedMul?: number; canDash?: boolean; canBurst?: boolean }) {
    super(scene, x, y, `mob_${def.sprite}`);
    this.gs = scene;
    this.def = def;
    this.maxHp = Math.round(def.hp * hpMul);
    this.hp = this.maxHp;
    this.damage = def.damage * dmgMul;
    this.dmgMul = dmgMul;
    this.speedMul = opts?.speedMul ?? 1;
    this.canDash = !!opts?.canDash;
    this.canBurst = !!opts?.canBurst;
    const t0 = performance.now();
    this.nextDashAt = t0 + 1800 + Math.random() * 2200;
    this.nextBurstAt = t0 + 1400 + Math.random() * 1800;

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
    this.sigNextAt = performance.now() + 1800 + Math.random() * 1600;
    this.setScale(def.scale * 0.2);
    scene.tweens.add({ targets: this, scaleX: def.scale, scaleY: def.scale, duration: 220, ease: 'Back.easeOut' });
  }

  isAlive(): boolean { return this.alive; }

  /**
   * Dégât de projectile mis à l'échelle de la ZONE uniquement : spawnEnemyProjectile
   * réapplique la difficulté, donc on la retire ici pour ne pas la compter deux fois.
   */
  private projDmg(base: number): number {
    const diffDmg = getDifficulty(RunState.difficultyId).enemyDamage || 1;
    return Math.round(base * (this.dmgMul / diffDmg));
  }

  /** Dégât direct (éruption, bombe) : pleine échelle zone × difficulté. */
  private directDmg(base: number): number {
    return Math.round(base * this.dmgMul);
  }

  /** Ruée : la bête bondit vers le joueur (mondes glacés et au-delà). */
  private startEnemyDash(dir: Phaser.Math.Vector2, now: number, body: Phaser.Physics.Arcade.Body): void {
    this.dashingUntil = now + 220;
    this.nextDashAt = now + 2600 + Math.random() * 2400;
    const ds = 520 * this.gs.enemyTimeScale;
    body.setVelocity(dir.x * ds, dir.y * ds);
    this.facingSign = dir.x > 0 ? 1 : -1;
    this.setFlipX(this.facingSign < 0);
    this.gs.juice.dashTrail(this.x, this.y, 0xffffff);
    this.atkSfx('bosscharge');
  }

  /** Rafale de projectiles visés, tirés en salve rapprochée vers le joueur. */
  private fireEnemyBurst(): void {
    this.atkSfx('eshot');
    const n = 5;
    for (let k = 0; k < n; k++) {
      this.gs.time.delayedCall(k * 90, () => {
        if (!this.alive) return;
        const q = this.gs.player;
        if (!q || q.dead) return;
        const a = Math.atan2(q.y - this.y, q.x - this.x) + Phaser.Math.FloatBetween(-0.06, 0.06);
        this.gs.spawnEnemyProjectile(this.x, this.y - 14, Math.cos(a), Math.sin(a), 240, this.projDmg(9));
      });
    }
  }

  /** Superpose (ou retire) les flammes noires d'Amaterasu selon le statut. */
  private updateBlackFlame(dt: number): void {
    if (this.statuses.blackburn) {
      if (!this.blackFlame) this.blackFlame = new BlackFlameFx(this.gs, 17);
      this.blackFlame.update(this.x, this.y - this.displayHeight * 0.35, this.displayHeight, dt);
    } else if (this.blackFlame) {
      this.blackFlame.destroy();
      this.blackFlame = undefined;
    }
  }

  /** Son d'attaque throttlé globalement (évite la saturation en meute). */
  private atkSfx(key: string): void {
    const now = performance.now();
    if (now - lastAtkSfxAt < 65) return;
    lastAtkSfxAt = now;
    this.gs.sfx(key);
  }

  update(time: number, dt: number): void {
    if (!this.alive) return;
    const now = performance.now();
    const player = this.gs.player;
    if (!player || player.dead) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    this.processStatuses(now);
    if (!this.alive) return;
    this.updateBlackFlame(dt);

    const frozen = !!this.statuses.freeze;
    const timeScale = this.gs.enemyTimeScale;

    const dx = player.x - this.x, dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = new Phaser.Math.Vector2(dx / dist, dy / dist);
    const body = this.body as Phaser.Physics.Arcade.Body;
    const slow = now < this.slowUntil ? this.slowMul : 1;
    const spd = this.def.speed * this.speedMul * (frozen ? 0.12 : 1) * slow * timeScale;

    // Orientation gauche/droite : dérivée de l'INTENTION (cible / direction de
    // charge), jamais de la vélocité subie (un knockback ne retourne pas la
    // bête). Verrouillée pendant les états engagés (télégraphe/signature).
    if (this.aiState === 'charging') {
      if (Math.abs(this.chargeDir.x) > 0.1) this.facingSign = this.chargeDir.x > 0 ? 1 : -1;
    } else if (this.aiState !== 'telegraph' && this.aiState !== 'signature') {
      if (Math.abs(dx) > 4) this.facingSign = dx > 0 ? 1 : -1; // DEADZONE anti-oscillation
    }
    this.setFlipX(this.facingSign < 0);

    // attaque signature (interrompt le comportement). Les exploders portent une
    // signature 'spread' réservée à leur explosion (nuée de spores) : ils ne la
    // lancent PAS comme attaque à distance.
    if (this.aiState === 'idle' && this.def.signature && this.def.behavior !== 'exploder'
        && !frozen && now >= this.sigNextAt && dist <= (this.def.signature.range ?? 260)) {
      this.startSignature(this.def.signature, dir, dist);
      return;
    }
    if (this.aiState === 'signature') { body.setVelocity(0, 0); this.clampToArena(); this.updateHpBar(); return; }

    // --- Ruée (mondes glacés et au-delà) : la bête fonce sur le joueur ---
    if (this.dashingUntil > now) {
      // ruée en cours : on laisse la vélocité filer, on ne change rien d'autre
      this.animate(dt, body); this.clampToArena(); this.updateHpBar(); return;
    }
    if (this.canDash && this.aiState === 'idle' && !frozen && now >= this.nextDashAt && dist > 110 && dist < 480) {
      this.startEnemyDash(dir, now, body);
      this.animate(dt, body); this.clampToArena(); this.updateHpBar(); return;
    }
    // --- Rafale de projectiles à distance (beaucoup d'ennemis, mondes glacés+) ---
    if (this.canBurst && this.aiState === 'idle' && !frozen && now >= this.nextBurstAt && dist < 440) {
      this.nextBurstAt = now + 2600 + Math.random() * 1400;
      this.fireEnemyBurst();
    }

    switch (this.def.behavior) {
      case 'chaser': body.setVelocity(dir.x * spd, dir.y * spd); break;
      case 'tank': body.setVelocity(dir.x * spd, dir.y * spd); break;
      case 'exploder': this.updateExploder(now, dir, dist, spd); break;
      case 'shooter': this.updateShooter(now, dir, dist, spd, false); break;
      case 'summoner': this.updateShooter(now, dir, dist, spd, true); break;
      case 'charger': this.updateCharger(now, dir, dist, spd); break;
      case 'healer': this.updateHealer(now, dir, dist, spd); break;
      case 'shielder': this.updateShielder(now, dir, dist, spd); break;
      case 'bomber': this.updateBomber(now, dir, dist, spd); break;
      case 'bossheal': this.updateBossHeal(now, dir, dist, spd); break;
    }

    this.applyStatusTint(frozen);
    this.animate(dt, body);
    this.clampToArena(); // les volants/téléporteurs ne peuvent pas sortir de l'arène
    this.updateHpBar();
  }

  /** Garde l'ancre du monstre à l'intérieur de l'arène (donc toujours frappable). */
  private clampToArena(): void {
    const A = ARENA_RECT, m = 10;
    const nx = Phaser.Math.Clamp(this.x, A.x + m, A.x + A.w - m);
    const ny = Phaser.Math.Clamp(this.y, A.y + m, A.y + A.h - m);
    if (nx !== this.x || ny !== this.y) this.setPosition(nx, ny);
  }

  // ---------------- statuts & réactions ----------------
  private processStatuses(now: number): void {
    for (const key of Object.keys(this.statuses) as Element[]) {
      const st = this.statuses[key]!;
      if (now >= st.expire) { delete this.statuses[key]; continue; }
      if (now >= st.nextTick) {
        st.nextTick = now + this.tickInterval(key);
        const dmg = this.dotDamage(key);
        if (dmg > 0) {
          this.hp -= dmg;
          this.gs.juice.burst(this.x, this.y - 12, this.dotColor(key), 3, 60, 0.5);
          if (this.hp <= 0) { this.kill(true); return; }
        }
      }
    }
  }
  private tickInterval(e: Element): number { return e === 'burn' || e === 'blackburn' ? 400 : 500; }
  private dotDamage(e: Element): number {
    if (e === 'burn') return Math.max(2, Math.round(this.maxHp * 0.035));
    if (e === 'blackburn') return Math.max(4, Math.round(this.maxHp * 0.07)); // Amaterasu : DoT ×2
    if (e === 'poison') return Math.max(2, Math.round(this.maxHp * 0.03));
    if (e === 'bleed') return Math.max(1, Math.round(this.maxHp * 0.03));
    return 0;
  }
  private dotColor(e: Element): number {
    if (e === 'blackburn') return 0x14060a;
    return e === 'burn' ? 0xff6a1f : e === 'poison' ? 0x8fd94a : e === 'bleed' ? 0xc0392b : 0x9fe6ff;
  }

  /** Ralentissement temporaire (Toile, Vapeur, immobilisations). */
  applySlow(factor: number, ms: number): void {
    this.slowMul = factor;
    this.slowUntil = performance.now() + ms;
  }
  private slowMul = 1;
  private slowUntil = 0;

  applyStatus(status: Element, duration: number): void {
    const now = performance.now();
    // réaction si un autre élément réactif est présent
    if (status !== 'mark' && status !== 'bleed' && status !== 'blackburn') {
      for (const other of Object.keys(this.statuses) as Element[]) {
        if (other === status || other === 'mark' || other === 'bleed' || other === 'blackburn') continue;
        const react = REACTIONS[reactKey(status, other)];
        if (react) {
          delete this.statuses[other];
          this.triggerReaction(react);
          if (!this.alive) return;
          return; // la réaction consomme l'application
        }
      }
    }
    const prev = this.statuses[status];
    this.statuses[status] = { expire: Math.max(prev?.expire ?? 0, now + duration), nextTick: prev?.nextTick ?? now + this.tickInterval(status) };
    // VFX/SFX dédiés à l'élément (le son est limité pour ne pas saturer)
    this.gs.juice.elementFx(this.x, this.y, status);
    if (!prev && now - lastElemSfxAt > 110) { lastElemSfxAt = now; this.gs.sfx(status); }
  }

  private triggerReaction(react: { name: string; base: number; hpFrac: number; color: number; aoe: number }): void {
    const bonus = Math.round(react.base + this.maxHp * react.hpFrac);
    this.gs.reactionVfx(this.x, this.y, react.name, react.color);
    if (react.aoe > 0) {
      for (const e of this.gs.enemiesNear(this.x, this.y, react.aoe)) {
        if (e !== this && e.isAlive()) e.takeDamage(Math.round(bonus * 0.6), this.x, this.y, { silent: true });
      }
    }
    this.hp -= bonus;
    if (this.hp <= 0) this.kill(true);
  }

  private applyStatusTint(frozen: boolean): void {
    if (this.aiState === 'telegraph' || this.aiState === 'signature') return;
    if (frozen) this.setTint(0x8fdfff);
    else if (performance.now() < this.shieldedUntil) this.setTint(0x8fd0ff);
    else if (this.statuses.blackburn) this.setTint(0x6a2030);
    else if (this.statuses.burn) this.setTint(0xff9a5a);
    else if (this.statuses.poison) this.setTint(0xbfe86a);
    else if (this.statuses.shock) this.setTint(0xcfe0ff);
    else if (this.statuses.mark) this.setTint(0xff9db0);
    else this.clearTint();
  }

  // ---------------- attaque signature ----------------
  private startSignature(sig: EnemySignature, dir: Phaser.Math.Vector2, dist: number): void {
    this.aiState = 'signature';
    this.atkSfx('ecast');
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    const color = sig.color ?? 0xffd24a;
    const p = this.gs.player;
    this.setTintFill(0xffffff);
    this.gs.tweens.add({ targets: this, scaleX: this.def.scale * 1.15, scaleY: this.def.scale * 1.15, duration: sig.telegraph, ease: 'Sine.easeInOut' });
    const endSig = () => {
      if (!this.alive) return; // le monstre a pu mourir pendant le télégraphe
      this.aiState = 'idle';
      this.sigNextAt = performance.now() + sig.cooldown;
      this.clearTint();
      this.setScale(this.def.scale);
    };

    switch (sig.type) {
      case 'leap': {
        const tx = p ? p.x : this.x, ty = p ? p.y : this.y;
        const r = sig.radius ?? 60;
        this.gs.telegraphCircle(tx, ty, r, color, sig.telegraph, () => {
          if (this.alive) this.gs.eruptAt(tx, ty, r, color, this.directDmg(sig.damage), sig.hazard, 2200);
          endSig();
        });
        this.gs.tweens.add({ targets: this, x: tx, y: ty, duration: sig.telegraph, ease: 'Quad.easeIn' });
        break;
      }
      case 'spinAoE': {
        const r = sig.radius ?? 80;
        this.gs.telegraphCircle(this.x, this.y, r, color, sig.telegraph, () => {
          if (!this.alive) { endSig(); return; }
          this.gs.eruptAt(this.x, this.y, r, color, this.directDmg(sig.damage));
          endSig();
        });
        break;
      }
      case 'spread': {
        this.gs.time.delayedCall(sig.telegraph, () => {
          if (this.alive) this.fireSpread(sig);
          endSig();
        });
        break;
      }
      case 'lobPool': {
        const tx = p ? p.x : this.x, ty = p ? p.y : this.y;
        const r = sig.radius ?? 48;
        this.gs.time.delayedCall(sig.telegraph, () => {
          if (this.alive) this.gs.spawnHazardZone(tx, ty, r, sig.hazard ?? 'toxic', 260, 4000);
          endSig();
        });
        break;
      }
      case 'blink': {
        this.gs.tweens.add({ targets: this, alpha: 0.2, duration: sig.telegraph * 0.6, yoyo: true });
        this.gs.time.delayedCall(sig.telegraph, () => {
          if (!this.alive) { endSig(); return; }
          const q = this.gs.player;
          if (q) {
            const a = Math.random() * Math.PI * 2;
            const A = ARENA_RECT, m = 24;
            this.setPosition(
              Phaser.Math.Clamp(q.x + Math.cos(a) * 70, A.x + m, A.x + A.w - m),
              Phaser.Math.Clamp(q.y + Math.sin(a) * 70, A.y + m, A.y + A.h - m),
            );
            this.gs.eruptAt(this.x, this.y, sig.radius ?? 40, color, this.directDmg(sig.damage));
          }
          endSig();
        });
        break;
      }
      case 'castZone': {
        const tx = p ? p.x : this.x, ty = p ? p.y : this.y;
        const r = sig.radius ?? 64;
        this.gs.telegraphCircle(tx, ty, r, color, sig.telegraph, () => {
          if (this.alive) this.gs.eruptAt(tx, ty, r, color, this.directDmg(sig.damage));
          endSig();
        });
        break;
      }
      case 'coneSpray': {
        // Souffle de glace en cône : plusieurs vagues de blocs + particules de givre.
        this.gs.time.delayedCall(sig.telegraph, () => {
          if (this.alive) this.fireCone(sig);
          endSig();
        });
        break;
      }
    }
  }

  /** Souffle en cône : nappe de blocs de glace + éclats de givre projetés. */
  private fireCone(sig: EnemySignature): void {
    this.atkSfx('ecast');
    const p = this.gs.player;
    const base = p ? Math.atan2(p.y - this.y, p.x - this.x) : 0;
    const n = sig.count ?? 9;
    const spread = 0.85; // large cône
    const speed = sig.speed ?? 220;
    // 3 vagues successives pour un vrai « spray »
    for (let wave = 0; wave < 3; wave++) {
      this.gs.time.delayedCall(wave * 130, () => {
        if (!this.alive) return;
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0.5 : k / (n - 1);
          const a = base + Phaser.Math.Linear(-spread, spread, t) + Phaser.Math.FloatBetween(-0.05, 0.05);
          const sp = speed * (0.8 + Math.random() * 0.4);
          this.gs.spawnEnemyProjectile(this.x, this.y - 12, Math.cos(a), Math.sin(a), sp, this.projDmg(sig.damage), 'freeze', undefined, { texture: 'ice_shard', scale: 1.3, radius: 6 });
        }
        // gerbe de particules de givre le long du cône
        this.gs.frostSpray(this.x, this.y - 12, base, spread);
      });
    }
  }

  private fireSpread(sig: EnemySignature): void {
    this.atkSfx('eshot');
    const p = this.gs.player;
    const base = p ? Math.atan2(p.y - this.y, p.x - this.x) : 0;
    const n = sig.count ?? 3;
    const spread = 0.45;
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0.5 : k / (n - 1);
      const a = base + Phaser.Math.Linear(-spread, spread, t);
      this.gs.spawnEnemyProjectile(this.x, this.y - 14, Math.cos(a), Math.sin(a), sig.speed ?? 200, this.projDmg(sig.damage), undefined, sig.color);
    }
  }

  private animate(dt: number, body: Phaser.Physics.Arcade.Body): void {
    this.bobT += dt / 1000 * 8;
    const moving = body.velocity.lengthSq() > 100;
    const bob = Math.sin(this.bobT) * (moving ? 0.08 : 0.04);
    const s = this.def.scale;
    if (this.aiState !== 'telegraph' && this.aiState !== 'signature') this.setScale(s * (1 - bob * 0.4), s * (1 + bob));
    // NB : l'orientation (flipX) est gérée dans update() à partir de l'intention.
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
    this.atkSfx('eslam');
    this.gs.juice.ring(this.x, this.y, r, 0xff5a3a, 260);
    this.gs.juice.burst(this.x, this.y, 0xff7a3a, 14, 200, 1.2);
    this.gs.juice.shake(140, 0.006);
    const p = this.gs.player;
    if (p && !p.dead && Math.hypot(p.x - this.x, p.y - this.y) <= r) {
      p.takeDamage(this.damage, this.x, this.y);
      if (this.def.attack?.status === 'poison') this.gs.poisonPlayer();
    }
    // nuée de spores à l'explosion (signature)
    if (this.def.signature?.type === 'spread') {
      const n = this.def.signature.count ?? 6;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        this.gs.spawnEnemyProjectile(this.x, this.y, Math.cos(a), Math.sin(a), this.def.signature.speed ?? 140, this.def.signature.damage, undefined, this.def.signature.color);
      }
    }
    this.kill(false);
  }

  private updateShooter(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number, summoner: boolean): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 240;
    if (this.aiState === 'idle') {
      if (dist < range * 0.6) body.setVelocity(-dir.x * spd, -dir.y * spd);
      else if (dist > range) body.setVelocity(dir.x * spd, dir.y * spd);
      else body.setVelocity(-dir.y * spd * 0.5, dir.x * spd * 0.5);
      if (now >= this.nextActionAt && dist <= range * 1.2) {
        this.beginTelegraph(now, this.def.attack?.telegraph ?? 500, 0xff5a3a, () => {
          if (summoner && Math.random() < 0.5) this.summon();
          else this.shoot(dir);
          this.nextActionAt = performance.now() + (this.def.attack?.cooldown ?? 1800);
        });
      }
    }
  }

  private shoot(dir: Phaser.Math.Vector2): void {
    if (!this.alive) return;
    this.atkSfx('eshot');
    const a = this.def.attack!;
    this.gs.spawnEnemyProjectile(this.x, this.y - 16, dir.x, dir.y, a.projectileSpeed ?? 180, this.projDmg(a.projectileDamage ?? 8), a.status);
  }

  private summon(): void {
    this.atkSfx('ecast');
    const a = this.def.attack!;
    this.gs.summonMinions(this.x, this.y, a.summonId ?? 'fantome', a.summonCount ?? 2);
    this.gs.juice.ring(this.x, this.y, 60, 0xb26bff, 300);
  }

  // -- Soigneuse : fuit le joueur, soigne l'allié le plus blessé --
  private updateHealer(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 250;
    if (dist < range) body.setVelocity(-dir.x * spd, -dir.y * spd);
    else body.setVelocity(-dir.y * spd * 0.4, dir.x * spd * 0.4);
    if (this.aiState === 'idle' && now >= this.nextActionAt) {
      this.nextActionAt = now + (this.def.attack?.cooldown ?? 3200);
      const allies = this.gs.getEnemies().filter((e) => e !== this && e.isAlive() && e.hp < e.maxHp);
      if (allies.length) {
        allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
        const t = allies[0];
        this.beginTelegraph(now, 450, 0x6ad46a, () => {
          if (!this.alive || !t.isAlive()) return;
          t.healBy(Math.round(t.maxHp * 0.2));
          this.gs.beam(this.x, this.y - 10, t.x, t.y - 10, 0x6ad46a);
        });
      }
    }
  }

  // -- Druide : soigne le BOSS (fuit le joueur) --
  private updateBossHeal(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 240;
    if (dist < range) body.setVelocity(-dir.x * spd, -dir.y * spd);
    else body.setVelocity(-dir.y * spd * 0.4, dir.x * spd * 0.4);
    if (this.aiState === 'idle' && now >= this.nextActionAt) {
      this.nextActionAt = now + (this.def.attack?.cooldown ?? 2600);
      const boss = this.gs.boss;
      if (boss && boss.isAlive()) {
        this.beginTelegraph(now, 400, 0x6ad46a, () => {
          const b = this.gs.boss;
          if (!this.alive || !b || !b.isAlive()) return;
          b.healBy(Math.round(b.maxHp * 0.03));
          this.gs.beam(this.x, this.y - 10, b.x, b.y - 10, 0x6ad46a);
        });
      }
    }
  }

  // -- Porte-bouclier : protège les alliés proches --
  private updateShielder(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 170;
    if (dist > 210) body.setVelocity(dir.x * spd, dir.y * spd);
    else if (dist < 120) body.setVelocity(-dir.x * spd * 0.5, -dir.y * spd * 0.5);
    else body.setVelocity(-dir.y * spd * 0.4, dir.x * spd * 0.4);
    if (this.aiState === 'idle' && now >= this.nextActionAt) {
      this.nextActionAt = now + (this.def.attack?.cooldown ?? 4200);
      this.beginTelegraph(now, 450, 0x59c8ff, () => {
        if (!this.alive) return;
        this.gs.juice.ring(this.x, this.y, range, 0x59c8ff, 420);
        this.applyShield(3800);
        for (const a of this.gs.getEnemies()) {
          if (a.isAlive() && Phaser.Math.Distance.Between(a.x, a.y, this.x, this.y) <= range) a.applyShield(3800);
        }
      });
    }
  }

  // -- Bombardier : lance des bombes télégraphiées (hitbox prévisionnelle) --
  private updateBomber(now: number, dir: Phaser.Math.Vector2, dist: number, spd: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const range = this.def.attack?.range ?? 300;
    if (dist < range * 0.55) body.setVelocity(-dir.x * spd, -dir.y * spd);
    else if (dist > range) body.setVelocity(dir.x * spd, dir.y * spd);
    else body.setVelocity(-dir.y * spd * 0.5, dir.x * spd * 0.5);
    if (this.aiState === 'idle' && now >= this.nextActionAt) {
      this.nextActionAt = now + (this.def.attack?.cooldown ?? 2600);
      const p = this.gs.player;
      const tx = p ? p.x : this.x, ty = p ? p.y : this.y;
      const a = this.def.attack!;
      this.gs.lobBomb(this.x, this.y - 14, tx, ty, a.explodeRadius ?? 64, this.directDmg(a.projectileDamage ?? 16), a.status, a.telegraph ?? 700);
    }
  }

  healBy(amount: number): void {
    if (!this.alive) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.gs.juice.burst(this.x, this.y - 10, 0x6ad46a, 6, 120, 0.8);
    this.gs.juice.popText(this.x, this.y - 26, `+${amount}`, '#6ad46a', 12);
  }

  applyShield(duration: number): void {
    this.shieldedUntil = Math.max(this.shieldedUntil, performance.now() + duration);
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
        const cs = (this.def.attack?.chargeSpeed ?? 440) * this.gs.enemyTimeScale;
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
    ms = Math.round(ms * (this.gs.player?.stats.telegraphMult ?? 1)); // Sens du Chaton
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

  // ---------------- IEnemyLike ----------------
  takeDamage(amount: number, fromX: number, fromY: number, opts?: { silent?: boolean; crit?: boolean }): void {
    if (!this.alive) return;
    if (this.statuses.mark) amount = Math.round(amount * 1.3); // Marque (Haki)
    if (performance.now() < this.shieldedUntil) {
      amount = Math.round(amount * 0.5); // protégé par un Gardien
      if (!opts?.silent) this.gs.juice.burst(this.x, this.y - 8, 0x59c8ff, 4, 90, 0.6);
    }
    this.hp -= amount;
    if (!opts?.silent) {
      this.gs.juice.flash(this, 80);
      this.gs.juice.burst(this.x, this.y - 10, 0xffffff, 5, 120, 0.7);
      this.gs.juice.damageNumber(this.x, this.y - this.displayHeight * 0.7, Math.round(amount), !!opts?.crit);
      this.gs.sfx('hitmob');
    }
    if (this.hp <= 0) this.kill(true);
  }

  kill(byPlayer: boolean): void {
    if (!this.alive) return;
    // Flammes d'Amaterasu : la Brûlure Noire se propage à un ennemi proche.
    if (this.statuses.blackburn) {
      for (const e of this.gs.enemiesNear(this.x, this.y, 120)) {
        if (e !== this && e.isAlive()) { e.applyStatus('blackburn', 4000); break; }
      }
    }
    this.alive = false;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.gs.juice.burst(this.x, this.y - 10, 0xffe0b0, 12, 180, 1.2);
    this.gs.onEnemyKilled(this, byPlayer);
    this.hpBg?.destroy();
    this.hpFill?.destroy();
    this.blackFlame?.destroy(); this.blackFlame = undefined;
    this.gs.tweens.add({
      targets: this, scaleX: this.def.scale * 1.3, scaleY: 0, alpha: 0, duration: 200,
      onComplete: () => this.destroy(),
    });
  }

  private updateHpBar(): void {
    const scouter = !!this.gs.player?.mods.scouter; // Scouter : barre de PV toujours visible
    if (this.hp >= this.maxHp && !scouter) {
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
    this.blackFlame?.destroy();
    super.destroy(fromScene);
  }
}
