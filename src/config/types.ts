import type { PlayerStats } from './game';

/** Éléments/statuts appliqués aux ennemis (base des réactions de combo). */
export type Element = 'shock' | 'burn' | 'freeze' | 'poison' | 'bleed' | 'mark';

export type OnHitFn = (target: IEnemyLike, damage: number, isCrit: boolean) => void;
export type OnKillFn = (target: IEnemyLike) => void;
export type VoidFn = () => void;

/** Drapeaux modifiant le Spécial et le Dash (boons divins). */
export type SpecialFlag = 'wave' | 'explosion' | 'timestop' | 'bigger';
export type DashFlag = 'shock' | 'burst' | 'clone';

/** Helpers de combat exposés par GameScene aux boons (effets actifs). */
export interface ICombatScene {
  lightningChain(x: number, y: number, damage: number, jumps: number): void;
  slashWave(x: number, y: number, dx: number, dy: number, damage: number): void;
  explosionAt(x: number, y: number, radius: number, damage: number): void;
  timeSlow(ms: number, factor: number): void;
  domainPulse(damage: number, radius: number): void;
  spawnClone(ms: number): void;
  getTargets(): IEnemyLike[];
  enemiesNear(x: number, y: number, r: number): IEnemyLike[];
  playerX(): number;
  playerY(): number;
}

/** Ce qu'un pouvoir/boon peut manipuler à l'exécution (implémenté par Player). */
export interface IPlayerContext {
  stats: PlayerStats;
  combat: ICombatScene;
  heal(amount: number): void;
  grantMaxShield(amount: number): void;
  addOnHit(fn: OnHitFn): void;
  addOnKill(fn: OnKillFn): void;
  addOnDash(fn: VoidFn): void;
  addOnRoomClear(fn: VoidFn): void;
  addComboHit(): void;
  /** effet récurrent (clone, domaine, lames orbitales…). */
  addPeriodic(intervalMs: number, fn: VoidFn): void;
  addSpecialFlag(flag: SpecialFlag): void;
  addDashFlag(flag: DashFlag): void;
}

/** Vue minimale d'un ennemi exposée aux hooks/boons. */
export interface IEnemyLike {
  x: number;
  y: number;
  takeDamage(amount: number, fromX: number, fromY: number, opts?: { silent?: boolean }): void;
  applyStatus(status: Element, duration: number): void;
  isAlive(): boolean;
  isBoss?: boolean;
}
