export type BossMoveType =
  | 'aimedBurst' | 'fan' | 'ringShot' | 'spiral' | 'shockwave' | 'summon'
  | 'charge' | 'diveBomb' | 'lineSweep' | 'crossBeams' | 'geysers' | 'nova'
  | 'arrowRain'   // pluie de projectiles télégraphiés (centaure)
  | 'mudFlood'    // inonde l'arène sauf quelques zones sûres (gobu)
  | 'roll'        // roule en boule très vite (gobu)
  | 'teleport'    // clignotement (mage)
  | 'glyphs'      // glyphes explosifs au sol (mage)
  | 'fireBurst'   // rafale de boules de feu vers le joueur (Ignis)
  | 'fireTornado' // tornades de feu traversant la map (Ignis)
  | 'icePylons'   // pilônes d'invincibilité aux 4 coins (Glacior)
  | 'iceRain'     // pluie de stalactites, quelques zones sûres (Glacior)
  | 'tornadoSweep' // énorme tornade qui balaie tout l'écran (à esquiver au dash)
  | 'mines'        // pose des mines télégraphiées (boss final, -100 PV)
  | 'grenades'     // lance des grenades qui explosent (boss final)
  | 'missileRain'  // pluie de missiles télégraphiés (boss final)
  | 'summonBoss';  // invoque un écho enragé d'un boss déjà vaincu (boss final)

export interface BossMove {
  type: BossMoveType;
  telegraph: number;
  cooldown: number;
  count?: number;
  speed?: number;
  damage?: number;
  radius?: number;
  spread?: number;
  width?: number;
  length?: number;
  arms?: number;
  spin?: boolean;
  hazard?: 'lava' | 'toxic' | 'web' | 'fire';
  duration?: number;
  safeCount?: number; // mudFlood : nombre de zones d'esquive
  summonId?: string;
  summonCount?: number;
  chargeSpeed?: number;
  color?: number;
}

export interface BossPhase {
  hpFrac: number;
  moves: BossMove[];
  speed: number;
  tint?: number;
  movement?: 'normal' | 'slither'; // serpent de lave
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  sprite: string;
  hp: number;
  scale: number;
  contactDamage: number;
  auraColor: number;
  phases: BossPhase[];
}

