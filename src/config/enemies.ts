export type Behavior = 'chaser' | 'charger' | 'shooter' | 'exploder' | 'tank' | 'summoner';

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string; // clé pixel art
  behavior: Behavior;
  hp: number;
  speed: number;
  damage: number;
  scale: number; // multiplicateur de taille de rendu
  /** paramètres d'attaque selon le comportement */
  attack?: {
    telegraph?: number; // ms de signal avant impact
    cooldown?: number; // ms entre attaques
    range?: number; // portée d'engagement (shooter/charger)
    projectileSpeed?: number;
    projectileDamage?: number;
    chargeSpeed?: number;
    explodeRadius?: number;
    status?: 'poison' | 'freeze';
    summonId?: string;
    summonCount?: number;
  };
}

export const ENEMIES: Record<string, EnemyDef> = {
  // ---- Forêt des Ronces ----
  slime: {
    id: 'slime', name: 'Slime Gluant', sprite: 'slime', behavior: 'chaser',
    hp: 22, speed: 78, damage: 8, scale: 1,
    attack: { cooldown: 900 },
  },
  champignon: {
    id: 'champignon', name: 'Champignon Bondissant', sprite: 'champignon', behavior: 'exploder',
    hp: 26, speed: 96, damage: 14, scale: 1,
    attack: { telegraph: 650, explodeRadius: 70, cooldown: 0 },
  },
  chauvesouris: {
    id: 'chauvesouris', name: 'Chauve-souris', sprite: 'chauvesouris', behavior: 'shooter',
    hp: 16, speed: 110, damage: 6, scale: 0.85,
    attack: { telegraph: 500, cooldown: 1800, range: 260, projectileSpeed: 200, projectileDamage: 8 },
  },
  // ---- Marais Putrides ----
  gobelin: {
    id: 'gobelin', name: 'Gobelin Vaseux', sprite: 'gobelin', behavior: 'chaser',
    hp: 34, speed: 88, damage: 10, scale: 1,
    attack: { cooldown: 800 },
  },
  crapaud: {
    id: 'crapaud', name: 'Crapaud Cracheur', sprite: 'crapaud', behavior: 'shooter',
    hp: 40, speed: 60, damage: 8, scale: 1.05,
    attack: { telegraph: 600, cooldown: 2000, range: 240, projectileSpeed: 170, projectileDamage: 10, status: 'poison' },
  },
  bulle: {
    id: 'bulle', name: 'Bulle de Gaz', sprite: 'bulle', behavior: 'exploder',
    hp: 18, speed: 70, damage: 16, scale: 1,
    attack: { telegraph: 700, explodeRadius: 85, status: 'poison' },
  },
  // ---- Forge de Braise ----
  diablotin: {
    id: 'diablotin', name: 'Diablotin de Feu', sprite: 'diablotin', behavior: 'chaser',
    hp: 30, speed: 120, damage: 11, scale: 0.9,
    attack: { cooldown: 700 },
  },
  chienlave: {
    id: 'chienlave', name: 'Chien de Lave', sprite: 'chienlave', behavior: 'charger',
    hp: 46, speed: 70, damage: 16, scale: 1.05,
    attack: { telegraph: 700, cooldown: 2400, range: 320, chargeSpeed: 460 },
  },
  armure: {
    id: 'armure', name: 'Armure Vivante', sprite: 'armure', behavior: 'tank',
    hp: 90, speed: 46, damage: 14, scale: 1.2,
    attack: { cooldown: 1200 },
  },
  // ---- Citadelle des Ombres ----
  fantome: {
    id: 'fantome', name: 'Fantôme', sprite: 'fantome', behavior: 'chaser',
    hp: 30, speed: 100, damage: 10, scale: 1,
    attack: { cooldown: 800 },
  },
  squelette: {
    id: 'squelette', name: 'Chevalier Squelette', sprite: 'squelette', behavior: 'charger',
    hp: 60, speed: 66, damage: 16, scale: 1.1,
    attack: { telegraph: 750, cooldown: 2600, range: 340, chargeSpeed: 420 },
  },
  sorcier: {
    id: 'sorcier', name: 'Sorcier d’Ombre', sprite: 'sorcier', behavior: 'summoner',
    hp: 48, speed: 70, damage: 10, scale: 1.05,
    attack: { telegraph: 700, cooldown: 3200, range: 300, projectileSpeed: 190, projectileDamage: 12, summonId: 'fantome', summonCount: 2 },
  },
};
