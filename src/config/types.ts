import type { PlayerStats } from './game';

/** Éléments/statuts appliqués aux ennemis (base des réactions de combo). */
export type Element = 'shock' | 'burn' | 'freeze' | 'poison' | 'bleed' | 'mark' | 'blackburn';

/** Infos de contexte d'un coup (combo). */
export interface HitInfo { finisher: boolean; first: boolean; index: number; }
export type OnHitFn = (target: IEnemyLike, damage: number, isCrit: boolean, info?: HitInfo) => void;
export type OnKillFn = (target: IEnemyLike) => void;
export type VoidFn = () => void;

/** Modificateurs temporaires (vitesse / dégâts / vitesse d'attaque). */
export interface BuffMods { spd?: number; dmg?: number; as?: number; }

/** Drapeaux modifiant le Spécial et le Dash (boons divins). */
export type SpecialFlag = 'wave' | 'explosion' | 'timestop' | 'bigger' | 'pika' | 'rasenshuriken' | 'kamehameha';
export type DashFlag = 'shock' | 'burst' | 'clone' | 'water' | 'thunder6' | 'kunai';

/** Helpers de combat exposés par GameScene aux boons (effets actifs). */
export interface ICombatScene {
  lightningChain(x: number, y: number, damage: number, jumps: number): void;
  slashWave(x: number, y: number, dx: number, dy: number, damage: number): void;
  explosionAt(x: number, y: number, radius: number, damage: number): void;
  shieldWave(x: number, y: number, radius: number, damage: number): void;
  timeSlow(ms: number, factor: number): void;
  domainPulse(damage: number, radius: number): void;
  spawnClone(ms: number): void;
  getTargets(): IEnemyLike[];
  enemiesNear(x: number, y: number, r: number): IEnemyLike[];
  playerX(): number;
  playerY(): number;
  beam(x1: number, y1: number, x2: number, y2: number, color: number): void;
  /** projectile allié (toile, poing, boomerang…). immobilizeMs > 0 fige la cible. */
  friendlyShot(x: number, y: number, dx: number, dy: number, speed: number, damage: number, opts?: { color?: number; pierce?: boolean; immobilizeMs?: number; knockback?: number; texture?: string; orient?: boolean; scale?: number }): void;
  tornado(x: number, y: number, dx: number, dy: number, damage: number): void;
  boomerang(x: number, y: number, dx: number, dy: number, damage: number): void;
  /** balaye un rayon frontal (Kamehameha) qui inflige des dégâts en ligne. */
  beamSweep(x: number, y: number, dx: number, dy: number, dmgPerTick: number, ms: number, color: number): void;
  /** aspire un ennemi vers un point (Gomme élastique). */
  pullEnemy(e: IEnemyLike, tx: number, ty: number, stunMs: number): void;
  /** Koji Bond : laser qui ricoche sur tous les monstres (5% des dégâts infligés). */
  kojiLaser(x: number, y: number, damage: number): void;
}

/** Ce qu'un pouvoir/boon peut manipuler à l'exécution (implémenté par Player). */
export interface IPlayerContext {
  stats: PlayerStats;
  combat: ICombatScene;
  /** Modificateurs libres lus en direct par le joueur (drapeaux/valeurs). */
  mods: Record<string, number>;
  /** Accumulateur de dégâts de la salle (Nettoyage Parfait), remis à zéro au départ. */
  roomDamageBonus: number;
  heal(amount: number): void;
  healUpTo(amount: number, frac: number): void;
  setHp(n: number): void;
  grantMaxShield(amount: number): void;
  addOnHit(fn: OnHitFn): void;
  addOnKill(fn: OnKillFn): void;
  addOnDash(fn: VoidFn): void;
  addOnRoomClear(fn: VoidFn): void;
  addOnRoomStart(fn: VoidFn): void;
  addComboHit(): void;
  /** effet récurrent (clone, domaine, lames orbitales…). */
  addPeriodic(intervalMs: number, fn: VoidFn): void;
  /** buff temporaire cumulable-par-clé (vitesse/dégâts/vitesse d'attaque). */
  addBuff(key: string, ms: number, mods: BuffMods): void;
  addSpecialFlag(flag: SpecialFlag): void;
  addDashFlag(flag: DashFlag): void;
  /**
   * Relance l'effet du Spécial (avec ses bonus), sans cooldown. `auto` = true
   * pour les relances automatiques (Sanctuaire de Sukuna) : celles-ci N'ACTIVENT
   * PAS l'arrêt du temps (The World), qui doit rester une action volontaire.
   */
  castSpecial(auto?: boolean): void;
  px(): number;
  py(): number;
  hpFrac(): number;
  inCombat(): boolean;
  /** Recalcule le nombre de charges de dash après un gain (+1 charge). */
  syncDashCharges(): void;
}

/** Vue minimale d'un ennemi exposée aux hooks/boons. */
export interface IEnemyLike {
  x: number;
  y: number;
  takeDamage(amount: number, fromX: number, fromY: number, opts?: { silent?: boolean; crit?: boolean }): void;
  applyStatus(status: Element, duration: number): void;
  isAlive(): boolean;
  isBoss?: boolean;
}
