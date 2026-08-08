import type { PlayerStats } from './game';

export interface MetaUpgradeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxTier: number;
  costPerTier: number[]; // longueur = maxTier
  /** appliqué aux stats de base avant chaque run (tier = paliers achetés). */
  apply(base: PlayerStats, tier: number): void;
  /** effet spécial non couvert par les stats (ex: revive), lu par le moteur. */
  flag?: string;
  /** coût EN MATÉRIAUX de boss (par achat) : {id_materiau: quantité}. */
  matCost?: Record<string, number>;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'nine_lives', name: 'Neuf Vies', icon: 'heart', maxTier: 5, costPerTier: [35, 75, 150, 300, 600],
    description: '+15 PV max de base par palier.',
    apply(base, tier) { base.maxHp += 15 * tier; },
  },
  {
    id: 'sharp_claws', name: 'Griffes Aiguisées', icon: 'sword', maxTier: 5, costPerTier: [45, 95, 190, 380, 750],
    description: '+10% dégâts d’épée de base par palier.',
    apply(base, tier) { base.swordDamage = base.swordDamage.map((d) => Math.round(d * (1 + 0.1 * tier))); },
  },
  {
    id: 'feline_agility', name: 'Souplesse Féline', icon: 'dash', maxTier: 3, costPerTier: [70, 165, 330],
    description: 'Dash amélioré : palier 3 = +1 charge de départ.',
    apply(base, tier) { base.dashCooldown *= 1 - 0.1 * tier; if (tier >= 3) base.dashCharges += 1; },
  },
  {
    id: 'recovery', name: 'Récupération', icon: 'cooldown', maxTier: 4, costPerTier: [55, 110, 220, 450],
    description: '-6% cooldowns de base par palier.',
    apply(base, tier) { base.specialCooldown *= 1 - 0.06 * tier; base.dashCooldown *= 1 - 0.06 * tier; },
  },
  {
    id: 'lucky_cat', name: 'Chat Chanceux', icon: 'luck', maxTier: 3, costPerTier: [90, 220, 480],
    description: 'Pouvoirs rares plus fréquents (+8% par palier).',
    apply(base, tier) { base.luck += 0.08 * tier; },
    matCost: { voltair_cape: 1 },
  },
  {
    id: 'land_on_feet', name: 'Retombée Féline', icon: 'revive', maxTier: 3, costPerTier: [600, 1400, 3000],
    description: 'Une renaissance par palier et par run (revive à 40% des PV). Jusqu’à 3.',
    apply() { /* lu via flag + reviveCharges (nb de paliers) */ },
    flag: 'revive',
    matCost: { neantis_scepter: 1 },
  },
  {
    id: 'room_purr', name: 'Ronronthérapie', icon: 'heart', maxTier: 5, costPerTier: [40, 85, 170, 340, 640],
    description: '+5 PV soignés à chaque entrée de salle par palier (jusqu’à +25).',
    apply(base, tier) { base.roomHeal += 5 * tier; },
  },
  {
    id: 'greed', name: 'Gourmandise', icon: 'coin', maxTier: 4, costPerTier: [55, 125, 270, 540],
    description: '+12% de Croquettes Dorées gagnées par palier.',
    apply(base, tier) { base.greed += 0.12 * tier; },
  },
  {
    id: 'arsenal', name: 'Arsenal', icon: 'combo', maxTier: 1, costPerTier: [400],
    description: 'Ajoute des pouvoirs Légendaires au pool.',
    apply() { /* lu via flag */ },
    flag: 'arsenal',
    matCost: { boss_bandana: 1 },
  },
];

export function getMetaById(id: string): MetaUpgradeDef | undefined {
  return META_UPGRADES.find((m) => m.id === id);
}
