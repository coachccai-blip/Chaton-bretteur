export type Behavior = 'chaser' | 'charger' | 'shooter' | 'exploder' | 'tank' | 'summoner' | 'healer' | 'shielder' | 'bomber' | 'bossheal';

/** Attaque signature d'un monstre (télégraphiée, esquive au skill). */
export interface EnemySignature {
  type: 'leap' | 'spinAoE' | 'spread' | 'lobPool' | 'blink' | 'castZone';
  telegraph: number;
  cooldown: number;
  damage: number;
  range?: number;   // portée d'engagement
  radius?: number;  // rayon d'impact / zone
  count?: number;   // projectiles
  speed?: number;   // vitesse projectile / bond
  hazard?: 'toxic' | 'lava'; // flaque laissée
  color?: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  behavior: Behavior;
  hp: number;
  speed: number;
  damage: number;
  scale: number;
  attack?: {
    telegraph?: number;
    cooldown?: number;
    range?: number;
    projectileSpeed?: number;
    projectileDamage?: number;
    chargeSpeed?: number;
    explodeRadius?: number;
    status?: 'poison' | 'freeze';
    summonId?: string;
    summonCount?: number;
  };
  signature?: EnemySignature;
}

export const ENEMIES: Record<string, EnemyDef> = {
  // ---- Forêt des Ronces ----
  slime: {
    id: 'slime', name: 'Slime Gluant', sprite: 'slime', behavior: 'chaser',
    hp: 30, speed: 82, damage: 11, scale: 1,
    attack: { cooldown: 900 },
    // Bond gluant : saute sur le joueur (ombre télégraphiée), impact de zone.
    signature: { type: 'leap', telegraph: 620, cooldown: 4200, damage: 14, range: 260, radius: 62, speed: 1, color: 0x6ad46a },
  },
  champignon: {
    id: 'champignon', name: 'Champignon Bondissant', sprite: 'champignon', behavior: 'exploder',
    hp: 30, speed: 100, damage: 16, scale: 1,
    attack: { telegraph: 650, explodeRadius: 74, cooldown: 0 },
    // Nuée de spores : à l'explosion, projette un anneau de spores.
    signature: { type: 'spread', telegraph: 200, cooldown: 99999, damage: 8, count: 8, speed: 150, color: 0x8fd94a },
  },
  chauvesouris: {
    id: 'chauvesouris', name: 'Chauve-souris', sprite: 'chauvesouris', behavior: 'shooter',
    hp: 20, speed: 116, damage: 8, scale: 0.85,
    attack: { telegraph: 500, cooldown: 1700, range: 260, projectileSpeed: 210, projectileDamage: 9 },
    // Cri sonique : triple salve en éventail.
    signature: { type: 'spread', telegraph: 520, cooldown: 3600, damage: 9, count: 3, speed: 230, range: 320, color: 0xb26bff },
  },
  // ---- Marais Putrides ----
  gobelin: {
    id: 'gobelin', name: 'Gobelin Vaseux', sprite: 'gobelin', behavior: 'chaser',
    hp: 44, speed: 92, damage: 13, scale: 1,
    attack: { cooldown: 800 },
    // Moulinet : quand il est proche, tournoie et frappe en cercle.
    signature: { type: 'spinAoE', telegraph: 560, cooldown: 3800, damage: 16, range: 90, radius: 76, color: 0xffd24a },
  },
  crapaud: {
    id: 'crapaud', name: 'Crapaud Cracheur', sprite: 'crapaud', behavior: 'shooter',
    hp: 52, speed: 62, damage: 10, scale: 1.05,
    attack: { telegraph: 600, cooldown: 1900, range: 240, projectileSpeed: 180, projectileDamage: 11, status: 'poison' },
    // Crachat corrosif : dépose une flaque toxique aux pieds du joueur.
    signature: { type: 'lobPool', telegraph: 640, cooldown: 4200, damage: 8, range: 300, radius: 50, hazard: 'toxic', color: 0x8fd94a },
  },
  bulle: {
    id: 'bulle', name: 'Bulle de Gaz', sprite: 'bulle', behavior: 'exploder',
    hp: 24, speed: 76, damage: 18, scale: 1,
    attack: { telegraph: 700, explodeRadius: 88, status: 'poison' },
    signature: { type: 'spread', telegraph: 200, cooldown: 99999, damage: 8, count: 6, speed: 130, color: 0x8fd94a },
  },
  // ---- Forge de Braise ----
  diablotin: {
    id: 'diablotin', name: 'Diablotin de Feu', sprite: 'diablotin', behavior: 'chaser',
    hp: 38, speed: 126, damage: 13, scale: 0.9,
    attack: { cooldown: 700 },
    // Salve ardente : crache 3 boules de feu en éventail.
    signature: { type: 'spread', telegraph: 480, cooldown: 3200, damage: 11, count: 3, speed: 250, range: 300, color: 0xff6a1f },
  },
  chienlave: {
    id: 'chienlave', name: 'Chien de Lave', sprite: 'chienlave', behavior: 'charger',
    hp: 58, speed: 72, damage: 18, scale: 1.05,
    attack: { telegraph: 680, cooldown: 2200, range: 320, chargeSpeed: 470 },
    // Bond incandescent : saut télégraphié laissant une flaque de lave.
    signature: { type: 'leap', telegraph: 640, cooldown: 4600, damage: 18, range: 300, radius: 66, speed: 1, hazard: 'lava', color: 0xff5a1f },
  },
  armure: {
    id: 'armure', name: 'Armure Vivante', sprite: 'armure', behavior: 'tank',
    hp: 120, speed: 48, damage: 16, scale: 1.2,
    attack: { cooldown: 1200 },
    // Coup de bouclier : moulinet de zone lent mais dévastateur.
    signature: { type: 'spinAoE', telegraph: 720, cooldown: 4200, damage: 22, range: 100, radius: 92, color: 0x59c8ff },
  },
  // ---- Citadelle des Ombres ----
  fantome: {
    id: 'fantome', name: 'Fantôme', sprite: 'fantome', behavior: 'chaser',
    hp: 40, speed: 104, damage: 12, scale: 1,
    attack: { cooldown: 800 },
    // Assaut spectral : se téléporte près du joueur et fond sur lui.
    signature: { type: 'blink', telegraph: 520, cooldown: 4000, damage: 15, range: 400, radius: 40, color: 0xdfe6f2 },
  },
  squelette: {
    id: 'squelette', name: 'Chevalier Squelette', sprite: 'squelette', behavior: 'charger',
    hp: 74, speed: 68, damage: 18, scale: 1.1,
    attack: { telegraph: 720, cooldown: 2400, range: 340, chargeSpeed: 430 },
    // Jet d'os : lance une volée d'os en éventail.
    signature: { type: 'spread', telegraph: 560, cooldown: 3800, damage: 12, count: 5, speed: 240, range: 360, color: 0xe6e2d4 },
  },
  sorcier: {
    id: 'sorcier', name: 'Sorcier d’Ombre', sprite: 'sorcier', behavior: 'summoner',
    hp: 58, speed: 72, damage: 12, scale: 1.05,
    attack: { telegraph: 700, cooldown: 3000, range: 300, projectileSpeed: 200, projectileDamage: 13, summonId: 'fantome', summonCount: 2 },
    // Sceau d'ombre : fait jaillir une zone explosive sous le joueur.
    signature: { type: 'castZone', telegraph: 720, cooldown: 3600, damage: 18, range: 340, radius: 64, color: 0xb26bff },
  },

  // ---- Archétypes de soutien (rôles uniques par zone) ----
  // Forêt : Fée sylvestre — SOIGNEUSE (rend des PV à ses alliés, fuit le joueur).
  fee: {
    id: 'fee', name: 'Fée Sylvestre', sprite: 'fee', behavior: 'healer',
    hp: 26, speed: 118, damage: 6, scale: 0.8,
    attack: { cooldown: 3200, range: 260 }, // range = distance de fuite
  },
  // Marais : Cracheur — BOMBARDIER (lance des bombes de poison télégraphiées).
  bombardier: {
    id: 'bombardier', name: 'Vase Bombardier', sprite: 'bombardier', behavior: 'bomber',
    hp: 40, speed: 70, damage: 10, scale: 1.05,
    attack: { telegraph: 800, cooldown: 2600, range: 300, explodeRadius: 66, projectileDamage: 16, status: 'poison' },
  },
  // Forge : Gardien de braise — PORTE-BOUCLIER (protège ses alliés).
  gardien: {
    id: 'gardien', name: 'Gardien de Braise', sprite: 'gardien', behavior: 'shielder',
    hp: 110, speed: 52, damage: 14, scale: 1.15,
    attack: { cooldown: 4200, range: 170 }, // range = rayon de bouclier
  },

  // ---- Bestiaire créatif ----
  // Forêt : Loup — chargeur rapide (bonds répétés).
  loup: {
    id: 'loup', name: 'Loup Sylvestre', sprite: 'loup', behavior: 'charger',
    hp: 40, speed: 130, damage: 14, scale: 1,
    attack: { telegraph: 480, cooldown: 1500, range: 340, chargeSpeed: 560 },
    signature: { type: 'leap', telegraph: 460, cooldown: 3200, damage: 15, range: 320, radius: 54, speed: 1, color: 0xffd24a },
  },
  // Forge : Drake — cracheur de feu (salve + souffle).
  drake: {
    id: 'drake', name: 'Drakelin', sprite: 'drake', behavior: 'shooter',
    hp: 46, speed: 104, damage: 12, scale: 1.05,
    attack: { telegraph: 520, cooldown: 1800, range: 300, projectileSpeed: 240, projectileDamage: 12 },
    signature: { type: 'spread', telegraph: 560, cooldown: 3000, damage: 12, count: 5, speed: 250, range: 320, color: 0xff6a1f },
  },
  // Citadelle : Archer squelette — flèches visées à hitbox prévisionnelle.
  archer: {
    id: 'archer', name: 'Archer Squelette', sprite: 'archer', behavior: 'shooter',
    hp: 34, speed: 80, damage: 10, scale: 1,
    attack: { telegraph: 620, cooldown: 2000, range: 340, projectileSpeed: 300, projectileDamage: 14 },
    signature: { type: 'spread', telegraph: 640, cooldown: 3400, damage: 12, count: 3, speed: 300, range: 380, color: 0xbff7f6 },
  },

  // ---- Adds invoqués par les boss ----
  druide: { // soigne le boss
    id: 'druide', name: 'Druide', sprite: 'druide', behavior: 'bossheal',
    hp: 30, speed: 96, damage: 6, scale: 0.9,
    attack: { cooldown: 2600, range: 240 },
  },
  bebeserpent: {
    id: 'bebeserpent', name: 'Serpenteau', sprite: 'bebeserpent', behavior: 'chaser',
    hp: 20, speed: 150, damage: 10, scale: 0.85,
    attack: { cooldown: 600 },
  },
  zombie: {
    id: 'zombie', name: 'Zombie', sprite: 'zombie', behavior: 'chaser',
    hp: 60, speed: 58, damage: 12, scale: 1.05,
    attack: { cooldown: 900 },
  },
  araigneemini: {
    id: 'araigneemini', name: 'Araignignon', sprite: 'araigneemini', behavior: 'chaser',
    hp: 22, speed: 138, damage: 9, scale: 0.85,
    attack: { cooldown: 700 },
  },
};