export const BOSSES: Record<string, BossDef> = {
  // =============================================================
  // FORÊT — Sylvaan, le Centaure Archer (+ druides soigneurs en P2)
  // =============================================================
  araignee: {
    id: 'araignee', name: 'Sylvaan', title: 'le Centaure Archer', sprite: 'centaure',
    hp: 460, scale: 0.82, contactDamage: 14, auraColor: 0x59d9a0,
    phases: [
      { hpFrac: 1.0, speed: 150, moves: [
        { type: 'arrowRain', telegraph: 700, cooldown: 2800, count: 7, radius: 46, damage: 16, color: 0x59d9a0 },
        { type: 'charge', telegraph: 620, cooldown: 3200, chargeSpeed: 540, damage: 20 },
        { type: 'summon', telegraph: 700, cooldown: 8000, summonId: 'druide', summonCount: 2 },
      ]},
      { hpFrac: 0.5, speed: 190, tint: 0x9ee06a, moves: [
        { type: 'summon', telegraph: 700, cooldown: 8000, summonId: 'druide', summonCount: 2 },
        { type: 'arrowRain', telegraph: 560, cooldown: 2400, count: 10, radius: 48, damage: 18, color: 0x59d9a0 },
        { type: 'charge', telegraph: 500, cooldown: 2600, chargeSpeed: 620, damage: 24 },
      ]},
    ],
  },

  // =============================================================
  // MARAIS — Gorbak, le Gobu Géant (déluge de boue + roulade)
  // =============================================================
  crapaudroi: {
    id: 'crapaudroi', name: 'Gorbak', title: 'le Gobu Géant', sprite: 'gobugeant',
    hp: 620, scale: 0.82, contactDamage: 16, auraColor: 0x9fe04a,
    phases: [
      { hpFrac: 1.0, speed: 120, moves: [
        { type: 'mudFlood', telegraph: 1100, cooldown: 5200, safeCount: 3, radius: 74, damage: 26, hazard: 'toxic', color: 0x8a6a3a },
        { type: 'shockwave', telegraph: 780, cooldown: 3000, radius: 165, damage: 20, color: 0x8a6a3a },
        // Gorbak invoque ses mini-gorbaks dès la phase 1.
        { type: 'summon', telegraph: 700, cooldown: 7000, summonId: 'minigorbak', summonCount: 2 },
      ]},
      { hpFrac: 0.55, speed: 165, tint: 0x88cc66, moves: [
        { type: 'roll', telegraph: 700, cooldown: 3400, chargeSpeed: 620, damage: 24, duration: 1900 },
        { type: 'mudFlood', telegraph: 950, cooldown: 4600, safeCount: 2, radius: 66, damage: 30, hazard: 'toxic', color: 0x8a6a3a },
        { type: 'summon', telegraph: 700, cooldown: 6000, summonId: 'minigorbak', summonCount: 3 },
      ]},
    ],
  },

  // =============================================================
  // FORGE — Ignis, le Serpent de Lave (serpente, crache, invoque)
  // =============================================================
  golem: {
    id: 'golem', name: 'Ignis', title: 'le Serpent de Lave', sprite: 'serpentlave',
    hp: 760, scale: 0.82, contactDamage: 18, auraColor: 0xff6a1f,
    phases: [
      { hpFrac: 1.0, speed: 205, movement: 'slither', moves: [
        { type: 'fireBurst', telegraph: 620, cooldown: 3000, count: 10, speed: 250, damage: 14, color: 0xff7a2a },
        // Signature : 5 tornades de feu venant de 5 directions (0,2 s d'intervalle).
        { type: 'fireTornado', telegraph: 700, cooldown: 5600, count: 5, damage: 20, color: 0xff6a1f },
        { type: 'geysers', telegraph: 640, cooldown: 3200, count: 5, radius: 74, damage: 22, hazard: 'lava', duration: 3000, color: 0xff6a1f },
      ]},
      { hpFrac: 0.5, speed: 250, movement: 'slither', tint: 0xff5522, moves: [
        { type: 'fireBurst', telegraph: 520, cooldown: 2600, count: 12, speed: 280, damage: 16, color: 0xff5522 },
        { type: 'fireTornado', telegraph: 620, cooldown: 4600, count: 5, damage: 22, color: 0xff5522 },
        { type: 'geysers', telegraph: 560, cooldown: 3000, count: 6, radius: 78, damage: 24, hazard: 'lava', duration: 3200, color: 0xff6a1f },
      ]},
    ],
  },

  // =============================================================
  // CITADELLE — Mortis, le Mage Mort-vivant (invoque, téléporte, glyphes)
  // =============================================================
  roi: {
    id: 'roi', name: 'Mortis', title: 'l’Archimage Mort-vivant', sprite: 'archimage',
    hp: 1150, scale: 0.82, contactDamage: 20, auraColor: 0xb26bff,
    phases: [
      { hpFrac: 1.0, speed: 140, moves: [
        { type: 'summon', telegraph: 700, cooldown: 6000, summonId: 'zombie', summonCount: 2 },
        { type: 'glyphs', telegraph: 900, cooldown: 3000, count: 4, radius: 60, damage: 22, color: 0xb26bff },
        { type: 'teleport', telegraph: 420, cooldown: 2600 },
      ]},
      { hpFrac: 0.66, speed: 185, moves: [
        // Mortis invoque des ÉCHOS de boss (Sylvaan / Gorbak / Ignis affaiblis) dès la phase 2.
        { type: 'summon', telegraph: 800, cooldown: 8000, summonId: 'miniboss_sylvaan', summonCount: 1 },
        { type: 'summon', telegraph: 800, cooldown: 8500, summonId: 'miniboss_gorbak', summonCount: 1 },
        { type: 'summon', telegraph: 800, cooldown: 9000, summonId: 'miniboss_ignis', summonCount: 1 },
        { type: 'glyphs', telegraph: 720, cooldown: 2800, count: 4, radius: 62, damage: 24, color: 0xb26bff },
        { type: 'teleport', telegraph: 360, cooldown: 2200 },
      ]},
      { hpFrac: 0.33, speed: 235, tint: 0xc78aff, moves: [
        { type: 'glyphs', telegraph: 560, cooldown: 2200, count: 6, radius: 60, damage: 26, color: 0xc78aff },
        { type: 'summon', telegraph: 700, cooldown: 7000, summonId: 'miniboss_sylvaan', summonCount: 1 },
        { type: 'summon', telegraph: 700, cooldown: 7500, summonId: 'miniboss_gorbak', summonCount: 1 },
        { type: 'summon', telegraph: 700, cooldown: 8000, summonId: 'miniboss_ignis', summonCount: 1 },
        { type: 'teleport', telegraph: 300, cooldown: 1800 },
      ]},
    ],
  },

  // =============================================================
  // ABYSSES DE GIVRE — Glacior, le Léviathan des Abysses
  // =============================================================
  leviathan: {
    id: 'leviathan', name: 'Glacior', title: 'le Léviathan des Abysses', sprite: 'leviathan',
    hp: 1400, scale: 0.82, contactDamage: 22, auraColor: 0x7fdcff,
    phases: [
      { hpFrac: 1.0, speed: 160, moves: [
        // 0. Pilônes de Glace — invoqués au spawn, rendent Glacior invincible (damage = PV/pilône)
        { type: 'icePylons', telegraph: 700, cooldown: 999999, damage: 130 },
        // 1. Souffle du Zéro Absolu — rayon gelant balayé
        { type: 'lineSweep', telegraph: 900, cooldown: 3200, width: 70, length: 520, damage: 22, color: 0x7fdcff },
        // 2. Pluie de Stalactites — chute du ciel, quelques zones sûres
        { type: 'iceRain', telegraph: 780, cooldown: 3600, count: 10, safeCount: 3, radius: 46, damage: 20, color: 0x9fd0e8 },
      ]},
      { hpFrac: 0.6, speed: 200, tint: 0x9fe0f8, moves: [
        // Re-invoque les pilônes à mi-vie (invincible de nouveau jusqu'à leur destruction)
        { type: 'icePylons', telegraph: 650, cooldown: 999999, damage: 160 },
        // 3. Plongée Abyssale — plonge et jaillit
        { type: 'diveBomb', telegraph: 620, cooldown: 3200, radius: 70, damage: 26, color: 0x7fdcff },
        // Pluie de stalactites renforcée
        { type: 'iceRain', telegraph: 640, cooldown: 3200, count: 14, safeCount: 2, radius: 48, damage: 22, color: 0x9fd0e8 },
        // Tornade Abyssale — énorme tornade qui balaie l'écran (esquive au dash).
        { type: 'tornadoSweep', telegraph: 850, cooldown: 6000, damage: 26 },
      ]},
      { hpFrac: 0.3, speed: 230, tint: 0xcfeaff, moves: [
        // 5. Étreinte du Blizzard — onde tournante
        { type: 'shockwave', telegraph: 720, cooldown: 2600, radius: 175, damage: 22, color: 0xcfe8ff },
        { type: 'geysers', telegraph: 620, cooldown: 2800, count: 7, radius: 52, damage: 26, duration: 1300, color: 0x9fe0f8 },
        { type: 'iceRain', telegraph: 620, cooldown: 3000, count: 12, safeCount: 2, radius: 46, damage: 24, color: 0x9fd0e8 },
        { type: 'tornadoSweep', telegraph: 750, cooldown: 5200, damage: 28 },
      ]},
    ],
  },

  // =============================================================
  // NÉCROPOLE CÉLESTE — Voltaïr, le Rapace du Jugement
  // =============================================================
  rapace: {
    id: 'rapace', name: 'Voltaïr', title: 'le Rapace du Jugement', sprite: 'rapace',
    hp: 1750, scale: 0.82, contactDamage: 24, auraColor: 0xb0c8ff,
    phases: [
      { hpFrac: 1.0, speed: 175, moves: [
        { type: 'arrowRain', telegraph: 640, cooldown: 2600, count: 9, radius: 46, damage: 20, color: 0xb0c8ff },
        { type: 'charge', telegraph: 560, cooldown: 3000, chargeSpeed: 600, damage: 22 },
        { type: 'crossBeams', telegraph: 700, cooldown: 3400, width: 58, damage: 22, color: 0xffe08a },
      ]},
      { hpFrac: 0.65, speed: 210, tint: 0xd8e0ff, moves: [
        // 1. Piqué Fulgurant
        { type: 'diveBomb', telegraph: 560, cooldown: 2600, radius: 66, damage: 26, color: 0xb0c8ff },
        // Largage : momies-éclair
        { type: 'summon', telegraph: 700, cooldown: 6500, summonId: 'momie', summonCount: 2 },
        { type: 'arrowRain', telegraph: 600, cooldown: 2600, count: 11, radius: 48, damage: 22, color: 0xffe08a },
      ]},
      { hpFrac: 0.3, speed: 235, tint: 0xffe08a, moves: [
        // 6. Jugement Céleste — grille de foudre
        { type: 'crossBeams', telegraph: 640, cooldown: 3000, width: 60, damage: 26, color: 0xb0c8ff },
        { type: 'arrowRain', telegraph: 560, cooldown: 2400, count: 12, radius: 48, damage: 24, color: 0xffe08a },
        { type: 'diveBomb', telegraph: 480, cooldown: 2400, radius: 70, damage: 28, color: 0xb0c8ff },
        { type: 'shockwave', telegraph: 680, cooldown: 2800, radius: 175, damage: 24, color: 0xffe08a },
      ]},
    ],
  },

  // =============================================================
  // FAILLE DU NÉANT — Néantis, le Reflet Noir (boss final, 4 phases)
  // =============================================================
  reflet: {
    id: 'reflet', name: 'Néantis', title: 'le Reflet Noir', sprite: 'reflet',
    hp: 2100, scale: 0.82, contactDamage: 26, auraColor: 0xd05aff,
    phases: [
      { hpFrac: 1.0, speed: 150, moves: [
        // 1. Combo Miroir — charge d'estoc
        { type: 'charge', telegraph: 520, cooldown: 2600, chargeSpeed: 600, damage: 22 },
        { type: 'glyphs', telegraph: 760, cooldown: 3000, count: 4, radius: 60, damage: 20, color: 0xd05aff },
        { type: 'arrowRain', telegraph: 640, cooldown: 3000, count: 8, radius: 46, damage: 20, color: 0x59d9ff },
      ]},
      { hpFrac: 0.75, speed: 185, tint: 0xe08aff, moves: [
        // 4. Éclipse du Reflet — téléportation
        { type: 'teleport', telegraph: 420, cooldown: 2400 },
        { type: 'crossBeams', telegraph: 600, cooldown: 3000, width: 58, damage: 22, color: 0xd05aff },
        { type: 'arrowRain', telegraph: 600, cooldown: 2600, count: 10, radius: 46, damage: 22, color: 0x59d9ff },
      ]},
      { hpFrac: 0.5, speed: 220, tint: 0xd05aff, moves: [
        // 5. Gravité Renversée — glyphes + invocation de Doppelchats
        { type: 'glyphs', telegraph: 720, cooldown: 2800, count: 5, radius: 62, damage: 24, color: 0xd05aff },
        { type: 'summon', telegraph: 700, cooldown: 7000, summonId: 'doppelchat', summonCount: 2 },
        { type: 'crossBeams', telegraph: 560, cooldown: 3000, width: 60, damage: 24, color: 0xd05aff },
      ]},
      { hpFrac: 0.25, speed: 250, tint: 0xf0a0ff, moves: [
        // Chœur des Vaincus + Néant Dévorant (approx. : salve totale)
        { type: 'geysers', telegraph: 560, cooldown: 2600, count: 8, radius: 54, damage: 26, duration: 1300, color: 0x59d9ff },
        { type: 'shockwave', telegraph: 600, cooldown: 2600, radius: 180, damage: 26, color: 0xd05aff },
        { type: 'glyphs', telegraph: 560, cooldown: 2400, count: 6, radius: 60, damage: 26, color: 0xd05aff },
        { type: 'teleport', telegraph: 300, cooldown: 1800 },
      ]},
    ],
  },

  // =============================================================
  // BOSS FINAL — Général Kaptain Miaou, l'Ombre Militaire (arène circulaire)
  // Métal Gear félin : mines, grenades, missiles, dash/téléport, invoque des
  // échos enragés des boss vaincus. 20× les PV de Néantis.
  // =============================================================
  militaire: {
    id: 'militaire', name: 'Général Kaptain Miaou', title: 'l’Ombre Militaire', sprite: 'militaire',
    hp: 2100, scale: 1.45, contactDamage: 34, auraColor: 0x8aa04a,
    phases: [
      { hpFrac: 1.0, speed: 175, moves: [
        { type: 'mines', telegraph: 700, cooldown: 4200, count: 5, damage: 100, color: 0xff6a4a },
        { type: 'grenades', telegraph: 700, cooldown: 3200, count: 3, damage: 55, color: 0x6a8a3a },
        { type: 'missileRain', telegraph: 900, cooldown: 5000, count: 8, damage: 50, color: 0xff7a1f },
        { type: 'teleport', telegraph: 380, cooldown: 2600 },
      ]},
      { hpFrac: 0.6, speed: 205, tint: 0xc9d08a, moves: [
        { type: 'missileRain', telegraph: 820, cooldown: 4200, count: 11, damage: 55, color: 0xff7a1f },
        { type: 'summonBoss', telegraph: 900, cooldown: 9000 },
        { type: 'mines', telegraph: 650, cooldown: 3800, count: 6, damage: 100, color: 0xff6a4a },
        { type: 'tornadoSweep', telegraph: 800, cooldown: 6500, damage: 40 },
        { type: 'charge', telegraph: 460, cooldown: 3000, chargeSpeed: 660, damage: 30 },
      ]},
      { hpFrac: 0.3, speed: 235, tint: 0xe0e0a0, moves: [
        { type: 'grenades', telegraph: 560, cooldown: 2600, count: 5, damage: 60, color: 0x6a8a3a },
        { type: 'missileRain', telegraph: 720, cooldown: 3600, count: 14, damage: 60, color: 0xff7a1f },
        { type: 'summonBoss', telegraph: 800, cooldown: 8000 },
        { type: 'mines', telegraph: 560, cooldown: 3400, count: 7, damage: 100, color: 0xff6a4a },
        { type: 'tornadoSweep', telegraph: 700, cooldown: 5200, damage: 44 },
        { type: 'teleport', telegraph: 300, cooldown: 1900 },
      ]},
    ],
  },
};
