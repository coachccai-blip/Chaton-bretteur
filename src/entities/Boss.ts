import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { BossDef, BossMove, BossPhase } from '../config/bosses';
import type { Element, IEnemyLike } from '../config/types';
import { REACTIONS, reactKey } from './Enemy';

interface StatusInfo { expire: number; nextTick: number; }

export class Boss extends Phaser.Physics.Arcade.Sprite implements IEnemyLike {
  gs: GameScene;
  def: BossDef;
  maxHp: number;
  hp: number;
  alive = true;
  isBoss = true;
  contactDamage: number;

  private phaseIndex = 0;
  private moveCooldowns: number[] = [];
  private busy = false;
  private bobT = 0;
  private statuses: Partial<Record<Element, StatusInfo>> = {};
  private aura!: Phaser.GameObjects.Image;
  private auraEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private auraRing!: Phaser.GameObjects.Graphics;

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
    // entrée
    this.setScale(def.scale * 0.2).setAlpha(0);
    scene.tweens.add({ targets: this, scaleX: def.scale, scaleY: def.scale, alpha: 1, duration: 500, ease: 'Back.easeOut' });
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

  private get phase(): BossPhase { return this.def.phases[this.phaseIndex]; }

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
    const frozen = !!this.statuses.freeze;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const dir = new Phaser.Math.Vector2(dx / dist, dy / dist);
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (!this.busy && !frozen) {
      const spd = this.phase.speed * this.gs.enemyTimeScale;
      if (this.phase.movement === 'slither') {
        // serpente : avance vers le joueur en ondulant
        const perp = new Phaser.Math.Vector2(-dir.y, dir.x);
        const wobble = Math.sin(this.bobT * 3) * 0.9;
        body.setVelocity((dir.x + perp.x * wobble) * spd, (dir.y + perp.y * wobble) * spd);
      } else if (dist > 220) body.setVelocity(dir.x * spd, dir.y * spd);
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
    // Orientation : face au joueur (intention), figée pendant une attaque.
    if (!this.busy && Math.abs(dx) > 6) this.setFlipX(dx < 0);
    if (frozen) this.setTint(0x8fdfff); else if (!this.phase.tint) this.clearTint(); else this.setTint(this.phase.tint);
    this.updateAura();
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
    if (summon) {
      this.gs.time.delayedCall(500, () => {
        if (this.alive) this.gs.summonMinions(this.x, this.y, summon.summonId ?? 'slime', summon.summonCount ?? 3);
      });
    }
    this.gs.events.emit('bossPhase', this.phaseIndex + 1, this.def.phases.length);
  }

  private execMove(i: number, dir: Phaser.Math.Vector2): void {
    const m = this.phase.moves[i];
    this.busy = true;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.setTintFill(0xffffff);
    // moves à télégraphe interne : brève amorce seulement
    const selfTel = m.type === 'arrowRain' || m.type === 'mudFlood' || m.type === 'glyphs' || m.type === 'geysers' || m.type === 'diveBomb' || m.type === 'teleport';
    const windup = selfTel ? 320 : m.telegraph;
    this.gs.tweens.add({ targets: this, scaleX: this.def.scale * 1.12, scaleY: this.def.scale * 1.12, duration: windup, ease: 'Sine.easeInOut' });
    this.gs.time.delayedCall(windup, () => {
      if (!this.alive) { this.busy = false; return; }
      this.clearTint();
      this.setScale(this.def.scale);
      this.runMove(m, dir);
    });
    // Cadence d'attaque ×2 : on réduit surtout le temps mort entre coups (le
    // télégraphe reste lisible pour rester équitable).
    this.moveCooldowns[i] = performance.now() + m.telegraph + m.cooldown * 0.5;
  }

  private runMove(m: BossMove, dir: Phaser.Math.Vector2): void {
    const p = this.gs.player;
    const done = (delay: number) => this.gs.time.delayedCall(delay, () => (this.busy = false));
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
        this.gs.summonMinions(this.x, this.y, m.summonId ?? 'slime', m.summonCount ?? 3);
        this.gs.juice.ring(this.x, this.y, 90, 0xb26bff, 350);
        done(220);
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
        // balayage : le rail pivote légèrement (effet fouet/langue)
        this.gs.telegraphLine(this.x, this.y, base - 0.18, m.length ?? 340, m.width ?? 42, col, m.telegraph, m.damage ?? 18);
        this.gs.time.delayedCall(180, () => {
          if (this.alive) this.gs.telegraphLine(this.x, this.y, base + 0.18, m.length ?? 340, m.width ?? 42, col, 220, m.damage ?? 18);
        });
        done(520);
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
        // inonde toute l'arène SAUF quelques zones d'esquive
        this.gs.floodArena(m.safeCount ?? 3, m.radius ?? 70, m.telegraph, m.damage ?? 26, m.hazard ?? 'toxic', col);
        done(m.telegraph + 400);
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
        if (dmg > 0) {
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
    this.hp = Math.max(0, this.hp - bonus);
    this.gs.events.emit('bossHp', this.hp, this.maxHp);
    if (this.hp <= 0) this.die();
  }

  // ---------- IEnemyLike ----------
  takeDamage(amount: number, _fx: number, _fy: number, opts?: { silent?: boolean }): void {
    if (!this.alive) return;
    if (this.statuses.mark) amount = Math.round(amount * 1.3);
    this.hp = Math.max(0, this.hp - amount);
    if (!opts?.silent) {
      this.gs.juice.flash(this, 60);
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
    this.gs.tweens.add({ targets: this.aura, alpha: 0, duration: 600, onComplete: () => this.aura?.destroy() });
    this.gs.onBossKilled(this);
  }

  destroy(fromScene?: boolean): void {
    this.alive = false; // court-circuite les callbacks de télégraphe en attente
    this.aura?.destroy();
    this.auraEmitter?.destroy();
    this.auraRing?.destroy();
    super.destroy(fromScene);
  }
}
