import type { Player } from '../entities/Player';

/**
 * Consommables achetés à la boutique du camp (pièces + matériaux de boss).
 * Le joueur en porte jusqu'à 2 par run ; à l'usage ils confèrent un buff
 * PERMANENT (toute la run) ou TEMPORAIRE. Une fontaine restaure ceux du départ.
 */
export interface ConsumableDef {
  id: string;
  name: string;
  icon: string;          // clé de texture (on réutilise l'icône du matériau lié)
  description: string;
  cost: number;                     // coût en Croquettes Dorées
  matCost: Record<string, number>;  // coût en matériaux de boss
  kind: 'run' | 'temp';             // buff permanent (run) ou temporaire
  use(p: Player): void;
}

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'sap_elixir', name: 'Élixir de Sève', icon: 'mat_wood', kind: 'run',
    description: 'Toute la run : +45 PV max (et soigne autant).',
    cost: 120, matCost: { sylvann_wood: 1 },
    use(p) { p.stats.maxHp += 45; p.heal(45); },
  },
  {
    id: 'rage_potion', name: 'Potion de Rage', icon: 'mat_mud', kind: 'temp',
    description: '15 s : dégâts ×2.',
    cost: 140, matCost: { gorbak_mud: 1 },
    use(p) { p.addBuff('conso_rage', 15000, { dmg: 2 }); p.consumableFx(0xff5a3a); },
  },
  {
    id: 'fire_feather', name: 'Plume Ardente', icon: 'mat_wing', kind: 'run',
    description: 'Toute la run : +25% vitesse de déplacement.',
    cost: 130, matCost: { ignis_wing: 1 },
    use(p) { p.stats.moveSpeedMult *= 1.25; p.consumableFx(0xff8a3a); },
  },
  {
    id: 'ether_vial', name: 'Fiole d’Éther', icon: 'mat_tail', kind: 'temp',
    description: '18 s : vitesse d’attaque ×1,6 et déplacement ×1,2.',
    cost: 150, matCost: { mortis_tail: 1 },
    use(p) { p.addBuff('conso_ether', 18000, { as: 1.6, spd: 1.2 }); p.consumableFx(0xc78aff); },
  },
  {
    id: 'frost_shard', name: 'Éclat Glacé', icon: 'mat_spike', kind: 'temp',
    description: '8 s : invincibilité.',
    cost: 180, matCost: { glacior_spike: 1 },
    use(p) { p.grantInvuln(8000); p.consumableFx(0x7fdcff); },
  },
  {
    id: 'wind_cape', name: 'Cape du Vent', icon: 'mat_cape', kind: 'run',
    description: 'Toute la run : +1 charge de dash.',
    cost: 200, matCost: { voltair_cape: 1 },
    use(p) { p.stats.dashCharges += 1; p.syncDashCharges(); p.consumableFx(0xb0c8ff); },
  },
  {
    id: 'void_scepter', name: 'Sceptre du Vide', icon: 'mat_scepter', kind: 'run',
    description: 'Toute la run : +30% de dégâts (épée, spécial, dash).',
    cost: 240, matCost: { neantis_scepter: 1 },
    use(p) {
      p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.3));
      p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.3);
      p.stats.dashDamage = Math.round(p.stats.dashDamage * 1.3);
      p.consumableFx(0xd05aff);
    },
  },
  {
    id: 'war_bandana', name: 'Bandana de Guerre', icon: 'mat_bandana', kind: 'run',
    description: 'Toute la run : +25% dégâts, +30 PV max et +15% vitesse.',
    cost: 400, matCost: { boss_bandana: 1 },
    use(p) {
      p.stats.swordDamage = p.stats.swordDamage.map((d) => Math.round(d * 1.25));
      p.stats.specialDamage = Math.round(p.stats.specialDamage * 1.25);
      p.stats.maxHp += 30; p.heal(30);
      p.stats.moveSpeedMult *= 1.15;
      p.consumableFx(0x8aff6a);
    },
  },
];

export function consumableById(id: string): ConsumableDef | undefined {
  return CONSUMABLES.find((c) => c.id === id);
}
