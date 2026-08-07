import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS, REWARDS } from '../config/game';
import { ZONES, type ZoneDef } from '../config/worlds';
import { ENEMIES } from '../config/enemies';
import { BOSSES } from '../config/bosses';
import { getDifficulty } from '../config/difficulty';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Projectile } from '../entities/Projectile';
import { JuiceManager } from '../systems/JuiceManager';
import { InputManager } from '../systems/InputManager';
import { RunState } from '../systems/RunState';
import { SaveSystem } from '../systems/SaveSystem';
import { AudioManager } from '../systems/AudioManager';
import type { IEnemyLike } from '../config/types';
import type { PowerDef } from '../config/powers';

const ARENA = { x: 28, y: 64, w: 904, h: 452 };

interface Hazard { x: number; y: number; r: number; type: ZoneDef['hazard']; nextTick: number; }

export class GameScene extends Phaser.Scene {
  player!: Player;
  juice!: JuiceManager;
  controls!: InputManager;

  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  boss: Boss | null = null;

  private activeEnemies = new Set<Enemy>();
  private zone!: ZoneDef;
  private roomState: 'combat' | 'boss' | 'transition' | 'over' = 'transition';
  private waveIndex = 0;
  private wavesTotal = 1;
  private floor!: Phaser.GameObjects.TileSprite;
  private hazards: Hazard[] = [];
  private hazardGfx!: Phaser.GameObjects.Graphics;
  private reviveAvailable = false;
  private poisonUntil = 0;
  private nextPoisonTick = 0;

  constructor() { super('Game'); }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

    this.juice = new JuiceManager(this);
    this.controls = new InputManager(this);

