import Phaser from 'phaser';
import { POWERS, RARITY_WEIGHTS, RARITY_RANK, type PowerDef, type Rarity } from '../config/powers';
import { RunState } from './RunState';
import { SaveSystem } from './SaveSystem';

/**
 * Tire `count` pouvoirs distincts, pondérés par rareté (+ chance).
 * Aucun doublon : un boon déjà obtenu n'est jamais reproposé.
 * `minRarity` impose une rareté minimale (boons du marchand = rare ou +).
 */
export function rollChoices(count: number, luck: number, minRarity: Rarity = 'common'): PowerDef[] {
  const arsenal = SaveSystem.hasFlag('arsenal');
  const takenIds = new Set(RunState.powers.map((p) => p.id));
  const minRank = RARITY_RANK[minRarity];

  const eligible = POWERS.filter((p) => {
    if (p.locked && !arsenal) return false;
    if (takenIds.has(p.id)) return false;       // jamais deux fois le même boon
    if (RARITY_RANK[p.rarity] < minRank) return false; // rareté minimale
    return true;
  });

  // poids ajustés : la chance déplace la masse vers rare/épique/légendaire
  const weights: Record<Rarity, number> = {
    common: Math.max(5, RARITY_WEIGHTS.common * (1 - luck)),
    rare: RARITY_WEIGHTS.rare * (1 + luck),
    epic: RARITY_WEIGHTS.epic * (1 + luck * 1.5),
    legendary: RARITY_WEIGHTS.legendary * (1 + luck * 2),
  };

  const chosen: PowerDef[] = [];
  const pool = [...eligible];
  for (let i = 0; i < count && pool.length > 0; i++) {
    // choisir une rareté disponible
    const available = new Set(pool.map((p) => p.rarity));
    let totalW = 0;
    for (const r of available) totalW += weights[r];
    let roll = Math.random() * totalW;
    let pickedRarity: Rarity = 'common';
    for (const r of available) { roll -= weights[r]; if (roll <= 0) { pickedRarity = r; break; } }
    const byRarity = pool.filter((p) => p.rarity === pickedRarity);
    const pick = Phaser.Utils.Array.GetRandom(byRarity);
    chosen.push(pick);
    Phaser.Utils.Array.Remove(pool, pick);
  }
  return chosen;
}
