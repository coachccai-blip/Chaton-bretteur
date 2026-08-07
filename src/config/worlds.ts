export interface ZoneDef {
  id: string;
  name: string;
  index: number;
  rooms: number; // salles de combat avant le boss
  enemyPool: string[]; // ids d'ennemis
  bossId: string;
  hazard: 'thorns' | 'toxic' | 'lava' | 'shadow' | 'none';
  palette: {
    floor: number;
    floorAlt: number;
    wall: number;
    accent: number;
    fog: number;
  };
}

export const ZONES: ZoneDef[] = [
  {
    id: 'foret', name: 'La Forêt des Ronces', index: 0, rooms: 6,
    enemyPool: ['slime', 'champignon', 'chauvesouris'],
    bossId: 'araignee', hazard: 'thorns',
    palette: { floor: 0x2f5d3a, floorAlt: 0x27502f, wall: 0x1c3322, accent: 0x8a5cff, fog: 0x0d1f14 },
  },
  {
    id: 'marais', name: 'Les Marais Putrides', index: 1, rooms: 6,
    enemyPool: ['gobelin', 'crapaud', 'bulle'],
    bossId: 'crapaudroi', hazard: 'toxic',
    palette: { floor: 0x4a5a3a, floorAlt: 0x3d4d30, wall: 0x2a3320, accent: 0x9d5cff, fog: 0x18200f },
  },
  {
    id: 'forge', name: 'La Forge de Braise', index: 2, rooms: 7,
    enemyPool: ['diablotin', 'chienlave', 'armure'],
    bossId: 'golem', hazard: 'lava',
    palette: { floor: 0x3a2420, floorAlt: 0x30201c, wall: 0x241512, accent: 0xff6a1f, fog: 0x1a0d0a },
  },
  {
    id: 'citadelle', name: 'La Citadelle des Ombres', index: 3, rooms: 7,
    enemyPool: ['fantome', 'squelette', 'sorcier'],
    bossId: 'roi', hazard: 'shadow',
    palette: { floor: 0x2a2440, floorAlt: 0x231e36, wall: 0x191430, accent: 0xf4c430, fog: 0x0f0b1e },
  },
];
