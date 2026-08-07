export type BossMoveType =
  | 'aimedBurst'   // rafale visée
  | 'fan'          // éventail de projectiles vers le joueur
  | 'ringShot'     // anneau de projectiles
  | 'spiral'       // spirale tournante
  | 'shockwave'    // onde de choc au sol (saut)
  | 'summon'       // invocation de sbires
  | 'charge'       // charge en ligne droite
  | 'diveBomb'     // saut-plongeon sur le joueur (ombre télégraphiée)
  | 'lineSweep'    // attaque en ligne (langue, faisceau) télégraphiée
  | 'crossBeams'   // plusieurs faisceaux depuis le boss (croix / étoile)
  | 'geysers'      // colonnes qui jaillissent à plusieurs endroits
  | 'poolShot'     // crée des flaques persistantes au sol (toxique/lave/feu)
  | 'webTrap'      // pièges de toile qui ralentissent
  | 'nova';        // onde de projectiles dense (à esquiver au dash)

export interface BossMove {
  type: BossMoveType;
  telegraph: number;
  cooldown: number;
  count?: number;
  speed?: number;
  damage?: number;
  radius?: number;
  spread?: number;      // demi-angle de l'éventail (rad)
  width?: number;       // largeur d'un faisceau/ligne
  length?: number;      // longueur d'un faisceau/ligne
  arms?: number;        // nombre de faisceaux (crossBeams)
  spin?: boolean;       // crossBeams tournants
  hazard?: 'lava' | 'toxic' | 'web' | 'fire'; // type de zone au sol créée
  duration?: number;    // durée de vie d'une zone au sol
  summonId?: string;
  summonCount?: number;
  chargeSpeed?: number;
  color?: number;       // couleur du télégraphe/VFX
}

export interface BossPhase {
  hpFrac: number;
  moves: BossMove[];
  speed: number;
  tint?: number;
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
  // ---------------------------------------------------------------
  // FORÊT — Broussaille, l'Araignée-Mère : pièges de toile, nuées, plongeon
  // ---------------------------------------------------------------
  araignee: {
    id: 'araignee', name: 'Broussaille', title: 'l’Araignée-Mère', sprite: 'araignee',
    hp: 620, scale: 2.4, contactDamage: 14,
    phases: [
      { hpFrac: 1.0, speed: 78, moves: [
        { type: 'fan', telegraph: 550, cooldown: 1900, count: 5, spread: 0.5, speed: 220, damage: 12, color: 0xb26bff },
        { type: 'webTrap', telegraph: 650, cooldown: 4200, count: 3, radius: 52, hazard: 'web', duration: 5000, color: 0xcfc0ff },
        { type: 'summon', telegraph: 750, cooldown: 6500, summonId: 'slime', summonCount: 3 },
      ]},
      { hpFrac: 0.5, speed: 118, tint: 0xff6699, moves: [
        { type: 'diveBomb', telegraph: 700, cooldown: 2600, radius: 95, damage: 20, color: 0xff4a7a },
        { type: 'ringShot', telegraph: 650, cooldown: 2400, count: 14, speed: 195, damage: 12, color: 0xb26bff },
        { type: 'webTrap', telegraph: 650, cooldown: 4200, count: 4, radius: 55, hazard: 'web', duration: 5000, color: 0xcfc0ff },
        { type: 'summon', telegraph: 700, cooldown: 7000, summonId: 'chauvesouris', summonCount: 3 },
      ]},
    ],
  },

  // ---------------------------------------------------------------
  // MARAIS — Bufo le Vorace : langue-fouet, crachats toxiques, onde de choc
  // ---------------------------------------------------------------
  crapaudroi: {
    id: 'crapaudroi', name: 'Bufo', title: 'le Vorace', sprite: 'crapaudroi',
    hp: 780, scale: 2.5, contactDamage: 16,
    phases: [
      { hpFrac: 1.0, speed: 58, moves: [
        { type: 'lineSweep', telegraph: 700, cooldown: 2200, width: 42, length: 360, damage: 18, color: 0xff5a8a },
        { type: 'poolShot', telegraph: 650, cooldown: 3400, count: 3, radius: 48, hazard: 'toxic', duration: 4500, color: 0x8fd94a },
        { type: 'shockwave', telegraph: 800, cooldown: 3200, radius: 150, damage: 18, color: 0x6ad46a },
      ]},
      { hpFrac: 0.55, speed: 92, tint: 0x88ff88, moves: [
        { type: 'lineSweep', telegraph: 560, cooldown: 1900, width: 48, length: 380, damage: 20, color: 0xff5a8a },
        { type: 'shockwave', telegraph: 650, cooldown: 2600, radius: 180, damage: 22, color: 0x6ad46a },
        { type: 'poolShot', telegraph: 600, cooldown: 3000, count: 4, radius: 50, hazard: 'toxic', duration: 4500, color: 0x8fd94a },
        { type: 'summon', telegraph: 700, cooldown: 6500, summonId: 'crapaud', summonCount: 2 },
      ]},
    ],
  },

