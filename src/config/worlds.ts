export interface ZoneDef {
  id: string;
  name: string;
  index: number;
  rooms: number; // salles de combat avant le boss
  enemyPool: string[]; // ids d'ennemis
  bossId: string;
  hazard: 'thorns' | 'toxic' | 'lava' | 'shadow' | 'frost' | 'void' | 'none';
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
    id: 'foret', name: 'La Forêt des Ronces', index: 0, rooms: 4,
    enemyPool: ['slime', 'champignon', 'chauvesouris', 'fee', 'loup'],
    bossId: 'araignee', hazard: 'thorns',
    palette: { floor: 0x1f3a2a, floorAlt: 0x18301f, wall: 0x14261a, accent: 0x59d9a0, fog: 0x0a1710 },
  },
  {
    // Marais putride : vert-gris toxique, brume malsaine, lueur acide
    id: 'marais', name: 'Les Marais Putrides', index: 1, rooms: 4,
    enemyPool: ['gobelin', 'crapaud', 'bulle', 'bombardier'],
    bossId: 'crapaudroi', hazard: 'toxic',
    palette: { floor: 0x2b3a2a, floorAlt: 0x233022, wall: 0x1a281a, accent: 0x9fe04a, fog: 0x0e160d },
  },
  {
    // Forge de braise : charbon sombre, lave et braises orangées
    id: 'forge', name: 'La Forge de Braise', index: 2, rooms: 4,
    enemyPool: ['diablotin', 'chienlave', 'armure', 'gardien', 'drake'],
    bossId: 'golem', hazard: 'lava',
    palette: { floor: 0x2c211d, floorAlt: 0x241a16, wall: 0x1c1310, accent: 0xff7a2a, fog: 0x120a07 },
  },
  {
    // Citadelle des ombres : pierre bleu-nuit, torches chaudes, spectres violets
    id: 'citadelle', name: 'La Citadelle des Ombres', index: 3, rooms: 5,
    enemyPool: ['fantome', 'squelette', 'sorcier', 'archer'],
    bossId: 'roi', hazard: 'shadow',
    palette: { floor: 0x1c2436, floorAlt: 0x161d2e, wall: 0x121829, accent: 0xf2a53a, fog: 0x090d18 },
  },
  {
    // Abysses de Givre : caverne glaciaire sous un lac gelé, cyan glacier
    id: 'givre', name: 'Les Abysses de Givre', index: 4, rooms: 5,
    enemyPool: ['yeti', 'spectregivre', 'stalactite', 'pingouin', 'sculpteur', 'sorciereblizzard', 'brochet'],
    bossId: 'leviathan', hazard: 'frost',
    palette: { floor: 0x203040, floorAlt: 0x18283a, wall: 0x141e2c, accent: 0x7fdcff, fog: 0x0a1220 },
  },
  {
    // Nécropole Céleste : ruines flottantes dans un orage éternel, or et éclair
    id: 'celeste', name: 'La Nécropole Céleste', index: 5, rooms: 5,
    enemyPool: ['harpie', 'nuagetonnerre', 'djinn', 'chevalierceleste', 'idole', 'oiseauplasma', 'porteursarco'],
    bossId: 'rapace', hazard: 'void',
    palette: { floor: 0x2a2a4a, floorAlt: 0x22223e, wall: 0x1c1c38, accent: 0xffe08a, fog: 0x10101f },
  },
  {
    // Faille du Néant : fragments de tous les mondes dans un cosmos noir, magenta
    id: 'neant', name: 'La Faille du Néant', index: 6, rooms: 6,
    enemyPool: ['oeilneant', 'golemstellaire', 'doppelchat', 'mangeurames', 'faucheurdim', 'etoilenaine', 'larvechaos'],
    bossId: 'reflet', hazard: 'void',
    palette: { floor: 0x14101f, floorAlt: 0x100c18, wall: 0x0c0a16, accent: 0xd05aff, fog: 0x060410 },
  },
];
