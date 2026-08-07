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
import { Environment } from '../systems/Environment';
import { Door, ROOM_TYPE_INFO, type RoomType } from '../entities/Door';
import { Trap, type TrapType } from '../entities/Trap';
import { randomLayout, type Rect } from '../config/roomLayouts';
import { PROPS } from '../art/environment';
import type { IEnemyLike } from '../config/types';
import type { PowerDef } from '../config/powers';

const ARENA = { x: 28, y: 70, w: 904, h: 442 };
export const ARENA_RECT = ARENA;

function shade(c: number, amt: number): number {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) + amt));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (c & 255) + amt));
  return (r << 16) | (g << 8) | b;
}

const ZONE_PROPS: Record<string, string[]> = {
  foret: ['prop_bush', 'prop_glowshroom'],
  marais: ['prop_reed', 'prop_glowshroom'],
  forge: ['prop_ember', 'prop_skull'],
  citadelle: ['prop_candle', 'prop_skull'],
};

type HazardType = 'thorns' | 'toxic' | 'lava' | 'shadow' | 'web' | 'fire';

/** Projectile allié (onde tranchante, clone, Getsuga…). */
interface FriendlyShot {
  sprite: Phaser.GameObjects.Sprite;
  vx: number; vy: number;
  damage: number;
  dieAt: number;
  hit: Set<IEnemyLike>;
  pierce: boolean;
}
interface Hazard {
  x: number; y: number; r: number; type: HazardType;
  nextTick: number; activeAt: number; expireAt: number;
}

/** dégâts / effets par type de zone au sol. */
const HAZARD_FX: Record<HazardType, { dmg: number; tick: number; slow: number; poison: boolean; color: number }> = {
  thorns: { dmg: 4, tick: 700, slow: 1, poison: false, color: 0x6a2a3a },
  toxic: { dmg: 3, tick: 700, slow: 0.55, poison: true, color: 0x4a7a2a },
  lava: { dmg: 9, tick: 500, slow: 1, poison: false, color: 0xff5a1f },
  fire: { dmg: 10, tick: 400, slow: 1, poison: false, color: 0xff8a1f },
  web: { dmg: 0, tick: 999, slow: 0.4, poison: false, color: 0xcfc0ff },
  shadow: { dmg: 0, tick: 999, slow: 1, poison: false, color: 0x2a1a4a },
};

export class GameScene extends Phaser.Scene {
  player!: Player;
  juice!: JuiceManager;
  controls!: InputManager;

  enemies!: Phaser.Physics.Arcade.Group;
  projectiles!: Phaser.Physics.Arcade.Group;
  boss: Boss | null = null;

  private activeEnemies = new Set<Enemy>();
  private zone!: ZoneDef;
  private roomState: 'combat' | 'boss' | 'transition' | 'over' | 'idle' = 'transition';
  private waveIndex = 0;
  private wavesTotal = 1;
  private floor!: Phaser.GameObjects.TileSprite;

  // salles / portes / décor
  private env!: Environment;
  private walls!: Phaser.Physics.Arcade.StaticGroup;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private obstacles: Rect[] = [];
  private doors: Door[] = [];
  private doorsActive = false;
  private roomType: RoomType = 'combat';
  private combatDone = 0;
  private roomToken = 0;

  private hazards: Hazard[] = [];
  private bossHazards: Hazard[] = [];
  private traps: Trap[] = [];
  private hazardGfx!: Phaser.GameObjects.Graphics;
  private reviveAvailable = false;
  private poisonUntil = 0;
  private nextPoisonTick = 0;

  // combos / boons divins
  enemyTimeScale = 1;
  private enemyTimeScaleUntil = 0;
  private friendlyShots: FriendlyShot[] = [];