    this.floor = this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 12, ARENA.w, ARENA.h, 'floor_foret');
    this.floor.setDepth(0);
    this.hazardGfx = this.add.graphics().setDepth(1);
    this.drawWalls();

    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.projectiles = this.physics.add.group({ runChildUpdate: true });

    const stats = SaveSystem.computeBaseStats();
    this.reviveAvailable = SaveSystem.hasFlag('revive');
    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20, stats);

    // overlaps
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const en = e as Enemy;
      if (!en.isAlive()) return;
      this.player.tryDashHit(en);
      this.player.takeDamage(en.damage, en.x, en.y);
    });
    this.physics.add.overlap(this.player, this.projectiles, (_p, pr) => (pr as Projectile).hitPlayer());

    this.scene.launch('UI', { gameScene: this });
    this.events.emit('powers', RunState.powers);

    this.startZone(RunState.zoneIndex);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.activeEnemies.clear();
      this.boss = null;
    });
  }

  private drawWalls(): void {
    const g = this.add.graphics().setDepth(2);
    g.lineStyle(6, 0x000000, 0.5);
    g.strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    g.lineStyle(3, this.zone?.palette.accent ?? COLORS.gold, 0.5);
    g.strokeRect(ARENA.x + 3, ARENA.y + 3, ARENA.w - 6, ARENA.h - 6);
    // vignette
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.bg, 0)
      .setStrokeStyle(80, COLORS.bg, 0.25).setDepth(3);
  }

  // ---------------- progression ----------------
  private startZone(index: number): void {
    // nettoyage des reliquats de la zone précédente
    this.projectiles.clear(true, true);
    this.activeEnemies.forEach((e) => e.destroy());
    this.activeEnemies.clear();
    this.zone = ZONES[index];
    RunState.zoneIndex = index;
    RunState.roomIndex = 0;
    SaveSystem.recordZone(index);
    this.floor.setTexture(`floor_${this.zone.id}`);
    this.cameras.main.setBackgroundColor(this.zone.palette.fog);
    AudioManager.startMusic(this.zone.id);
    this.events.emit('zoneName', this.zone.name);
    this.banner(this.zone.name, () => this.startRoom());
  }

  private startRoom(): void {
    if (RunState.roomIndex >= this.zone.rooms) {
      this.startBoss();
      return;
    }
    this.roomState = 'combat';
    this.setupHazards();
    const diff = getDifficulty(RunState.difficultyId);
    this.wavesTotal = Phaser.Math.Between(1, 3);
    this.waveIndex = 0;
    this.events.emit('progress', this.zone.name, RunState.roomIndex + 1, this.zone.rooms, false);
    this.spawnWave(diff);
  }

  private spawnWave(diff = getDifficulty(RunState.difficultyId)): void {
    const baseCount = 3 + Math.floor(RunState.roomIndex * 0.6) + this.zone.index;
    const count = Math.max(2, Math.round(baseCount * diff.waveDensity));
    for (let i = 0; i < count; i++) {
      const id = Phaser.Utils.Array.GetRandom(this.zone.enemyPool);
      const pos = this.randomSpawnPos();
      this.juice.ring(pos.x, pos.y, 30, this.zone.palette.accent, 300);
      this.time.delayedCall(300, () => this.spawnEnemy(id, pos.x, pos.y, diff));
    }
  }

  private randomSpawnPos(): { x: number; y: number } {
    let x = 0, y = 0;
    for (let tries = 0; tries < 10; tries++) {
      x = Phaser.Math.Between(ARENA.x + 40, ARENA.x + ARENA.w - 40);
      y = Phaser.Math.Between(ARENA.y + 40, ARENA.y + ARENA.h - 40);
      if (!this.player || Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 140) break;
    }
    return { x, y };
  }

  spawnEnemy(id: string, x: number, y: number, diff = getDifficulty(RunState.difficultyId)): Enemy {
    const def = ENEMIES[id];
    const e = new Enemy(this, x, y, def, diff.enemyHp, diff.enemyDamage);
    this.enemies.add(e);
    this.activeEnemies.add(e);
    return e;
  }

  summonMinions(x: number, y: number, id: string, count: number): void {
    if (this.roomState === 'over') return;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const px = Phaser.Math.Clamp(x + Math.cos(ang) * 50, ARENA.x + 20, ARENA.x + ARENA.w - 20);
      const py = Phaser.Math.Clamp(y + Math.sin(ang) * 50, ARENA.y + 20, ARENA.y + ARENA.h - 20);
      this.time.delayedCall(200, () => {
        if (this.roomState === 'over') return;
        this.spawnEnemy(id, px, py);
      });
    }
  }

  spawnEnemyProjectile(x: number, y: number, dx: number, dy: number, speed: number, damage: number, status?: 'poison' | 'freeze'): void {
    const diff = getDifficulty(RunState.difficultyId);
    const p = new Projectile(this, x, y, dx * speed, dy * speed, damage * diff.enemyDamage, status);
    this.projectiles.add(p);
  }

  private startBoss(): void {
    this.roomState = 'boss';
    this.hazards = [];
    this.hazardGfx.clear();
    const def = BOSSES[this.zone.bossId];
    const diff = getDifficulty(RunState.difficultyId);
    AudioManager.startMusic('boss');
    this.events.emit('progress', this.zone.name, this.zone.rooms, this.zone.rooms, true);
    this.banner(`BOSS : ${def.name}, ${def.title}`, () => {
      this.boss = new Boss(this, GAME_WIDTH / 2, ARENA.y + 120, def, diff.enemyHp, diff.enemyDamage);
      this.physics.add.overlap(this.player, this.boss, (_p, b) => {
        const bs = b as Boss;
        if (bs.isAlive()) this.player.takeDamage(bs.contactDamage, bs.x, bs.y);
      });
      this.events.emit('bossName', `${def.name}, ${def.title}`);
      this.events.emit('bossHp', this.boss.hp, this.boss.maxHp);
      this.events.emit('bossPhase', 1, def.phases.length);
    });
  }

  // ---------------- callbacks entités ----------------
  getTargets(): IEnemyLike[] {
    const list: IEnemyLike[] = [];
    for (const e of this.activeEnemies) if (e.isAlive()) list.push(e);
    if (this.boss?.isAlive()) list.push(this.boss);
    return list;
  }

  onEnemyKilled(e: Enemy, byPlayer: boolean): void {
    this.activeEnemies.delete(e);
    if (byPlayer) {
      RunState.kills++;
      this.player.notifyKill(e);
      this.addRunCurrency(REWARDS.perEnemyBonus);
    }
    this.checkWaveCleared();
  }

  private checkWaveCleared(): void {
    if (this.roomState !== 'combat') return;
    if (this.activeEnemies.size > 0) return;
    this.waveIndex++;
    if (this.waveIndex < this.wavesTotal) {
      this.time.delayedCall(600, () => { if (this.roomState === 'combat') this.spawnWave(); });
    } else {
      this.roomClear();
    }
  }

  private roomClear(): void {
    this.roomState = 'transition';
    this.player.onRoomClear();
    this.addRunCurrency(REWARDS.perRoom * getDifficulty(RunState.difficultyId).reward);
    this.hazards = [];
    this.hazardGfx.clear();
    this.projectiles.clear(true, true);
    this.juice.popText(this.player.x, this.player.y - 50, 'Salle nettoyée !', '#6ad46a', 18);
    this.time.delayedCall(500, () => this.openReward());
  }

  private openReward(): void {
    this.scene.pause();
    this.scene.launch('Reward', { gameScene: this });
  }

  /** appelé par RewardScene après le choix. */
  onPowerPicked(power: PowerDef | null): void {
    if (power) {
      power.apply(this.player);
      this.player.syncDashCharges();
      RunState.addPower(power);
      this.events.emit('powers', RunState.powers);
    }
    RunState.roomIndex++;
    this.scene.resume();
    this.roomState = 'transition';
    this.time.delayedCall(200, () => this.startRoom());
  }

  onBossKilled(b: Boss): void {
    this.boss = null;
    AudioManager.play('bossdie');
    // slow-mo + shake + particules
    this.time.timeScale = 0.35;
    this.physics.world.timeScale = 2.8;
    this.juice.shake(600, 0.02);
    for (let i = 0; i < 5; i++) {
      this.time.delayedCall(i * 120, () => this.juice.burst(b.x, b.y - 20, 0xffe0b0, 20, 260, 2));
    }
    this.events.emit('bossHp', 0, b.maxHp);
    this.addRunCurrency(REWARDS.perBoss * getDifficulty(RunState.difficultyId).reward);
    // animation de mort puis destruction du sprite
    (b.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.tweens.add({ targets: b, alpha: 0, scaleY: 0, angle: 40, duration: 1100, ease: 'Cubic.easeIn', onComplete: () => b.destroy() });
    this.time.delayedCall(1400, () => {
      this.time.timeScale = 1;
      this.physics.world.timeScale = 1;
      this.afterBoss();
    });
  }

  private afterBoss(): void {
    if (RunState.zoneIndex >= ZONES.length - 1) {
      RunState.victory = true;
      this.finishRun(true);
    } else {
      this.banner('Zone vaincue !', () => this.startZone(RunState.zoneIndex + 1));
    }
  }

  onPlayerDead(): void {
    this.roomState = 'over';
    this.time.delayedCall(1200, () => this.finishRun(false));
  }

  /** abandon depuis le menu pause. */
  abandon(): void {
    this.roomState = 'over';
    this.finishRun(false);
  }

  private finishRun(victory: boolean): void {
    SaveSystem.addCurrency(RunState.currencyEarned);
    if (victory) SaveSystem.recordClear();
    AudioManager.stopMusic();
    this.scene.stop('UI');
    this.scene.stop();
    this.scene.start(victory ? 'Victory' : 'GameOver');
  }

  // ---------------- helpers divers ----------------
  private addRunCurrency(n: number): void {
    RunState.currencyEarned += Math.round(n);
    this.events.emit('currency', RunState.currencyEarned);
  }

  sfx(name: string): void { AudioManager.play(name); }

  /** Bannière de transition (nom de zone, boss…) puis callback. */
  private banner(text: string, onDone: () => void): void {
    const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
      fontFamily: 'monospace', fontSize: '34px', color: '#f4e9c1', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(90).setAlpha(0).setScale(0.8);
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.time.delayedCall(1300, () => {
      this.tweens.add({ targets: t, alpha: 0, scale: 1.2, duration: 350, onComplete: () => t.destroy() });
      onDone();
    });
  }

  poisonPlayer(): void {
    const now = performance.now();
    this.poisonUntil = now + 2500;
    this.nextPoisonTick = Math.min(this.nextPoisonTick || now, now + 500);
  }

  thornsHit(x: number, y: number, amount: number): void {
    for (const e of this.getTargets()) {
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < 36) {
        e.takeDamage(Math.round(amount), this.player.x, this.player.y);
        break;
      }
    }
  }

  canRevive(): boolean { return this.reviveAvailable && !RunState.reviveUsed; }
  consumeRevive(): void { RunState.reviveUsed = true; this.reviveAvailable = false; }

  // ---------------- hazards ----------------
  private setupHazards(): void {
    this.hazards = [];
    if (this.zone.hazard === 'none') return;
    const n = Phaser.Math.Between(2, 4);
    for (let i = 0; i < n; i++) {
      const pos = this.randomSpawnPos();
      this.hazards.push({ x: pos.x, y: pos.y, r: Phaser.Math.Between(30, 50), type: this.zone.hazard, nextTick: 0 });
    }
  }

  private updateHazards(now: number): void {
    this.hazardGfx.clear();
    if (this.hazards.length === 0) return;
    const colorMap: Record<string, number> = { thorns: 0x6a2a3a, toxic: 0x4a7a2a, lava: 0xff5a1f, shadow: 0x2a1a4a };
    let inSlow = false;
    for (const h of this.hazards) {
      const col = colorMap[h.type] ?? 0x333333;
      this.hazardGfx.fillStyle(col, 0.35);
      this.hazardGfx.fillCircle(h.x, h.y, h.r);
      this.hazardGfx.lineStyle(2, col, 0.7);
      this.hazardGfx.strokeCircle(h.x, h.y, h.r);
      if (this.player && !this.player.dead && Phaser.Math.Distance.Between(this.player.x, this.player.y, h.x, h.y) < h.r) {
        if (h.type === 'toxic') { inSlow = true; if (now >= h.nextTick) { h.nextTick = now + 700; this.player.takeHazardDamage(3); } }
        else if (h.type === 'lava') { if (now >= h.nextTick) { h.nextTick = now + 600; this.player.takeHazardDamage(8); } }
        else if (h.type === 'thorns') { if (now >= h.nextTick) { h.nextTick = now + 700; this.player.takeHazardDamage(4); } }
      }
    }
    if (this.player) this.player.slowFactor = inSlow ? 0.55 : 1;
  }

  update(time: number, delta: number): void {
    const now = performance.now();
    this.controls.updatePad();
    if (this.controls.consumePause() && this.roomState !== 'over') {
      this.scene.pause();
      this.scene.launch('Pause', { gameScene: this });
      return;
    }
    if (this.player && !this.player.dead) this.player.update(time, delta);

    // poison joueur
    if (this.player && !this.player.dead && now < this.poisonUntil && now >= this.nextPoisonTick) {
      this.nextPoisonTick = now + 500;
      this.player.takeHazardDamage(2);
      this.juice.burst(this.player.x, this.player.y - 10, 0x8fd94a, 3, 60, 0.5);
    }

    this.updateHazards(now);

    // projectiles hors zone
    this.projectiles.getChildren().forEach((o) => {
      const p = o as Projectile;
      if (p.active && (p.x < ARENA.x - 20 || p.x > ARENA.x + ARENA.w + 20 || p.y < ARENA.y - 20 || p.y > ARENA.y + ARENA.h + 20)) p.destroy();
    });

    // HUD cooldowns
    if (this.player && !this.player.dead) {
      this.events.emit('cooldowns', this.player.dashCooldownFrac(), this.player.specialCooldownFrac(), this.player.dashCharges());
    }
  }
}
