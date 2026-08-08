export type BossMoveType =
  | 'aimedBurst' | 'fan' | 'ringShot' | 'spiral' | 'shockwave' | 'summon'
  | 'charge' | 'diveBomb' | 'lineSweep' | 'crossBeams' | 'geysers' | 'nova'
  | 'arrowRain'   // pluie de projectiles télégraphiés (centaure)
  | 'mudFlood'    // inonde l'arène sauf quelques zones sûres (gobu)
  | 'roll'        // roule en boule très vite (gobu)
  | 'teleport'    // clignotement (mage)
  | 'glyphs'      // glyphes explosifs au sol (mage)
  | 'fireBurst'   // rafale de boules de feu vers le joueur (Ignis)
  | 'icePylons'   // pilônes d'invincibilité aux 4 coins (Glacior)
  | 'iceRain';    // pluie de stalactites, quelques zones sûres (Glacior)

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
    hp: 460, scale: 1.15, contactDamage: 14, auraColor: 0x59d9a0,
    phases: [
      { hpFrac: 1.0, speed: 150, moves: [
        { type: 'aimedBurst', telegraph: 480, cooldown: 1700, count: 3, speed: 260, damage: 13, color: 0x9ee06a },
        { type: 'fan', telegraph: 520, cooldown: 2200, count: 5, spread: 0.5, speed: 230, damage: 12, color: 0x6ad46a },
        { type: 'arrowRain', telegraph: 700, cooldown: 3400, count: 6, radius: 46, damage: 16, color: 0x59d9a0 },
        { type: 'charge', telegraph: 620, cooldown: 3200, chargeSpeed: 540, damage: 20 },
      ]},
      { hpFrac: 0.5, speed: 190, tint: 0x9ee06a, moves: [
        { type: 'summon', telegraph: 700, cooldown: 8000, summonId: 'druide', summonCount: 2 },
        { type: 'arrowRain', telegraph: 560, cooldown: 2600, count: 9, radius: 48, damage: 18, color: 0x59d9a0 },
        { type: 'fan', telegraph: 440, cooldown: 1800, count: 7, spread: 0.7, speed: 250, damage: 14, color: 0x6ad46a },
        { type: 'charge', telegraph: 500, cooldown: 2600, chargeSpeed: 620, damage: 24 },
      ]},
    ],
  },

  // =============================================================
  // MARAIS — Gorbak, le Gobu Géant (déluge de boue + roulade)
  // =============================================================
  crapaudroi: {
    id: 'crapaudroi', name: 'Gorbak', title: 'le Gobu Géant', sprite: 'gobugeant',
    hp: 620, scale: 1.25, contactDamage: 16, auraColor: 0x9fe04a,
    phases: [
      { hpFrac: 1.0, speed: 120, moves: [
        { type: 'mudFlood', telegraph: 1100, cooldown: 5200, safeCount: 3, radius: 74, damage: 26, hazard: 'toxic', color: 0x8a6a3a },
        { type: 'aimedBurst', telegraph: 520, cooldown: 2000, count: 3, speed: 200, damage: 12, color: 0x8fd94a },
        { type: 'shockwave', telegraph: 780, cooldown: 3000, radius: 165, damage: 20, color: 0x8a6a3a },
      ]},
      { hpFrac: 0.55, speed: 165, tint: 0x88cc66, moves: [
        { type: 'roll', telegraph: 700, cooldown: 3400, chargeSpeed: 620, damage: 24, duration: 1900 },
        { type: 'mudFlood', telegraph: 950, cooldown: 4600, safeCount: 2, radius: 66, damage: 30, hazard: 'toxic', color: 0x8a6a3a },
        { type: 'summon', telegraph: 700, cooldown: 6500, summonId: 'bombardier', summonCount: 2 },
      ]},
    ],
  },

  // =============================================================
  // FORGE — Ignis, le Serpent de Lave (serpente, crache, invoque)
  // =============================================================
  golem: {
    id: 'golem', name: 'Ignis', title: 'le Serpent de Lave', sprite: 'serpentlave',
    hp: 760, scale: 1.15, contactDamage: 18, auraColor: 0xff6a1f,
    phases: [
      { hpFrac: 1.0, speed: 175, movement: 'slither', moves: [
        { type: 'fan', telegraph: 520, cooldown: 1900, count: 5, spread: 0.55, speed: 210, damage: 15, color: 0xff7a2a },
        { type: 'fireBurst', telegraph: 620, cooldown: 3600, count: 10, speed: 250, damage: 14, color: 0xff7a2a },
        { type: 'summon', telegraph: 700, cooldown: 5200, summonId: 'bebeserpent', summonCount: 3 },
        { type: 'spiral', telegraph: 520, cooldown: 3000, count: 16, speed: 175, damage: 14, color: 0xff8a3a },
      ]},
      { hpFrac: 0.5, speed: 220, movement: 'slither', tint: 0xff5522, moves: [
        { type: 'fireBurst', telegraph: 520, cooldown: 3000, count: 10, speed: 280, damage: 16, color: 0xff5522 },
        { type: 'fan', telegraph: 400, cooldown: 1500, count: 7, spread: 0.7, speed: 240, damage: 16, color: 0xff7a2a },
        { type: 'summon', telegraph: 600, cooldown: 4800, summonId: 'bebeserpent', summonCount: 4 },
        // grosses flaques de lave persistantes (au lieu des petites bombes)
        { type: 'geysers', telegraph: 600, cooldown: 3200, count: 5, radius: 78, damage: 24, hazard: 'lava', duration: 3200, color: 0xff6a1f },
      ]},
    ],
  },

  // =============================================================
  // CITADELLE — Mortis, le Mage Mort-vivant (invoque, téléporte, glyphes)
  // =============================================================
  roi: {
    id: 'roi', name: 'Mortis', title: 'l’Archimage Mort-vivant', sprite: 'archimage',
    hp: 1150, scale: 1.2, contactDamage: 20, auraColor: 0xb26bff,
    phases: [
      { hpFrac: 1.0, speed: 140, moves: [
        { type: 'summon', telegraph: 700, cooldown: 6000, summonId: 'zombie', summonCount: 2 },
        { type: 'glyphs', telegraph: 900, cooldown: 3400, count: 3, radius: 60, damage: 22, color: 0xb26bff },
        { type: 'teleport', telegraph: 420, cooldown: 2600 },
        { type: 'aimedBurst', telegraph: 460, cooldown: 2000, count: 3, speed: 220, damage: 14, color: 0xc78aff },
      ]},
      { hpFrac: 0.66, speed: 185, moves: [
        { type: 'summon', telegraph: 650, cooldown: 5200, summonId: 'fantome', summonCount: 2 },
        { type: 'summon', telegraph: 650, cooldown: 6200, summonId: 'araigneemini', summonCount: 2 },
        { type: 'glyphs', telegraph: 720, cooldown: 2800, count: 4, radius: 62, damage: 24, color: 0xb26bff },
        { type: 'teleport', telegraph: 360, cooldown: 2200 },
      ]},
      { hpFrac: 0.33, speed: 235, tint: 0xc78aff, moves: [
        { type: 'nova', telegraph: 520, cooldown: 2600, count: 22, speed: 210, damage: 16, color: 0xb26bff },
        { type: 'glyphs', telegraph: 560, cooldown: 2200, count: 6, radius: 60, damage: 26, color: 0xc78aff },
        { type: 'summon', telegraph: 600, cooldown: 4600, summonId: 'zombie', summonCount: 3 },
        { type: 'teleport', telegraph: 300, cooldown: 1800 },
      ]},
    ],
  },

  // =============================================================
  // ABYSSES DE GIVRE — Glacior, le Léviathan des Abysses
  // =============================================================
  leviathan: {
    id: 'leviathan', name: 'Glacior', title: 'le Léviathan des Abysses', sprite: 'leviathan',
    hp: 1400, scale: 1.25, contactDamage: 22, auraColor: 0x7fdcff,
    phases: [
      { hpFrac: 1.0, speed: 160, moves: [
        // 0. Pilônes de Glace — invoqués au spawn, rendent Glacior invincible (damage = PV/pilône)
        { type: 'icePylons', telegraph: 700, cooldown: 999999, damage: 130 },
        // 1. Souffle du Zéro Absolu — rayon gelant balayé
        { type: 'lineSweep', telegraph: 900, cooldown: 3200, width: 70, length: 520, damage: 22, color: 0x7fdcff },
        // 2. Pluie de Stalactites — chute du ciel, quelques zones sûres
        { type: 'iceRain', telegraph: 780, cooldown: 4200, count: 10, safeCount: 3, radius: 46, damage: 20, color: 0x9fd0e8 },
        // éclats de givre visés
        { type: 'aimedBurst', telegraph: 480, cooldown: 1900, count: 3, speed: 240, damage: 15, color: 0xcfe8ff },
      ]},
      { hpFrac: 0.6, speed: 200, tint: 0x9fe0f8, moves: [
        // Re-invoque les pilônes à mi-vie (invincible de nouveau jusqu'à leur destruction)
        { type: 'icePylons', telegraph: 650, cooldown: 999999, damage: 160 },
        // 3. Plongée Abyssale — plonge et jaillit
        { type: 'diveBomb', telegraph: 620, cooldown: 3400, radius: 70, damage: 26, color: 0x7fdcff },
        // 4. Miroirs de Glace — flipper de projectiles
        { type: 'ringShot', telegraph: 560, cooldown: 2400, count: 16, speed: 200, damage: 16, color: 0x9fe0f8 },
        // Pluie de stalactites renforcée
        { type: 'iceRain', telegraph: 640, cooldown: 3600, count: 14, safeCount: 2, radius: 48, damage: 22, color: 0x9fd0e8 },
        // 6. Cœur de Gel — nova gelante
        { type: 'nova', telegraph: 900, cooldown: 5000, count: 20, speed: 200, damage: 24, color: 0x7fdcff },
      ]},
      { hpFrac: 0.3, speed: 230, tint: 0xcfeaff, moves: [
        // 5. Étreinte du Blizzard — onde tournante
        { type: 'shockwave', telegraph: 720, cooldown: 2800, radius: 175, damage: 22, color: 0xcfe8ff },
        { type: 'nova', telegraph: 640, cooldown: 3200, count: 26, speed: 210, damage: 26, color: 0x7fdcff },
        { type: 'geysers', telegraph: 620, cooldown: 3000, count: 7, radius: 52, damage: 26, duration: 1300, color: 0x9fe0f8 },
        { type: 'spiral', telegraph: 520, cooldown: 2600, count: 18, speed: 190, damage: 18, color: 0x9fd0e8 },
      ]},
    ],
  },

  // =============================================================
  // NÉCROPOLE CÉLESTE — Voltaïr, le Rapace du Jugement
  // =============================================================
  rapace: {
    id: 'rapace', name: 'Voltaïr', title: 'le Rapace du Jugement', sprite: 'rapace',
    hp: 1750, scale: 1.2, contactDamage: 24, auraColor: 0xb0c8ff,
    phases: [
      { hpFrac: 1.0, speed: 175, moves: [
        // Tempête de Plumes — éventails d'éclairs
        { type: 'fan', telegraph: 520, cooldown: 2000, count: 7, spread: 0.7, speed: 240, damage: 16, color: 0xffe08a },
        { type: 'arrowRain', telegraph: 700, cooldown: 3000, count: 8, radius: 46, damage: 20, color: 0xb0c8ff },
        { type: 'charge', telegraph: 560, cooldown: 3000, chargeSpeed: 600, damage: 22 },
      ]},
      { hpFrac: 0.65, speed: 210, tint: 0xd8e0ff, moves: [
        // 1. Piqué Fulgurant
        { type: 'diveBomb', telegraph: 560, cooldown: 2800, radius: 66, damage: 26, color: 0xb0c8ff },
        // 5. Ouragan Central
        { type: 'nova', telegraph: 820, cooldown: 4400, count: 22, speed: 210, damage: 22, color: 0xffe08a },
        // Largage : momies-éclair
        { type: 'summon', telegraph: 700, cooldown: 6500, summonId: 'momie', summonCount: 2 },
        { type: 'spiral', telegraph: 520, cooldown: 2800, count: 18, speed: 200, damage: 16, color: 0xb0c8ff },
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
    hp: 2100, scale: 1.15, contactDamage: 26, auraColor: 0xd05aff,
    phases: [
      { hpFrac: 1.0, speed: 150, moves: [
        // 1. Combo Miroir — charge d'estoc
        { type: 'charge', telegraph: 520, cooldown: 2600, chargeSpeed: 600, damage: 22 },
        { type: 'aimedBurst', telegraph: 440, cooldown: 1800, count: 3, speed: 240, damage: 16, color: 0xd05aff },
        { type: 'fan', telegraph: 500, cooldown: 2200, count: 5, spread: 0.5, speed: 230, damage: 16, color: 0x59d9ff },
      ]},
      { hpFrac: 0.75, speed: 185, tint: 0xe08aff, moves: [
        // 4. Éclipse du Reflet — téléportation
        { type: 'teleport', telegraph: 420, cooldown: 2400 },
        { type: 'spiral', telegraph: 500, cooldown: 2600, count: 20, speed: 200, damage: 16, color: 0xd05aff },
        { type: 'nova', telegraph: 620, cooldown: 3200, count: 20, speed: 205, damage: 20, color: 0x59d9ff },
      ]},
      { hpFrac: 0.5, speed: 220, tint: 0xd05aff, moves: [
        // 5. Gravité Renversée — glyphes + invocation de Doppelchats
        { type: 'glyphs', telegraph: 720, cooldown: 2800, count: 5, radius: 62, damage: 24, color: 0xd05aff },
        { type: 'summon', telegraph: 700, cooldown: 7000, summonId: 'doppelchat', summonCount: 2 },
        { type: 'ringShot', telegraph: 520, cooldown: 2200, count: 18, speed: 205, damage: 18, color: 0x59d9ff },
        { type: 'crossBeams', telegraph: 560, cooldown: 3000, width: 60, damage: 24, color: 0xd05aff },
      ]},
      { hpFrac: 0.25, speed: 250, tint: 0xf0a0ff, moves: [
        // Chœur des Vaincus + Néant Dévorant (approx. : salve totale)
        { type: 'nova', telegraph: 520, cooldown: 2400, count: 26, speed: 220, damage: 24, color: 0xd05aff },
        { type: 'geysers', telegraph: 560, cooldown: 2600, count: 8, radius: 54, damage: 26, duration: 1300, color: 0x59d9ff },
        { type: 'shockwave', telegraph: 600, cooldown: 2600, radius: 180, damage: 26, color: 0xd05aff },
        { type: 'teleport', telegraph: 300, cooldown: 1800 },
      ]},
    ],
  },
};