  constructor() { super('Game'); }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.bg);
    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

    this.juice = new JuiceManager(this);
    this.controls = new InputManager(this);
    this.env = new Environment(this, ARENA);

    this.floor = this.add.tileSprite(GAME_WIDTH / 2, ARENA.y + ARENA.h / 2, ARENA.w, ARENA.h, 'floor_foret');
    this.floor.setDepth(0);
    this.hazardGfx = this.add.graphics().setDepth(1);

    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.projectiles = this.physics.add.group({ runChildUpdate: true });
    this.walls = this.physics.add.staticGroup();

    const stats = SaveSystem.computeBaseStats();
    this.reviveAvailable = SaveSystem.hasFlag('revive');
    this.player = new Player(this, GAME_WIDTH / 2, ARENA.y + ARENA.h / 2, stats);

    // collisions murs
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.enemies, this.walls);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.projectiles, this.walls, (pr) => (pr as Projectile).destroy());

    // overlaps combat
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const en = e as unknown as Enemy;
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
      this.env?.destroy();
    });
  }

  // ---------------- construction de salle ----------------
  private clearRoom(): void {
    this.roomObjects.forEach((o) => o.destroy());
    this.roomObjects = [];
    this.walls.clear(true, true);
    this.clearDoors();
    this.clearTraps();
    this.hazards = [];
    this.bossHazards = [];
    this.hazardGfx.clear();
  }

  private buildRoom(layoutId?: string): void {
    this.clearRoom();
    this.floor.setTexture(`floor_${this.zone.id}`);
    this.drawBorder();
    const layout = randomLayout(Math.random);
    this.obstacles = (this.roomType === 'boss' ? [] : layout.obstacles(ARENA)).filter(Boolean);
    for (const o of this.obstacles) this.makeWall(o);
    this.scatterProps();
  }

  private drawBorder(): void {
    const key = `wall_${this.zone.id}`;
    const t = 18;
    const mk = (cx: number, cy: number, w: number, h: number) => {
      const s = this.add.tileSprite(cx, cy, w, h, key).setDepth(6);
      this.roomObjects.push(s);
    };
    mk(GAME_WIDTH / 2, ARENA.y - t / 2, ARENA.w + t * 2, t);
    mk(GAME_WIDTH / 2, ARENA.y + ARENA.h + t / 2, ARENA.w + t * 2, t);
    mk(ARENA.x - t / 2, ARENA.y + ARENA.h / 2, t, ARENA.h + t * 2);
    mk(ARENA.x + ARENA.w + t / 2, ARENA.y + ARENA.h / 2, t, ARENA.h + t * 2);
    // liseré accent intérieur
    const g = this.add.graphics().setDepth(7);
    g.lineStyle(2, this.zone.palette.accent, 0.4).strokeRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
    this.roomObjects.push(g);
  }

  private makeWall(o: Rect): void {
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const shadow = this.add.rectangle(cx, cy + 10, o.w + 10, o.h + 4, 0x000000, 0.35).setDepth(5);
    const ts = this.add.tileSprite(cx, cy, o.w, o.h, `wall_${this.zone.id}`).setDepth(6);
    const top = this.add.rectangle(cx, o.y + 3, o.w, 6, shade(this.zone.palette.wall, 55), 1).setDepth(7);
    const rect = this.add.rectangle(cx, cy, o.w, o.h, 0, 0);
    this.physics.add.existing(rect, true);
    this.walls.add(rect);
    this.roomObjects.push(shadow, ts, top, rect);
  }

  private scatterProps(): void {
    const pool = ZONE_PROPS[this.zone.id] ?? [];
    if (pool.length === 0) return;
    for (let i = 0; i < 5; i++) {
      const pos = this.arenaPoint(70);
      if (this.pointBlocked(pos.x, pos.y, 30)) continue;
      const key = Phaser.Utils.Array.GetRandom(pool);
      const s = this.add.image(pos.x, pos.y, key).setDepth(4).setAlpha(0.9);
      s.setScale(0.85 + Math.random() * 0.4);
      this.roomObjects.push(s);
    }
  }

  private pointBlocked(x: number, y: number, margin: number): boolean {
    for (const o of this.obstacles) {
      if (x > o.x - margin && x < o.x + o.w + margin && y > o.y - margin && y < o.y + o.h + margin) return true;
    }
    return false;
  }

  // ---------------- progression / salles ----------------
  private startZone(index: number): void {
    this.projectiles.clear(true, true);
    this.activeEnemies.forEach((e) => e.destroy());
    this.activeEnemies.clear();
    this.friendlyShots.forEach((s) => s.sprite.destroy());
    this.friendlyShots = [];
    this.enemyTimeScale = 1;
    this.combatDone = 0;
    this.zone = ZONES[index];
    RunState.zoneIndex = index;
    RunState.roomIndex = 0;
    SaveSystem.recordZone(index);
    this.env.setZone(this.zone);
    this.cameras.main.setBackgroundColor(this.zone.palette.fog);
    AudioManager.startMusic(this.zone.id);
    this.events.emit('zoneName', this.zone.name);
    this.banner(this.zone.name, () => this.enterRoom('combat'));
  }

  /** Entre dans une salle du type donné : construit le décor puis lance son contenu. */
  private enterRoom(type: RoomType): void {
    this.roomToken++;
    this.roomState = 'transition';
    this.clearDoors();
    this.projectiles.clear(true, true);
    this.activeEnemies.forEach((e) => e.destroy());
    this.activeEnemies.clear();
    this.roomType = type;
    this.buildRoom();
    // replace le joueur en bas de la salle
    this.player.setPosition(GAME_WIDTH / 2, ARENA.y + ARENA.h - 60);

    switch (type) {
      case 'combat': this.startCombat(); break;
      case 'boss': this.startBoss(); break;
      case 'fountain': this.startFountain(); break;
      case 'shop': this.startShop(); break;
      case 'treasure': this.startTreasure(); break;
    }
  }

  private startCombat(): void {
    this.roomState = 'combat';
    this.setupTraps();
    this.wavesTotal = Phaser.Math.Between(1, 3);
    this.waveIndex = 0;
    this.events.emit('progress', this.zone.name, this.combatDone + 1, this.zone.rooms, false, 'Combat');
    this.spawnWave();
  }

  private spawnWave(diff = getDifficulty(RunState.difficultyId)): void {
    const baseCount = 3 + Math.floor(this.combatDone * 0.6) + this.zone.index;
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
    for (let tries = 0; tries < 16; tries++) {
      x = Phaser.Math.Between(ARENA.x + 46, ARENA.x + ARENA.w - 46);
      y = Phaser.Math.Between(ARENA.y + 46, ARENA.y + ARENA.h - 46);
      const farFromPlayer = !this.player || Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 150;
      if (farFromPlayer && !this.pointBlocked(x, y, 24)) break;
    }
    return { x, y };
  }

  // ---------------- portes ----------------
  private clearDoors(): void {
    this.doors.forEach((d) => d.destroy());
    this.doors = [];
    this.doorsActive = false;
  }

  private openDoors(): void {
    this.clearDoors();
    this.roomState = 'idle';
    const choices = this.pickDoorChoices();
    const n = choices.length;
    const y = ARENA.y + 54;
    choices.forEach((type, i) => {
      const frac = n === 1 ? 0.5 : 0.22 + (0.56 * i) / (n - 1);
      const x = ARENA.x + ARENA.w * frac;
      this.doors.push(new Door(this, x, y, type));
    });
    this.doorsActive = true;
    this.juice.popText(this.player.x, this.player.y - 50, 'Choisis ta porte →', '#f4e9c1', 16);
  }

  private pickDoorChoices(): RoomType[] {
    if (this.combatDone >= this.zone.rooms) return ['boss'];
    // toujours au moins un combat pour progresser
    const bonus: RoomType[] = [];
    const roll = () => {
      const r = Math.random();
      if (r < 0.5) return 'combat';
      if (r < 0.68) return 'fountain';
      if (r < 0.85) return 'shop';
      return 'treasure';
    };
    const a = roll() as RoomType;
    let b = roll() as RoomType;
    if (a !== 'combat' && b !== 'combat') b = 'combat';
    bonus.push(a, b);
    return bonus;
  }

  private selectDoor(d: Door): void {
    if (d.used) return;
    d.used = true;
    this.doorsActive = false;
    AudioManager.play('door');
    this.juice.ring(d.x, d.y, 90, ROOM_TYPE_INFO[d.type].color, 400);
    this.player.setPosition(d.x, ARENA.y + 90);
    const type = d.type;
    this.clearDoors();
    this.time.delayedCall(150, () => this.enterRoom(type));
  }

  // ---------------- salles spéciales ----------------
  private startFountain(): void {
    this.roomState = 'idle';
    this.events.emit('progress', this.zone.name, this.combatDone, this.zone.rooms, false, 'Fontaine de vie');
    const fx = GAME_WIDTH / 2, fy = ARENA.y + ARENA.h / 2;
    const glow = this.add.image(fx, fy, 'light').setTint(0x6ad46a).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6).setDepth(9).setAlpha(0.6);
    const basin = this.add.graphics().setDepth(10);
    basin.fillStyle(0x2a3a4a, 1).fillRoundedRect(fx - 44, fy - 20, 88, 44, 10);
    basin.fillStyle(0x59c8ff, 0.6).fillEllipse(fx, fy, 70, 26);
    const heart = this.add.image(fx, fy - 34, 'glyph_heart').setTint(0x6ad46a).setScale(3).setDepth(11);
    this.tweens.add({ targets: heart, y: fy - 44, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: glow, alpha: 0.3, duration: 1000, yoyo: true, repeat: -1 });
    this.roomObjects.push(glow, basin, heart);
    let used = false;
    const check = this.time.addEvent({ delay: 100, loop: true, callback: () => {
      if (used || this.player.dead) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fx, fy) < 60) {
        used = true;
        const healed = Math.round(this.player.stats.maxHp * 0.6);
        this.player.heal(healed);
        this.player.stats.maxHp += 10;
        this.player.heal(10);
        this.juice.ring(fx, fy, 120, 0x6ad46a, 500);
        this.juice.popText(fx, fy - 60, `+${healed} PV`, '#6ad46a', 20);
        AudioManager.play('fountain');
      }
    }});
    this.roomObjects.push({ destroy: () => check.remove() } as unknown as Phaser.GameObjects.GameObject);
    const _tk = this.roomToken; this.time.delayedCall(700, () => { if (this.roomToken === _tk) this.openDoors(); });
  }

  private startTreasure(): void {
    this.roomState = 'idle';
    this.events.emit('progress', this.zone.name, this.combatDone, this.zone.rooms, false, 'Trésor');
    const fx = GAME_WIDTH / 2, fy = ARENA.y + ARENA.h / 2;
    const glow = this.add.image(fx, fy, 'light').setTint(0xf4c430).setBlendMode(Phaser.BlendModes.ADD).setScale(1.4).setDepth(9).setAlpha(0.55);
    const chest = this.add.graphics().setDepth(10);
    chest.fillStyle(0x7a4b26, 1).fillRoundedRect(fx - 30, fy - 20, 60, 40, 6);
    chest.fillStyle(0xf4c430, 1).fillRect(fx - 30, fy - 4, 60, 8);
    chest.fillStyle(0x24467e, 0);
    this.roomObjects.push(glow, chest);
    this.tweens.add({ targets: glow, alpha: 0.28, scale: 1.6, duration: 900, yoyo: true, repeat: -1 });
    let used = false;
    const check = this.time.addEvent({ delay: 100, loop: true, callback: () => {
      if (used || this.player.dead) return;
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, fx, fy) < 56) {
        used = true;
        const gold = 30 + this.zone.index * 15;
        this.addRunCurrency(gold);
        this.juice.burst(fx, fy, 0xf4c430, 24, 240, 1.6);
        this.juice.popText(fx, fy - 50, `+${gold} 🥇 + Boon !`, '#f4c430', 18);
        AudioManager.play('coin');
        chest.clear();
        // trésor = boon offert
        this.scene.pause();
        this.scene.launch('Reward', { gameScene: this });
      }
    }});
    this.roomObjects.push({ destroy: () => check.remove() } as unknown as Phaser.GameObjects.GameObject);
    const _tk = this.roomToken; this.time.delayedCall(700, () => { if (this.roomToken === _tk) this.openDoors(); });
  }

  private startShop(): void {
    this.roomState = 'idle';
    this.events.emit('progress', this.zone.name, this.combatDone, this.zone.rooms, false, 'Marchand');
    const y = ARENA.y + ARENA.h / 2;
    const items: { label: string; cost: number; buy: () => void }[] = [
      { label: 'Soin +50', cost: 20, buy: () => this.player.heal(50) },
      { label: '+25 PV max', cost: 35, buy: () => { this.player.stats.maxHp += 25; this.player.heal(25); } },
      { label: 'Boon', cost: 50, buy: () => { this.scene.pause(); this.scene.launch('Reward', { gameScene: this }); } },
    ];
    // marchand (chaton PNJ)
    const npc = this.add.sprite(GAME_WIDTH / 2, ARENA.y + 70, 'cat').setScale(2.2).setTint(0xffe0b0).setDepth(11);
    this.tweens.add({ targets: npc, y: ARENA.y + 62, duration: 900, yoyo: true, repeat: -1 });
    this.roomObjects.push(npc);
    items.forEach((it, i) => {
      const px = GAME_WIDTH / 2 + (i - 1) * 200;
      const glow = this.add.image(px, y, 'light').setTint(0xf4c430).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setDepth(9).setAlpha(0.4);
      const ped = this.add.graphics().setDepth(10);
      ped.fillStyle(0x2a2436, 1).fillRoundedRect(px - 30, y - 6, 60, 26, 6);
      const txt = this.add.text(px, y - 30, `${it.label}\n${it.cost} 🥇`, { fontFamily: 'monospace', fontSize: '13px', color: '#f4e9c1', align: 'center', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5).setDepth(11);
      this.roomObjects.push(glow, ped, txt);
      let bought = false;
      const check = this.time.addEvent({ delay: 120, loop: true, callback: () => {
        if (bought || this.player.dead) return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, px, y) < 44) {
          if (RunState.currencyEarned >= it.cost) {
            bought = true;
            RunState.currencyEarned -= it.cost;
            this.events.emit('currency', RunState.currencyEarned);
            it.buy();
            this.juice.burst(px, y, 0xf4c430, 14, 180, 1.2);
            AudioManager.play('coin');
            txt.setText('Acheté !');
          } else {
            this.juice.popText(px, y - 44, 'Trop cher', '#ff9db0', 12);
          }
        }
      }});
      this.roomObjects.push({ destroy: () => check.remove() } as unknown as Phaser.GameObjects.GameObject);
    });
    const _tk = this.roomToken; this.time.delayedCall(600, () => { if (this.roomToken === _tk) this.openDoors(); });
  }

  spawnEnemy(id: string, x: number, y: number, diff = getDifficulty(RunState.difficultyId)): Enemy {
    const def = ENEMIES[id];
    // montée en puissance par zone : force le joueur à construire des synergies
    const zoneHp = 1 + this.zone.index * 0.35;
    const zoneDmg = 1 + this.zone.index * 0.2;
    const e = new Enemy(this, x, y, def, diff.enemyHp * zoneHp, diff.enemyDamage * zoneDmg);
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

  spawnEnemyProjectile(x: number, y: number, dx: number, dy: number, speed: number, damage: number, status?: 'poison' | 'freeze', tint?: number): void {
    const diff = getDifficulty(RunState.difficultyId);
    const p = new Projectile(this, x, y, dx * speed, dy * speed, damage * diff.enemyDamage, status, tint);
    this.projectiles.add(p);
  }

  /** Point aléatoire dans l'arène (pour geysers, etc.). */
  arenaPoint(margin = 70): { x: number; y: number } {
    return {
      x: Phaser.Math.Between(ARENA.x + margin, ARENA.x + ARENA.w - margin),
      y: Phaser.Math.Between(ARENA.y + margin, ARENA.y + ARENA.h - margin),
    };
  }

  private startBoss(): void {
    this.roomState = 'boss';
    this.hazards = [];
    this.bossHazards = [];
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

  private rewardFromCombat = false;

  private roomClear(): void {
    this.roomState = 'transition';
    this.player.onRoomClear();
    this.addRunCurrency(REWARDS.perRoom * getDifficulty(RunState.difficultyId).reward);
    this.hazards = [];
    this.hazardGfx.clear();
    this.projectiles.clear(true, true);
    this.combatDone++;
    this.juice.popText(this.player.x, this.player.y - 50, 'Salle nettoyée !', '#6ad46a', 18);
    this.rewardFromCombat = true;
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
    this.scene.resume();
    if (this.rewardFromCombat) {
      this.rewardFromCombat = false;
      const _tk = this.roomToken; this.time.delayedCall(200, () => { if (this.roomToken === _tk) this.openDoors(); });
    }
  }

  onBossKilled(b: Boss): void {
    this.boss = null;
    this.bossHazards = [];
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

  // ---------------- pièges d'environnement ----------------
  private clearTraps(): void {
    this.traps.forEach((t) => t.destroy());
    this.traps = [];
  }

  private setupTraps(): void {
    this.clearTraps();
    // types de pièges par zone
    const byZone: Record<string, TrapType[]> = {
      thorns: ['spike'],
      toxic: ['toxic', 'spike'],
      lava: ['lava', 'spike'],
      shadow: ['spike'],
      none: [],
    };
    const pool = byZone[this.zone.hazard] ?? ['spike'];
    if (pool.length === 0) return;
    const n = Phaser.Math.Between(2, 4);
    for (let i = 0; i < n; i++) {
      let pos = this.arenaPoint(70);
      for (let tries = 0; tries < 8 && (this.pointBlocked(pos.x, pos.y, 36) || Phaser.Math.Distance.Between(pos.x, pos.y, this.player.x, this.player.y) < 90); tries++) {
        pos = this.arenaPoint(70);
      }
      const type = Phaser.Utils.Array.GetRandom(pool);
      this.traps.push(new Trap(this, pos.x, pos.y, type));
    }
  }

  /** dégâts d'environnement/piège (ignore les i-frames). */
  hurtPlayer(amount: number): void {
    if (this.player && !this.player.dead) this.player.takeHazardDamage(amount);
  }

  private updateTraps(now: number): void {
    let slow = 1;
    const px = this.player?.x ?? -999, py = this.player?.y ?? -999;
    const alive = !!this.player && !this.player.dead;
    for (const t of this.traps) {
      const r = t.update(now, px, py, alive);
      if (r.slow < slow) slow = r.slow;
    }
    if (this.player && slow < 1) this.player.slowFactor = Math.min(this.player.slowFactor, slow);
  }

  /** Zone au sol dynamique (attaque de boss) : télégraphe puis active pendant `duration`. */
  spawnHazardZone(x: number, y: number, r: number, type: HazardType, telegraphMs: number, duration: number): void {
    const now = performance.now();
    x = Phaser.Math.Clamp(x, ARENA.x + 10, ARENA.x + ARENA.w - 10);
    y = Phaser.Math.Clamp(y, ARENA.y + 10, ARENA.y + ARENA.h - 10);
    this.bossHazards.push({ x, y, r, type, nextTick: now + telegraphMs, activeAt: now + telegraphMs, expireAt: now + telegraphMs + duration });
  }

  private updateHazards(now: number): void {
    this.hazardGfx.clear();
    this.bossHazards = this.bossHazards.filter((h) => now < h.expireAt);
    let slowMul = 1;
    const px = this.player?.x ?? -999, py = this.player?.y ?? -999;
    const playerAlive = this.player && !this.player.dead;

    for (const h of [...this.hazards, ...this.bossHazards]) {
      const fx = HAZARD_FX[h.type];
      const telegraphing = now < h.activeAt;
      if (telegraphing) {
        // télégraphe pulsant (contour d'avertissement)
        const pulse = 0.35 + 0.35 * Math.abs(Math.sin(now * 0.012));
        this.hazardGfx.lineStyle(3, 0xff3a3a, pulse);
        this.hazardGfx.strokeCircle(h.x, h.y, h.r);
        this.hazardGfx.fillStyle(fx.color, 0.12);
        this.hazardGfx.fillCircle(h.x, h.y, h.r * 0.9);
      } else {
        this.hazardGfx.fillStyle(fx.color, 0.32);
        this.hazardGfx.fillCircle(h.x, h.y, h.r);
        this.hazardGfx.lineStyle(2, fx.color, 0.7);
        this.hazardGfx.strokeCircle(h.x, h.y, h.r);
        if (playerAlive && Phaser.Math.Distance.Between(px, py, h.x, h.y) < h.r) {
          if (fx.slow < 1) slowMul = Math.min(slowMul, fx.slow);
          if (fx.dmg > 0 && now >= h.nextTick) {
            h.nextTick = now + fx.tick;
            this.player.takeHazardDamage(fx.dmg);
            if (fx.poison) this.poisonPlayer();
          }
        }
      }
    }
    if (this.player) this.player.slowFactor = slowMul;
  }

  // ---------------- VFX & télégraphes d'attaques (pixel art) ----------------
  /** Cercle d'avertissement qui se remplit, puis éruption (cb) — geysers, plongeons. */
  telegraphCircle(x: number, y: number, r: number, color: number, ms: number, cb: () => void): void {
    const g = this.add.graphics().setDepth(4);
    this.tweens.addCounter({
      from: 0, to: 1, duration: ms,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        g.clear();
        g.lineStyle(3, 0xff3a3a, 0.5 + 0.4 * Math.abs(Math.sin(v * 22)));
        g.strokeCircle(x, y, r);
        g.fillStyle(color, 0.22);
        g.fillCircle(x, y, r * v);
      },
      onComplete: () => { g.destroy(); if (this.roomState !== 'over') cb(); },
    });
  }

  /** Éruption/impact : anneau + gerbe de pixels + dégâts dans le rayon. */
  eruptAt(x: number, y: number, r: number, color: number, damage: number, hazard?: HazardType, hazardDur = 1200): void {
    this.juice.ring(x, y, r, color, 280);
    this.juice.burst(x, y, color, 16, 220, 1.4);
    this.juice.shake(160, 0.006);
    // colonne de pixels vers le haut
    const col = this.add.particles(x, y, 'px', {
      speedY: { min: -260, max: -120 }, speedX: { min: -40, max: 40 },
      scale: { start: 1.6, end: 0 }, lifespan: 420, quantity: 14, tint: color, blendMode: 'ADD', emitting: false,
    }).setDepth(30);
    col.explode(14);
    this.time.delayedCall(500, () => col.destroy());
    if (this.player && !this.player.dead && Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= r) {
      this.player.takeDamage(damage, x, y); // esquivable au dash (i-frames)
    }
    if (hazard) this.spawnHazardZone(x, y, r * 0.85, hazard, 0, hazardDur);
  }

  /**
   * Attaque en ligne télégraphiée (langue, faisceau). Depuis (x,y), angle, longueur/largeur.
   * Dessine un rail d'avertissement, puis frappe la bande.
   */
  telegraphLine(x: number, y: number, angle: number, length: number, width: number, color: number, ms: number, damage: number, hazard?: HazardType, hazardDur = 2000): void {
    const rect = this.add.rectangle(x, y, length, width, color, 0.18).setOrigin(0, 0.5).setRotation(angle).setDepth(4);
    rect.setStrokeStyle(2, 0xff3a3a, 0.8);
    this.tweens.add({ targets: rect, alpha: 0.38, duration: ms, ease: 'Sine.easeIn' });
    this.time.delayedCall(ms, () => {
      if (this.roomState === 'over') { rect.destroy(); return; }
      // flash actif
      rect.setFillStyle(color, 0.7);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      // dégâts si le joueur est dans la bande
      const p = this.player;
      if (p && !p.dead) {
        const dx = p.x - x, dy = p.y - y;
        const along = dx * cos + dy * sin;
        const perp = -dx * sin + dy * cos;
        if (along >= -10 && along <= length && Math.abs(perp) <= width / 2 + 6) p.takeDamage(damage, x, y);
      }
      // gerbe de pixels le long de la ligne
      for (let d = 0; d < length; d += 40) {
        this.juice.burst(x + cos * d, y + sin * d, color, 4, 100, 0.8);
      }
      // flaque persistante optionnelle (crossBeams lave)
      if (hazard) {
        for (let d = 40; d < length; d += 70) {
          this.spawnHazardZone(x + cos * d, y + sin * d, width * 0.7, hazard, 0, hazardDur);
        }
      }
      this.tweens.add({ targets: rect, alpha: 0, duration: 160, onComplete: () => rect.destroy() });
    });
  }

  // ============ ICombatScene (boons divins) ============
  playerX(): number { return this.player?.x ?? 0; }
  playerY(): number { return this.player?.y ?? 0; }

  enemiesNear(x: number, y: number, r: number): IEnemyLike[] {
    return this.getTargets().filter((e) => Phaser.Math.Distance.Between(x, y, e.x, e.y) <= r);
  }

  /** Éclair qui frappe une cible puis chaîne vers les ennemis proches. */
  lightningChain(x: number, y: number, damage: number, jumps: number): void {
    this.sfx('zap');
    const struck = new Set<IEnemyLike>();
    let cx = x, cy = y;
    const g = this.add.graphics().setDepth(45);
    for (let j = 0; j <= jumps; j++) {
      // dessine un éclair pixelisé depuis le haut jusqu'à la cible
      this.drawBolt(g, cx, cy - 200, cx, cy);
      // trouve la cible la plus proche non encore touchée
      let target: IEnemyLike | null = null;
      let best = j === 0 ? 40 : 200;
      for (const e of this.getTargets()) {
        if (struck.has(e)) continue;
        const d = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
        if (d < best) { best = d; target = e; }
      }
      if (!target && j === 0) {
        // frappe le point initial même sans cible exacte
        this.juice.burst(cx, cy, 0x9fe6ff, 8, 160, 1);
      }
      if (!target) break;
      struck.add(target);
      target.applyStatus('shock', 2200);
      target.takeDamage(Math.round(damage * (j === 0 ? 1 : 0.7)), cx, cy);
      this.juice.burst(target.x, target.y, 0x9fe6ff, 8, 160, 1);
      cx = target.x; cy = target.y;
    }
    this.juice.shake(90, 0.004);
    this.time.delayedCall(120, () => g.destroy());
  }

  private drawBolt(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number): void {
    g.lineStyle(3, 0xffffff, 0.95);
    g.beginPath();
    g.moveTo(x1, y1);
    const seg = 6;
    for (let i = 1; i <= seg; i++) {
      const t = i / seg;
      const nx = Phaser.Math.Linear(x1, x2, t) + (i < seg ? Phaser.Math.Between(-10, 10) : 0);
      const ny = Phaser.Math.Linear(y1, y2, t);
      g.lineTo(nx, ny);
    }
    g.strokePath();
  }

  /** Onde tranchante (Getsuga / clone) : projectile allié qui transperce. */
  slashWave(x: number, y: number, dx: number, dy: number, damage: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    const s = this.add.sprite(x, y, 'orb_big').setDepth(18).setTint(0x9fe6ff);
    s.setScale(2.4, 0.9).setRotation(Math.atan2(ny, nx));
    this.friendlyShots.push({ sprite: s, vx: nx * 520, vy: ny * 520, damage, dieAt: performance.now() + 700, hit: new Set(), pierce: true });
    this.sfx('sword');
  }

  /** Grande explosion (Megumin / Rasengan). */
  explosionAt(x: number, y: number, radius: number, damage: number): void {
    this.juice.ring(x, y, radius, 0xffa53a, 360);
    this.juice.burst(x, y, 0xffd24a, 22, 260, 1.8);
    this.juice.shake(240, 0.012);
    this.sfx('special');
    for (const e of this.getTargets()) {
      if (e.isAlive() && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) e.takeDamage(Math.round(damage), x, y);
    }
  }

  /** Pulse de domaine autour du joueur (Sukuna). */
  domainPulse(damage: number, radius: number): void {
    if (!this.player || this.player.dead) return;
    const x = this.player.x, y = this.player.y;
    this.juice.ring(x, y, radius, 0xb26bff, 360);
    this.juice.burst(x, y, 0xb26bff, 14, 200, 1.2);
    for (const e of this.getTargets()) {
      if (e.isAlive() && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) e.takeDamage(Math.round(damage), x, y);
    }
  }

  /** THE WORLD — arrêt du temps : animation complète (désaturation, horloge, ondes). */
  timeSlow(ms: number, factor: number): void {
    this.enemyTimeScale = factor;
    this.enemyTimeScaleUntil = performance.now() + ms;
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    AudioManager.play('timestop');
    this.juice.shake(220, 0.01);

    // voile indigo qui fige le monde (sauf le joueur, rendu au-dessus)
    const veil = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x1a1030, 0).setDepth(40);
    this.tweens.add({ targets: veil, alpha: 0.5, duration: 120, yoyo: false });
    // le joueur passe au premier plan et brille
    const prevDepth = this.player.depth;
    this.player.setDepth(45);
    const pglow = this.add.image(this.player.x, this.player.y, 'light').setTint(0xd8c8ff).setBlendMode(Phaser.BlendModes.ADD).setDepth(44).setScale(1.6).setAlpha(0.7);

    // ondes de choc « ZA WARUDO »
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 90, () => this.juice.ring(cx, cy, 320, 0xb26bff, 420));
    }
    // lignes radiales
    const rays = this.add.graphics().setDepth(41);
    rays.lineStyle(3, 0xd8c8ff, 0.5);
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      rays.lineBetween(cx + Math.cos(ang) * 120, cy + Math.sin(ang) * 120, cx + Math.cos(ang) * 520, cy + Math.sin(ang) * 520);
    }
    this.tweens.add({ targets: rays, alpha: 0, duration: 500, onComplete: () => rays.destroy() });

    // horloge qui s'arrête
    const clock = this.add.graphics().setDepth(43);
    const drawClock = (hand: number) => {
      clock.clear();
      clock.lineStyle(5, 0xf4e9c1, 0.9); clock.strokeCircle(cx, cy, 60);
      clock.fillStyle(0x1a1030, 0.6); clock.fillCircle(cx, cy, 58);
      clock.lineStyle(4, 0xf4e9c1, 1);
      for (let t = 0; t < 12; t++) { const a = (t / 12) * Math.PI * 2; clock.lineBetween(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50, cx + Math.cos(a) * 58, cy + Math.sin(a) * 58); }
      clock.lineStyle(5, 0xff5a8a, 1); clock.lineBetween(cx, cy, cx + Math.cos(hand) * 42, cy + Math.sin(hand) * 42);
      clock.lineStyle(4, 0xf4c430, 1); clock.lineBetween(cx, cy, cx + Math.cos(hand * 1.6) * 30, cy + Math.sin(hand * 1.6) * 30);
    };
    this.tweens.addCounter({ from: -Math.PI / 2, to: Math.PI * 2, duration: 350, ease: 'Cubic.easeOut', onUpdate: (tw) => drawClock(tw.getValue() ?? 0) });

    // tinte les ennemis figés
    const frozen = this.getTargets();
    frozen.forEach((e) => (e as unknown as Phaser.GameObjects.Sprite).setTint?.(0x8a7fb0));

    this.time.delayedCall(ms, () => {
      this.tweens.add({ targets: [veil], alpha: 0, duration: 200, onComplete: () => veil.destroy() });
      this.tweens.add({ targets: clock, alpha: 0, duration: 200, onComplete: () => clock.destroy() });
      pglow.destroy();
      this.player.setDepth(prevDepth);
      frozen.forEach((e) => { const s = e as unknown as Phaser.GameObjects.Sprite; if (s.active) s.clearTint?.(); });
    });
  }

  /** Clone cosmétique qui frappe (utilisé si besoin). */
  spawnClone(ms: number): void {
    if (!this.player) return;
    const ghost = this.add.sprite(this.player.x - 30, this.player.y, 'cat').setAlpha(0.5).setTint(0x9fe6ff).setDepth(19).setScale(0.9);
    const ev = this.time.addEvent({
      delay: 600, loop: true, callback: () => {
        if (!this.player) return;
        ghost.setPosition(this.player.x - 34, this.player.y - 6);
        const near = this.enemiesNear(ghost.x, ghost.y, 150);
        if (near.length) this.slashWave(ghost.x, ghost.y, near[0].x - ghost.x, near[0].y - ghost.y, 12);
      },
    });
    this.time.delayedCall(ms, () => { ev.remove(); ghost.destroy(); });
  }

  /** VFX + texte d'une réaction élémentaire. */
  reactionVfx(x: number, y: number, name: string, color: number): void {
    this.juice.ring(x, y, 70, color, 300);
    this.juice.burst(x, y, color, 16, 220, 1.5);
    this.juice.popText(x, y - 34, name, '#ffffff', 15);
    this.juice.shake(110, 0.005);
    this.sfx('reaction');
  }

  private updateFriendlyShots(now: number, dt: number): void {
    this.friendlyShots = this.friendlyShots.filter((sh) => {
      if (now > sh.dieAt || !sh.sprite.active) { sh.sprite.destroy(); return false; }
      sh.sprite.x += sh.vx * dt / 1000;
      sh.sprite.y += sh.vy * dt / 1000;
      if (sh.sprite.x < ARENA.x - 30 || sh.sprite.x > ARENA.x + ARENA.w + 30 || sh.sprite.y < ARENA.y - 30 || sh.sprite.y > ARENA.y + ARENA.h + 30) {
        sh.sprite.destroy(); return false;
      }
      for (const e of this.getTargets()) {
        if (sh.hit.has(e) || !e.isAlive()) continue;
        if (Phaser.Math.Distance.Between(sh.sprite.x, sh.sprite.y, e.x, e.y) < 30) {
          sh.hit.add(e);
          e.takeDamage(Math.round(sh.damage), sh.sprite.x, sh.sprite.y);
          this.juice.burst(sh.sprite.x, sh.sprite.y, 0x9fe6ff, 5, 120, 0.8);
          if (!sh.pierce) { sh.sprite.destroy(); return false; }
        }
      }
      return true;
    });
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

    // ambiance : lumière + ombres portées
    if (this.player) {
      const ents: { x: number; y: number; displayHeight: number; scaleX: number }[] = [];
      for (const e of this.activeEnemies) if (e.isAlive()) ents.push(e);
      if (this.boss?.isAlive()) ents.push(this.boss);
      this.env.update(this.player.x, this.player.y, ents);
    }

    // choix de porte par proximité
    if (this.doorsActive && this.player && !this.player.dead) {
      for (const d of this.doors) {
        if (!d.used && Phaser.Math.Distance.Between(this.player.x, this.player.y, d.x, d.y) < 44) {
          this.selectDoor(d);
          break;
        }
      }
    }

    // poison joueur
    if (this.player && !this.player.dead && now < this.poisonUntil && now >= this.nextPoisonTick) {
      this.nextPoisonTick = now + 500;
      this.player.takeHazardDamage(2);
      this.juice.burst(this.player.x, this.player.y - 10, 0x8fd94a, 3, 60, 0.5);
    }

    this.updateHazards(now);
    this.updateTraps(now);

    // fin du ralentissement temporel (The World)
    if (this.enemyTimeScale !== 1 && now >= this.enemyTimeScaleUntil) this.enemyTimeScale = 1;

    // projectiles alliés (ondes tranchantes, clones)
    this.updateFriendlyShots(now, delta);

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
