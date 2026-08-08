import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, WORLD_WIDTH, WORLD_HEIGHT, WORLD_ZOOM, COLORS, REWARDS } from '../config/game';
import { ZONES, type ZoneDef } from '../config/worlds';
import { ENEMIES } from '../config/enemies';
import { BOSSES } from '../config/bosses';
import { BOSS_TAUNTS } from '../config/bossTaunts';
import { materialByBoss, materialById } from '../config/materials';
import { consumableById } from '../config/consumables';
import { getDifficulty } from '../config/difficulty';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { Pylon } from '../entities/Pylon';
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

// Arène en coordonnées MONDE (1200×675). Centrée horizontalement (centre x=600),
// avec une marge en haut pour l'ATH. Plus grande qu'avant -> plus d'espace.
const ARENA = { x: 60, y: 96, w: 1080, h: 496 };
export const ARENA_RECT = ARENA;

// Arène du BOSS FINAL : circulaire et ~2× plus grande qu'une arène classique.
const FINAL_CX = 900, FINAL_CY = 720, FINAL_R = 560;
const FINAL_WORLD_W = 1800, FINAL_WORLD_H = 1440;

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
  givre: ['prop_glowshroom', 'prop_candle'],
  celeste: ['prop_candle', 'prop_skull'],
  neant: ['prop_skull', 'prop_candle'],
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
  immobilizeMs?: number;
  knockback?: number;
  color?: number;
}
interface Hazard {
  x: number; y: number; r: number; type: HazardType;
  nextTick: number; activeAt: number; expireAt: number;
}

