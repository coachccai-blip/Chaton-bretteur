import Phaser from 'phaser';
import { genSprite, genMask, genOrb, genPixel } from './PixelArtGenerator';
import { CAT, SWORD, KATANA, MERCHANT_CAT, HAMMER, WATER_WAVE, SUSANOO, KAGE_BUNSHIN, RASENSHURIKEN } from './hero';
import { GLYPHS } from './icons';
import { genCritter, MONSTER_RECIPES } from './critters';
import { BOSS_CATS } from './bosscats';
import { genHeroCat } from './heroesHD';
import { genRadialLight, genVignette, genSoftShadow, genProps, genTrapBase, genSpikes, genPool, genFloorThemed, genWallThemed, MINE, FIREBALL, ICE_SHARD, FROST, ICE_STALACTITE, ICE_PYLON, BLACK_FLAME, MUD_BLOB, MUD_SPLAT, TORNADO, FIRE_TORNADO, BOOMERANG, CAT_PAW, LIGHTNING_BLUE, ANGEL_WINGS, MINE_BOSS, GRENADE, MISSILE, EXPLOSION, TURRET, TANK, TANK_MISSILE, GATLING_BULLET, MATERIAL_ART, RED_AURA } from './environment';
import { ZONES } from '../config/worlds';

let generated = false;

/** Génère toutes les textures pixel art du jeu (idempotent). */
export function generateAll(scene: Phaser.Scene): void {
  if (generated && scene.textures.exists('cat')) return;

  // Héros (redessiné en HD procédural — voir heroesHD.ts)
  genHeroCat(scene);
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
  genSprite(scene, MUD_BLOB); // glob de boue (Gorbak & mini-gorbaks)
  genSprite(scene, MUD_SPLAT); // éclaboussure de boue (particule)
  genSprite(scene, TORNADO); // tornade du boon Dernier Souffle
  genSprite(scene, FIRE_TORNADO); // tornade de feu d'Ignis
  genSprite(scene, BOOMERANG); // boon Lame Boomerang
  genSprite(scene, CAT_PAW); // boon Poing Pistolet (patte projetée)
  genSprite(scene, LIGHTNING_BLUE); // boon Chidori (arc électrique du dash)
  genSprite(scene, ANGEL_WINGS); // revive Retombée Féline
  genSprite(scene, MINE_BOSS); // mine du boss final
  genSprite(scene, GRENADE); // grenade du boss final
  genSprite(scene, MISSILE); // missile du boss final
  genSprite(scene, EXPLOSION); // explosion (mines/grenades/missiles)
  genSprite(scene, TURRET); // tourelle gatling (boss final)
  genSprite(scene, TANK); // char d'assaut (boss final)
  genSprite(scene, TANK_MISSILE); // roquette de char
  genSprite(scene, GATLING_BULLET); // balle de gatling
  for (const m of MATERIAL_ART) genSprite(scene, m); // matériaux lâchés par les boss
  genSprite(scene, RED_AURA); // aura rouge du boon Porte de la Vie
  genSprite(scene, ICE_SHARD); // bloc de glace (projectile givre)
  genSprite(scene, FROST);  // particule de givre (spray en cône)
  genSprite(scene, ICE_STALACTITE); // stalactite tombante (Glacior)
  genSprite(scene, ICE_PYLON); // pilône d'invincibilité (Glacior)
  genSprite(scene, BLACK_FLAME); // flamme noire d'Amaterasu (Brûlure Noire)

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
