/**
 * Constantes globales et tuning du jeu.
 * Toutes les valeurs chiffrées sont ici pour être ajustées sans toucher au moteur.
 */

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Échelle du rendu pixel art : 1 "pixel" logique = PIXEL_SCALE px écran. */
export const PIXEL_SCALE = 4;

export const COLORS = {
  bg: 0x0c0910,
  panel: 0x1a1224,
  panelLight: 0x2a1f3d,
  gold: 0xf4c430,
  cream: 0xf4e9c1,
  hp: 0xe8384f,
  hpBack: 0x3a1220,
  shield: 0x59b8ff,
  dash: 0x59c8ff,
  special: 0xb26bff,
  currency: 0xf4c430,
  text: 0xf4e9c1,
  textDim: 0x9a8fb0,
  rarityCommon: 0xb8c0cc,
  rarityRare: 0x4fa8ff,
  rarityEpic: 0xb26bff,
  rarityLegendary: 0xf4a020,
};

export const PLAYER_BASE = {
  maxHp: 100,
  speed: 265,
  swordDamage: [10, 10, 18], // coups 1-2-3
  comboWindow: 420, // ms pour enchaîner
  attackDuration: 220, // ms d'une frappe
  dashCooldown: 800,
  dashDistance: 160,
  dashDuration: 180,
  dashIFrames: 250,
  dashCharges: 1,
  specialDamage: 30,
  specialCooldown: 4000,
  specialRadius: 150,
  hurtIFrames: 500,
  knockback: 280, // 3e coup
  lifesteal: 0, // fraction
  critChance: 0,
  critMult: 2,
  armor: 0, // réduction de dégâts (fraction)
  thorns: 0, // retour de dégâts
  moveSpeedMult: 1,
  attackSpeedMult: 1,
  luck: 0, // bonus de rareté
  greed: 1, // multiplicateur de monnaie
  dashDamage: 0,
  specialCdOnKill: 0, // ms de cooldown spécial rendu par kill
  // --- boons divins ---
  extraHits: 0, // coups supplémentaires par frappe (ORA ORA)
  instakillChance: 0, // chance d'éliminer un non-boss (Poing de Saitama)
  armorPen: 0, // ignore une fraction de l'armure ennemie (non utilisé côté ennemi, réservé)
  dodgeChance: 0, // chance d'esquive auto (Sharingan)
  rageBelow: 0, // seuil de PV (fraction) déclenchant la rage (Bankai)
  rageDamageMult: 1, // multiplicateur de dégâts en rage
};

export type PlayerStats = typeof PLAYER_BASE;

export const ROOM = {
  width: 900,
  height: 500,
  minWaves: 1,
  maxWaves: 3,
};

/** Récompense de base en monnaie par salle nettoyée et par boss. */
export const REWARDS = {
  perRoom: 8,
  perBoss: 40,
  perEnemyBonus: 1,
};
