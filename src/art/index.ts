import Phaser from 'phaser';
import { genSprite, genMask, genOrb, genPixel } from './PixelArtGenerator';
import { CAT, SWORD, KATANA, MERCHANT_CAT, HAMMER, WATER_WAVE, SUSANOO, KAGE_BUNSHIN, RASENSHURIKEN } from './hero';
import { GLYPHS } from './icons';
import { genCritter, MONSTER_RECIPES } from './critters';
import { BOSS_CATS } from './bosscats';
import { genRadialLight, genVignette, genSoftShadow, genProps, genTrapBase, genSpikes, genPool, genFloorThemed, genWallThemed, MINE, FIREBALL, ICE_SHARD, FROST, ICE_STALACTITE, ICE_PYLON } from './environment';
import { ZONES } from '../config/worlds';

let generated = false;

/** Génère toutes les textures pixel art du jeu (idempotent). */
export function generateAll(scene: Phaser.Scene): void {
  if (generated && scene.textures.exists('cat')) return;

  // Héros
  genSprite(scene, CAT);
  genSprite(scene, SWORD);
  genSprite(scene, KATANA); // katana noir orbital (Troisième Lame)
  genSprite(scene, HAMMER); // Mjölnir orbital
  genSprite(scene, SUSANOO); // aura spectrale du boon Susanoo
  genSprite(scene, WATER_WAVE); // vague de la Première Danse de l'Eau
  genSprite(scene, MERCHANT_CAT); // chat marchand du désert
  genSprite(scene, KAGE_BUNSHIN); // clone d'ombre (boon Kage Bunshin)
  genSprite(scene, RASENSHURIKEN); // shuriken de vent (Spécial Rasenshuriken)
  genSprite(scene, MINE);   // marqueur de danger au sol
  genSprite(scene, FIREBALL); // boule de feu d'Ignis
  genSprite(scene, ICE_SHARD); // bloc de glace (projectile givre)
  genSprite(scene, FROST);  // particule de givre (spray en cône)
  genSprite(scene, ICE_STALACTITE); // stalactite tombante (Glacior)
  genSprite(scene, ICE_PYLON); // pilône d'invincibilité (Glacior)

  // Monstres (procéduraux)
  for (const [key, recipe] of Object.entries(MONSTER_RECIPES)) genCritter(scene, `mob_${key}`, recipe);
  // Boss : chats-champions dessinés à la main (taille du héros)
  for (const def of BOSS_CATS) genSprite(scene, def);

  // Projectiles & particules
  genOrb(scene, 'orb', '#ffffff', 5);
  genOrb(scene, 'orb_big', '#ffffff', 8);
  genPixel(scene, 'px', 4);
  genPixel(scene, 'px2', 6);

  // Icônes
  for (const g of GLYPHS) genMask(scene, g, 3);

  // Sols & murs thématiques par zone
  for (const z of ZONES) {
    genFloorThemed(scene, z.id, z.palette.floor, z.palette.floorAlt, 256);
    genWallThemed(scene, z.id, z.palette.wall, 48);
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