  // ---------------------------------------------------------------
  // FORGE — Ignar, le Golem de Forge : coulées en croix, geysers, spirale
  // ---------------------------------------------------------------
  golem: {
    id: 'golem', name: 'Ignar', title: 'le Golem de Forge', sprite: 'golem',
    hp: 980, scale: 2.8, contactDamage: 18,
    phases: [
      { hpFrac: 1.0, speed: 48, moves: [
        { type: 'crossBeams', telegraph: 800, cooldown: 3000, arms: 4, width: 46, length: 520, damage: 20, hazard: 'lava', duration: 2500, color: 0xff6a1f },
        { type: 'fan', telegraph: 600, cooldown: 2200, count: 3, spread: 0.35, speed: 190, damage: 14, color: 0xff8a3a },
      ]},
      { hpFrac: 0.6, speed: 68, moves: [
        { type: 'geysers', telegraph: 800, cooldown: 3000, count: 5, radius: 50, damage: 22, hazard: 'fire', duration: 1400, color: 0xff6a1f },
        { type: 'spiral', telegraph: 550, cooldown: 3000, count: 16, speed: 170, damage: 14, color: 0xff8a3a },
        { type: 'charge', telegraph: 700, cooldown: 3200, chargeSpeed: 500, damage: 22 },
      ]},
      { hpFrac: 0.3, speed: 92, tint: 0xff5522, moves: [
        { type: 'crossBeams', telegraph: 600, cooldown: 2600, arms: 6, width: 44, length: 540, damage: 22, hazard: 'lava', duration: 2200, spin: true, color: 0xff5522 },
        { type: 'geysers', telegraph: 600, cooldown: 2600, count: 7, radius: 52, damage: 24, hazard: 'fire', duration: 1200, color: 0xff6a1f },
        { type: 'charge', telegraph: 500, cooldown: 2400, chargeSpeed: 600, damage: 26 },
      ]},
    ],
  },

  // ---------------------------------------------------------------
  // CITADELLE — Grior, le Roi des Monstres : combine tout, nova d'ombre
  // ---------------------------------------------------------------
  roi: {
    id: 'roi', name: 'Grior', title: 'le Roi des Monstres', sprite: 'roi',
    hp: 1550, scale: 3.0, contactDamage: 22,
    phases: [
      { hpFrac: 1.0, speed: 62, moves: [
        { type: 'aimedBurst', telegraph: 500, cooldown: 1800, count: 3, speed: 240, damage: 14, color: 0xf4c430 },
        { type: 'charge', telegraph: 620, cooldown: 3000, chargeSpeed: 540, damage: 24 },
        { type: 'summon', telegraph: 700, cooldown: 6000, summonId: 'squelette', summonCount: 2 },
      ]},
      { hpFrac: 0.66, speed: 88, moves: [
        { type: 'nova', telegraph: 750, cooldown: 3000, count: 20, speed: 200, damage: 15, color: 0xb26bff },
        { type: 'lineSweep', telegraph: 600, cooldown: 2200, width: 50, length: 420, damage: 20, color: 0xb26bff },
        { type: 'geysers', telegraph: 700, cooldown: 3000, count: 5, radius: 54, damage: 22, hazard: 'fire', duration: 1300, color: 0x8a5cff },
        { type: 'summon', telegraph: 700, cooldown: 6500, summonId: 'sorcier', summonCount: 1 },
      ]},
      { hpFrac: 0.33, speed: 118, tint: 0xffcc33, moves: [
        { type: 'spiral', telegraph: 420, cooldown: 2100, count: 24, speed: 205, damage: 16, color: 0xffcc33 },
        { type: 'nova', telegraph: 550, cooldown: 2600, count: 26, speed: 220, damage: 16, color: 0xb26bff },
        { type: 'charge', telegraph: 480, cooldown: 2000, chargeSpeed: 640, damage: 28 },
        { type: 'aimedBurst', telegraph: 400, cooldown: 1500, count: 5, speed: 260, damage: 16, color: 0xf4c430 },
      ]},
    ],
  },
};
