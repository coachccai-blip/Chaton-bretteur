import type { IPlayerContext } from './types';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type PowerCategory =
  | 'hp' | 'dash' | 'attack' | 'attackspeed' | 'cooldown' | 'special'
  | 'movespeed' | 'defense' | 'lifesteal' | 'luck' | 'divine';

export interface PowerDef {
  id: string;
  name: string;
  description: string;
  category: PowerCategory;
  rarity: Rarity;
  icon: string;
  /** dieu / source (habillage manga/anime) affiché sur la carte. */
  god?: string;
  repeatable?: boolean;
  locked?: boolean;
  /** carte de repli (PV max / soin) : appliquée mais NON enregistrée comme boon. */
  fallback?: boolean;
  apply(p: IPlayerContext): void;
}

export const RARITY_COLORS: Record<Rarity, number> = {
  common: 0xb8c0cc, rare: 0x4fa8ff, epic: 0xb26bff, legendary: 0xf4a020,
};
export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire',
};
// Distribution cible par apparition : Légendaire 10%, Épique 15%, Rare 25%, Commun 50%.
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50, rare: 25, epic: 15, legendary: 10,
};
/** Ordre de rareté (pour un minimum de rareté, ex. boons du marchand). */
export const RARITY_RANK: Record<Rarity, number> = {
  common: 0, rare: 1, epic: 2, legendary: 3,
};

