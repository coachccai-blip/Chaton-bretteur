export type BossMoveType = 'ringShot' | 'aimedBurst' | 'shockwave' | 'summon' | 'charge' | 'spiral';

export interface BossMove {
  type: BossMoveType;
  telegraph: number;
  cooldown: number;
  // params selon le type
  count?: number; // projectiles
  speed?: number;
  damage?: number;
  radius?: number; // shockwave
  summonId?: string;
  summonCount?: number;
  chargeSpeed?: number;
}

export interface BossPhase {
  /** déclenchée quand hp <= hpFrac * hpMax */
  hpFrac: number;
  moves: BossMove[];
  /** vitesse de déplacement pendant la phase */
  speed: number;
  tint?: number; // teinte "enragée"
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
  araignee: {
    id: 'araignee', name: 'Broussaille', title: 'l’Araignée-Mère', sprite: 'araignee',
    hp: 620, scale: 2.4, contactDamage: 14,
    phases: [
      { hpFrac: 1.0, speed: 70, moves: [
        { type: 'aimedBurst', telegraph: 550, cooldown: 2200, count: 3, speed: 210, damage: 12 },
        { type: 'summon', telegraph: 800, cooldown: 6000, summonId: 'chauvesouris', summonCount: 3 },
      ]},
      { hpFrac: 0.5, speed: 110, tint: 0xff6699, moves: [
        { type: 'charge', telegraph: 650, cooldown: 2600, chargeSpeed: 520, damage: 16 },
        { type: 'ringShot', telegraph: 700, cooldown: 2800, count: 10, speed: 190, damage: 12 },
        { type: 'summon', telegraph: 800, cooldown: 7000, summonId: 'slime', summonCount: 3 },
      ]},
    ],
  },
  crapaudroi: {
    id: 'crapaudroi', name: 'Bufo', title: 'le Vorace', sprite: 'crapaudroi',
    hp: 780, scale: 2.5, contactDamage: 16,
    phases: [
      { hpFrac: 1.0, speed: 60, moves: [
        { type: 'shockwave', telegraph: 800, cooldown: 3000, radius: 150, damage: 18 },
        { type: 'aimedBurst', telegraph: 500, cooldown: 2000, count: 1, speed: 230, damage: 12 },
      ]},
      { hpFrac: 0.55, speed: 90, tint: 0x88ff88, moves: [
        { type: 'shockwave', telegraph: 700, cooldown: 2600, radius: 175, damage: 20 },
        { type: 'ringShot', telegraph: 650, cooldown: 2600, count: 12, speed: 175, damage: 12 },
        { type: 'summon', telegraph: 700, cooldown: 6500, summonId: 'crapaud', summonCount: 2 },
      ]},
    ],
  },
  golem: {
    id: 'golem', name: 'Ignar', title: 'le Golem de Forge', sprite: 'golem',
    hp: 980, scale: 2.8, contactDamage: 18,
    phases: [
      { hpFrac: 1.0, speed: 50, moves: [
        { type: 'ringShot', telegraph: 750, cooldown: 2800, count: 8, speed: 170, damage: 14 },
        { type: 'charge', telegraph: 800, cooldown: 3200, chargeSpeed: 480, damage: 20 },
      ]},
      { hpFrac: 0.6, speed: 70, moves: [
        { type: 'spiral', telegraph: 600, cooldown: 3200, count: 16, speed: 165, damage: 12 },
        { type: 'shockwave', telegraph: 700, cooldown: 3000, radius: 170, damage: 22 },
      ]},
      { hpFrac: 0.3, speed: 95, tint: 0xff5522, moves: [
        { type: 'spiral', telegraph: 450, cooldown: 2400, count: 20, speed: 185, damage: 14 },
        { type: 'charge', telegraph: 550, cooldown: 2400, chargeSpeed: 560, damage: 24 },
      ]},
    ],
  },
  roi: {
    id: 'roi', name: 'Grior', title: 'le Roi des Monstres', sprite: 'roi',
    hp: 1500, scale: 3.0, contactDamage: 22,
    phases: [
      { hpFrac: 1.0, speed: 60, moves: [
        { type: 'aimedBurst', telegraph: 500, cooldown: 1900, count: 3, speed: 240, damage: 14 },
        { type: 'charge', telegraph: 650, cooldown: 3000, chargeSpeed: 540, damage: 24 },
      ]},
      { hpFrac: 0.66, speed: 85, moves: [
        { type: 'ringShot', telegraph: 600, cooldown: 2400, count: 14, speed: 195, damage: 14 },
        { type: 'summon', telegraph: 700, cooldown: 6000, summonId: 'squelette', summonCount: 2 },
        { type: 'shockwave', telegraph: 650, cooldown: 3000, radius: 180, damage: 24 },
      ]},
      { hpFrac: 0.33, speed: 115, tint: 0xffcc33, moves: [
        { type: 'spiral', telegraph: 400, cooldown: 2000, count: 22, speed: 205, damage: 16 },
        { type: 'charge', telegraph: 500, cooldown: 2000, chargeSpeed: 620, damage: 28 },
        { type: 'aimedBurst', telegraph: 400, cooldown: 1600, count: 5, speed: 260, damage: 16 },
      ]},
    ],
  },
};