/** Âme d'un monstre tué : à ramasser en 5 s, sinon le monstre réapparaît. */
interface Soul {
  orb: Phaser.GameObjects.Sprite;
  ring: Phaser.GameObjects.Graphics;
  id: string;
  x: number; y: number;
  expireAt: number;
  homing?: boolean;
}
const SOUL_TTL = 5000;
// Rayon d'aspiration de base : dès que le joueur passe à cette distance, l'âme
// glisse vers lui automatiquement (env. la taille du personnage).
const SOUL_MAGNET = 110;

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
  private bossOverlap?: Phaser.Physics.Arcade.Collider;
  private bossPylons: Pylon[] = []; // pilônes d'invincibilité de Glacior
  // Round final : le boss réapparaît ENRAGÉ en 3 exemplaires simultanés.
  private rageBosses: Boss[] = [];
  private rageActive = false;
  private rageMaxTotal = 1;
  private rageOverlaps: Phaser.Physics.Arcade.Collider[] = [];

  private activeBanner?: Phaser.GameObjects.Text;
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
  private hazardMarkers: Phaser.GameObjects.Image[] = []; // mines de signalisation (pool)
  private reviveCharges = 0;
  // --- Boss final ---
  private finalActive = false; // arène circulaire du boss final en cours
  private finalGfx?: Phaser.GameObjects.Graphics; // sol circulaire
  private bossMines: { sprite: Phaser.GameObjects.Sprite; x: number; y: number; armAt: number; damage: number; r: number }[] = [];
  private poisonUntil = 0;
  private nextPoisonTick = 0;

  // combos / boons divins
  enemyTimeScale = 1;
  private enemyTimeScaleUntil = 0;
  private friendlyShots: FriendlyShot[] = [];
  private souls: Soul[] = [];
  private materialPickups: { sprite: Phaser.GameObjects.Sprite; matId: string }[] = [];

  constructor() { super('Game'); }

  create(): void {
    // GameScene est un singleton RÉUTILISÉ (scene.start relance la même instance) :
    // les champs de classe ne sont initialisés qu'à la construction. On remet donc
    // à zéro tout l'état transitoire ici, sinon des références d'objets détruits au
    // run précédent traînent (ex. hazardMarkers → crash au 2e run) ou un boon en
    // file est offert gratuitement au run suivant.
    this.hazardMarkers = [];
    this.hazards = []; this.bossHazards = []; this.traps = [];
    this.friendlyShots = [];
    this.souls = [];
    this.activeEnemies.clear();
    this.bossPylons = [];
    this.rageBosses = []; this.rageActive = false; this.rageOverlaps = [];
    this.pendingBoons = 0; this.rewardActive = false;
    this.finalActive = false; this.finalGfx?.destroy(); this.finalGfx = undefined;
    this.bossMines.forEach((m) => m.sprite.destroy()); this.bossMines = [];
    this.materialPickups.forEach((m) => m.sprite.destroy()); this.materialPickups = [];
    this.bossOverlap = undefined;
    this.boss = null;
    this.enemyTimeScale = 1;
    this.roomState = 'transition';
    this.roomToken = 0;
    this.poisonUntil = 0;
    this.combatDone = 0;

    // Restaure l'arène classique (l'arène du boss final mute ARENA + la caméra).
    ARENA.x = 60; ARENA.y = 96; ARENA.w = 1080; ARENA.h = 496;
    this.cameras.main.stopFollow();
    this.cameras.main.setBackgroundColor(COLORS.bg);
    // dézoom : affiche le monde 1200×675 dans le canvas 960×540 (personnage
    // plus petit, plus d'espace). L'ATH (UIScene) reste en 960×540.
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.cameras.main.setScroll((WORLD_WIDTH - GAME_WIDTH) / 2, (WORLD_HEIGHT - GAME_HEIGHT) / 2);
    this.physics.world.setBounds(ARENA.x, ARENA.y, ARENA.w, ARENA.h);

    this.juice = new JuiceManager(this);
    this.controls = new InputManager(this);
    this.env = new Environment(this, ARENA);

    this.floor = this.add.tileSprite(WORLD_WIDTH / 2, ARENA.y + ARENA.h / 2, ARENA.w, ARENA.h, 'floor_foret');
    this.floor.setDepth(0);
    this.hazardGfx = this.add.graphics().setDepth(1);

    this.enemies = this.physics.add.group({ runChildUpdate: true });
    this.projectiles = this.physics.add.group({ runChildUpdate: true });
    this.walls = this.physics.add.staticGroup();

    const stats = SaveSystem.computeBaseStats();
    this.reviveCharges = SaveSystem.reviveCharges();
    this.player = new Player(this, WORLD_WIDTH / 2, ARENA.y + ARENA.h / 2, stats);

    // collisions murs. Le joueur traverse les OBSTACLES pendant un dash
    // (les bords d'arène restent infranchissables via les world bounds).
    this.physics.add.collider(this.player, this.walls, undefined, () => !this.player.isDashing());
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
    this.events.emit('boons', this.pendingBoons); // compteur de compétences (0 au départ)
    this.events.emit('revives', this.reviveLeft()); // compteur de Retombées Félines
    this.emitConsumables(); // slots de consommables portés

    this.startZone(RunState.zoneIndex);

    // chronomètre : en pause quand le jeu est en pause (choix de boon, menu pause).
    // Handlers nommés retirés au SHUTDOWN (émetteur de scène réutilisé entre runs).
    this.events.on(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
    this.events.on(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PAUSE, this.onScenePause, this);
      this.events.off(Phaser.Scenes.Events.RESUME, this.onSceneResume, this);
      this.activeEnemies.clear();
      this.boss = null;
      this.clearSouls();
      this.clearPylons();
      this.clearRageBosses();
      this.env?.destroy();
    });
  }

  // ---------------- construction de salle ----------------
  private clearRoom(): void {
    this.roomObjects.forEach((o) => o.destroy());
    this.roomObjects = [];
    this.materialPickups.forEach((m) => m.sprite.destroy());
    this.materialPickups = [];
    this.walls.clear(true, true);
    this.clearDoors();
    this.clearTraps();
    this.clearSouls();
    this.hazards = [];
    this.bossHazards = [];
    this.hazardGfx.clear();
  }

  private buildRoom(layoutId?: string): void {
    this.clearRoom();
    this.floor.setTexture(`floor_${this.zone.id}`);
    this.drawBorder();
    // Seules les salles de combat ont des obstacles : les salles spéciales
    // (fontaine, marchand, trésor) et de boss restent dégagées — évite les
    // « murs invisibles » qui bloquaient l'accès à la fontaine.
    const layout = randomLayout(Math.random);
    this.obstacles = (this.roomType === 'combat' ? layout.obstacles(ARENA) : []).filter(Boolean);
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
    mk(WORLD_WIDTH / 2, ARENA.y - t / 2, ARENA.w + t * 2, t);
    mk(WORLD_WIDTH / 2, ARENA.y + ARENA.h + t / 2, ARENA.w + t * 2, t);
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
    this.bossOverlap?.destroy(); this.bossOverlap = undefined;
    if (this.boss) { this.boss.destroy(); this.boss = null; }
    this.activeEnemies.forEach((e) => e.destroy());
    this.activeEnemies.clear();
    this.clearPylons();
    this.clearRageBosses();
    this.friendlyShots.forEach((s) => s.sprite.destroy());
    this.friendlyShots = [];
    this.enemyTimeScale = 1;
    this.combatDone = 0;
    this.clearRoom();
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
    if (this.boss) { this.boss.destroy(); this.boss = null; }
    this.activeEnemies.forEach((e) => e.destroy());
    this.activeEnemies.clear();
    this.clearPylons();
    this.clearRageBosses();
    this.roomType = type;
    this.buildRoom();
    // replace le joueur en bas de la salle
    this.player.setPosition(WORLD_WIDTH / 2, ARENA.y + ARENA.h - 60);
    // Ronronthérapie (méta) : soin à chaque entrée de salle.
    if (this.player.stats.roomHeal > 0 && !this.player.dead) {
      this.player.heal(this.player.stats.roomHeal);
      this.juice.popText(this.player.x, this.player.y - 40, `+${this.player.stats.roomHeal}`, '#6ad46a', 16);
    }

    switch (type) {
      case 'combat': this.startCombat(); break;
      case 'boss': this.startBoss(); break;
      case 'fountain': this.startFountain(); break;
      case 'shop': this.startShop(); break;
      case 'treasure': this.startTreasure(); break;
    }
  }

  /** Débogage/QA : saute directement au boss d'une zone donnée. */
  debugBossZone(index: number): void {
    this.combatDone = this.zone.rooms;
    RunState.zoneIndex = index;
    this.zone = ZONES[index];
    this.env.setZone(this.zone);
    this.cameras.main.setBackgroundColor(this.zone.palette.fog);
    this.enterRoom('boss');
  }

  private startCombat(): void {
    this.roomState = 'combat';
    this.setupTraps();
    this.wavesTotal = Phaser.Math.Between(1, 3);
    this.waveIndex = 0;
    this.player.onRoomStart(); // réinitialise les accumulateurs de salle (boons)
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
    // Une salle spéciale (fontaine / marchand / trésor) a 10% de chance CHACUNE
    // d'apparaître, et jamais deux fois d'affilée (pas la même que la salle
    // précédente). L'autre porte reste toujours un combat pour progresser.
    const last = this.roomType;
    const r = Math.random();
    let special: RoomType | null = null;
    if (r < 0.10) special = 'fountain';
    else if (r < 0.20) special = 'shop';
    else if (r < 0.30) special = 'treasure';
    if (special === last) special = null; // pas deux fois d'affilée
    const choices: RoomType[] = ['combat', special ?? 'combat'];
    if (Math.random() < 0.5) choices.reverse();
    return choices;
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
    const fx = WORLD_WIDTH / 2, fy = ARENA.y + ARENA.h / 2;
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
        // La fontaine restaure aussi les consommables du départ (s'ils ont servi).
        if (RunState.consumablesStart.some((id) => id)) {
          RunState.restoreConsumables();
          this.emitConsumables();
          this.juice.popText(fx, fy - 84, 'Consommables restaurés !', '#eaf4ff', 15);
        }
      }
    }});
    this.roomObjects.push({ destroy: () => check.remove() } as unknown as Phaser.GameObjects.GameObject);
    const _tk = this.roomToken; this.time.delayedCall(700, () => { if (this.roomToken === _tk) this.openDoors(); });
  }

  private startTreasure(): void {
    this.roomState = 'idle';
    this.events.emit('progress', this.zone.name, this.combatDone, this.zone.rooms, false, 'Trésor');
    const fx = WORLD_WIDTH / 2, fy = ARENA.y + ARENA.h / 2;
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
    // Le marchand accepte l'or (gagné en tuant des monstres) OU les PV — le
    // logo de chaque article indique la monnaie. Les boons vendus sont rare ou +.
    const openBoon = () => { this.scene.pause(); this.scene.launch('Reward', { gameScene: this, minRarity: 'rare' }); };
    type ShopItem = { label: string; currency: 'coin' | 'hp'; cost: number; buy: () => void };
    const items: ShopItem[] = [
      { label: 'Boon', currency: 'coin', cost: 45, buy: openBoon },
      { label: 'Boon', currency: 'hp', cost: 25, buy: openBoon },
      { label: '+40 PV max', currency: 'coin', cost: 35, buy: () => { this.player.stats.maxHp += 40; this.player.heal(40); } },
    ];
    // marchand : chat tigré du désert (turban, gourde) sous un halo doré chaud
    const aura = this.add.image(WORLD_WIDTH / 2, ARENA.y + 66, 'light').setTint(0xf4a020).setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setDepth(8).setAlpha(0.35);
    this.tweens.add({ targets: aura, alpha: 0.18, duration: 1100, yoyo: true, repeat: -1 });
    const npc = this.add.sprite(WORLD_WIDTH / 2, ARENA.y + 70, 'merchant_cat').setScale(2.4).setDepth(11);
    this.tweens.add({ targets: npc, y: ARENA.y + 62, duration: 900, yoyo: true, repeat: -1 });
    this.roomObjects.push(aura, npc);
    items.forEach((it, i) => {
      const px = WORLD_WIDTH / 2 + (i - 1) * 200;
      const isCoin = it.currency === 'coin';
      const glowCol = isCoin ? 0xf4c430 : 0xe8384f;
      const glow = this.add.image(px, y, 'light').setTint(glowCol).setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setDepth(9).setAlpha(0.4);
      const ped = this.add.graphics().setDepth(10);
      ped.fillStyle(0x2a2436, 1).fillRoundedRect(px - 44, y - 8, 88, 34, 8);
      ped.lineStyle(2, glowCol, 0.85).strokeRoundedRect(px - 44, y - 8, 88, 34, 8);
      const txt = this.add.text(px, y - 40, `${it.label}\n${it.cost} ${isCoin ? '🥇' : '❤'}`, { fontFamily: 'monospace', fontSize: '20px', color: isCoin ? '#f4c430' : '#ffd0d0', align: 'center', stroke: '#000', strokeThickness: 4, fontStyle: 'bold' }).setOrigin(0.5).setDepth(11);
      this.roomObjects.push(glow, ped, txt);
      let bought = false;
      const check = this.time.addEvent({ delay: 120, loop: true, callback: () => {
        if (bought || this.player.dead) return;
        if (Phaser.Math.Distance.Between(this.player.x, this.player.y, px, y) < 44) {
          const canPay = isCoin ? RunState.currencyEarned >= it.cost : this.player.hp > it.cost;
          if (canPay) {
            bought = true;
            if (isCoin) { RunState.currencyEarned -= it.cost; this.events.emit('currency', RunState.currencyEarned); }
            else { this.player.spendLife(it.cost); }
            it.buy();
            this.juice.burst(px, y, glowCol, 14, 180, 1.2);
            AudioManager.play('coin');
            txt.setText('Acheté !');
          } else {
            this.juice.popText(px, y - 54, isCoin ? 'Pas assez d’or' : 'Pas assez de PV', '#ff9db0', 18);
          }
        }
      }});
      this.roomObjects.push({ destroy: () => check.remove() } as unknown as Phaser.GameObjects.GameObject);
    });
    const _tk = this.roomToken; this.time.delayedCall(600, () => { if (this.roomToken === _tk) this.openDoors(); });
  }

  spawnEnemy(id: string, x: number, y: number, diff = getDifficulty(RunState.difficultyId)): Enemy {
    const def = ENEMIES[id];
    // Difficulté croissante : le joueur monte TRÈS vite en puissance (jusqu'à ~36
    // boons au dernier boss), donc les monstres montent en flèche zone après zone
    // (croissance exponentielle) en plus du palier de salle.
    // PV monstres ×3 dans les deux derniers mondes (Nécropole Céleste + Faille du Néant).
    const lastWorldsHp = this.zone.index >= 5 ? 3 : 1;
    const zoneHp = Math.pow(1.62, this.zone.index) * (1 + this.combatDone * 0.07) * lastWorldsHp;
    const zoneDmg = Math.pow(1.34, this.zone.index) * (1 + this.combatDone * 0.05);
    // Vitesse : de plus en plus rapide au fil des salles (et un peu par zone) ×
    // le multiplicateur de difficulté (les modes durs bougent plus vite).
    const speedMul = (1 + this.combatDone * 0.07) * (1 + this.zone.index * 0.05) * diff.enemySpeed;
    // À partir du monde de glace (zone 4) : tous foncent (dash) et beaucoup canardent.
    const icePlus = this.zone.index >= 4;
    const e = new Enemy(this, x, y, def, diff.enemyHp * zoneHp, diff.enemyDamage * zoneDmg, {
      speedMul,
      canDash: icePlus,
      canBurst: icePlus && Math.random() < 0.6,
      atkSpeedMul: diff.enemyAttackSpeed,
    });
    this.enemies.add(e);
    this.activeEnemies.add(e);
    return e;
  }

  summonMinions(x: number, y: number, id: string, count: number): void {
    if (!this.combatActive) return;
    if (this.activeEnemies.size > 24) return; // évite l'accumulation d'adds
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2;
      const px = Phaser.Math.Clamp(x + Math.cos(ang) * 50, ARENA.x + 20, ARENA.x + ARENA.w - 20);
      const py = Phaser.Math.Clamp(y + Math.sin(ang) * 50, ARENA.y + 20, ARENA.y + ARENA.h - 20);
      this.time.delayedCall(200, () => {
        if (!this.combatActive) return;
        this.spawnEnemy(id, px, py);
      });
    }
  }

  spawnEnemyProjectile(x: number, y: number, dx: number, dy: number, speed: number, damage: number, status?: 'poison' | 'freeze', tint?: number, opts?: { texture?: string; scale?: number; orient?: boolean; radius?: number }): void {
    const diff = getDifficulty(RunState.difficultyId);
    // Les projectiles de gel prennent d'office l'apparence d'un bloc de glace.
    if (status === 'freeze' && !opts?.texture) opts = { ...opts, texture: 'ice_shard', scale: 1.4, radius: 6 };
    const p = new Projectile(this, x, y, dx * speed, dy * speed, damage * diff.enemyDamage, status, tint, opts);
    this.projectiles.add(p);
  }

  /** Gerbe de particules de givre projetées en cône (souffle de glace). */
  frostSpray(x: number, y: number, angle: number, spread: number): void {
    const deg = Phaser.Math.RadToDeg(angle);
    const half = Phaser.Math.RadToDeg(spread);
    const em = this.add.particles(x, y, 'frost', {
      speed: { min: 120, max: 300 },
      angle: { min: deg - half, max: deg + half },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.95, end: 0 },
      lifespan: 460, quantity: 14, frequency: -1, rotate: { min: 0, max: 360 },
      blendMode: 'ADD',
    }).setDepth(17);
    em.explode(14);
    this.time.delayedCall(560, () => em.destroy());
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
    // PV des boss : base ×2 amplifiée par une montée exponentielle de zone (le
    // joueur devient très fort), le tout ENCORE ×5 (boss très costauds), et
    // dégâts de contact/attaques mis à l'échelle de zone.
    const bossHpMult = (2 + this.zone.index) * 2 * Math.pow(1.28, this.zone.index) * 2.5;
    const bossDmgMult = Math.pow(1.3, this.zone.index);
    AudioManager.startMusic('boss');
    this.events.emit('progress', this.zone.name, this.zone.rooms, this.zone.rooms, true);
    // petit dialogue chaton ↔ boss (change à chaque run), puis la bannière et le boss
    this.bossIntro(def, () => {
      this.banner(`BOSS : ${def.name}, ${def.title}`, () => {
        this.boss = new Boss(this, WORLD_WIDTH / 2, ARENA.y + 120, def, diff.enemyHp * bossHpMult, diff.enemyDamage * bossDmgMult);
        this.bossOverlap?.destroy();
        this.bossOverlap = this.physics.add.overlap(this.player, this.boss, (_p, b) => {
          const bs = b as Boss;
          if (bs.isAlive()) this.player.takeDamage(bs.contactDamage, bs.x, bs.y);
        });
        this.events.emit('bossName', `Nv ${def.level} · ${def.name}, ${def.title}`);
        this.events.emit('bossHp', this.boss.hp, this.boss.maxHp);
        this.events.emit('bossPhase', 1, def.phases.length);
      });
    });
  }

  /** Dialogue chaton ↔ boss avant le combat (tiré au hasard, fun, change par run). */
  private bossIntro(def: typeof BOSSES[string], onDone: () => void): void {
    const pool = BOSS_TAUNTS[def.id] ?? [];
    if (pool.length === 0) { onDone(); return; }
    const t = pool[Math.floor(Math.random() * pool.length)];
    const cx = WORLD_WIDTH / 2, cy = WORLD_HEIGHT / 2;
    const mk = (text: string, color: string, y: number) => this.add.text(cx, y, text, {
      fontFamily: 'monospace', fontSize: '18px', color, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 560 },
    }).setOrigin(0.5).setDepth(92).setAlpha(0);
    const catLine = mk(`🐱 ${t.cat}`, '#f4e9c1', cy - 26);
    const bossLine = mk(`${def.name} : « ${t.boss} »`, '#ff9db0', cy + 30);
    this.tweens.add({ targets: catLine, alpha: 1, y: cy - 30, duration: 260, ease: 'Back.easeOut' });
    this.time.delayedCall(1200, () => this.tweens.add({ targets: bossLine, alpha: 1, y: cy + 26, duration: 260, ease: 'Back.easeOut' }));
    this.time.delayedCall(2900, () => {
      this.tweens.add({ targets: [catLine, bossLine], alpha: 0, duration: 300, onComplete: () => { catLine.destroy(); bossLine.destroy(); } });
      onDone();
    });
  }

  /** Ennemis actifs (pour soigneuse/porte-bouclier). */
  getEnemies(): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.activeEnemies) if (e.isAlive()) out.push(e);
    return out;
  }

  /** Faisceau court entre deux points (soin, lien). */
  beam(x1: number, y1: number, x2: number, y2: number, color: number): void {
    const g = this.add.graphics().setDepth(17);
    g.lineStyle(3, color, 0.9).lineBetween(x1, y1, x2, y2);
    g.lineStyle(6, color, 0.3).lineBetween(x1, y1, x2, y2);
    this.tweens.add({ targets: g, alpha: 0, duration: 320, onComplete: () => g.destroy() });
  }

  /** Bombe en cloche : projectile en arc puis zone télégraphiée (hitbox prévisionnelle). */
  lobBomb(sx: number, sy: number, tx: number, ty: number, radius: number, damage: number, status: 'poison' | 'freeze' | undefined, telegraph: number): void {
    tx = Phaser.Math.Clamp(tx, ARENA.x + 20, ARENA.x + ARENA.w - 20);
    ty = Phaser.Math.Clamp(ty, ARENA.y + 20, ARENA.y + ARENA.h - 20);
    const color = status === 'poison' ? 0x8fd94a : 0xff8a3a;
    const bomb = this.add.sprite(sx, sy, 'orb_big').setTint(status === 'poison' ? 0x6a8a2a : 0x333842).setDepth(24).setScale(1.5);
    const shadow = this.add.ellipse(tx, ty, 22, 10, 0x000000, 0.35).setDepth(3);
    const flight = 620;
    this.tweens.add({ targets: bomb, x: tx, y: ty, duration: flight, ease: 'Sine.easeIn' });
    // effet d'arc (hauteur)
    this.tweens.add({ targets: bomb, scale: 2.1, duration: flight / 2, yoyo: true });
    this.tweens.add({ targets: bomb, angle: 360, duration: flight });
    this.time.delayedCall(flight, () => {
      bomb.destroy();
      shadow.destroy();
      this.telegraphCircle(tx, ty, radius, color, telegraph, () => {
        this.eruptAt(tx, ty, radius, color, damage, status === 'poison' ? 'toxic' : undefined, 2500);
      });
    });
  }

  /**
   * Glob de boue craché vers un point au sol : file en ligne droite vers (tx,ty),
   * inflige des dégâts une fois s'il touche le joueur en vol, puis retombe en
   * flaque toxique là où il atterrit. Utilisé par Gorbak et les mini-gorbaks.
   */
  mudGlob(sx: number, sy: number, tx: number, ty: number, damage: number, puddleR = 34): void {
    tx = Phaser.Math.Clamp(tx, ARENA.x + 24, ARENA.x + ARENA.w - 24);
    ty = Phaser.Math.Clamp(ty, ARENA.y + 24, ARENA.y + ARENA.h - 24);
    const dist = Math.hypot(tx - sx, ty - sy);
    const dur = Phaser.Math.Clamp(dist / 0.62, 260, 720); // vitesse ~0,62 px/ms
    const glob = this.add.image(sx, sy - 12, 'mud_blob').setDepth(24).setScale(1.5);
    const shadow = this.add.ellipse(tx, ty, 20, 9, 0x000000, 0.32).setDepth(3);
    let hit = false;
    this.tweens.add({
      targets: glob, x: tx, y: ty, duration: dur, ease: 'Sine.easeIn',
      onUpdate: () => {
        if (hit) return;
        const p = this.player;
        if (this.combatActive && p && !p.dead && Math.hypot(p.x - glob.x, p.y - glob.y) < 18) {
          hit = true;
          p.takeDamage(damage, glob.x, glob.y);
          this.poisonPlayer();
        }
      },
    });
    this.tweens.add({ targets: glob, scale: 2.0, duration: dur / 2, yoyo: true });
    this.tweens.add({ targets: glob, angle: 360, duration: dur });
    this.time.delayedCall(dur, () => {
      glob.destroy();
      shadow.destroy();
      this.juice.burst(tx, ty, 0x7a8a3a, 8, 150, 1.1);
      // éclaboussures de boue à l'impact
      const sp = this.add.particles(tx, ty, 'mud_splat', {
        speedX: { min: -110, max: 110 }, speedY: { min: -150, max: -40 },
        scale: { start: 1, end: 0.2 }, lifespan: 380, quantity: 7, gravityY: 260, emitting: false,
      }).setDepth(26);
      sp.explode(7);
      this.time.delayedCall(420, () => sp.destroy());
      this.eruptAt(tx, ty, puddleR, 0x8a6a3a, Math.round(damage * 0.6), 'toxic', 2600);
    });
  }

  /**
   * Barrage de boue de Gorbak enragé : vise la position du joueur au lancer.
   * mode 'line' = globs alignés qui traversent le joueur ; mode 'cone' = gerbe
   * de globs étalés autour de lui. Chaque glob retombe en flaque toxique.
   */
  mudBarrage(sx: number, sy: number, px: number, py: number, mode: 'line' | 'cone', damage: number): void {
    const base = Math.atan2(py - sy, px - sx);
    const dist = Math.max(120, Math.hypot(px - sx, py - sy));
    if (mode === 'line') {
      // trois flaques le long de l'axe boss→joueur (avant, sur, après le joueur)
      const factors = [0.7, 1.0, 1.32];
      factors.forEach((f, i) => {
        this.time.delayedCall(i * 150, () => {
          if (!this.combatActive) return;
          this.mudGlob(sx, sy, sx + Math.cos(base) * dist * f, sy + Math.sin(base) * dist * f, damage, 32);
        });
      });
    } else {
      // cône de globs autour de la position visée
      const n = 5, spread = 0.6;
      for (let k = 0; k < n; k++) {
        const t = k / (n - 1);
        const a = base + Phaser.Math.Linear(-spread, spread, t);
        const d = dist * (0.85 + Math.random() * 0.3);
        this.mudGlob(sx, sy, sx + Math.cos(a) * d, sy + Math.sin(a) * d, damage, 30);
      }
    }
  }

  // ---------------- callbacks entités ----------------
  private onScenePause(): void { RunState.pauseTimer(); }
  private onSceneResume(): void { RunState.resumeTimer(); }

  /** Le combat est-il actif ? (Les dégâts d'attaques télégraphiées ne s'appliquent
   * qu'en combat/boss — jamais pendant une transition, ex. après la mort du boss.) */
  private get combatActive(): boolean {
    return this.roomState === 'combat' || this.roomState === 'boss';
  }

  getTargets(): IEnemyLike[] {
    const list: IEnemyLike[] = [];
    for (const e of this.activeEnemies) if (e.isAlive()) list.push(e);
    for (const p of this.bossPylons) if (p.isAlive()) list.push(p);
    if (this.boss?.isAlive()) list.push(this.boss);
    for (const rb of this.rageBosses) if (rb !== this.boss && rb.isAlive()) list.push(rb);
    return list;
  }

  /** Glacior est invincible tant qu'au moins un pilône de glace tient. */
  bossInvincible(): boolean {
    return this.bossPylons.some((p) => p.isAlive());
  }

  /** Invoque 4 pilônes de glace aux coins de l'arène (rend le boss invincible). */
  spawnIcePylons(hpEach: number): void {
    this.clearPylons();
    const A = ARENA, m = 92;
    const corners = [
      { x: A.x + m, y: A.y + m + 30 },
      { x: A.x + A.w - m, y: A.y + m + 30 },
      { x: A.x + m, y: A.y + A.h - m },
      { x: A.x + A.w - m, y: A.y + A.h - m },
    ];
    for (const c of corners) this.bossPylons.push(new Pylon(this, c.x, c.y, hpEach));
    this.juice.popText(WORLD_WIDTH / 2, ARENA.y + 90, 'INVINCIBLE : BRISE LES PILÔNES !', '#7fdcff', 22);
    this.sfx('bosscast');
  }

  private clearPylons(): void {
    for (const p of this.bossPylons) p.destroy();
    this.bossPylons = [];
  }

  /** Pluie de stalactites : impacts partout SAUF quelques zones sûres marquées. */
  iceRain(safeCount: number, count: number, telegraph: number, damage: number, radius: number): void {
    const safe: { x: number; y: number }[] = [];
    for (let i = 0; i < safeCount; i++) safe.push(this.arenaPoint(90));
    const safeR = 74;
    // marque les zones sûres en vert le temps de l'attaque
    const g = this.add.graphics().setDepth(3);
    const drawSafe = () => {
      g.clear();
      const pulse = 0.4 + 0.3 * Math.abs(Math.sin(performance.now() * 0.008));
      for (const s of safe) {
        g.fillStyle(0x59ff9a, 0.14 * pulse); g.fillCircle(s.x, s.y, safeR);
        g.lineStyle(3, 0x59ff9a, 0.7 * pulse); g.strokeCircle(s.x, s.y, safeR);
      }
    };
    const timer = this.time.addEvent({ delay: 40, loop: true, callback: drawSafe });
    for (let k = 0; k < count; k++) {
      this.time.delayedCall(k * 130, () => {
        if (!this.combatActive) return;
        let pt = this.arenaPoint(50);
        // évite les zones sûres (quelques essais)
        for (let tries = 0; tries < 6; tries++) {
          if (safe.every((s) => Phaser.Math.Distance.Between(pt.x, pt.y, s.x, s.y) > safeR + radius)) break;
          pt = this.arenaPoint(50);
        }
        this.dropStalactite(pt.x, pt.y, radius, damage, telegraph);
      });
    }
    this.time.delayedCall(count * 130 + telegraph + 700, () => { timer.remove(); g.destroy(); });
  }

  /** Une stalactite : ombre télégraphe, chute du ciel, impact gelant. */
  dropStalactite(x: number, y: number, r: number, damage: number, telegraph: number): void {
    const shadow = this.add.ellipse(x, y, r * 1.6, r * 0.7, 0x2a6a9a, 0.35).setDepth(3);
    this.tweens.add({ targets: shadow, scaleX: 1.3, scaleY: 1.3, duration: telegraph, yoyo: false });
    this.time.delayedCall(telegraph, () => {
      if (!this.combatActive) { shadow.destroy(); return; }
      const ice = this.add.image(x, y - 240, 'ice_stalactite').setDepth(28).setScale(2.2);
      this.tweens.add({ targets: ice, y, duration: 240, ease: 'Quad.easeIn', onComplete: () => {
        this.sfx('freeze');
        this.eruptAt(x, y, r, 0x7fdcff, damage);
        this.juice.burst(x, y, 0xbfeaff, 12, 200, 1.2);
        this.tweens.add({ targets: ice, alpha: 0, scaleY: 0.4, duration: 260, onComplete: () => ice.destroy() });
        shadow.destroy();
      } });
    });
  }

  onEnemyKilled(e: Enemy, byPlayer: boolean): void {
    this.activeEnemies.delete(e);
    if (byPlayer) {
      RunState.kills++;
      this.player.notifyKill(e);
      this.addRunCurrency(REWARDS.perEnemyBonus);
      this.awardXp(Math.round(3 + e.maxHp * 0.09)); // XP relevée : moins de salles, boss ×5 PV
    }
    // dépose une âme à récupérer (salles de combat uniquement)
    if (this.roomState === 'combat') this.spawnSoul(e.def.id, e.x, e.y);
    this.checkWaveCleared();
  }

  private checkWaveCleared(): void {
    if (this.roomState !== 'combat') return;
    if (this.activeEnemies.size > 0) return;
    if (this.souls.length > 0) return; // des âmes restent à récupérer
    this.waveIndex++;
    if (this.waveIndex < this.wavesTotal) {
      this.time.delayedCall(600, () => { if (this.roomState === 'combat') this.spawnWave(); });
    } else {
      this.roomClear();
    }
  }

  // File de boons gagnés par montée de niveau (XP). Les boons ne sont plus donnés
  // en fin de salle : on les obtient en montant de niveau.
  private pendingBoons = 0;
  private rewardActive = false;

  /** Gagne de l'XP ; chaque niveau franchi ajoute une COMPÉTENCE à récupérer
   * (le joueur la choisit via le bouton clignotant de l'ATH — pas d'ouverture auto). */
  private awardXp(amount: number): void {
    RunState.xp += amount;
    let leveled = false;
    while (RunState.xp >= RunState.xpForLevel()) {
      RunState.xp -= RunState.xpForLevel();
      RunState.level++;
      this.pendingBoons++;
      leveled = true;
    }
    this.events.emit('xp', RunState.xp, RunState.xpForLevel(), RunState.level);
    if (leveled) {
      this.juice.popText(this.player.x, this.player.y - 56, `NIVEAU ${RunState.level} !`, '#59b8ff', 18);
      this.sfx('power');
      this.events.emit('boons', this.pendingBoons); // met à jour le compteur du bouton
    }
  }

  /** Nombre de compétences en attente (lu par l'ATH). */
  boonsPending(): number { return this.pendingBoons; }

  /** Envoie l'état des consommables à l'ATH (slots de départ + restants). */
  emitConsumables(): void {
    this.events.emit('consumables', { slots: RunState.consumablesStart, active: RunState.consumables });
  }
  /** Active le consommable du slot donné (bouton/tap de l'ATH). */
  useConsumable(index: number): void {
    if (this.scene.isPaused() || !this.player || this.player.dead) return;
    const id = RunState.consumables[index];
    if (!id) return;
    const def = consumableById(id);
    if (!def) return;
    def.use(this.player);
    this.juice.popText(this.player.x, this.player.y - 46, `${def.name} !`, '#eaf4ff', 15);
    this.sfx('special');
    RunState.consumables[index] = '';
    this.emitConsumables();
  }

  /**
   * Récupère UNE compétence (déclenché par le bouton de l'ATH). Ouvre l'écran de
   * choix — jamais automatiquement, pour éviter les sélections par erreur.
   */
  redeemBoon(): void {
    if (this.pendingBoons <= 0 || this.rewardActive || this.scene.isPaused()) return;
    this.pendingBoons--;
    this.rewardActive = true;
    this.events.emit('boons', this.pendingBoons);
    this.scene.pause();
    this.scene.launch('Reward', { gameScene: this });
  }

  private roomClear(): void {
    this.roomState = 'transition';
    this.player.onRoomClear();
    this.addRunCurrency(REWARDS.perRoom * getDifficulty(RunState.difficultyId).reward);
    this.hazards = [];
    this.hazardGfx.clear();
    this.projectiles.clear(true, true);
    this.combatDone++;
    this.juice.popText(this.player.x, this.player.y - 50, 'Salle nettoyée !', '#6ad46a', 18);
    // Les portes s'ouvrent directement : plus de boon en fin de salle (XP à la place).
    const _tk = this.roomToken; this.time.delayedCall(500, () => { if (this.roomToken === _tk) this.openDoors(); });
  }

  /** Nombre d'exemplaires d'un boon déjà possédés (pour l'étiquette cumulable). */
  ownedCount(id: string): number {
    return RunState.powers.reduce((n, p) => n + (p.id === id ? 1 : 0), 0);
  }

  // ---------------- âmes (récupération / respawn) ----------------
  private spawnSoul(id: string, x: number, y: number): void {
    const orb = this.add.sprite(x, y - 8, 'orb_big').setDepth(16).setTint(0xbff7f6).setScale(1.25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: orb, y: y - 16, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: orb, alpha: 0.55, duration: 380, yoyo: true, repeat: -1 });
    const ring = this.add.graphics().setDepth(16);
    this.souls.push({ orb, ring, id, x, y, expireAt: RunState.elapsedMs() + SOUL_TTL });
    this.juice.burst(x, y - 8, 0xbff7f6, 6, 100, 0.8);
  }

  /** Met à jour les âmes : ramassage par proximité, sinon respawn après 5 s. */
  private updateSouls(): void {
    const t = RunState.elapsedMs(); // temps du run (en pause pendant les menus)
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const s = this.souls[i];
      const left = Phaser.Math.Clamp((s.expireAt - t) / SOUL_TTL, 0, 1);
      const urgent = left < 0.3;
      s.ring.clear();
      s.ring.lineStyle(2.5, urgent ? 0xff5a5a : 0xbff7f6, 0.9);
      s.ring.beginPath();
      s.ring.arc(s.x, s.orb.y, 15, -Math.PI / 2, -Math.PI / 2 + left * Math.PI * 2, false);
      s.ring.strokePath();
      s.orb.setTint(urgent ? 0xff8a8a : 0xbff7f6);
      if (this.player && !this.player.dead) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, s.x, s.y);
        // Attraction Gravitationnelle : aspiration sur toute l'arène + homing rapide.
        const grav = !!this.player.mods.gravSoul;
        const magnet = grav ? 99999 : SOUL_MAGNET + (this.player.stats.soulMagnet ?? 0);
        if (dist < magnet) {
          s.homing = true;
          this.tweens.killTweensOf(s.orb); // stoppe le flottement pour un homing net
          s.orb.setAlpha(0.95);
        }
        if (s.homing) {
          // Glisse vers le joueur ; vitesse croissante à mesure qu'il approche.
          const sp = grav ? 0.42 : Phaser.Math.Clamp(1 - dist / (magnet + 1), 0.18, 0.9) * 0.5 + 0.1;
          s.x = Phaser.Math.Linear(s.x, this.player.x, sp);
          s.y = Phaser.Math.Linear(s.y, this.player.y, sp);
          s.orb.setPosition(s.x, s.y - 8);
        }
        const grab = 36 + (this.player.stats.soulMagnet ?? 0); // ramassage
        if (dist < grab) { this.collectSoul(i); continue; }
      }
      if (t >= s.expireAt) this.respawnFromSoul(i);
    }
  }

  private collectSoul(i: number): void {
    const s = this.souls[i];
    this.juice.burst(s.x, s.orb.y, 0xbff7f6, 12, 170, 1.2);
    this.juice.popText(s.x, s.orb.y - 18, 'Âme', '#bff7f6', 14);
    AudioManager.play('soul');
    this.addRunCurrency(1);
    // Le soin n'est plus offert par défaut : seuls les pouvoirs dédiés (Senzu /
    // Cueilleur) rendent des PV à la récupération d'une âme.
    if (this.player.stats.soulHealBonus > 0) this.player.heal(this.player.stats.soulHealBonus);
    s.orb.destroy(); s.ring.destroy();
    this.souls.splice(i, 1);
    this.checkWaveCleared();
  }

  private respawnFromSoul(i: number): void {
    const s = this.souls[i];
    s.orb.destroy(); s.ring.destroy();
    this.souls.splice(i, 1);
    this.juice.ring(s.x, s.y, 32, 0xff5a5a, 320);
    this.juice.burst(s.x, s.y - 8, 0x9a3a6a, 12, 180, 1.1);
    AudioManager.play('respawn');
    if (this.roomState === 'combat') this.spawnEnemy(s.id, s.x, s.y);
  }

  private clearSouls(): void {
    for (const s of this.souls) { s.orb.destroy(); s.ring.destroy(); }
    this.souls = [];
  }

  /** Ramasse toutes les âmes situées près du segment parcouru (téléport Kunai). */
  collectSoulsAlong(x1: number, y1: number, x2: number, y2: number, radius: number): void {
    const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy || 1;
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const s = this.souls[i];
      const t = Phaser.Math.Clamp(((s.x - x1) * dx + (s.y - y1) * dy) / len2, 0, 1);
      const px = x1 + dx * t, py = y1 + dy * t;
      if (Phaser.Math.Distance.Between(s.x, s.y, px, py) <= radius) this.collectSoul(i);
    }
  }

  /**
   * Éclair du Kunai : trait de foudre entre le départ et l'arrivée du téléport,
   * bruitage d'éclair et ramassage des âmes traversées.
   */
  kunaiBlink(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.add.graphics().setDepth(24);
    this.drawBolt(g, x1, y1, x2, y2);
    this.juice.burst(x1, y1, 0xffe08a, 8, 150, 0.9);
    this.juice.burst(x2, y2, 0xfff27a, 12, 190, 1.2);
    this.juice.ring(x2, y2, 44, 0xffe08a, 260);
    this.sfx('zap');
    this.collectSoulsAlong(x1, y1, x2, y2, 40);
    this.time.delayedCall(130, () => g.destroy());
  }

  /** appelé par RewardScene après le choix. */
  onPowerPicked(power: PowerDef | null): void {
    if (power) {
      power.apply(this.player);
      this.player.syncDashCharges();
      if (!power.fallback) RunState.addPower(power); // les cartes de repli ne sont pas des boons
      this.events.emit('powers', RunState.powers);
    }
    this.rewardActive = false;
    // ENCHAÎNEMENT : s'il reste des compétences à choisir, on relance directement
    // l'écran de choix (le joueur sélectionne les 4 d'affilée sans recliquer).
    if (this.pendingBoons > 0) {
      this.pendingBoons--;
      this.rewardActive = true;
      this.events.emit('boons', this.pendingBoons);
      this.scene.launch('Reward', { gameScene: this });
      return;
    }
    if (this.scene.isPaused()) this.scene.resume();
    this.events.emit('boons', this.pendingBoons);
  }

  onBossKilled(b: Boss): void {
    const wasPrimary = b === this.boss;
    if (wasPrimary) this.boss = null;
    const wasRage = this.rageBosses.includes(b);
    this.rageBosses = this.rageBosses.filter((x) => x !== b);

    // récompenses (réduites pour chaque clone enragé)
    this.awardXp(Math.round(b.maxHp * (wasRage ? 0.015 : 0.03)));
    this.addRunCurrency(REWARDS.perBoss * getDifficulty(RunState.difficultyId).reward * (wasRage ? 0.34 : 1));
    AudioManager.play('bossdie');
    this.juice.shake(wasRage ? 360 : 600, wasRage ? 0.014 : 0.02);
    for (let i = 0; i < 4; i++) this.time.delayedCall(i * 110, () => this.juice.burst(b.x, b.y - 20, 0xffe0b0, 16, 240, 1.8));
    (b.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.tweens.add({ targets: b, alpha: 0, scaleY: 0, angle: 40, duration: 1000, ease: 'Cubic.easeIn', onComplete: () => b.destroy() });

    // BOSS FINAL : pas de round enragé — sa chute conclut le jeu (VICTOIRE ultime).
    if (this.finalActive && wasPrimary) {
      // Lâche (et garantit) le Bandana du BIG BOSS.
      this.spawnMaterialDrop(b.x, b.y, 'boss_bandana');
      SaveSystem.addMaterial('boss_bandana', 1);
      this.roomState = 'transition';
      this.bossMines.forEach((m) => m.sprite.destroy()); this.bossMines = [];
      this.activeEnemies.forEach((e) => e.destroy()); this.activeEnemies.clear();
      this.time.timeScale = 0.35; this.physics.world.timeScale = 2.8;
      this.time.delayedCall(1600, () => {
        this.time.timeScale = 1; this.physics.world.timeScale = 1;
        this.banner('BIG BOSS VAINCU !', () => this.finishRun(true));
      });
      return;
    }

    if (!this.rageActive && !wasRage) {
      // PREMIÈRE défaite du boss → il lâche son MATÉRIAU (à récupérer avant/pendant
      // le round enragé), puis on enchaîne sur le round ENRAGÉ (3 clones).
      const mat = materialByBoss(this.zone.bossId);
      if (mat) this.spawnMaterialDrop(b.x, b.y, mat.id);
      this.roomState = 'transition';
      this.bossHazards = [];
      this.bossOverlap?.destroy();
      this.bossOverlap = undefined;
      this.activeEnemies.forEach((e) => e.destroy());
      this.activeEnemies.clear();
      this.clearPylons();
      this.clearSouls();
      this.time.timeScale = 0.4;
      this.physics.world.timeScale = 2.5;
      this.events.emit('bossHp', 0, b.maxHp);
      this.time.delayedCall(1300, () => {
        this.time.timeScale = 1;
        this.physics.world.timeScale = 1;
        // Les compétences gagnées attendent le bouton ; on enchaîne le round enragé.
        this.startRageRound();
      });
      return;
    }

    // Un clone enragé vient de tomber : on n'avance QUE lorsqu'ils sont tous morts.
    if (this.rageBosses.length === 0) {
      this.rageActive = false;
      this.roomState = 'transition';
      this.bossHazards = [];
      this.rageOverlaps.forEach((o) => o.destroy());
      this.rageOverlaps = [];
      this.activeEnemies.forEach((e) => e.destroy());
      this.activeEnemies.clear();
      this.clearPylons();
      this.clearSouls();
      this.time.timeScale = 0.35;
      this.physics.world.timeScale = 2.8;
      this.events.emit('bossHp', 0, this.rageMaxTotal);
      this.time.delayedCall(1400, () => {
        this.time.timeScale = 1;
        this.physics.world.timeScale = 1;
        this.banner('BOSS VRAIMENT VAINCU !', () => this.afterBoss());
      });
    }
  }

  /** Round final : le boss revient (dialogue) puis réapparaît ENRAGÉ en 3 clones. */
  private startRageRound(): void {
    const def = BOSSES[this.zone.bossId];
    const diff = getDifficulty(RunState.difficultyId);
    // Nouveau dialogue avec le boss avant qu'il ne se démultiplie.
    this.bossIntro(def, () => {
      this.banner(`${def.name} ENRAGÉ ×3 !`, () => {
        this.roomState = 'boss';
        this.rageActive = true;
        this.rageBosses = [];
        this.rageOverlaps.forEach((o) => o.destroy());
        this.rageOverlaps = [];
        // PV par clone ≈ 0,5× le boss simple (trio ≈ 1,5×) ; dégâts ×1,3.
        const hpMult = (2 + this.zone.index) * 2 * Math.pow(1.28, this.zone.index) * 2.5 * 0.5;
        const dmgMult = Math.pow(1.3, this.zone.index) * 1.3;
        const spots = [
          { x: WORLD_WIDTH / 2, y: ARENA.y + 110 },
          { x: ARENA.x + 150, y: ARENA.y + ARENA.h - 140 },
          { x: ARENA.x + ARENA.w - 150, y: ARENA.y + ARENA.h - 140 },
        ];
        this.rageMaxTotal = 0;
        for (const s of spots) {
          const rb = new Boss(this, s.x, s.y, def, diff.enemyHp * hpMult, diff.enemyDamage * dmgMult);
          rb.markEnraged();
          this.rageBosses.push(rb);
          this.rageMaxTotal += rb.maxHp;
          const ov = this.physics.add.overlap(this.player, rb, (_p, bb) => {
            const bs = bb as Boss;
            if (bs.isAlive()) this.player.takeDamage(bs.contactDamage, bs.x, bs.y);
          });
          this.rageOverlaps.push(ov);
        }
        this.boss = this.rageBosses[0]; // primaire (nom/HUD)
        this.events.emit('bossName', `Nv ${def.level} · ${def.name} ENRAGÉ ×3`);
        this.events.emit('bossHp', this.rageMaxTotal, this.rageMaxTotal);
        this.events.emit('bossPhase', def.phases.length, def.phases.length);
        AudioManager.startMusic('boss');
      });
    });
  }

  private clearRageBosses(): void {
    this.rageOverlaps.forEach((o) => o.destroy());
    this.rageOverlaps = [];
    for (const rb of this.rageBosses) rb.destroy();
    this.rageBosses = [];
    this.rageActive = false;
  }

  private afterBoss(): void {
    if (RunState.zoneIndex >= ZONES.length - 1) {
      // Néantis ×3 vaincu : on propose de rentrer au camp (victoire) ou d'affronter
      // le boss final. Pas de victoire automatique tant que le choix n'est pas fait.
      RunState.victory = true; // la campagne est déjà « gagnée » à ce stade
      this.roomState = 'transition';
      this.scene.pause();
      this.scene.launch('FinalChoice', { gameScene: this });
    } else {
      this.banner('Zone vaincue !', () => this.startZone(RunState.zoneIndex + 1));
    }
  }

  /** Choix « Rentrer au camp » : victoire du run. */
  finishRunVictory(): void {
    if (this.scene.isPaused()) this.scene.resume();
    this.finishRun(true);
  }

  // ============================================================
  //  BOSS FINAL — l'Ombre Militaire (arène circulaire agrandie)
  // ============================================================
  startFinalBoss(): void {
    if (this.scene.isPaused()) this.scene.resume();
    this.finalActive = true;
    this.roomState = 'transition';
    this.clearRageBosses(); this.clearPylons(); this.clearSouls();
    this.activeEnemies.forEach((e) => e.destroy()); this.activeEnemies.clear();
    this.projectiles.clear(true, true);
    this.bossHazards = []; this.hazards = [];
    this.setupFinalArena();
    this.events.emit('hideTimer'); // pas de chronomètre pour ce combat

    const def = BOSSES['militaire'];
    const diff = getDifficulty(RunState.difficultyId);
    const zi = ZONES.length - 1;
    // 20× les PV de Néantis (même barème de boss appliqué à Néantis, ×20).
    const neantisMul = (2 + zi) * 2 * Math.pow(1.28, zi) * 2.5;
    const hpMul = neantisMul * 20 * (BOSSES['reflet'].hp / def.hp);
    const dmgMul = Math.pow(1.3, zi) * 1.2;
    this.bossIntro(def, () => {
      this.banner(`BOSS FINAL : ${def.name}`, () => {
        this.roomState = 'boss';
        this.boss = new Boss(this, FINAL_CX, FINAL_CY - FINAL_R * 0.4, def, diff.enemyHp * hpMul, diff.enemyDamage * dmgMul);
        this.bossOverlap?.destroy();
        this.bossOverlap = this.physics.add.overlap(this.player, this.boss, (_p, b) => {
          const bs = b as Boss; if (bs.isAlive()) this.player.takeDamage(bs.contactDamage, bs.x, bs.y);
        });
        this.events.emit('bossName', `Nv ${def.level} · ${def.name}, ${def.title}`);
        this.events.emit('bossHp', this.boss.maxHp, this.boss.maxHp);
        this.events.emit('bossPhase', 1, def.phases.length);
        AudioManager.startMusic('boss');
      });
    });
  }

  private setupFinalArena(): void {
    this.physics.world.setBounds(0, 0, FINAL_WORLD_W, FINAL_WORLD_H);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, FINAL_WORLD_W, FINAL_WORLD_H);
    cam.setZoom(0.6);
    cam.startFollow(this.player, true, 0.09, 0.09);
    cam.setBackgroundColor(0x0a0d08);
    // ARENA (rectangle englobant du cercle) : réutilisé par les clamps existants.
    ARENA.x = FINAL_CX - FINAL_R; ARENA.y = FINAL_CY - FINAL_R; ARENA.w = FINAL_R * 2; ARENA.h = FINAL_R * 2;
    this.clearRoom(); // retire murs, bordures et props de la salle précédente
    this.floor?.setVisible(false);
    this.walls.clear(true, true);
    // Sol circulaire militaire (hélipad).
    this.finalGfx?.destroy();
    const g = this.add.graphics().setDepth(-5);
    g.fillStyle(0x161a12, 1).fillCircle(FINAL_CX, FINAL_CY, FINAL_R);
    g.fillStyle(0x1e241a, 1).fillCircle(FINAL_CX, FINAL_CY, FINAL_R - 10);
    g.lineStyle(4, 0x3a4a28, 0.7);
    for (let rr = FINAL_R - 46; rr > 90; rr -= 118) g.strokeCircle(FINAL_CX, FINAL_CY, rr);
    g.lineStyle(12, 0x4a5a30, 1).strokeCircle(FINAL_CX, FINAL_CY, FINAL_R - 6);
    g.lineStyle(9, 0x5a6a38, 0.7);
    g.strokeRect(FINAL_CX - 46, FINAL_CY - 66, 0, 132);
    g.lineBetween(FINAL_CX - 46, FINAL_CY - 66, FINAL_CX - 46, FINAL_CY + 66);
    g.lineBetween(FINAL_CX + 46, FINAL_CY - 66, FINAL_CX + 46, FINAL_CY + 66);
    g.lineBetween(FINAL_CX - 46, FINAL_CY, FINAL_CX + 46, FINAL_CY);
    this.finalGfx = g;
    this.player.setPosition(FINAL_CX, FINAL_CY + FINAL_R * 0.55);
  }

  /** Garde le joueur, le boss et les échos DANS le cercle de l'arène finale. */
  private clampFinalArena(): void {
    const max = FINAL_R - 22;
    const cl = (o: { x: number; y: number }) => {
      const dx = o.x - FINAL_CX, dy = o.y - FINAL_CY, d = Math.hypot(dx, dy);
      if (d > max) { o.x = FINAL_CX + (dx / d) * max; o.y = FINAL_CY + (dy / d) * max; }
    };
    if (this.player && !this.player.dead) cl(this.player);
    for (const e of this.activeEnemies) if (e.isAlive()) cl(e as unknown as { x: number; y: number });
    if (this.boss?.isAlive()) cl(this.boss as unknown as { x: number; y: number });
  }

  /** Couloir rouge télégraphiant une RUÉE (dash) de monstre/boss avant l'élan. */
  dashTelegraph(x: number, y: number, angle: number, len: number, width: number, ms = 280): void {
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const ex = x + nx * len, ey = y + ny * len;
    const g = this.add.graphics().setDepth(3);
    let t = 0;
    const draw = () => {
      t += 40; const a = 0.26 + 0.2 * Math.sin(t / 55);
      g.clear();
      g.lineStyle(width, 0xff3020, a * 0.5); g.lineBetween(x, y, ex, ey);
      g.lineStyle(Math.max(3, width * 0.4), 0xff7a5a, a); g.lineBetween(x, y, ex, ey);
      g.fillStyle(0xff3020, a * 0.6); g.fillCircle(ex, ey, width * 0.5);
    };
    draw();
    const ev = this.time.addEvent({ delay: 40, loop: true, callback: draw });
    this.time.delayedCall(ms, () => { ev.remove(); g.destroy(); });
  }

  /** Lâche un matériau de boss récupérable (icône flottante) à collecter. */
  spawnMaterialDrop(x: number, y: number, matId: string): void {
    const def = materialById(matId); if (!def) return;
    const s = this.add.sprite(x, y, def.icon).setDepth(17).setScale(2.4);
    this.tweens.add({ targets: s, y: y - 10, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: s, scale: 2.8, duration: 700, yoyo: true, repeat: -1 });
    this.juice.ring(x, y, 60, 0xffe08a, 500);
    this.juice.popText(x, y - 44, `${def.name} !`, '#ffe08a', 18);
    this.sfx('coin');
    this.materialPickups.push({ sprite: s, matId });
  }

  private updateMaterialPickups(): void {
    if (!this.materialPickups.length) return;
    const p = this.player; if (!p || p.dead) return;
    this.materialPickups = this.materialPickups.filter((m) => {
      if (!m.sprite.active) return false;
      const d = Math.hypot(p.x - m.sprite.x, p.y - m.sprite.y);
      if (d < 200) { // aspiration douce vers le chaton
        m.sprite.x = Phaser.Math.Linear(m.sprite.x, p.x, 0.12);
        m.sprite.y = Phaser.Math.Linear(m.sprite.y, p.y, 0.12);
      }
      if (d < 34) {
        const def = materialById(m.matId);
        SaveSystem.addMaterial(m.matId, 1);
        this.juice.burst(m.sprite.x, m.sprite.y, 0xffe08a, 10, 160, 1);
        if (def) this.juice.popText(p.x, p.y - 40, `+1 ${def.name}`, '#ffe08a', 15);
        this.sfx('coin');
        m.sprite.destroy();
        return false;
      }
      return true;
    });
  }

  /** Explosion (mine/grenade/missile) : sprite + dégâts de zone (esquive au dash). */
  detonate(x: number, y: number, r: number, dmg: number): void {
    const e = this.add.sprite(x, y, 'explosion').setDepth(28).setScale(0.5);
    this.tweens.add({ targets: e, scale: 2.2, alpha: 0, duration: 360, ease: 'Cubic.easeOut', onComplete: () => e.destroy() });
    this.juice.shake(150, 0.008);
    this.juice.burst(x, y, 0xff7a1f, 16, 240, 1.6);
    this.sfx('explosionbig');
    if (this.combatActive && this.player && !this.player.dead && Math.hypot(this.player.x - x, this.player.y - y) <= r) {
      this.player.takeDamage(dmg, x, y);
    }
  }

  /** Le boss final pose des mines qui explosent à l'approche (-100 PV). */
  layBossMines(count: number, dmg: number): void {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, rr = 70 + Math.random() * (FINAL_R - 140);
      const x = FINAL_CX + Math.cos(a) * rr, y = FINAL_CY + Math.sin(a) * rr;
      const s = this.add.sprite(x, y, 'mine_boss').setDepth(6).setScale(1.4).setAlpha(0.55);
      this.tweens.add({ targets: s, alpha: 1, duration: 220, yoyo: true, repeat: 2 });
      this.bossMines.push({ sprite: s, x, y, armAt: performance.now() + 900, damage: dmg, r: 48 });
    }
    this.sfx('bosscast');
  }

  private updateBossMines(now: number): void {
    if (!this.bossMines.length) return;
    const p = this.player;
    this.bossMines = this.bossMines.filter((m) => {
      if (!m.sprite.active) return false;
      if (now >= m.armAt) m.sprite.setTint(now % 500 < 250 ? 0xff5a3a : 0xffffff);
      const near = this.combatActive && p && !p.dead && now >= m.armAt && Math.hypot(p.x - m.x, p.y - m.y) <= m.r;
      if (near) { this.detonate(m.x, m.y, 92, m.damage); m.sprite.destroy(); return false; }
      return true;
    });
  }

  /** Grenades lancées vers le joueur : arc puis explosion (≥55 PV). */
  throwGrenades(count: number, dmg: number): void {
    const b = this.boss; if (!b) return;
    for (let k = 0; k < count; k++) {
      this.time.delayedCall(k * 220, () => {
        if (!this.combatActive || !this.boss) return;
        const p = this.player;
        const tx = Phaser.Math.Clamp((p && !p.dead ? p.x : this.boss.x) + Phaser.Math.Between(-50, 50), FINAL_CX - FINAL_R + 30, FINAL_CX + FINAL_R - 30);
        const ty = Phaser.Math.Clamp((p && !p.dead ? p.y : this.boss.y) + Phaser.Math.Between(-50, 50), FINAL_CY - FINAL_R + 30, FINAL_CY + FINAL_R - 30);
        const gr = this.add.sprite(this.boss.x, this.boss.y - 12, 'grenade').setDepth(24).setScale(1.3);
        const shadow = this.add.ellipse(tx, ty, 18, 8, 0x000000, 0.3).setDepth(3);
        this.tweens.add({ targets: gr, x: tx, y: ty, duration: 520, ease: 'Sine.easeIn' });
        this.tweens.add({ targets: gr, scale: 1.9, duration: 260, yoyo: true });
        this.tweens.add({ targets: gr, angle: 360, duration: 520 });
        this.time.delayedCall(520, () => { gr.destroy(); shadow.destroy(); this.detonate(tx, ty, 82, dmg); });
      });
    }
    this.sfx('bosscharge');
  }

  /** Pluie de missiles télégraphiés qui tombent du ciel (≥50 PV). */
  bossMissileRain(count: number, dmg: number): void {
    for (let k = 0; k < count; k++) {
      this.time.delayedCall(k * 150, () => {
        if (!this.combatActive) return;
        const p = this.player;
        let tx: number, ty: number;
        if (k % 3 === 0 && p && !p.dead) { tx = p.x; ty = p.y; }
        else { const a = Math.random() * Math.PI * 2, rr = Math.random() * (FINAL_R - 90); tx = FINAL_CX + Math.cos(a) * rr; ty = FINAL_CY + Math.sin(a) * rr; }
        const shadow = this.add.ellipse(tx, ty, 28, 12, 0xff5522, 0.4).setDepth(3);
        this.tweens.add({ targets: shadow, scaleX: 1.5, scaleY: 1.5, duration: 720, yoyo: true });
        const m = this.add.sprite(tx, ty - 380, 'missile').setDepth(24).setScale(1.5);
        this.tweens.add({ targets: m, y: ty, duration: 720, ease: 'Quad.easeIn', onComplete: () => { m.destroy(); shadow.destroy(); this.detonate(tx, ty, 72, dmg); } });
      });
    }
    this.sfx('bosscast');
  }

  /** Le boss final invoque un ÉCHO enragé et amélioré d'un boss déjà vaincu. */
  summonEnragedBoss(): void {
    const pool = ['miniboss_sylvaan', 'miniboss_gorbak', 'miniboss_ignis', 'miniboss_mortis', 'miniboss_glacior', 'miniboss_voltair', 'miniboss_neantis'];
    const id = pool[Math.floor(Math.random() * pool.length)];
    const def = ENEMIES[id]; if (!def) return;
    const a = Math.random() * Math.PI * 2, rr = FINAL_R * 0.6;
    const x = FINAL_CX + Math.cos(a) * rr, y = FINAL_CY + Math.sin(a) * rr;
    const diff = getDifficulty(RunState.difficultyId);
    const zi = ZONES.length - 1;
    // Améliorés & enragés : plus de PV, plus de dégâts, plus rapides.
    const zoneHp = Math.pow(1.62, zi) * 3 * 1.7;
    const zoneDmg = Math.pow(1.34, zi) * 1.5;
    const e = new Enemy(this, x, y, def, diff.enemyHp * zoneHp, diff.enemyDamage * zoneDmg, { speedMul: 1.6, canDash: true, canBurst: true });
    this.enemies.add(e); this.activeEnemies.add(e);
    this.juice.ring(x, y, 90, 0xff5a3a, 420);
    this.juice.popText(x, y - 34, 'ÉCHO ENRAGÉ !', '#ff9db0', 16);
    this.sfx('bosscast');
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
    this.clearPylons();
    this.clearRageBosses();
    SaveSystem.clearLoadout(); // les consommables portés sont consommés à la fin du run
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
    // remplace toute bannière précédente (évite le chevauchement lors des
    // transitions enchaînées, ex. « Zone vaincue ! » -> nom de la zone suivante).
    if (this.activeBanner) { this.tweens.killTweensOf(this.activeBanner); this.activeBanner.destroy(); }
    const t = this.add.text(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, text, {
      fontFamily: 'monospace', fontSize: '34px', color: '#f4e9c1', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 6, align: 'center',
    }).setOrigin(0.5).setDepth(90).setAlpha(0).setScale(0.8);
    this.activeBanner = t;
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 350, ease: 'Back.easeOut' });
    this.time.delayedCall(1300, () => {
      if (t.active) this.tweens.add({ targets: t, alpha: 0, scale: 1.2, duration: 350, onComplete: () => t.destroy() });
      if (this.activeBanner === t) this.activeBanner = undefined;
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

  canRevive(): boolean { return RunState.revivesUsed < this.reviveCharges; }
  consumeRevive(): void { RunState.revivesUsed += 1; this.events.emit('revives', this.reviveLeft()); }
  reviveLeft(): number { return Math.max(0, this.reviveCharges - RunState.revivesUsed); }

  /** VFX du revive « Retombée Féline » : ailes d'ange, particules blanches, son. */
  reviveFx(x: number, y: number): void {
    this.sfx('revive');
    this.juice.ring(x, y, 150, 0xffffff, 600);
    this.juice.ring(x, y, 90, 0xf4f0ff, 500);
    // ailes d'ange qui s'élèvent puis s'estompent
    const wings = this.add.sprite(x, y - 6, 'angel_wings').setDepth(30).setScale(2.2).setAlpha(0);
    this.tweens.add({ targets: wings, alpha: 1, y: y - 26, duration: 260, yoyo: true, hold: 500, ease: 'Sine.easeOut', onComplete: () => wings.destroy() });
    // colonne de plumes/particules blanches
    const p = this.add.particles(x, y, 'px', {
      speed: { min: 40, max: 180 }, angle: { min: 250, max: 290 }, gravityY: -60,
      scale: { start: 2, end: 0 }, lifespan: 700, quantity: 26, tint: [0xffffff, 0xdfeaff], blendMode: 'ADD', emitting: false,
    }).setDepth(29);
    p.explode(26);
    this.time.delayedCall(760, () => p.destroy());
    this.juice.popText(x, y - 46, 'RETOMBÉE FÉLINE !', '#eaf4ff', 20);
  }

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

    const allHaz = [...this.hazards, ...this.bossHazards];
    this.syncHazardMarkers(allHaz, now);
    for (const h of allHaz) {
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

  /**
   * Marqueur au centre de chaque zone dangereuse. Pendant le télégraphe : une
   * MINE clignotante (alerte). Une fois la zone active : une vraie FLAQUE (lave
   * pour feu/lave, mare toxique pour poison) qui couvre le rayon.
   */
  private syncHazardMarkers(list: Hazard[], now: number): void {
    while (this.hazardMarkers.length < list.length) {
      this.hazardMarkers.push(this.add.image(0, 0, 'mine').setDepth(3));
    }
    for (let i = 0; i < this.hazardMarkers.length; i++) {
      const m = this.hazardMarkers[i];
      if (i >= list.length) { m.setVisible(false); continue; }
      const h = list[i];
      const telegraphing = now < h.activeAt;
      const molten = h.type === 'lava' || h.type === 'fire';
      const toxic = h.type === 'toxic';
      const texKey = telegraphing ? 'mine' : (molten ? 'pool_lava' : toxic ? 'pool_toxic' : 'mine');
      if (m.texture.key !== texKey) m.setTexture(texKey);
      m.setVisible(true).setPosition(h.x, h.y);
      if (telegraphing) {
        const blink = Math.sin(now * 0.02) > 0 ? 1 : 0.3;
        const base = Phaser.Math.Clamp(h.r / 34, 0.7, 1.9);
        m.setAlpha(blink).setScale(base * (1 + 0.06 * Math.sin(now * 0.012))).setTint(0xffd0d0);
      } else if (molten || toxic) {
        // les textures de flaque font 112 px : on les met à l'échelle du rayon.
        const s = (h.r * 2.1) / 112;
        m.setAlpha(0.9).clearTint().setScale(s * (1 + 0.03 * Math.sin(now * 0.006)));
      } else {
        const base = Phaser.Math.Clamp(h.r / 34, 0.7, 1.9);
        m.setAlpha(0.7 + 0.3 * Math.abs(Math.sin(now * 0.008))).setTint(0xffffff)
          .setScale(base * (1 + 0.06 * Math.sin(now * 0.012)));
      }
    }
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
      onComplete: () => { g.destroy(); if (this.combatActive) cb(); },
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
    if (this.combatActive && this.player && !this.player.dead && Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y) <= r) {
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
      if (!this.combatActive) { rect.destroy(); return; }
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

  /**
   * Coup de sabre spectral porté par le clone d'ombre : croissant visible à la
   * position du clone + dégâts d'arc aux ennemis proches dans la direction visée.
   */
  spectralSlash(cx: number, cy: number, aimAngle: number, range: number, damage: number): void {
    const span = 1.1, col = 0x9a5cff;
    const g = this.add.graphics().setDepth(22);
    g.lineStyle(14, col, 0.55);
    g.beginPath(); g.arc(cx, cy, range * 0.85, aimAngle - span, aimAngle + span, false); g.strokePath();
    g.lineStyle(5, 0xe0c8ff, 0.9);
    g.beginPath(); g.arc(cx, cy, range * 0.85, aimAngle - span * 0.8, aimAngle + span * 0.8, false); g.strokePath();
    this.tweens.add({ targets: g, alpha: 0, duration: 240, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    for (const e of this.getTargets()) {
      if (!e.isAlive()) continue;
      const dx = e.x - cx, dy = e.y - cy;
      if (Math.hypot(dx, dy) > range) continue;
      const da = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - aimAngle);
      if (Math.abs(da) > span) continue;
      e.takeDamage(damage, cx, cy);
      this.juice.burst(e.x, e.y, col, 5, 120, 0.7);
    }
  }

  /**
   * Rasenshuriken : le shuriken de vent file du chaton vers la cible en
   * tournoyant, puis explose en dôme de vent (dégâts de zone).
   */
  rasenshuriken(sx: number, sy: number, tx: number, ty: number, damage: number, radius: number): void {
    // Le shuriken garde ses couleurs (blend normal) pour que ses lames restent
    // lisibles ; le halo ADD placé derrière fournit la lueur de chakra.
    const shu = this.add.sprite(sx, sy - 8, 'rasenshuriken').setDepth(25).setScale(1.3);
    const halo = this.add.image(sx, sy - 8, 'light').setTint(0x59c8ff).setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(24).setScale(0.9).setAlpha(0.55);
    this.tweens.add({ targets: shu, angle: 360, duration: 140, repeat: -1, ease: 'Linear' });
    const fly = 260;
    this.tweens.add({ targets: [shu, halo], x: tx, y: ty - 8, duration: fly, ease: 'Quad.easeIn' });
    this.tweens.add({ targets: shu, scale: 2.1, duration: fly, ease: 'Quad.easeIn' });
    this.sfx('rasengan');
    // petites traînées de vent pendant le vol
    for (let k = 1; k <= 4; k++) {
      this.time.delayedCall((fly / 5) * k, () => this.juice.burst(shu.x, shu.y, 0xbff7f6, 4, 90, 0.6));
    }
    this.time.delayedCall(fly, () => {
      if (this.roomState === 'over') { shu.destroy(); halo.destroy(); return; }
      // dôme de vent : anneaux concentriques + explosion
      this.juice.spiral(tx, ty, 0xbff7f6, radius);
      this.juice.ring(tx, ty, radius, 0xdfffff, 320);
      this.juice.ring(tx, ty, radius * 0.6, 0x8fe8ff, 260);
      this.explosionAt(tx, ty, radius, damage);
      this.sfx('rasengan');
      this.juice.shake(220, 0.01);
      this.tweens.add({ targets: shu, scale: 3.4, alpha: 0, angle: shu.angle + 180, duration: 260, onComplete: () => shu.destroy() });
      this.tweens.add({ targets: halo, scale: 2.4, alpha: 0, duration: 260, onComplete: () => halo.destroy() });
    });
  }

  /**
   * Koji Bond : à chaque frappe, un petit laser ricoche sur TOUS les monstres de
   * la zone, chacun subissant 5% des dégâts infligés. VFX limité pour rester fluide.
   */
  kojiLaser(x: number, y: number, damage: number): void {
    const lz = Math.max(1, Math.round(damage * 0.05));
    const targets = this.getTargets().filter((e) => e.isAlive());
    if (!targets.length) return;
    // Chaîne de ricochet par proximité (départ = monstre frappé).
    let cx = x, cy = y;
    const remaining = targets.slice();
    const path: IEnemyLike[] = [];
    while (remaining.length) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = Phaser.Math.Distance.Between(cx, cy, remaining[i].x, remaining[i].y);
        if (d < bd) { bd = d; bi = i; }
      }
      const t = remaining.splice(bi, 1)[0];
      path.push(t); cx = t.x; cy = t.y;
    }
    // Dégâts à tous (silencieux : pas de nombres/sfx en cascade).
    for (const t of path) t.takeDamage(lz, x, y, { silent: true });
    // VFX ricochet throttlé (les frappes sont fréquentes).
    const now = performance.now();
    if (now - this._kojiVfxAt > 55) {
      this._kojiVfxAt = now;
      const g = this.add.graphics().setDepth(46);
      let px = x, py = y - 6;
      const hops = path.slice(0, 8); // limite visuelle
      for (const t of hops) {
        g.lineStyle(4, 0xff2a5a, 0.25).lineBetween(px, py, t.x, t.y - 6);
        g.lineStyle(1.5, 0xff9db8, 0.95).lineBetween(px, py, t.x, t.y - 6);
        this.juice.burst(t.x, t.y - 6, 0xff5a8a, 3, 80, 0.5);
        px = t.x; py = t.y - 6;
      }
      this.sfx('zap');
      this.tweens.add({ targets: g, alpha: 0, duration: 200, ease: 'Cubic.easeIn', onComplete: () => g.destroy() });
    }
  }
  private _kojiVfxAt = 0;

  /** Onde tranchante (Getsuga / clone) : projectile allié qui transperce. */
  slashWave(x: number, y: number, dx: number, dy: number, damage: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len, ny = dy / len;
    const s = this.add.sprite(x, y, 'orb_big').setDepth(18).setTint(0x9fe6ff);
    s.setScale(2.4, 0.9).setRotation(Math.atan2(ny, nx));
    this.friendlyShots.push({ sprite: s, vx: nx * 520, vy: ny * 520, damage, dieAt: performance.now() + 700, hit: new Set(), pierce: true });
    this.sfx('sword');
  }

  /** Projectile allié générique (toile, poing, boomerang, cartes…). */
  friendlyShot(x: number, y: number, dx: number, dy: number, speed: number, damage: number, opts?: { color?: number; pierce?: boolean; immobilizeMs?: number; knockback?: number; texture?: string; orient?: boolean; scale?: number }): void {
    const len = Math.hypot(dx, dy) || 1; const nx = dx / len, ny = dy / len;
    const col = opts?.color ?? 0xffffff;
    const tex = opts?.texture ?? 'orb';
    const s = this.add.sprite(x, y, tex).setDepth(18).setScale(opts?.scale ?? 1.4);
    // Sprite dédié (patte de chat…) : garde ses couleurs ; sinon on teinte l'orbe.
    if (opts?.texture) { if (opts.color) s.setTint(col); } else s.setTint(col);
    if (opts?.orient) s.setRotation(Math.atan2(ny, nx)); else s.setRotation(Math.atan2(ny, nx));
    if (opts?.texture) { this.tweens.add({ targets: s, angle: s.angle + 720, duration: 600, repeat: -1 }); }
    this.friendlyShots.push({ sprite: s, vx: nx * speed, vy: ny * speed, damage, dieAt: performance.now() + 900, hit: new Set(), pierce: !!opts?.pierce, immobilizeMs: opts?.immobilizeMs, knockback: opts?.knockback, color: col });
  }

  /**
   * Boon Lame Boomerang : lance un boomerang qui part en ligne droite puis
   * REVIENT vers le joueur — il inflige des dégâts à l'aller ET au retour.
   */
  boomerang(x: number, y: number, dx: number, dy: number, damage: number): void {
    const len = Math.hypot(dx, dy) || 1; const nx = dx / len, ny = dy / len;
    const reach = 300;
    const tx = Phaser.Math.Clamp(x + nx * reach, ARENA.x + 20, ARENA.x + ARENA.w - 20);
    const ty = Phaser.Math.Clamp(y + ny * reach, ARENA.y + 20, ARENA.y + ARENA.h - 20);
    const s = this.add.sprite(x, y, 'boomerang').setDepth(19).setScale(1.6);
    this.tweens.add({ targets: s, angle: 360, duration: 260, repeat: -1 });
    let hit = new Set<IEnemyLike>();
    const touch = () => {
      if (!this.combatActive) return;
      for (const e of this.getTargets()) {
        if (!e.isAlive() || hit.has(e)) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) <= 30) { hit.add(e); e.takeDamage(damage, s.x, s.y); this.juice.burst(e.x, e.y, 0xf4d98a, 5, 120, 0.8); }
      }
    };
    // Aller
    this.tweens.add({
      targets: s, x: tx, y: ty, duration: 340, ease: 'Sine.easeOut',
      onUpdate: touch,
      onComplete: () => {
        hit = new Set(); // le retour peut re-toucher les mêmes ennemis
        // Retour : revient vers la position ACTUELLE du joueur.
        const p = this.player;
        const rx = p && !p.dead ? p.x : x, ry = p && !p.dead ? p.y : y;
        this.tweens.add({
          targets: s, x: rx, y: ry, duration: 360, ease: 'Sine.easeIn',
          onUpdate: touch,
          onComplete: () => s.destroy(),
        });
      },
    });
    this.sfx('slash2');
  }

  /**
   * Tornade du boon Dernier Souffle : lancée au 3e coup du combo, elle file en
   * ligne droite en malmenant les ennemis traversés, puis EXPLOSE à l'arrivée
   * (gerbe de vent + dégâts de zone).
   */
  tornado(x: number, y: number, dx: number, dy: number, damage: number): void {
    const len = Math.hypot(dx, dy) || 1; const nx = dx / len, ny = dy / len;
    const range = 300;
    const tx = Phaser.Math.Clamp(x + nx * range, ARENA.x + 24, ARENA.x + ARENA.w - 24);
    const ty = Phaser.Math.Clamp(y + ny * range, ARENA.y + 24, ARENA.y + ARENA.h - 24);
    const s = this.add.sprite(x, y, 'tornado').setDepth(20).setScale(1.4);
    this.tweens.add({ targets: s, angle: 360, duration: 260, repeat: -1 });
    this.tweens.add({ targets: s, scaleX: 1.75, duration: 150, yoyo: true, repeat: -1 });
    const hit = new Set<IEnemyLike>();
    const dur = 440;
    this.tweens.add({
      targets: s, x: tx, y: ty, duration: dur, ease: 'Sine.easeOut',
      onUpdate: () => {
        if (!this.combatActive) return;
        for (const e of this.getTargets()) {
          if (!e.isAlive() || hit.has(e)) continue;
          if (Math.hypot(e.x - s.x, e.y - s.y) <= 34) {
            hit.add(e);
            e.takeDamage(damage, s.x, s.y);
            const anyE = e as unknown as { body?: Phaser.Physics.Arcade.Body };
            if (anyE.body) { anyE.body.velocity.x += nx * 140; anyE.body.velocity.y += ny * 140; }
            this.juice.burst(e.x, e.y, 0xbfe6ff, 5, 120, 0.8);
          }
        }
      },
      onComplete: () => {
        // EXPLOSION à l'arrivée : bourrasque circulaire + dégâts de zone.
        const ex = s.x, ey = s.y;
        this.juice.ring(ex, ey, 82, 0x9fd6f0, 320);
        this.juice.burst(ex, ey, 0xbfe6ff, 22, 280, 1.7);
        this.juice.shake(120, 0.006);
        this.sfx('slashfin');
        const puff = this.add.particles(ex, ey, 'frost', {
          speed: { min: 60, max: 240 }, scale: { start: 1.4, end: 0 }, lifespan: 460,
          quantity: 18, tint: 0xbfe6ff, blendMode: 'ADD', emitting: false,
        }).setDepth(28);
        puff.explode(18);
        this.time.delayedCall(500, () => puff.destroy());
        if (this.combatActive) {
          for (const e of this.getTargets()) {
            if (e.isAlive() && Math.hypot(e.x - ex, e.y - ey) <= 82) e.takeDamage(Math.round(damage * 1.2), ex, ey);
          }
        }
        s.destroy();
      },
    });
  }

  /**
   * Grosse tornade de feu d'Ignis : télégraphie une ligne droite passant par la
   * position du joueur (angle libre), puis une tornade traverse TOUTE la map le
   * long de cette ligne en infligeant des dégâts. Traînée d'étincelles.
   */
  fireTornado(px: number, py: number, angle: number, damage: number, telegraph = 700): void {
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const D = Math.hypot(ARENA.w, ARENA.h) * 0.62;
    const sx = px - nx * D, sy = py - ny * D;
    const tx = px + nx * D, ty = py + ny * D;
    // Télégraphe : trait large qui pulse le long de la trajectoire.
    const g = this.add.graphics().setDepth(19);
    let tt = 0;
    const ev = this.time.addEvent({ delay: 40, loop: true, callback: () => {
      tt += 40; const a = 0.3 + 0.22 * Math.sin(tt / 70);
      g.clear();
      g.lineStyle(48, 0xff4410, a * 0.4); g.lineBetween(sx, sy, tx, ty);
      g.lineStyle(18, 0xffb020, a); g.lineBetween(sx, sy, tx, ty);
    } });
    this.sfx('bosscast');
    this.time.delayedCall(telegraph, () => {
      ev.remove(); g.destroy();
      const s = this.add.sprite(sx, sy, 'fire_tornado').setDepth(22).setScale(1.7);
      this.tweens.add({ targets: s, angle: 360, duration: 220, repeat: -1 });
      this.tweens.add({ targets: s, scaleX: 2.15, duration: 150, yoyo: true, repeat: -1 });
      const emit = this.add.particles(0, 0, 'px', {
        follow: s, speed: { min: 20, max: 130 }, scale: { start: 2.2, end: 0 },
        lifespan: 420, quantity: 3, tint: [0xff6a1f, 0xffb020, 0xfff2c0], blendMode: 'ADD',
      }).setDepth(21);
      const speed = 540; const dur = (Math.hypot(tx - sx, ty - sy) / speed) * 1000;
      let hitAt = 0;
      this.tweens.add({
        targets: s, x: tx, y: ty, duration: dur, ease: 'Linear',
        onUpdate: () => {
          const now = performance.now();
          const pl = this.player;
          if (this.combatActive && pl && !pl.dead && now - hitAt > 400 && Math.hypot(pl.x - s.x, pl.y - s.y) < 40) {
            hitAt = now; pl.takeDamage(damage, s.x, s.y);
          }
        },
        onComplete: () => { emit.destroy(); this.juice.burst(s.x, s.y, 0xff8a3a, 16, 240, 1.5); s.destroy(); },
      });
      this.sfx('bosscharge');
      this.juice.shake(160, 0.006);
    });
  }

  /**
   * Énorme tornade qui BALAIE tout l'écran d'un bord à l'autre : un mur de
   * tornades traverse l'arène, à esquiver OBLIGATOIREMENT au dash (i-frames).
   * Télégraphie le bord d'arrivée avant de déferler.
   */
  bossTornadoSweep(damage: number, telegraph = 800): void {
    const A = ARENA;
    const horizontal = Math.random() < 0.5;
    const forward = Math.random() < 0.5;
    const startC = horizontal ? (forward ? A.x - 20 : A.x + A.w + 20) : (forward ? A.y - 20 : A.y + A.h + 20);
    const endC = horizontal ? (forward ? A.x + A.w + 20 : A.x - 20) : (forward ? A.y + A.h + 20 : A.y - 20);
    const perpMin = horizontal ? A.y + 24 : A.x + 24;
    const perpMax = horizontal ? A.y + A.h - 24 : A.x + A.w - 24;
    // Télégraphe : flèche/mur clignotant au bord de départ.
    const tel = this.add.graphics().setDepth(19);
    let tt = 0;
    const telEv = this.time.addEvent({ delay: 45, loop: true, callback: () => {
      tt += 45; const a = 0.3 + 0.25 * Math.sin(tt / 80);
      tel.clear();
      tel.fillStyle(0x7fdcff, a * 0.35);
      if (horizontal) tel.fillRect(startC - 26, A.y, 52, A.h); else tel.fillRect(A.x, startC - 26, A.w, 52);
    } });
    this.sfx('bosscast');
    this.time.delayedCall(telegraph, () => {
      telEv.remove(); tel.destroy();
      const count = 8;
      const sprites: Phaser.GameObjects.Sprite[] = [];
      for (let k = 0; k < count; k++) {
        const perp = Phaser.Math.Linear(perpMin, perpMax, k / (count - 1));
        const s = this.add.sprite(horizontal ? startC : perp, horizontal ? perp : startC, 'tornado')
          .setDepth(23).setScale(2.6).setTint(0xaee8ff);
        this.tweens.add({ targets: s, angle: 360, duration: 280, repeat: -1 });
        this.tweens.add({ targets: s, scaleX: 3.1, duration: 160, yoyo: true, repeat: -1 });
        sprites.push(s);
      }
      this.sfx('bosscharge');
      const band = 52;
      let hitAt = 0;
      this.tweens.addCounter({
        from: startC, to: endC, duration: 1600, ease: 'Sine.easeInOut',
        onUpdate: (tw) => {
          const cur = tw.getValue() ?? endC;
          for (const s of sprites) { if (horizontal) s.x = cur; else s.y = cur; }
          const pl = this.player; const now = performance.now();
          if (this.combatActive && pl && !pl.dead && now - hitAt > 300) {
            const pc = horizontal ? pl.x : pl.y;
            if (Math.abs(pc - cur) < band) { hitAt = now; pl.takeDamage(damage, pl.x, pl.y); }
          }
        },
        onComplete: () => { sprites.forEach((s) => s.destroy()); },
      });
    });
  }

  /** Signature d'Ignis : 5 tornades de feu venant de 5 directions (intervalle 0,2 s). */
  fireTornadoStorm(px: number, py: number, damage: number): void {
    const off = Math.random() * Math.PI;
    for (let k = 0; k < 5; k++) {
      const angle = off + (k / 5) * Math.PI * 2;
      this.time.delayedCall(k * 200, () => {
        if (this.combatActive) this.fireTornado(px, py, angle, damage, 620);
      });
    }
  }

  /** Aspire un ennemi vers un point et l'étourdit brièvement (Gomme élastique). */
  pullEnemy(e: IEnemyLike, tx: number, ty: number, stunMs: number): void {
    const anyE = e as unknown as { applySlow?: (f: number, ms: number) => void; setPosition?: (x: number, y: number) => void; x: number; y: number };
    const nx = tx - anyE.x, ny = ty - anyE.y, d = Math.hypot(nx, ny) || 1;
    const step = Math.min(d, 90);
    anyE.setPosition?.(anyE.x + (nx / d) * step, anyE.y + (ny / d) * step);
    anyE.applySlow?.(0.05, stunMs);
    this.juice.burst(anyE.x, anyE.y, 0xff9db0, 8, 140, 0.9);
  }

  /** Rayon frontal balayable (Kamehameha) : dégâts en ligne pendant `ms`. */
  beamSweep(x: number, y: number, dx: number, dy: number, dmgPerTick: number, ms: number, color: number): void {
    const player = this.player;
    let elapsed = 0; const interval = 120;
    const gfx = this.add.graphics().setDepth(46);
    const tick = this.time.addEvent({ delay: interval, loop: true, callback: () => {
      elapsed += interval;
      if (!player || player.dead || elapsed >= ms) { gfx.destroy(); tick.remove(); return; }
      const a = player.aimAngle();
      const ex = player.x + Math.cos(a) * 900, ey = player.y + Math.sin(a) * 900;
      gfx.clear();
      gfx.lineStyle(70, color, 0.25); gfx.lineBetween(player.x, player.y, ex, ey);
      gfx.lineStyle(30, 0xffffff, 0.5); gfx.lineBetween(player.x, player.y, ex, ey);
      // dégâts en ligne
      const nx = Math.cos(a), ny = Math.sin(a);
      for (const e of this.getTargets()) {
        if (!e.isAlive()) continue;
        const t = Phaser.Math.Clamp((e.x - player.x) * nx + (e.y - player.y) * ny, 0, 900);
        const px = player.x + nx * t, py = player.y + ny * t;
        if (Math.hypot(e.x - px, e.y - py) <= 45) e.takeDamage(dmgPerTick, player.x, player.y);
      }
      this.juice.shake(60, 0.004);
    } });
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
    this.sfx('domain');
    for (const e of this.getTargets()) {
      if (e.isAlive() && Phaser.Math.Distance.Between(x, y, e.x, e.y) <= radius) e.takeDamage(Math.round(damage), x, y);
    }
  }

  /** THE WORLD — arrêt du temps : animation complète (désaturation, horloge, ondes). */
  timeSlow(ms: number, factor: number): void {
    this.enemyTimeScale = factor;
    this.enemyTimeScaleUntil = performance.now() + ms;
    const cx = WORLD_WIDTH / 2, cy = WORLD_HEIGHT / 2;
    AudioManager.play('timestop');
    this.juice.shake(220, 0.01);

    // voile indigo qui fige le monde (sauf le joueur, rendu au-dessus)
    const veil = this.add.rectangle(cx, cy, WORLD_WIDTH, WORLD_HEIGHT, 0x1a1030, 0).setDepth(40);
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

  /** Déluge : couvre l'arène de danger sauf quelques zones sûres (Gobu Géant). */
  floodArena(safeCount: number, safeR: number, telegraph: number, damage: number, hazard: HazardType, color: number): void {
    const safe: { x: number; y: number }[] = [];
    for (let i = 0; i < safeCount; i++) safe.push(this.arenaPoint(safeR + 30));
    const g = this.add.graphics().setDepth(4);
    this.tweens.addCounter({
      from: 0, to: 1, duration: telegraph,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        g.clear();
        g.fillStyle(color, 0.18 + 0.14 * v);
        g.fillRect(ARENA.x, ARENA.y, ARENA.w, ARENA.h);
        for (const s of safe) {
          g.fillStyle(0x6ad46a, 0.28); g.fillCircle(s.x, s.y, safeR);
          g.lineStyle(3, 0xbfffbf, 0.9); g.strokeCircle(s.x, s.y, safeR);
        }
      },
      onComplete: () => {
        g.destroy();
        if (!this.combatActive) return;
        this.juice.shake(280, 0.012);
        this.sfx('special');
        const p = this.player;
        if (p && !p.dead) {
          const inSafe = safe.some((s) => Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) < safeR);
          if (!inSafe) p.takeDamage(damage, p.x, p.y);
        }
        // boue résiduelle partout sauf zones sûres
        for (let gx = ARENA.x + 60; gx < ARENA.x + ARENA.w - 40; gx += 110) {
          for (let gy = ARENA.y + 60; gy < ARENA.y + ARENA.h - 40; gy += 110) {
            if (safe.some((s) => Phaser.Math.Distance.Between(gx, gy, s.x, s.y) < safeR + 30)) continue;
            this.spawnHazardZone(gx, gy, 58, hazard, 0, 2200);
          }
        }
      },
    });
  }

  /** Glyphe explosif au sol (Archimage) : rune tournante télégraphiée puis explosion. */
  glyph(x: number, y: number, r: number, color: number, telegraph: number, damage: number): void {
    const g = this.add.graphics().setDepth(4);
    this.tweens.addCounter({
      from: 0, to: 1, duration: telegraph,
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        const rot = v * Math.PI * 3;
        g.clear();
        g.fillStyle(color, 0.1 + 0.14 * v); g.fillCircle(x, y, r * (0.4 + 0.6 * v));
        g.lineStyle(2.5, color, 0.8); g.strokeCircle(x, y, r);
        g.lineStyle(2, 0xffffff, 0.5); g.strokeCircle(x, y, r * 0.6);
        for (let k = 0; k < 6; k++) {
          const a = rot + (k / 6) * Math.PI * 2;
          g.lineBetween(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
        }
      },
      onComplete: () => { g.destroy(); if (this.combatActive) this.eruptAt(x, y, r, color, damage); },
    });
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
          this.juice.burst(sh.sprite.x, sh.sprite.y, sh.color ?? 0x9fe6ff, 5, 120, 0.8);
          const anyE = e as unknown as { applySlow?: (f: number, ms: number) => void; body?: Phaser.Physics.Arcade.Body };
          if (sh.immobilizeMs && anyE.applySlow) anyE.applySlow(0.05, sh.immobilizeMs);
          if (sh.knockback && anyE.body) { const a = Math.atan2(sh.vy, sh.vx); anyE.body.velocity.x += Math.cos(a) * sh.knockback; anyE.body.velocity.y += Math.sin(a) * sh.knockback; }
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
    // (Plus d'ouverture automatique des compétences : le joueur clique le bouton.)
    if (this.player && !this.player.dead) this.player.update(time, delta);

    // ambiance : lumière + ombres portées
    if (this.player) {
      const ents: { x: number; y: number; displayHeight: number; scaleX: number }[] = [];
      for (const e of this.activeEnemies) if (e.isAlive()) ents.push(e);
      if (this.boss?.isAlive()) ents.push(this.boss);
      for (const rb of this.rageBosses) if (rb !== this.boss && rb.isAlive()) ents.push(rb);
      this.env.update(this.player.x, this.player.y, ents);
    }
    // Round enragé : jauge de boss = PV cumulés des 3 clones.
    if (this.rageActive) {
      let hp = 0;
      for (const rb of this.rageBosses) if (rb.isAlive()) hp += rb.hp;
      this.events.emit('bossHp', hp, this.rageMaxTotal);
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
    this.updateSouls();
    this.updateMaterialPickups();
    if (this.finalActive) { this.updateBossMines(now); this.clampFinalArena(); }

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