export const POWERS: PowerDef[] = [
  // ============ COMMUNS (stats de base) ============
  {
    id: 'nine_lives', name: 'Neuf Vies', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: '+25 PV max (et soigne d’autant).',
    apply(p) { p.stats.maxHp += 25; p.heal(25); },
  },
  {
    id: 'sharp_claws', name: 'Griffes Aiguisées', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: '+22% dégâts d’épée.',
    apply(p) { p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.22)); },
  },
  {
    id: 'swift_claws', name: 'Griffes Rapides', category: 'attackspeed', rarity: 'common', icon: 'atkspeed', repeatable: true,
    description: 'Attaques 15% plus rapides.',
    apply(p) { p.stats.attackSpeedMult *= 1.15; },
  },
  {
    id: 'agile_paws', name: 'Pattes Agiles', category: 'movespeed', rarity: 'common', icon: 'movespeed', repeatable: true,
    description: '+12% vitesse de déplacement.',
    apply(p) { p.stats.moveSpeedMult *= 1.12; },
  },
  {
    id: 'quick_paws', name: 'Pattes Vives', category: 'dash', rarity: 'common', icon: 'dash', repeatable: true,
    description: '-15% cooldown de dash.',
    apply(p) { p.stats.dashCooldown *= 0.85; },
  },
  {
    id: 'iron_fur', name: 'Fourrure de Fer', category: 'defense', rarity: 'common', icon: 'armor', repeatable: true,
    description: '-12% dégâts subis.',
    apply(p) { p.stats.armor = 1 - (1 - p.stats.armor) * 0.88; },
  },
  {
    id: 'feline_reflex', name: 'Réflexes Félins', category: 'dash', rarity: 'rare', icon: 'dash',
    description: '+1 charge de dash.',
    apply(p) { p.stats.dashCharges += 1; },
  },
  {
    id: 'recovery', name: 'Récupération', category: 'cooldown', rarity: 'rare', icon: 'cooldown', repeatable: true,
    description: '-20% cooldown du spécial et du dash.',
    apply(p) { p.stats.specialCooldown *= 0.8; p.stats.dashCooldown *= 0.8; },
  },
  {
    id: 'combo_master', name: 'Maître du Combo', category: 'attack', rarity: 'epic', icon: 'combo',
    description: '+1 coup à ton combo d’épée.',
    apply(p) { p.addComboHit(); },
  },
  {
    id: 'critical_pounce', name: 'Bond Critique', category: 'attack', rarity: 'rare', icon: 'crit', repeatable: true,
    description: '+15% de chance de coup critique (×2 dégâts).',
    apply(p) { p.stats.critChance += 0.15; },
  },
  {
    id: 'lucky_cat', name: 'Chat Chanceux', category: 'luck', rarity: 'common', icon: 'luck', repeatable: true,
    description: '+chance de boons rares.',
    apply(p) { p.stats.luck += 0.12; },
  },
  {
    id: 'golden_greed', name: 'Gourmandise Dorée', category: 'luck', rarity: 'rare', icon: 'coin', repeatable: true,
    description: '+25% de Croquettes Dorées gagnées.',
    apply(p) { p.stats.greed += 0.25; },
  },
  {
    id: 'regen_shield', name: 'Bouclier Ronronnant', category: 'defense', rarity: 'epic', icon: 'shield',
    description: 'Bouclier de 30 PV qui se régénère hors combat.',
    apply(p) { p.grantMaxShield(30); },
  },

  // ============ BOONS DIVINS — Éléments (base des combos) ============
  {
    id: 'foudre_elektor', name: 'Foudre d’Elektor', god: 'Dieu de la Foudre', category: 'divine', rarity: 'epic', icon: 'lightning', repeatable: true,
    description: 'Tes coups appliquent CHOC. 35% de chance d’invoquer un éclair qui chaîne sur 3 ennemis.',
    apply(p) {
      p.addOnHit((e) => {
        e.applyStatus('shock', 2500);
        if (Math.random() < 0.35) p.combat.lightningChain(e.x, e.y, 14 + p.stats.swordDamage[0] * 0.6, 3);
      });
    },
  },
  {
    id: 'flamme_igneel', name: 'Flamme d’Igneel', god: 'Dragon de Feu', category: 'divine', rarity: 'rare', icon: 'flame', repeatable: true,
    description: 'Tes coups embrasent l’ennemi : BRÛLURE (dégâts de feu sur la durée).',
    apply(p) { p.addOnHit((e) => e.applyStatus('burn', 3000)); },
  },
  {
    id: 'givre_rukia', name: 'Givre de Rukia', god: 'Danse de Glace', category: 'divine', rarity: 'rare', icon: 'freeze', repeatable: true,
    description: 'Tes coups appliquent GEL : les ennemis ralentissent puis figent.',
    apply(p) { p.addOnHit((e) => e.applyStatus('freeze', 1600)); },
  },
  {
    id: 'crocs_venin', name: 'Crocs Venimeux', god: 'Serpent', category: 'divine', rarity: 'rare', icon: 'poison', repeatable: true,
    description: 'Tes coups empoisonnent : POISON (dégâts sur la durée qui s’intensifient).',
    apply(p) { p.addOnHit((e) => e.applyStatus('poison', 3000)); },
  },
  {
    id: 'haki_armement', name: 'Haki de l’Armement', god: 'Volonté du Roi', category: 'divine', rarity: 'epic', icon: 'fist', repeatable: true,
    description: '+25% dégâts. Tes coups MARQUENT l’ennemi : il subit +30% de dégâts de toutes sources.',
    apply(p) {
      p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.25));
      p.addOnHit((e) => e.applyStatus('mark', 4000));
    },
  },

  // ============ BOONS DIVINS — Spécial (actifs) ============
  {
    id: 'getsuga', name: 'Getsuga Tenshō', god: 'Faucheur d’Âmes', category: 'divine', rarity: 'epic', icon: 'wave',
    description: 'Ton Spécial projette une ONDE TRANCHANTE à distance qui transperce les ennemis.',
    apply(p) { p.addSpecialFlag('wave'); },
  },
  {
    id: 'megumin', name: 'EXPLOSION de Megumin', god: 'Archimage', category: 'divine', rarity: 'legendary', icon: 'boom',
    description: 'Ton Spécial devient une EXPLOSION dévastatrice : dégâts ×2.3, zone +60% (cooldown +40%).',
    apply(p) {
      p.addSpecialFlag('explosion');
      p.stats.specialDamage = Math.round(p.stats.specialDamage * 2.3);
      p.stats.specialRadius *= 1.6;
      p.stats.specialCooldown *= 1.4;
    },
  },
  {
    id: 'the_world', name: 'The World', god: 'Roi des Vampires', category: 'divine', rarity: 'legendary', icon: 'hourglass',
    description: 'Ton Spécial FIGE LE TEMPS : les ennemis sont quasi immobilisés pendant 2,2 s.',
    apply(p) { p.addSpecialFlag('timestop'); },
  },
  {
    id: 'wide_whirl', name: 'Tourbillon Ample', god: 'Vent Tranchant', category: 'special', rarity: 'rare', icon: 'special', repeatable: true,
    description: '+35% de zone et +45% de dégâts du Spécial.',
    apply(p) { p.stats.specialRadius *= 1.35; p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.45); },
  },

  // ============ BOONS DIVINS — Dash (actifs) ============
  {
    id: 'chidori', name: 'Chidori', god: 'Éclair Perforant', category: 'divine', rarity: 'epic', icon: 'lightning',
    description: 'Ton Dash transperce et inflige CHOC (+24 dégâts aux ennemis traversés).',
    apply(p) { p.stats.dashDamage += 24; p.addDashFlag('shock'); },
  },
  {
    id: 'rasengan', name: 'Rasengan', god: 'Tourbillon', category: 'divine', rarity: 'rare', icon: 'spiral',
    description: 'À la fin de ton Dash, déclenche une explosion tourbillonnante.',
    apply(p) { p.addDashFlag('burst'); },
  },

  // ============ BOONS DIVINS — Invocations / domaines (actifs) ============
  {
    id: 'kage_bunshin', name: 'Kage Bunshin', god: 'Ninja de l’Ombre', category: 'divine', rarity: 'legendary', icon: 'clone',
    description: 'Un CLONE D’OMBRE tranche sans cesse les ennemis proches de toi.',
    apply(p) {
      p.addPeriodic(650, () => {
        const near = p.combat.enemiesNear(p.combat.playerX(), p.combat.playerY(), 150);
        if (near.length === 0) return;
        const t = near[Math.floor(Math.random() * near.length)];
        p.combat.slashWave(p.combat.playerX(), p.combat.playerY(), t.x - p.combat.playerX(), t.y - p.combat.playerY(), 10 + p.stats.swordDamage[0] * 0.5);
      });
    },
  },
  {
    id: 'sukuna_domain', name: 'Sanctuaire Malfaisant', god: 'Roi des Fléaux', category: 'divine', rarity: 'legendary', icon: 'domain',
    description: 'Relance ton SPÉCIAL en continu (avec tous ses bonus) tant que des ennemis sont proches.',
    apply(p) {
      p.addPeriodic(2200, () => {
        const near = p.combat.enemiesNear(p.combat.playerX(), p.combat.playerY(), p.stats.specialRadius * 1.4);
        if (near.length > 0) p.castSpecial();
      });
    },
  },

  // ============ BOONS DIVINS — Passifs de frappe ============
  {
    id: 'ora_ora', name: 'ORA ORA ORA !', god: 'Poing Stellaire', category: 'divine', rarity: 'epic', icon: 'fist', repeatable: true,
    description: 'Rafale : +2 coups instantanés supplémentaires à chaque frappe.',
    apply(p) { p.stats.extraHits += 2; },
  },
  {
    id: 'saitama', name: 'Poing Sérieux', god: 'Héros de Loisir', category: 'divine', rarity: 'legendary', icon: 'fist',
    description: '7% de chance qu’une frappe ÉLIMINE instantanément un ennemi (hors boss).',
    apply(p) { p.stats.instakillChance += 0.07; },
  },
  {
    id: 'bankai', name: 'Bankai', god: 'Libération', category: 'divine', rarity: 'epic', icon: 'rage', repeatable: true,
    description: 'Sous 35% de PV, ta rage explose : +60% de dégâts.',
    apply(p) { p.stats.rageBelow = Math.max(p.stats.rageBelow, 0.35); p.stats.rageDamageMult *= 1.6; },
  },
  {
    id: 'gear_second', name: 'Gear Second', god: 'Homme Caoutchouc', category: 'divine', rarity: 'rare', icon: 'atkspeed',
    description: '+22% vitesse d’attaque et +15% de déplacement.',
    apply(p) { p.stats.attackSpeedMult *= 1.22; p.stats.moveSpeedMult *= 1.15; },
  },

  // ============ BOONS DIVINS — Vol de vie / défense ============
  {
    id: 'alucard', name: 'Soif d’Alucard', god: 'Roi Vampire', category: 'divine', rarity: 'legendary', icon: 'lifesteal',
    description: '+12% de vol de vie et +8 PV soignés à chaque ennemi tué.',
    apply(p) { p.stats.lifesteal += 0.12; p.addOnKill(() => p.heal(8)); },
  },
  {
    id: 'sharingan', name: 'Sharingan', god: 'Œil Prophétique', category: 'divine', rarity: 'rare', icon: 'eye',
    description: '18% de chance d’esquiver automatiquement une attaque.',
    apply(p) { p.stats.dodgeChance += 0.18; },
  },
  {
    id: 'ultra_instinct', name: 'Ultra Instinct', god: 'Instinct Suprême', category: 'divine', rarity: 'legendary', icon: 'eye',
    description: '+25% d’esquive automatique et +20% de dégâts.',
    apply(p) {
      p.stats.dodgeChance += 0.25;
      p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.2));
      p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.2);
    },
  },
  {
    id: 'spiky_fur', name: 'Poils Piquants', god: 'Ronce', category: 'defense', rarity: 'rare', icon: 'thorns',
    description: 'Renvoie 45% des dégâts subis à l’attaquant.',
    apply(p) { p.stats.thorns += 0.45; },
  },
];

export function getPowerById(id: string): PowerDef | undefined {
  return POWERS.find((p) => p.id === id);
}

/**
 * Cartes de repli proposées quand on ne peut plus obtenir de boon (tous pris,
 * ou doublon) : choix entre +25 PV max ou soin de 50 PV. Non enregistrées.
 */
export const FALLBACK_BOONS: PowerDef[] = [
  {
    id: 'fb_maxhp', name: '+25 PV max', category: 'hp', rarity: 'common', icon: 'heart', fallback: true,
    description: 'Augmente tes PV max de 25 (et soigne d’autant).',
    apply(p) { p.stats.maxHp += 25; p.heal(25); },
  },
  {
    id: 'fb_heal', name: 'Soin +50 PV', category: 'hp', rarity: 'common', icon: 'heart', fallback: true,
    description: 'Rends immédiatement 50 PV.',
    apply(p) { p.heal(50); },
  },
];
