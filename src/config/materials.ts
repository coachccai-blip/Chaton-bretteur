/** Matériaux lâchés par les boss (à leur PREMIÈRE défaite, avant le round ×3). */
export interface MaterialDef {
  id: string;
  name: string;
  icon: string;   // clé de texture (mat_*)
  bossId: string; // id du boss qui le lâche (clé de BOSSES / zone.bossId)
}

export const MATERIALS: MaterialDef[] = [
  { id: 'sylvann_wood', name: 'Bois de Sylvann', icon: 'mat_wood', bossId: 'araignee' },
  { id: 'gorbak_mud', name: 'Boue de Gorbak', icon: 'mat_mud', bossId: 'crapaudroi' },
  { id: 'ignis_wing', name: 'Aile d’Ignis', icon: 'mat_wing', bossId: 'golem' },
  { id: 'mortis_tail', name: 'Queue de Mortis', icon: 'mat_tail', bossId: 'roi' },
  { id: 'glacior_spike', name: 'Pic de Glacior', icon: 'mat_spike', bossId: 'leviathan' },
  { id: 'voltair_cape', name: 'Cape de Voltaïr', icon: 'mat_cape', bossId: 'rapace' },
  { id: 'neantis_scepter', name: 'Sceptre de Néantis', icon: 'mat_scepter', bossId: 'reflet' },
  { id: 'boss_bandana', name: 'Bandana du BIG BOSS', icon: 'mat_bandana', bossId: 'militaire' },
];

export function materialByBoss(bossId: string): MaterialDef | undefined {
  return MATERIALS.find((m) => m.bossId === bossId);
}
export function materialById(id: string): MaterialDef | undefined {
  return MATERIALS.find((m) => m.id === id);
}
