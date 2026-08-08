export interface Difficulty {
  id: string;
  name: string;
  enemyHp: number;
  enemyDamage: number;
  enemySpeed: number;       // multiplicateur de vitesse de déplacement des monstres
  enemyAttackSpeed: number; // multiplicateur de cadence d'attaque (télégraphes + CD)
  waveDensity: number; // multiplicateur du nombre d'ennemis
  reward: number;
  color: number;
}

// Le Normal est la référence (×1) : le tableau des PV de boss correspond au Normal.
// Facile 0,8 · Normal 1 · Difficile 1,3 · Extrême 1,5 (PV et Gain identiques).
export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: 'Facile', enemyHp: 0.8, enemyDamage: 0.8, enemySpeed: 0.85, enemyAttackSpeed: 0.85, waveDensity: 0.85, reward: 0.8, color: 0x6ad46a },
  { id: 'normal', name: 'Normal', enemyHp: 1.0, enemyDamage: 1.0, enemySpeed: 1.0, enemyAttackSpeed: 1.0, waveDensity: 1.0, reward: 1.0, color: 0x59a8ff },
  { id: 'hard', name: 'Difficile', enemyHp: 1.3, enemyDamage: 1.3, enemySpeed: 1.2, enemyAttackSpeed: 1.25, waveDensity: 1.2, reward: 1.3, color: 0xff8f3f },
  { id: 'extreme', name: 'Extrême', enemyHp: 1.5, enemyDamage: 1.5, enemySpeed: 1.4, enemyAttackSpeed: 1.5, waveDensity: 1.4, reward: 1.5, color: 0xe8384f },
];

export function getDifficulty(id: string): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
