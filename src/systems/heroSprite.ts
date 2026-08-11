import Phaser from 'phaser';
import { HERO_ART_TEST } from '../config/game';

/**
 * Héros unifié : en mode HERO_ART_TEST, tous les sprites du héros (menus, clones,
 * fantôme de revive…) utilisent l'illustration `hero_art` au lieu du pixel art
 * `cat`. Ces helpers centralisent le choix de texture et le calcul d'échelle
 * pour conserver EXACTEMENT la taille à l'écran d'avant.
 */
function useArt(scene: Phaser.Scene): boolean {
  return HERO_ART_TEST && scene.textures.exists('hero_art');
}

/** Clé de texture du héros (illustration en test, sinon pixel art). */
export function heroTex(scene: Phaser.Scene): string {
  return useArt(scene) ? 'hero_art' : 'cat';
}

/** Échelle pour obtenir la même hauteur d'affichage qu'un sprite 'cat' d'échelle
 *  `catScale` — quelle que soit la texture réellement utilisée. */
export function heroScale(scene: Phaser.Scene, catScale: number): number {
  if (!useArt(scene)) return catScale;
  const catH = scene.textures.get('cat').getSourceImage().height || 216;
  const artH = scene.textures.get('hero_art').getSourceImage().height || 434;
  return (catH * catScale) / artH;
}

/** true si l'on affiche l'illustration (pour, ex., masquer l'épée séparée des menus). */
export function heroIsArt(scene: Phaser.Scene): boolean { return useArt(scene); }
