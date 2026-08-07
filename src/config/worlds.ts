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
    // Forêt sombre et enchantée : vert profond mousse, lueur turquoise-émeraude
    id: 'foret', name: 'La Forêt des Ronces', index: 0, rooms: 6,
    enemyPool: ['slime', 'champignon', 'chauvesouris'],
    bossId: 'araignee', hazard: 'thorns',
    palette: { floor: 0x1f3a2a, floorAlt: 0x18301f, wall: 0x14261a, accent: 0x59d9a0, fog: 0x0a1710 },
  },
  {
    // Marais putride : vert-gris toxique, brume malsaine, lueur acide
    id: 'marais', name: 'Les Marais Putrides', index: 1, rooms: 6,
    enemyPool: ['gobelin', 'crapaud', 'bulle'],
    bossId: 'crapaudroi', hazard: 'toxic',
    palette: { floor: 0x2b3a2a, floorAlt: 0x233022, wall: 0x1a281a, accent: 0x9fe04a, fog: 0x0e160d },
  },
  {
    // Forge de braise : charbon sombre, lave et braises orangées
    id: 'forge', name: 'La Forge de Braise', index: 2, rooms: 7,
    enemyPool: ['diablotin', 'chienlave', 'armure'],
    bossId: 'golem', hazard: 'lava',
    palette: { floor: 0x2c211d, floorAlt: 0x241a16, wall: 0x1c1310, accent: 0xff7a2a, fog: 0x120a07 },
  },
  {
    // Citadelle des ombres : pierre bleu-nuit, torches chaudes, spectres violets
    id: 'citadelle', name: 'La Citadelle des Ombres', index: 3, rooms: 7,
    enemyPool: ['fantome', 'squelette', 'sorcier'],
    bossId: 'roi', hazard: 'shadow',
    palette: { floor: 0x1c2436, floorAlt: 0x161d2e, wall: 0x121829, accent: 0xf2a53a, fog: 0x090d18 },
  },
];
