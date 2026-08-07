export interface Difficulty {
  id: string;
  name: string;
  enemyHp: number;
  enemyDamage: number;
  waveDensity: number; // multiplicateur du nombre d'ennemis
  reward: number;
  color: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: 'easy', name: 'Facile', enemyHp: 0.8, enemyDamage: 0.7, waveDensity: 0.85, reward: 0.8, color: 0x6ad46a },
  { id: 'normal', name: 'Normal', enemyHp: 1.0, enemyDamage: 1.0, waveDensity: 1.0, reward: 1.0, color: 0x59a8ff },
  { id: 'hard', name: 'Difficile', enemyHp: 1.3, enemyDamage: 1.3, waveDensity: 1.2, reward: 1.3, color: 0xff8f3f },
  { id: 'extreme', name: 'Extrême', enemyHp: 1.6, enemyDamage: 1.6, waveDensity: 1.45, reward: 1.6, color: 0xe8384f },
];

export function getDifficulty(id: string): Difficulty {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1];
}
