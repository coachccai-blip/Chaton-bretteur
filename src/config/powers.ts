import type { IPlayerContext, IEnemyLike } from './types';

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

/** Compteur pour générer des clés de buff uniques par acquisition (empilement). */
let buffUid = 0;
/** Ennemi vivant le plus proche d'un point (helper des pouvoirs actifs). */
function nearest(p: IPlayerContext, x: number, y: number, r: number): IEnemyLike | null {
  const list = p.combat.enemiesNear(x, y, r);
  let best: IEnemyLike | null = null, bestD = Infinity;
  for (const e of list) {
    if (!e.isAlive()) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}
/** Applique un ralentissement à un ennemi s'il le supporte. */
function slowEnemy(e: IEnemyLike, factor: number, ms: number): void {
  const anyE = e as unknown as { applySlow?: (f: number, ms: number) => void };
  anyE.applySlow?.(factor, ms);
}

export const POWERS: PowerDef[] = [
  // ============================================================
  //  COMMUNS (50)
  // ============================================================
  {
    id: 'nine_lives', name: 'Neuf Vies', god: 'Chaton', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: '+25 PV max (et soigne d’autant).',
    apply(p) { p.stats.maxHp += 25; p.heal(25); },
  },
  {
    id: 'sharp_claws', name: 'Griffes Aiguisées', god: 'Chaton', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: '+22% dégâts d’épée.',
    apply(p) { p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.22)); },
  },
  {
    id: 'swift_claws', name: 'Griffes Rapides', god: 'Chaton', category: 'attackspeed', rarity: 'common', icon: 'atkspeed', repeatable: true,
    description: '+15% vitesse d’attaque.',
    apply(p) { p.stats.attackSpeedMult *= 1.15; },
  },
  {
    id: 'agile_paws', name: 'Pattes Agiles', god: 'Chaton', category: 'movespeed', rarity: 'common', icon: 'movespeed', repeatable: true,
    description: '+12% vitesse de déplacement.',
    apply(p) { p.stats.moveSpeedMult *= 1.12; },
  },
  {
    id: 'quick_paws', name: 'Pattes Vives', god: 'Chaton', category: 'dash', rarity: 'common', icon: 'dash', repeatable: true,
    description: '-15% cooldown de dash.',
    apply(p) { p.stats.dashCooldown *= 0.85; },
  },
  {
    id: 'iron_fur', name: 'Fourrure de Fer', god: 'Chaton', category: 'defense', rarity: 'common', icon: 'armor', repeatable: true,
    description: '-12% dégâts subis.',
    apply(p) { p.stats.armor = 1 - (1 - p.stats.armor) * 0.88; },
  },
  {
    id: 'lucky_cat', name: 'Chat Chanceux', god: 'Maneki-neko', category: 'luck', rarity: 'common', icon: 'luck', repeatable: true,
    description: '+chance de boons rares, épiques et légendaires.',
    apply(p) { p.stats.luck += 0.12; },
  },
  {
    id: 'golden_greed', name: 'Gourmandise Dorée', god: 'Chaton', category: 'luck', rarity: 'common', icon: 'coin', repeatable: true,
    description: '+25% de Croquettes Dorées gagnées.',
    apply(p) { p.stats.greed += 0.25; },
  },
  {
    id: 'roulade', name: 'Roulade', god: 'Vayne', category: 'dash', rarity: 'common', icon: 'dash', repeatable: true,
    description: '+10% de distance de dash. Après un dash, la prochaine attaque inflige +30% (cumulable).',
    apply(p) { p.stats.dashDistance = Math.round(p.stats.dashDistance * 1.10); p.mods.tumble = (p.mods.tumble || 0) + 1; },
  },
  {
    id: 'wilix_rollerblade', name: 'Wilix Rollerblade', god: 'Patineur Cosmique', category: 'attack', rarity: 'epic', icon: 'lightning', repeatable: true,
    description: 'Triple le nombre d’armes en orbite et accélère leur rotation de +300%. Inutile seul — combo avec Le Marteau de Thor et La 3ᵉ Lame de Zoro.',
    apply(p) { p.mods.orbitMult = (p.mods.orbitMult || 1) * 3; p.mods.orbitSpeedMult = (p.mods.orbitSpeedMult || 1) * 4; },
  },
  {
    id: 'swords_dance', name: 'Danse-Lames', god: 'Dresseur', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: '+4% de dégâts par salle nettoyée sans mourir (max +20%).',
    apply(p) {
      const key = 'danse' + (buffUid++); let stacks = 0;
      p.addOnRoomClear(() => { stacks = Math.min(5, stacks + 1); p.addBuff(key, 9e8, { dmg: 1 + 0.04 * stacks }); });
    },
  },
  {
    id: 'devil_ghost', name: 'Fantôme du Démon', god: 'Running-back', category: 'movespeed', rarity: 'common', icon: 'dash', repeatable: true,
    description: 'Après un dash, +40% de vitesse pendant 1 s.',
    apply(p) { p.addOnDash(() => p.addBuff('phantom' + (buffUid++), 1000, { spd: 1.4 })); },
  },
  {
    id: 'devil_run', name: 'Course du Diable', god: 'Running-back', category: 'movespeed', rarity: 'common', icon: 'movespeed', repeatable: true,
    description: '+18% de vitesse quand les PV sont sous 50%.',
    apply(p) { p.mods.courseDiable = 1; },
  },
  {
    id: 'sprint42', name: 'Sprint 4,2 s', god: 'Running-back', category: 'movespeed', rarity: 'common', icon: 'dash', repeatable: true,
    description: 'Au début de chaque salle, +50% de vitesse pendant 4,2 s.',
    apply(p) { p.addOnRoomStart(() => p.addBuff('sprint' + (buffUid++), 4200, { spd: 1.5 })); },
  },
  {
    id: 'lethal_tempo', name: 'Tempo Mortel', god: 'Chasseuse', category: 'attackspeed', rarity: 'common', icon: 'atkspeed', repeatable: true,
    description: 'Chaque coup donne +2% de vitesse d’attaque (max 10, 3 s).',
    apply(p) {
      const key = 'tempo' + (buffUid++); let stacks = 0, last = 0;
      p.addOnHit(() => {
        const now = performance.now();
        if (now - last > 3000) stacks = 0;
        last = now; stacks = Math.min(10, stacks + 1);
        p.addBuff(key, 3000, { as: 1 + 0.02 * stacks });
      });
    },
  },
  {
    id: 'fleet_footwork', name: 'Jeu de Jambes', god: 'Vagabond', category: 'attack', rarity: 'common', icon: 'movespeed', repeatable: true,
    description: 'Certains coups soignent 3 PV et ralentissent brièvement la cible.',
    apply(p) { p.addOnHit((e) => { if (Math.random() < 0.25) { p.heal(3); slowEnemy(e, 0.7, 600); } }); },
  },
  {
    id: 'celerity', name: 'Célérité', god: 'Vagabond', category: 'movespeed', rarity: 'common', icon: 'movespeed', repeatable: true,
    description: '+8% de vitesse, +16% hors combat.',
    apply(p) { p.stats.moveSpeedMult *= 1.08; p.mods.celerite = 1; },
  },
  {
    id: 'second_wind', name: 'Second Souffle', god: 'Vagabond', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: 'Régénère 1 PV/s hors combat.',
    apply(p) { p.mods.regenOoc = (p.mods.regenOoc || 0) + 1; },
  },
  {
    id: 'super_serum', name: 'Sérum du Super-Chaton', god: 'Super-Soldat', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: '+10 PV max et +5% de dégâts.',
    apply(p) { p.stats.maxHp += 10; p.heal(10); p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.05)); },
  },
  {
    id: 'spider_sense', name: 'Sens du Chaton', god: 'Tisseur', category: 'defense', rarity: 'common', icon: 'eye', repeatable: true,
    description: 'Les télégraphes d’attaques ennemies durent 25% plus longtemps.',
    apply(p) { p.stats.telegraphMult *= 1.25; },
  },
  {
    id: 'vibranium_skin', name: 'Peau de Vibranium', god: 'Panthère', category: 'defense', rarity: 'common', icon: 'armor', repeatable: true,
    description: 'Le premier coup reçu dans chaque salle est réduit de 50%.',
    apply(p) { p.mods.vibranium = 1; },
  },
  {
    id: 'warrior_rage', name: 'Rage du Guerrier', god: 'Spartiate', category: 'movespeed', rarity: 'common', icon: 'rage', repeatable: true,
    description: 'À chaque ennemi tué : +10% de vitesse pendant 2 s.',
    apply(p) { p.addOnKill(() => p.addBuff('warrior' + (buffUid++), 2000, { spd: 1.1 })); },
  },
  {
    id: 'squirtle_shell', name: 'Carapace de Carapuce', god: 'Dresseur', category: 'defense', rarity: 'common', icon: 'shield', repeatable: true,
    description: 'Bouclier de 10 PV qui se régénère hors combat.',
    apply(p) { p.grantMaxShield(10); },
  },
  {
    id: 'static', name: 'Statik', god: 'Dresseur', category: 'defense', rarity: 'common', icon: 'lightning', repeatable: true,
    description: '10% de chance d’électriser (CHOC) un ennemi qui te touche.',
    apply(p) { p.stats.contactShockChance += 0.10; },
  },
  {
    id: 'extreme_speed', name: 'Vitesse Extrême', god: 'Dresseur', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: 'Le premier coup de chaque combo inflige +30% de dégâts.',
    apply(p) { p.stats.firstComboMult *= 1.3; },
  },
  {
    id: 'fire_fang', name: 'Croc de Feu', god: 'Dresseur', category: 'divine', rarity: 'common', icon: 'flame', repeatable: true,
    description: '10% de chance d’appliquer une BRÛLURE légère par coup.',
    apply(p) { p.stats.fangBurn += 0.10; p.mods.elemFire = 1; },
  },
  {
    id: 'ice_fang', name: 'Croc de Givre', god: 'Dresseur', category: 'divine', rarity: 'common', icon: 'freeze', repeatable: true,
    description: '10% de chance d’appliquer un GEL court par coup.',
    apply(p) { p.stats.fangFreeze += 0.10; p.mods.elemFreeze = 1; },
  },
  {
    id: 'thunder_fang', name: 'Croc Éclair', god: 'Dresseur', category: 'divine', rarity: 'common', icon: 'lightning', repeatable: true,
    description: '10% de chance d’appliquer CHOC par coup.',
    apply(p) { p.stats.fangShock += 0.10; },
  },
  {
    id: 'razor_edge', name: 'Fil du Rasoir', god: 'Forgeron', category: 'attack', rarity: 'common', icon: 'crit', repeatable: true,
    description: 'Les coups critiques infligent ×2,2 au lieu de ×2.',
    apply(p) { p.stats.critMult += 0.2; },
  },
  {
    id: 'grapple', name: 'Grappin d’Exploration', god: 'Bataillon', category: 'dash', rarity: 'common', icon: 'dash', repeatable: true,
    description: 'Le dash vers un ennemi est légèrement aimanté.',
    apply(p) { p.mods.dashMagnet = 1; },
  },
  {
    id: 'sasha_ration', name: 'Ration de Sasha', god: 'Bataillon', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: 'Tous les soins reçus sont augmentés de 20%.',
    apply(p) { p.stats.healReceivedMult += 0.20; },
  },
  {
    id: 'perfect_clean', name: 'Nettoyage Parfait', god: 'Bataillon', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: '+8% de dégâts par ennemi tué sans être touché (max +24%, RàZ si touché).',
    apply(p) {
      p.mods.nettoyage = 1;
      p.addOnKill(() => { if (!p.mods.hitThisRoom) p.roomDamageBonus = Math.min(0.24, p.roomDamageBonus + 0.08); });
    },
  },
  {
    id: 'black_belt', name: 'Ceinture Noire', god: 'Dojo', category: 'defense', rarity: 'common', icon: 'eye', repeatable: true,
    description: '+6% de chance d’esquive automatique.',
    apply(p) { p.stats.dodgeChance += 0.06; },
  },
  {
    id: 'turtle_training', name: 'Entraînement de Tortue', god: 'Ermite', category: 'attack', rarity: 'common', icon: 'fist', repeatable: true,
    description: '+8% de dégâts et +8 PV max.',
    apply(p) { p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.08)); p.stats.maxHp += 8; p.heal(8); },
  },
  {
    id: 'senzu_crumbs', name: 'Senzu Émietté', god: 'Ermite', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: 'Chaque âme récupérée rend 2 PV.',
    apply(p) { p.stats.soulHealBonus += 2; },
  },
  {
    id: 'scouter', name: 'Scouter', god: 'Guerrier de l’Espace', category: 'attack', rarity: 'common', icon: 'eye', repeatable: true,
    description: 'Affiche les PV des ennemis et +5% de chance de critique.',
    apply(p) { p.stats.critChance += 0.05; p.mods.scouter = 1; },
  },
  {
    id: 'light_web', name: 'Toile Légère', god: 'Tisseur', category: 'attack', rarity: 'common', icon: 'spiral', repeatable: true,
    description: 'Les coups ralentissent l’ennemi de 12% pendant 0,8 s.',
    apply(p) { p.stats.hitSlow += 0.12; },
  },
  {
    id: 'shield_ricochet', name: 'Ricochet du Bouclier', god: 'Super-Soldat', category: 'attack', rarity: 'common', icon: 'shield', repeatable: true,
    description: 'Le 3e coup du combo projette une onde circulaire (portée 90).',
    apply(p) { p.addOnHit((_e, _d, _c, info) => { if (info?.finisher) p.combat.shieldWave(p.px(), p.py(), 90, 8); }); },
  },
  {
    id: 'repulsor', name: 'Gant Réacteur', god: 'Ingénieur', category: 'special', rarity: 'common', icon: 'special', repeatable: true,
    description: '+15% de dégâts du Spécial.',
    apply(p) { p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.15); },
  },
  {
    id: 'apprentice_hammer', name: 'Marteau d’Apprenti', god: 'Asgard', category: 'special', rarity: 'common', icon: 'special', repeatable: true,
    description: '+10% de dégâts du Spécial et du dash.',
    apply(p) { p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.1); p.stats.dashDamage = Math.round(p.stats.dashDamage * 1.1); },
  },
  {
    id: 'healing_factor', name: 'Facteur Guérison', god: 'Mercenaire', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: '+1 PV/s quand les PV sont sous 30%.',
    apply(p) { p.mods.regenLow = (p.mods.regenLow || 0) + 1; },
  },
  {
    id: 'rodeo_drive', name: 'Rodéo Drive', god: 'Running-back', category: 'attack', rarity: 'common', icon: 'dash', repeatable: true,
    description: 'Une esquive au dash près d’un ennemi : +20% de dégâts pendant 2 s.',
    apply(p) { p.addOnDash(() => { if (p.combat.enemiesNear(p.px(), p.py(), 140).length) p.addBuff('rodeo' + (buffUid++), 2000, { dmg: 1.2 }); }); },
  },
  {
    id: 'rubber_body', name: 'Corps de Gomme', god: 'Pirate', category: 'defense', rarity: 'common', icon: 'armor', repeatable: true,
    description: 'Le corps élastique amortit les coups : -10% de dégâts subis.',
    apply(p) { p.stats.armor = 1 - (1 - p.stats.armor) * 0.90; p.stats.knockbackResist = Math.min(0.9, p.stats.knockbackResist + 0.5); },
  },
  {
    id: 'red_stone', name: 'Éclat de Pierre Rouge', god: 'Alchimiste', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: 'Les cartes de repli soignent 50% de plus.',
    apply(p) { p.mods.fallbackHealBonus = (p.mods.fallbackHealBonus || 0) + 0.5; },
  },
  {
    id: 'transmutation', name: 'Transmutation Mineure', god: 'Alchimiste', category: 'defense', rarity: 'common', icon: 'shield', repeatable: true,
    description: 'Désamorce les pièges au sol autour du chaton.',
    apply(p) { p.mods.disarm = 1; },
  },
  {
    id: 'death_note', name: 'Page du Carnet', god: 'Shinigami', category: 'attack', rarity: 'common', icon: 'crit', repeatable: true,
    description: 'Les ennemis (hors boss) sous 8% de PV meurent instantanément.',
    apply(p) { p.stats.execThreshold = Math.max(p.stats.execThreshold, 0.08); },
  },
  {
    id: 'oran_berry', name: 'Baie Oran', god: 'Dresseur', category: 'hp', rarity: 'common', icon: 'heart', repeatable: true,
    description: 'Sous 50% de PV : soin immédiat de 12 PV (1×/salle).',
    apply(p) { p.mods.baie = 1; },
  },
  {
    id: 'night_vision', name: 'Vision Nocturne', god: 'Chaton', category: 'attack', rarity: 'common', icon: 'eye', repeatable: true,
    description: 'Sens aiguisés dans le noir : +5% de critique et +5% d’esquive.',
    apply(p) { p.stats.critChance += 0.05; p.stats.dodgeChance += 0.05; p.mods.reveal = 1; },
  },
  {
    id: 'radar_whiskers', name: 'Moustaches Radar', god: 'Chaton', category: 'defense', rarity: 'common', icon: 'eye', repeatable: true,
    description: 'Les projectiles ennemis proches sont ralentis de 15%.',
    apply(p) { p.stats.projSlowRadius = Math.max(p.stats.projSlowRadius, 70); p.mods.projSlow = 1; },
  },
  {
    id: 'balance_tail', name: 'Queue Équilibrière', god: 'Chaton', category: 'attack', rarity: 'common', icon: 'sword', repeatable: true,
    description: 'Permet de trancher PENDANT le dash (1 coup par dash).',
    apply(p) { p.mods.dashAttack = 1; },
  },

  // ============================================================
  //  RARES (25)
  // ============================================================
  {
    id: 'feline_reflex', name: 'Réflexes Félins', god: 'Chaton', category: 'dash', rarity: 'rare', icon: 'dash',
    description: '+1 charge de dash.',
    apply(p) { p.stats.dashCharges += 1; p.syncDashCharges(); },
  },
  {
    id: 'recovery', name: 'Récupération', god: 'Chaton', category: 'cooldown', rarity: 'rare', icon: 'cooldown', repeatable: true,
    description: '-20% cooldown du Spécial et du dash.',
    apply(p) { p.stats.specialCooldown *= 0.8; p.stats.dashCooldown *= 0.8; },
  },
  {
    id: 'critical_pounce', name: 'Bond Critique', god: 'Chaton', category: 'attack', rarity: 'rare', icon: 'crit', repeatable: true,
    description: '+15% de chance de coup critique (×2 dégâts).',
    apply(p) { p.stats.critChance += 0.15; },
  },
  {
    id: 'flamme_igneel', name: 'Flamme d’Igneel', god: 'Dragon de Feu', category: 'divine', rarity: 'rare', icon: 'flame', repeatable: true,
    description: 'Les coups appliquent BRÛLURE (dégâts de feu sur 3 s).',
    apply(p) { p.addOnHit((e) => e.applyStatus('burn', 3000)); p.mods.elemFire = 1; },
  },
  {
    id: 'givre_rukia', name: 'Givre de Rukia', god: 'Danse de Glace', category: 'divine', rarity: 'rare', icon: 'freeze', repeatable: true,
    description: 'Les coups ont 10% de chances d’appliquer GEL (1,6 s) : ralentit puis fige.',
    apply(p) { p.addOnHit((e) => { if (Math.random() < 0.10) e.applyStatus('freeze', 1600); }); p.mods.elemFreeze = 1; },
  },
  {
    id: 'crocs_venin', name: 'Crocs Venimeux', god: 'Serpent', category: 'divine', rarity: 'rare', icon: 'poison', repeatable: true,
    description: 'Les coups appliquent POISON (3 s, dégâts croissants).',
    apply(p) { p.addOnHit((e) => e.applyStatus('poison', 3000)); p.mods.elemPoison = 1; },
  },
  {
    id: 'rasengan', name: 'Rasengan', god: 'Tourbillon', category: 'divine', rarity: 'rare', icon: 'spiral',
    description: 'À la fin du dash : explosion tourbillonnante de zone.',
    apply(p) { p.addDashFlag('burst'); },
  },
  {
    id: 'gear_second', name: 'Gear Second', god: 'Homme Caoutchouc', category: 'attackspeed', rarity: 'rare', icon: 'atkspeed',
    description: '+22% de vitesse d’attaque et +15% de déplacement.',
    apply(p) { p.stats.attackSpeedMult *= 1.22; p.stats.moveSpeedMult *= 1.15; },
  },
  {
    id: 'sharingan', name: 'Sharingan', god: 'Œil Prophétique', category: 'divine', rarity: 'rare', icon: 'eye',
    description: '18% de chance d’esquiver automatiquement une attaque.',
    apply(p) { p.stats.dodgeChance += 0.18; },
  },
  {
    id: 'spiky_fur', name: 'Poil Voile Miroir', god: 'Ronce', category: 'defense', rarity: 'rare', icon: 'thorns',
    description: 'Pendant le dash, invincible aux projectiles : ils sont renvoyés vers l’ennemi le plus proche (×1,5 dégâts).',
    apply(p) { p.mods.mirrorVeil = 1; },
  },
  {
    id: 'wide_whirl', name: 'Tourbillon Ample', god: 'Vent Tranchant', category: 'special', rarity: 'rare', icon: 'special', repeatable: true,
    description: '+35% de zone et +45% de dégâts du Spécial.',
    apply(p) { p.stats.specialRadius *= 1.35; p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.45); },
  },
  {
    id: 'water_first', name: 'Première Danse de l’Eau', god: 'Pourfendeur', category: 'divine', rarity: 'rare', icon: 'wave',
    description: 'Le dash trace un croissant d’eau (20 dégâts aux ennemis traversés).',
    apply(p) { p.addDashFlag('water'); p.stats.dashDamage += 20; },
  },
  {
    id: 'thunder_breath', name: 'Souffle du Tonnerre', god: 'Pourfendeur', category: 'divine', rarity: 'rare', icon: 'lightning',
    description: 'Tous les 6 dashes : éclair instantané traversant la ligne (45 dégâts).',
    apply(p) { p.addDashFlag('thunder6'); },
  },
  {
    id: 'pika_bolt', name: 'Fulgurance de Pika', god: 'Souris Électrique', category: 'divine', rarity: 'rare', icon: 'lightning', repeatable: true,
    description: 'Le Spécial libère 4 éclairs en croix (25 dégâts chacun).',
    apply(p) { p.addSpecialFlag('pika'); },
  },
  {
    id: 'boomerang_blade', name: 'Lame Boomerang', god: 'Guerrière du Désert', category: 'attack', rarity: 'rare', icon: 'wave',
    description: 'Le dernier coup du combo lance un boomerang qui frappe à l’aller ET au retour (18 dégâts).',
    apply(p) {
      p.addOnHit((e, _d, _c, info) => {
        if (!info?.finisher) return;
        const d = Math.hypot(e.x - p.px(), e.y - p.py()) || 1;
        p.combat.boomerang(p.px(), p.py(), (e.x - p.px()) / d, (e.y - p.py()) / d, 18);
      });
    },
  },
  {
    id: 'combat_web', name: 'Toile de Combat', god: 'Tisseur', category: 'divine', rarity: 'rare', icon: 'spiral',
    description: 'Toutes les 3 s, une toile part vers l’ennemi le plus proche et l’immobilise 1 s.',
    apply(p) {
      p.addPeriodic(3000, () => {
        const t = nearest(p, p.px(), p.py(), 340);
        if (!t) return;
        const d = Math.hypot(t.x - p.px(), t.y - p.py()) || 1;
        p.combat.friendlyShot(p.px(), p.py(), (t.x - p.px()) / d, (t.y - p.py()) / d, 420, 10, { immobilizeMs: 1000, texture: 'combat_net', scale: 1.5 });
      });
    },
  },
  {
    id: 'pistol_punch', name: 'Poing Pistolet', god: 'Pirate', category: 'attack', rarity: 'rare', icon: 'fist',
    description: 'Le coup final projette une patte à distance (26 dégâts, repousse).',
    apply(p) {
      p.addOnHit((e, _d, _c, info) => {
        if (!info?.finisher) return;
        const d = Math.hypot(e.x - p.px(), e.y - p.py()) || 1;
        p.combat.friendlyShot(p.px(), p.py(), (e.x - p.px()) / d, (e.y - p.py()) / d, 520, 26, { knockback: 260, texture: 'cat_paw', orient: true, scale: 1.3 });
      });
    },
  },
  {
    id: 'lion_pride', name: 'Orgueil du Lion', god: 'Péché de l’Orgueil', category: 'attack', rarity: 'rare', icon: 'rage',
    description: '+1% de dégâts/s dans la salle (max +30%, RàZ chaque salle).',
    apply(p) { p.mods.orgueil = 1; },
  },
  {
    id: 'explosive_cards', name: 'Cartes Explosives', god: 'Magicien', category: 'attack', rarity: 'rare', icon: 'boom', repeatable: true,
    description: 'Tous les 5 coups, 3 cartes explosent sur les ennemis proches (15 dégâts).',
    apply(p) {
      let c = 0;
      p.addOnHit(() => {
        if (++c % 5 !== 0) return;
        for (const t of p.combat.enemiesNear(p.px(), p.py(), 260).slice(0, 3)) p.combat.explosionAt(t.x, t.y, 40, 15);
      });
    },
  },
  {
    id: 'bungee_gum', name: 'Bras Élastique', god: 'Pirate', category: 'attack', rarity: 'rare', icon: 'fist', repeatable: true,
    description: '+12% de portée d’attaque de base (cumulable 3 fois).',
    apply(p) { p.mods.armReach = Math.min(3, (p.mods.armReach || 0) + 1); },
  },
  {
    id: 'third_blade', name: 'La 3ᵉ Lame de Zoro', god: 'Chasseur de Pirates', category: 'divine', rarity: 'rare', icon: 'sword',
    description: 'Un katana noir tournoie autour du chaton et tranche les ennemis (8 dégâts).',
    apply(p) { p.mods.orbitBlade = (p.mods.orbitBlade || 0) + 1; },
  },
  {
    id: 'heart_bulwark', name: 'Rempart du Cœur', god: 'Gardien des Glaces', category: 'defense', rarity: 'rare', icon: 'shield',
    description: 'Un bouclier frontal bloque 1 coup toutes les 2 s.',
    apply(p) { p.mods.rempart = 1; },
  },
  {
    id: 'soul_reaper', name: 'Cueilleur d’Âmes', god: 'Geôlier des Chaînes', category: 'hp', rarity: 'rare', icon: 'lifesteal',
    description: 'Les âmes sont aspirées automatiquement (rayon 200) et rendent 1 PV.',
    apply(p) { p.stats.soulMagnet += 164; p.stats.soulHealBonus += 1; },
  },
  {
    id: 'last_breath', name: 'Tornade de Yasuo', god: 'Vagabond', category: 'attack', rarity: 'rare', icon: 'wave',
    description: 'Le 3e coup lance une tornade qui avance puis explose à l’arrivée (20 dégâts, +zone).',
    apply(p) {
      p.addOnHit((e, _d, _c, info) => {
        if (!info?.finisher) return;
        const d = Math.hypot(e.x - p.px(), e.y - p.py()) || 1;
        p.combat.tornado(p.px(), p.py(), (e.x - p.px()) / d, (e.y - p.py()) / d, 20);
      });
    },
  },
  {
    id: 'flash_kunai', name: 'Kunai Éclair', god: 'Éclair Jaune', category: 'dash', rarity: 'rare', icon: 'dash',
    description: 'Le dash devient une téléportation-éclair instantanée (tous les effets de dash s’appliquent sur le trajet).',
    apply(p) { p.addDashFlag('kunai'); },
  },

  // ============================================================
  //  ÉPIQUES (15)
  // ============================================================
  {
    id: 'foudre_elektor', name: 'Foudre d’Elektor', god: 'Dieu de la Foudre', category: 'divine', rarity: 'epic', icon: 'lightning', repeatable: true,
    description: 'Les coups appliquent CHOC. 35% de chance d’un éclair qui chaîne sur 3 ennemis.',
    apply(p) {
      p.addOnHit((e) => {
        e.applyStatus('shock', 2500);
        if (Math.random() < 0.35) p.combat.lightningChain(e.x, e.y, 14 + p.stats.swordDamage[0] * 0.6, 3);
      });
    },
  },
  {
    id: 'haki_armement', name: 'Haki de l’Armement', god: 'Volonté du Roi', category: 'divine', rarity: 'epic', icon: 'fist', repeatable: true,
    description: '+25% dégâts d’épée. Les coups MARQUENT (+30% de dégâts subis, 4 s).',
    apply(p) {
      p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.25));
      p.addOnHit((e) => e.applyStatus('mark', 4000));
    },
  },
  {
    id: 'getsuga', name: 'Multi-Clonage', god: 'Maître des Clones', category: 'divine', rarity: 'epic', icon: 'clone',
    description: 'Deux mini-chats t’entourent et copient tes attaques à 10 %. Cumulable avec Kage Bunshin : chaque mini-chat gagne alors sa propre ombre qui frappe aussi.',
    apply(p) { p.mods.multiClone = 1; },
  },
  {
    id: 'chidori', name: 'Chidori', god: 'Éclair Perforant', category: 'divine', rarity: 'epic', icon: 'lightning',
    description: 'Le dash transperce et inflige CHOC (+24 dégâts aux ennemis traversés).',
    apply(p) { p.stats.dashDamage += 24; p.addDashFlag('shock'); },
  },
  {
    id: 'ora_ora', name: 'ORA ORA ORA !', god: 'Poing Stellaire', category: 'divine', rarity: 'epic', icon: 'fist', repeatable: true,
    description: '+2 coups instantanés supplémentaires à chaque frappe.',
    apply(p) { p.stats.extraHits += 2; },
  },
  {
    id: 'bankai', name: 'Bankai', god: 'Libération', category: 'divine', rarity: 'epic', icon: 'rage', repeatable: true,
    description: 'Sous 35% de PV, ta rage explose : +60% de dégâts.',
    apply(p) { p.stats.rageBelow = Math.max(p.stats.rageBelow, 0.35); p.stats.rageDamageMult *= 1.6; },
  },
  {
    id: 'combo_master', name: 'Maître du Combo', god: 'Chasseur de Démons', category: 'attack', rarity: 'epic', icon: 'combo',
    description: '+1 coup à ton combo d’épée.',
    apply(p) { p.addComboHit(); },
  },
  {
    id: 'regen_shield', name: 'Bouclier Ronronnant', god: 'Chaton', category: 'defense', rarity: 'epic', icon: 'shield',
    description: 'Bouclier de 30 PV qui se régénère hors combat.',
    apply(p) { p.grantMaxShield(30); },
  },
  {
    id: 'gate_babylon', name: 'Porte de Babylone', god: 'Roi des Héros', category: 'divine', rarity: 'epic', icon: 'sword',
    description: 'Toutes les 4 s, 3 épées dorées pleuvent sur les ennemis proches (22 dégâts).',
    apply(p) {
      p.addPeriodic(4000, () => {
        for (const t of p.combat.enemiesNear(p.px(), p.py(), 320).slice(0, 3)) {
          p.combat.beam(t.x, t.y - 120, t.x, t.y, 0xf4c430);
          p.combat.explosionAt(t.x, t.y, 34, 22);
        }
      });
    },
  },
  {
    id: 'mjolnir', name: 'Le Marteau de Thor', god: 'Dieu du Tonnerre', category: 'divine', rarity: 'epic', icon: 'lightning',
    description: 'Un marteau électrique tournoie autour du chaton (contact 10) et s’abat en foudre toutes les 5 s (35, rayon 90).',
    apply(p) {
      p.mods.orbitHammer = (p.mods.orbitHammer || 0) + 1; // marteau tournant visible + traînée électrique
      p.addPeriodic(5000, () => {
        const t = nearest(p, p.px(), p.py(), 300);
        if (!t) return;
        p.combat.lightningChain(t.x, t.y, 35, 2);
        p.combat.explosionAt(t.x, t.y, 90, 35);
      });
    },
  },
  {
    id: 'mirror_portal', name: 'Portail Miroitant', god: 'Sorcier Suprême', category: 'defense', rarity: 'epic', icon: 'domain',
    description: '20% des projectiles ennemis proches sont renvoyés (dégâts ×1,5).',
    apply(p) { p.mods.reflect = 0.2; },
  },
  {
    id: 'rasenshuriken', name: 'Rasenshuriken', god: 'Tourbillon', category: 'divine', rarity: 'epic', icon: 'spiral',
    description: 'Le Spécial lance un shuriken de vent qui explose en dôme (60, rayon 110).',
    apply(p) { p.addSpecialFlag('rasenshuriken'); },
  },
  {
    id: 'gentle_fist', name: 'Soixante-Quatre Poings', god: 'Poing Souple', category: 'divine', rarity: 'epic', icon: 'fist',
    description: 'Tous les 10 coups : rafale de 8 frappes de zone autour du chaton.',
    apply(p) {
      let c = 0;
      p.addOnHit(() => {
        if (++c % 10 !== 0) return;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          p.combat.explosionAt(p.px() + Math.cos(a) * 50, p.py() + Math.sin(a) * 50, 40, 6);
        }
      });
    },
  },
  {
    id: 'amaterasu', name: 'Flammes d’Amaterasu', god: 'Œil Éternel', category: 'divine', rarity: 'epic', icon: 'flame',
    description: 'Les coups critiques appliquent BRÛLURE NOIRE : DoT doublé, inextinguible, se propage.',
    apply(p) { p.addOnHit((e, _d, isCrit) => { if (isCrit) e.applyStatus('blackburn', 4000); }); p.mods.elemFire = 1; },
  },

  // ============================================================
  //  LÉGENDAIRES (10)
  // ============================================================
  {
    id: 'megumin', name: 'EXPLOSION de Vegeta', god: 'Prince des Saïyens', category: 'divine', rarity: 'legendary', icon: 'boom',
    description: 'Le Spécial devient une EXPLOSION dévastatrice : dégâts ×2,3, zone +60%. Coûte 1 PV à chaque usage.',
    apply(p) {
      p.addSpecialFlag('explosion');
      p.mods.vegetaCost = 1;
      p.stats.specialDamage = Math.round(p.stats.specialDamage * 2.3);
      p.stats.specialRadius *= 1.6;
      p.stats.specialCooldown *= 1.4;
    },
  },
  {
    id: 'the_world', name: 'Zharu warudo', god: 'Roi des Vampires', category: 'divine', rarity: 'legendary', icon: 'hourglass',
    description: 'Le Spécial FIGE LE TEMPS : ennemis quasi immobiles 2,2 s.',
    apply(p) { p.addSpecialFlag('timestop'); },
  },
  {
    id: 'kage_bunshin', name: 'Kage Bunshin', god: 'Ninja de l’Ombre', category: 'divine', rarity: 'legendary', icon: 'clone',
    description: 'Un clone d’ombre te suit et tranche sans cesse les ennemis proches.',
    // Le clone visible est géré par le Player (mods.kageClone) : il flotte près du
    // chaton et porte un coup de sabre spectral aux ennemis à portée.
    apply(p) { p.mods.kageClone = 1; },
  },
  {
    id: 'gravity_pull', name: 'Attraction Gravitationnelle', god: 'Seigneur des Astres', category: 'divine', rarity: 'legendary', icon: 'spiral',
    description: 'Les âmes fusent instantanément vers toi, où qu’elles soient (F = G·m₁·m₂ / r²).',
    // F = G · m₁ · m₂ / r²  — force d'attraction gravitationnelle entre le chaton et chaque âme.
    apply(p) { p.mods.gravSoul = 1; },
  },
  {
    id: 'sukuna_domain', name: 'Saimyo Territory', god: 'Roi des Fléaux', category: 'divine', rarity: 'legendary', icon: 'domain',
    description: 'Relance le SPÉCIAL en continu (avec tous ses bonus) si des ennemis sont proches.',
    apply(p) {
      p.addPeriodic(2200, () => {
        const near = p.combat.enemiesNear(p.px(), p.py(), p.stats.specialRadius * 1.4);
        if (near.length > 0) p.castSpecial(true); // relance auto : pas d'arrêt du temps
      });
    },
  },
  {
    id: 'saitama', name: 'Poing Sérieux', god: 'Héros de Loisir', category: 'divine', rarity: 'legendary', icon: 'fist',
    description: '7% de chance qu’une frappe ÉLIMINE instantanément un ennemi (hors boss).',
    apply(p) { p.stats.instakillChance += 0.07; },
  },
  {
    id: 'life_gate', name: 'Porte de la Vie', god: 'Rock Lee', category: 'divine', rarity: 'legendary', icon: 'fist',
    description: 'Ouvre les Huit Portes : PV max réduits à 10, mais dégâts +300% et vitesse +100%. Aura rouge.',
    apply(p) {
      p.stats.maxHp = 10;
      p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 4));
      p.stats.specialDamage = Math.round(p.stats.specialDamage * 4);
      p.stats.dashDamage = Math.round(p.stats.dashDamage * 4);
      p.stats.moveSpeedMult *= 2; // +100% de vitesse
      p.mods.lifeGate = 1;        // aura + traînée rouge (géré côté Player)
      p.setHp(10);
    },
  },
  {
    id: 'alucard', name: 'BT d’Arès', god: 'Dieu de la Guerre', category: 'divine', rarity: 'legendary', icon: 'lifesteal',
    description: 'Vol de vie (12% des dégâts) + 8 PV par ennemi tué — mais ne soigne QUE jusqu’à 30% des PV max.',
    apply(p) {
      p.addOnHit((_e, dmg) => p.healUpTo(dmg * 0.12, 0.30));
      p.addOnKill(() => p.healUpTo(8, 0.30));
    },
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
    id: 'koji_bond', name: 'Koji Bond', god: 'Lien du Rayon', category: 'divine', rarity: 'legendary', icon: 'wave',
    description: 'Chaque frappe fait ricocher un laser : tous les monstres de la zone subissent 15% des dégâts infligés.',
    apply(p) {
      p.addOnHit((target, dmg) => { p.combat.kojiLaser(target.x, target.y, dmg); });
    },
  },
  {
    id: 'susanoo', name: 'Meta Suzataro', god: 'Œil Éternel', category: 'divine', rarity: 'legendary', icon: 'domain',
    description: 'Une armure spectrale absorbe les 3 prochains coups et riposte (se reconstitue en 20 s).',
    apply(p) { p.mods.susanoo = 1; p.mods.susanooCharges = 3; },
  },
  {
    id: 'gear_fifth', name: 'Kaf Gear V', god: 'Guerrier Libéré', category: 'divine', rarity: 'legendary', icon: 'rage',
    description: 'ÉVEIL SOUTENU : tant que tes PV sont ≤ 40%, dégâts +80%, vitesse +20%, dégâts subis -40%.',
    apply(p) {
      // Buff maintenu en continu sous 40% PV (géré par le Player via mods.kafGear).
      p.mods.kafGear = 1;
      p.mods.transformDmg = 1.8; p.mods.transformSpd = 1.2;
      p.mods.transformScale = 1.5; p.mods.transformColor = 0xfff2a0;
    },
  },
];

export function getPowerById(id: string): PowerDef | undefined {
  return POWERS.find((p) => p.id === id);
}

/**
 * Cartes de repli proposées quand on ne peut plus obtenir de boon (tous pris,
 * ou doublon) : choix entre +25 PV max ou soin de 50 PV. Non enregistrées.
 * Éclat de Pierre Rouge (mods.fallbackHealBonus) augmente le soin de repli.
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
    apply(p) { p.heal(50 * (1 + (p.mods.fallbackHealBonus || 0))); },
  },
];
