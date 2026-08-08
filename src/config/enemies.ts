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

  // ============================================================
  //  Monde 5 — Abysses de Givre
  // ============================================================
  yeti: {
    id: 'yeti', name: 'Yéti Lanceur', sprite: 'yeti', behavior: 'bomber',
    hp: 130, speed: 52, damage: 20, scale: 1.3,
    // Boule de neige lobée qui explose en givre (approx. de la boule grossissante).
    attack: { telegraph: 820, cooldown: 2900, range: 320, explodeRadius: 72, projectileDamage: 20, status: 'freeze' },
  },
  spectregivre: {
    id: 'spectregivre', name: 'Spectre de Givre', sprite: 'spectregivre', behavior: 'shooter',
    hp: 56, speed: 74, damage: 14, scale: 1,
    attack: { telegraph: 600, cooldown: 1900, range: 250, projectileSpeed: 190, projectileDamage: 12, status: 'freeze' },
    // Souffle polaire : cône gelant.
    signature: { type: 'spread', telegraph: 600, cooldown: 3400, damage: 12, count: 3, speed: 200, range: 300, color: 0x7fdcff },
  },
  stalactite: {
    id: 'stalactite', name: 'Stalactite Vivante', sprite: 'stalactite', behavior: 'shooter',
    hp: 30, speed: 22, damage: 22, scale: 1,
    attack: { telegraph: 620, cooldown: 2600, range: 320, projectileSpeed: 220, projectileDamage: 12 },
    // Chute empalante : impact au sol télégraphié par l'ombre grandissante.
    signature: { type: 'leap', telegraph: 720, cooldown: 4200, damage: 22, range: 300, radius: 42, speed: 1, color: 0x9fd0e8 },
  },
  pingouin: {
    id: 'pingouin', name: 'Pingouin Torpille', sprite: 'pingouin', behavior: 'charger',
    hp: 44, speed: 190, damage: 16, scale: 1,
    attack: { telegraph: 500, cooldown: 1600, range: 380, chargeSpeed: 640 },
    signature: { type: 'leap', telegraph: 480, cooldown: 3000, damage: 16, range: 340, radius: 50, speed: 1, color: 0xcfe8ff },
  },
  sculpteur: {
    id: 'sculpteur', name: 'Sculpteur de Glace', sprite: 'sculpteur', behavior: 'summoner',
    hp: 48, speed: 60, damage: 6, scale: 1,
    // Statue éveillée : sculpte un pingouin (canal interruptible).
    attack: { telegraph: 900, cooldown: 4600, range: 300, projectileSpeed: 180, projectileDamage: 8, summonId: 'pingouin', summonCount: 1 },
  },
  sorciereblizzard: {
    id: 'sorciereblizzard', name: 'Sorcière du Blizzard', sprite: 'sorciereblizzard', behavior: 'shooter',
    hp: 52, speed: 70, damage: 12, scale: 1,
    attack: { telegraph: 560, cooldown: 2000, range: 300, projectileSpeed: 210, projectileDamage: 11, status: 'freeze' },
    // Appel du blizzard : se téléporte puis frappe.
    signature: { type: 'blink', telegraph: 560, cooldown: 4000, damage: 14, range: 420, radius: 42, color: 0xcfe8ff },
  },
  brochet: {
    id: 'brochet', name: 'Brochet des Glaces', sprite: 'brochet', behavior: 'charger',
    hp: 60, speed: 120, damage: 18, scale: 1.05,
    attack: { telegraph: 560, cooldown: 2200, range: 340, chargeSpeed: 520 },
    // Jaillissement brisant : surgit sous le joueur.
    signature: { type: 'leap', telegraph: 600, cooldown: 3800, damage: 18, range: 340, radius: 50, speed: 1, color: 0x9fd0e8 },
  },

  // ============================================================
  //  Monde 6 — Nécropole Céleste
  // ============================================================
  harpie: {
    id: 'harpie', name: 'Harpie des Courants', sprite: 'harpie', behavior: 'shooter',
    hp: 66, speed: 110, damage: 14, scale: 1,
    attack: { telegraph: 520, cooldown: 1800, range: 300, projectileSpeed: 230, projectileDamage: 12 },
    signature: { type: 'spinAoE', telegraph: 520, cooldown: 3400, damage: 14, range: 90, radius: 80, color: 0xffe08a },
  },
  nuagetonnerre: {
    id: 'nuagetonnerre', name: 'Nuage Tonnerre', sprite: 'nuagetonnerre', behavior: 'shooter',
    hp: 58, speed: 64, damage: 18, scale: 1,
    attack: { telegraph: 640, cooldown: 2200, range: 320, projectileSpeed: 240, projectileDamage: 14 },
    // Triple fulguration : colonnes de foudre télégraphiées.
    signature: { type: 'castZone', telegraph: 800, cooldown: 3600, damage: 18, range: 360, radius: 46, color: 0xb0c8ff },
  },
  djinn: {
    id: 'djinn', name: 'Djinn des Rafales', sprite: 'djinn', behavior: 'shooter',
    hp: 72, speed: 78, damage: 12, scale: 1.05,
    attack: { telegraph: 560, cooldown: 2000, range: 300, projectileSpeed: 200, projectileDamage: 12 },
    // Inspire-expire : onde de poussée conique.
    signature: { type: 'spinAoE', telegraph: 640, cooldown: 3600, damage: 12, range: 110, radius: 92, color: 0xb0c8ff },
  },
  chevalierceleste: {
    id: 'chevalierceleste', name: 'Chevalier Céleste', sprite: 'chevalierceleste', behavior: 'charger',
    hp: 98, speed: 96, damage: 20, scale: 1.1,
    attack: { telegraph: 560, cooldown: 2200, range: 340, chargeSpeed: 560 },
    // Croix du jugement : dash aérien en onde.
    signature: { type: 'leap', telegraph: 460, cooldown: 3200, damage: 20, range: 340, radius: 60, speed: 1, color: 0xffe08a },
  },
  idole: {
    id: 'idole', name: 'Idole Foudroyante', sprite: 'idole', behavior: 'shooter',
    hp: 85, speed: 0, damage: 30, scale: 1.15,
    attack: { telegraph: 800, cooldown: 3200, range: 600, projectileSpeed: 160, projectileDamage: 10 },
    // Verdict céleste : grande zone à interrompre (la tuer avant la fin).
    signature: { type: 'castZone', telegraph: 1600, cooldown: 5200, damage: 30, range: 700, radius: 96, color: 0xffe08a },
  },
  oiseauplasma: {
    id: 'oiseauplasma', name: 'Oiseau de Plasma', sprite: 'oiseauplasma', behavior: 'charger',
    hp: 40, speed: 170, damage: 10, scale: 0.95,
    attack: { telegraph: 460, cooldown: 1500, range: 400, chargeSpeed: 600 },
    signature: { type: 'leap', telegraph: 440, cooldown: 2800, damage: 10, range: 360, radius: 46, speed: 1, color: 0xb0c8ff },
  },
  porteursarco: {
    id: 'porteursarco', name: 'Porteur de Sarcophage', sprite: 'porteursarco', behavior: 'summoner',
    hp: 90, speed: 58, damage: 16, scale: 1.15,
    // Largage funèbre : lâche des momies-éclair.
    attack: { telegraph: 760, cooldown: 4200, range: 320, projectileSpeed: 190, projectileDamage: 12, summonId: 'momie', summonCount: 1 },
  },
  momie: {
    id: 'momie', name: 'Momie-Éclair', sprite: 'momie', behavior: 'chaser',
    hp: 20, speed: 150, damage: 10, scale: 0.85,
    attack: { cooldown: 600 },
  },

  // ============================================================
  //  Monde 7 — Faille du Néant
  // ============================================================
  oeilneant: {
    id: 'oeilneant', name: 'Œil du Néant', sprite: 'oeilneant', behavior: 'shooter',
    hp: 70, speed: 50, damage: 22, scale: 1.1,
    attack: { telegraph: 640, cooldown: 2000, range: 360, projectileSpeed: 240, projectileDamage: 16 },
    // Regard annihilant : zone de rayon balayé (approx).
    signature: { type: 'castZone', telegraph: 900, cooldown: 3800, damage: 22, range: 420, radius: 60, color: 0xd05aff },
  },
  golemstellaire: {
    id: 'golemstellaire', name: 'Golem Stellaire', sprite: 'golemstellaire', behavior: 'tank',
    hp: 150, speed: 44, damage: 20, scale: 1.25,
    attack: { cooldown: 1200 },
    // Puits gravitationnel : zone d'aspiration (approx. par impact de zone).
    signature: { type: 'castZone', telegraph: 900, cooldown: 4200, damage: 20, range: 340, radius: 90, color: 0x59d9ff },
  },
  doppelchat: {
    id: 'doppelchat', name: 'Doppelchat', sprite: 'doppelchat', behavior: 'charger',
    hp: 80, speed: 105, damage: 14, scale: 1,
    attack: { telegraph: 460, cooldown: 1800, range: 340, chargeSpeed: 560 },
    // Écho félin : mini-spécial après combo (onde).
    signature: { type: 'spinAoE', telegraph: 420, cooldown: 3000, damage: 14, range: 80, radius: 62, color: 0xd05aff },
  },
  mangeurames: {
    id: 'mangeurames', name: 'Mangeur d’Âmes', sprite: 'mangeurames', behavior: 'chaser',
    hp: 60, speed: 88, damage: 12, scale: 1.05,
    attack: { cooldown: 800 },
    signature: { type: 'spinAoE', telegraph: 520, cooldown: 3600, damage: 12, range: 90, radius: 76, color: 0x7fff9a },
  },
  faucheurdim: {
    id: 'faucheurdim', name: 'Faucheur Dimensionnel', sprite: 'faucheurdim', behavior: 'shooter',
    hp: 66, speed: 92, damage: 16, scale: 1.05,
    attack: { telegraph: 560, cooldown: 2000, range: 300, projectileSpeed: 220, projectileDamage: 14 },
    signature: { type: 'blink', telegraph: 520, cooldown: 3600, damage: 16, range: 420, radius: 44, color: 0xd05aff },
  },
  etoilenaine: {
    id: 'etoilenaine', name: 'Étoile Naine', sprite: 'etoilenaine', behavior: 'exploder',
    hp: 34, speed: 130, damage: 26, scale: 0.9,
    attack: { telegraph: 720, explodeRadius: 120 },
    // Supernova : anneau d'éclats à l'explosion.
    signature: { type: 'spread', telegraph: 200, cooldown: 99999, damage: 10, count: 8, speed: 150, color: 0xd05aff },
  },
  larvechaos: {
    id: 'larvechaos', name: 'Larve du Chaos', sprite: 'larvechaos', behavior: 'chaser',
    hp: 56, speed: 100, damage: 13, scale: 1,
    attack: { cooldown: 800 },
    // Quatre signatures : approximé par une salve changeante.
    signature: { type: 'spread', telegraph: 520, cooldown: 3200, damage: 12, count: 4, speed: 220, range: 320, color: 0x59d9ff },
  },
};
