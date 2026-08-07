import type { PlayerStats } from './game';

export type OnHitFn = (target: IEnemyLike, damage: number, isCrit: boolean) => void;
export type OnKillFn = (target: IEnemyLike) => void;
export type VoidFn = () => void;

/** Ce qu'un pouvoir peut manipuler à l'exécution (implémenté par Player). */
export interface IPlayerContext {
  stats: PlayerStats;
  heal(amount: number): void;
  grantMaxShield(amount: number): void;
  addOnHit(fn: OnHitFn): void;
  addOnKill(fn: OnKillFn): void;
  addOnDash(fn: VoidFn): void;
  addOnRoomClear(fn: VoidFn): void;
  addComboHit(): void; // +1 coup au combo épée
}

/** Vue minimale d'un ennemi exposée aux hooks de pouvoirs. */
export interface IEnemyLike {
  x: number;
  y: number;
  takeDamage(amount: number, fromX: number, fromY: number, opts?: { silent?: boolean }): void;
  applyStatus(status: 'bleed' | 'freeze' | 'poison', duration: number): void;
  isAlive(): boolean;
}
