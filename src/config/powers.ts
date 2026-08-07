import type { IPlayerContext } from './types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PowerCategory =
  | 'hp'
  | 'dash'
  | 'attack'
  | 'attackspeed'
  | 'cooldown'
  | 'special'
  | 'movespeed'
  | 'defense'
  | 'lifesteal'
  | 'luck';

export interface PowerDef {
  id: string;
  name: string;
  description: string;
  category: PowerCategory;
  rarity: Rarity;
  /** icône : clé de forme dessinée en pixel art (voir art/icons.ts). */
  icon: string;
  /** true = peut être tiré plusieurs fois dans un run (stacke). */
  repeatable?: boolean;
  /** débloqué de base ; sinon nécessite l'amélioration "Arsenal". */
  locked?: boolean;
  apply(p: IPlayerContext): void;
}

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xb8c0cc,
  rare: 0x4fa8ff,
  epic: 0xb26bff,
  legendary: 0xf4a020,
};

export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Commun',
  rare: 'Rare',
  epic: 'Épique',
  legendary: 'Légendaire',
};

/** Poids de tirage de base par rareté (améliorable via la méta "Chat Chanceux"). */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  rare: 28,
  epic: 10,
  legendary: 2,
};

export const POWERS: PowerDef[] = [
  // ---- PV ----
  {
    id: 'nine_lives', name: 'Neuf Vies', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: '+25 PV max (et soigne d’autant).',
    apply(p) { p.stats.maxHp += 25; p.heal(25); },
  },
  {
    id: 'purring_regen', name: 'Ronron Régénérant', category: 'hp', rarity: 'rare', icon: 'heartplus',
    description: 'Soigne 6 PV à chaque salle nettoyée.',
    apply(p) { p.addOnRoomClear(() => p.heal(6)); },
  },
  // ---- Dash ----
  {
    id: 'feline_reflex', name: 'Réflexes Félins', category: 'dash', rarity: 'rare', icon: 'dash',
    description: '+1 charge de dash.',
    apply(p) { p.stats.dashCharges += 1; },
  },
  {
    id: 'claw_trail', name: 'Traînée de Griffes', category: 'dash', rarity: 'epic', icon: 'clawtrail',
    description: 'Le dash inflige 18 dégâts aux ennemis traversés.',
    apply(p) { p.stats.dashDamage += 18; },
  },
  {
    id: 'quick_paws', name: 'Pattes Vives', category: 'dash', rarity: 'common', icon: 'dash', repeatable: true,
    description: '-15% cooldown de dash.',
    apply(p) { p.stats.dashCooldown *= 0.85; },
  },
  // ---- Attaque épée ----
  {
    id: 'sharp_claws', name: 'Griffes Aiguisées', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: '+20% dégâts d’épée.',
    apply(p) { p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.2)); },
  },
  {
    id: 'combo_master', name: 'Maître du Combo', category: 'attack', rarity: 'epic', icon: 'combo',
    description: '+1 coup à ton combo d’épée.',
    apply(p) { p.addComboHit(); },
  },
  {
    id: 'bleed_claws', name: 'Griffes Saignantes', category: 'attack', rarity: 'rare', icon: 'bleed',
    description: 'Tes coups infligent un saignement (dégâts sur la durée).',
    apply(p) { p.addOnHit((e) => e.applyStatus('bleed', 3000)); },
  },
  {
    id: 'frost_claws', name: 'Griffes de Givre', category: 'attack', rarity: 'rare', icon: 'freeze',
    description: 'Tes coups gèlent brièvement les ennemis.',
    apply(p) { p.addOnHit((e) => e.applyStatus('freeze', 1200)); },
  },
  {
    id: 'critical_pounce', name: 'Bond Critique', category: 'attack', rarity: 'epic', icon: 'crit', repeatable: true,
    description: '+15% de chance de coup critique (×2 dégâts).',
    apply(p) { p.stats.critChance += 0.15; },
  },
  // ---- Vitesse d'attaque ----
  {
    id: 'swift_claws', name: 'Griffes Rapides', category: 'attackspeed', rarity: 'common', icon: 'atkspeed', repeatable: true,
    description: 'Attaques 15% plus rapides.',
    apply(p) { p.stats.attackSpeedMult *= 1.15; },
  },
  // ---- Cooldown ----
  {
    id: 'recovery', name: 'Récupération', category: 'cooldown', rarity: 'rare', icon: 'cooldown', repeatable: true,
    description: '-20% cooldown du spécial et du dash.',
    apply(p) { p.stats.specialCooldown *= 0.8; p.stats.dashCooldown *= 0.8; },
  },
  // ---- Spécial ----
  {
    id: 'wide_whirl', name: 'Tourbillon Ample', category: 'special', rarity: 'rare', icon: 'special', repeatable: true,
    description: '+30% de zone et +40% de dégâts du spécial.',
    apply(p) { p.stats.specialRadius *= 1.3; p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.4); },
  },
  {
    id: 'battle_focus', name: 'Concentration', category: 'special', rarity: 'epic', icon: 'focus',
    description: 'Chaque ennemi tué réduit le cooldown du spécial de 0,4 s.',
    apply(p) { p.addOnKill(() => { /* géré par Player via flag */ p.stats.specialCdOnKill = (p.stats.specialCdOnKill ?? 0) + 400; }); },
  },
  // ---- Vitesse de déplacement ----
  {
    id: 'agile_paws', name: 'Pattes Agiles', category: 'movespeed', rarity: 'common', icon: 'movespeed', repeatable: true,
    description: '+12% vitesse de déplacement.',
    apply(p) { p.stats.moveSpeedMult *= 1.12; },
  },
  // ---- Défensif ----
  {
    id: 'iron_fur', name: 'Fourrure de Fer', category: 'defense', rarity: 'rare', icon: 'armor', repeatable: true,
    description: '-12% dégâts subis.',
    apply(p) { p.stats.armor = 1 - (1 - p.stats.armor) * 0.88; },
  },
  {
    id: 'regen_shield', name: 'Bouclier Ronronnant', category: 'defense', rarity: 'epic', icon: 'shield',
    description: 'Gagne un bouclier de 30 PV qui se régénère hors combat.',
    apply(p) { p.grantMaxShield(30); },
  },
  {
    id: 'spiky_fur', name: 'Poils Piquants', category: 'defense', rarity: 'rare', icon: 'thorns',
    description: 'Renvoie 40% des dégâts subis à l’attaquant.',
    apply(p) { p.stats.thorns += 0.4; },
  },
  // ---- Vol de vie ----
  {
    id: 'vampiric_purr', name: 'Ronron Vampirique', category: 'lifesteal', rarity: 'legendary', icon: 'lifesteal',
    description: 'Soigne 8% des dégâts infligés.',
    apply(p) { p.stats.lifesteal += 0.08; },
  },
  // ---- Chance / économie ----
  {
    id: 'lucky_cat', name: 'Chat Chanceux', category: 'luck', rarity: 'common', icon: 'luck', repeatable: true,
    description: '+chance de pouvoirs rares.',
    apply(p) { p.stats.luck += 0.12; },
  },
  {
    id: 'golden_greed', name: 'Gourmandise Dorée', category: 'luck', rarity: 'rare', icon: 'coin', repeatable: true,
    description: '+25% de Croquettes Dorées gagnées.',
    apply(p) { p.stats.greed += 0.25; },
  },
];

export function getPowerById(id: string): PowerDef | undefined {
  return POWERS.find((p) => p.id === id);
}
