import Phaser from 'phaser';
import { genSprite, genMask, genOrb, genPixel, genFloorTile } from './PixelArtGenerator';
import { CAT, SWORD } from './hero';
import { GLYPHS } from './icons';
import { genCritter, MONSTER_RECIPES, BOSS_RECIPES } from './critters';
import { genRadialLight, genVignette, genSoftShadow, genWallTile, genProps, genTrapBase, genSpikes, genPool } from './environment';
import { ZONES } from '../config/worlds';

function shade(c: number, amt: number): number {
  const r = Math.min(255, Math.max(0, ((c >> 16) & 255) + amt));
  const g = Math.min(255, Math.max(0, ((c >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (c & 255) + amt));
  return (r << 16) | (g << 8) | b;
}

let generated = false;

/** Génère toutes les textures pixel art du jeu (idempotent). */
export function generateAll(scene: Phaser.Scene): void {
  if (generated && scene.textures.exists('cat')) return;

  // Héros
  genSprite(scene, CAT);
  genSprite(scene, SWORD);

  // Monstres & boss (procéduraux)
  for (const [key, recipe] of Object.entries(MONSTER_RECIPES)) genCritter(scene, `mob_${key}`, recipe);
  for (const [key, recipe] of Object.entries(BOSS_RECIPES)) genCritter(scene, `boss_${key}`, recipe);

  // Projectiles & particules
  genOrb(scene, 'orb', '#ffffff', 5);
  genOrb(scene, 'orb_big', '#ffffff', 8);
  genPixel(scene, 'px', 4);
  genPixel(scene, 'px2', 6);

  // Icônes
  for (const g of GLYPHS) genMask(scene, g, 3);

  // Sols & murs de zones
  for (const z of ZONES) {
    genFloorTile(scene, `floor_${z.id}`, z.palette.floor, z.palette.floorAlt, 64);
    genWallTile(scene, `wall_${z.id}`, shade(z.palette.wall, 40), z.palette.wall, shade(z.palette.wall, -35), 48);
  }

  // Atmosphère
  genRadialLight(scene, 'light', 'rgba(255,255,255,1)', 256);
  genVignette(scene, 'vignette', 960, 540);
  genSoftShadow(scene, 'shadow', 64, 32);
  genProps(scene);

  // pièges
  genTrapBase(scene, 'trap_base', 56);
  genSpikes(scene, 'trap_spikes', 56);
  genPool(scene, 'pool_lava', '#ffe08a', '#ff8a1f', '#ff3a1f', '#5a1408', 112);
  genPool(scene, 'pool_toxic', '#dfffa0', '#8fd94a', '#4a7a2a', '#1a2810', 112);

  generated = true;
}
