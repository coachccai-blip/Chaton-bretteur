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
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: 'nine_lives', name: 'Neuf Vies', icon: 'heart', maxTier: 5, costPerTier: [20, 40, 80, 160, 320],
    description: '+15 PV max de base par palier.',
    apply(base, tier) { base.maxHp += 15 * tier; },
  },
  {
    id: 'sharp_claws', name: 'Griffes Aiguisées', icon: 'sword', maxTier: 5, costPerTier: [25, 50, 100, 200, 400],
    description: '+10% dégâts d’épée de base par palier.',
    apply(base, tier) { base.swordDamage = base.swordDamage.map((d) => Math.round(d * (1 + 0.1 * tier))); },
  },
  {
    id: 'feline_agility', name: 'Souplesse Féline', icon: 'dash', maxTier: 3, costPerTier: [40, 90, 180],
    description: 'Dash amélioré : palier 3 = +1 charge de départ.',
    apply(base, tier) { base.dashCooldown *= 1 - 0.1 * tier; if (tier >= 3) base.dashCharges += 1; },
  },
  {
    id: 'recovery', name: 'Récupération', icon: 'cooldown', maxTier: 4, costPerTier: [30, 60, 120, 240],
    description: '-6% cooldowns de base par palier.',
    apply(base, tier) { base.specialCooldown *= 1 - 0.06 * tier; base.dashCooldown *= 1 - 0.06 * tier; },
  },
  {
    id: 'lucky_cat', name: 'Chat Chanceux', icon: 'luck', maxTier: 3, costPerTier: [50, 120, 260],
    description: 'Pouvoirs rares plus fréquents (+8% par palier).',
    apply(base, tier) { base.luck += 0.08 * tier; },
  },
  {
    id: 'land_on_feet', name: 'Retombée Féline', icon: 'revive', maxTier: 1, costPerTier: [300],
    description: 'Une seconde chance par run (revive à 40% des PV).',
    apply() { /* lu via flag */ },
    flag: 'revive',
  },
  {
    id: 'greed', name: 'Gourmandise', icon: 'coin', maxTier: 4, costPerTier: [30, 70, 150, 300],
    description: '+12% de Croquettes Dorées gagnées par palier.',
    apply(base, tier) { base.greed += 0.12 * tier; },
  },
  {
    id: 'arsenal', name: 'Arsenal', icon: 'combo', maxTier: 1, costPerTier: [200],
    description: 'Ajoute des pouvoirs Légendaires au pool.',
    apply() { /* lu via flag */ },
    flag: 'arsenal',
  },
];

export function getMetaById(id: string): MetaUpgradeDef | undefined {
  return META_UPGRADES.find((m) => m.id === id);
}
