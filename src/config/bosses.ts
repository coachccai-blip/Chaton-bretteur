export type BossMoveType =
  | 'aimedBurst' | 'fan' | 'ringShot' | 'spiral' | 'shockwave' | 'summon'
  | 'charge' | 'diveBomb' | 'lineSweep' | 'crossBeams' | 'geysers' | 'nova'
  | 'arrowRain'   // pluie de projectiles télégraphiés (centaure)
  | 'mudFlood'    // inonde l'arène sauf quelques zones sûres (gobu)
  | 'roll'        // roule en boule très vite (gobu)
  | 'teleport'    // clignotement (mage)
  | 'glyphs';     // glyphes explosifs au sol (mage)

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
  phases: BossPhase[];
}

export const BOSSES: Record<string, BossDef> = {
  // =============================================================
  // FORÊT — Sylvaan, le Centaure Archer (+ druides soigneurs en P2)
  // =============================================================
  araignee: {
    id: 'araignee', name: 'Sylvaan', title: 'le Centaure Archer', sprite: 'centaure',
    hp: 640, scale: 2.5, contactDamage: 14,
    phases: [
      { hpFrac: 1.0, speed: 96, moves: [
        { type: 'aimedBurst', telegraph: 480, cooldown: 1700, count: 3, speed: 260, damage: 13, color: 0x9ee06a },
        { type: 'fan', telegraph: 520, cooldown: 2200, count: 5, spread: 0.5, speed: 230, damage: 12, color: 0x6ad46a },
        { type: 'arrowRain', telegraph: 700, cooldown: 3400, count: 6, radius: 46, damage: 16, color: 0x59d9a0 },
        { type: 'charge', telegraph: 620, cooldown: 3200, chargeSpeed: 540, damage: 20 },
      ]},
      { hpFrac: 0.5, speed: 120, tint: 0x9ee06a, moves: [
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
    hp: 900, scale: 2.7, contactDamage: 16,
    phases: [
      { hpFrac: 1.0, speed: 58, moves: [
        { type: 'mudFlood', telegraph: 1100, cooldown: 5200, safeCount: 3, radius: 74, damage: 26, hazard: 'toxic', color: 0x8a6a3a },
        { type: 'aimedBurst', telegraph: 520, cooldown: 2000, count: 3, speed: 200, damage: 12, color: 0x8fd94a },
        { type: 'shockwave', telegraph: 780, cooldown: 3000, radius: 165, damage: 20, color: 0x8a6a3a },
      ]},
      { hpFrac: 0.55, speed: 78, tint: 0x88cc66, moves: [
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
    hp: 1150, scale: 2.8, contactDamage: 18,
    phases: [
      { hpFrac: 1.0, speed: 118, movement: 'slither', moves: [
        { type: 'fan', telegraph: 520, cooldown: 1900, count: 5, spread: 0.55, speed: 210, damage: 15, color: 0xff7a2a },
        { type: 'summon', telegraph: 700, cooldown: 5200, summonId: 'bebeserpent', summonCount: 3 },
        { type: 'spiral', telegraph: 520, cooldown: 3000, count: 16, speed: 175, damage: 14, color: 0xff8a3a },
      ]},
      { hpFrac: 0.5, speed: 150, movement: 'slither', tint: 0xff5522, moves: [
        { type: 'ringShot', telegraph: 560, cooldown: 2200, count: 16, speed: 195, damage: 15, color: 0xff5522 },
        { type: 'fan', telegraph: 400, cooldown: 1500, count: 7, spread: 0.7, speed: 240, damage: 16, color: 0xff7a2a },
        { type: 'summon', telegraph: 600, cooldown: 4800, summonId: 'bebeserpent', summonCount: 4 },
        { type: 'geysers', telegraph: 600, cooldown: 3200, count: 6, radius: 52, damage: 24, hazard: 'fire', duration: 1300, color: 0xff6a1f },
      ]},
    ],
  },

  // =============================================================
  // CITADELLE — Mortis, le Mage Mort-vivant (invoque, téléporte, glyphes)
  // =============================================================
  roi: {
    id: 'roi', name: 'Mortis', title: 'l’Archimage Mort-vivant', sprite: 'archimage',
    hp: 1900, scale: 2.9, contactDamage: 20,
    phases: [
      { hpFrac: 1.0, speed: 66, moves: [
        { type: 'summon', telegraph: 700, cooldown: 6000, summonId: 'zombie', summonCount: 2 },
        { type: 'glyphs', telegraph: 900, cooldown: 3400, count: 3, radius: 60, damage: 22, color: 0xb26bff },
        { type: 'teleport', telegraph: 420, cooldown: 2600 },
        { type: 'aimedBurst', telegraph: 460, cooldown: 2000, count: 3, speed: 220, damage: 14, color: 0xc78aff },
      ]},
      { hpFrac: 0.66, speed: 84, moves: [
        { type: 'summon', telegraph: 650, cooldown: 5200, summonId: 'fantome', summonCount: 2 },
        { type: 'summon', telegraph: 650, cooldown: 6200, summonId: 'araigneemini', summonCount: 2 },
        { type: 'glyphs', telegraph: 720, cooldown: 2800, count: 4, radius: 62, damage: 24, color: 0xb26bff },
        { type: 'teleport', telegraph: 360, cooldown: 2200 },
      ]},
      { hpFrac: 0.33, speed: 100, tint: 0xc78aff, moves: [
        { type: 'nova', telegraph: 520, cooldown: 2600, count: 22, speed: 210, damage: 16, color: 0xb26bff },
        { type: 'glyphs', telegraph: 560, cooldown: 2200, count: 6, radius: 60, damage: 26, color: 0xc78aff },
        { type: 'summon', telegraph: 600, cooldown: 4600, summonId: 'zombie', summonCount: 3 },
        { type: 'teleport', telegraph: 300, cooldown: 1800 },
      ]},
    ],
  },
};
