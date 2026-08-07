import Phaser from 'phaser';
import { genSprite, genMask, genOrb, genPixel, genFloorTile } from './PixelArtGenerator';
import { CAT, SWORD } from './hero';
import { GLYPHS } from './icons';
import { genCritter, MONSTER_RECIPES, BOSS_RECIPES } from './critters';
import { ZONES } from '../config/worlds';

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

  // Sols de zones
  for (const z of ZONES) genFloorTile(scene, `floor_${z.id}`, z.palette.floor, z.palette.floorAlt, 64);

  generated = true;
}
