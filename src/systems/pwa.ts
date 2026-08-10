/**
 * Gestion de l'installation PWA (« Ajouter à l'écran d'accueil »).
 *
 * Sur Android / Chromium, le navigateur émet `beforeinstallprompt` : on garde
 * l'événement de côté pour déclencher l'installation depuis NOTRE bouton (un
 * geste utilisateur est requis). Sur iOS/Safari il n'existe pas d'API : on
 * affichera à la place des instructions (Partager → « Sur l'écran d'accueil »).
 *
 * Ce module s'auto-enregistre à l'import : importe-le tôt (main.ts) pour ne pas
 * manquer l'événement, qui peut survenir avant l'ouverture du menu.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault(); // on garde la main : l'installation se déclenche via notre bouton
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => { installed = true; deferredPrompt = null; });
}

/** L'app tourne-t-elle déjà en mode installé (standalone) ? */
export function isStandalone(): boolean {
  return (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches)
    || (typeof navigator !== 'undefined' && (navigator as unknown as { standalone?: boolean }).standalone === true);
}

/** Appareil iOS / iPadOS (pas de prompt natif → instructions). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iDevice = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ se présente comme un Mac : on le détecte via le tactile.
  const iPadOS = /Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document;
  return iDevice || iPadOS;
}

/** Téléphone / tablette (là où « installer sur l'écran d'accueil » a du sens). */
export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini/i.test(ua) || isIOS();
}

/** true si l'installation NATIVE (un clic) est disponible — Android/Chromium. */
export function hasNativePrompt(): boolean { return !!deferredPrompt; }

/**
 * Faut-il proposer le bouton « Installer » ? Uniquement sur mobile, si l'app
 * n'est pas déjà installée, et si soit un prompt natif est prêt, soit on est sur
 * iOS (où l'on montrera des instructions).
 */
export function canInstall(): boolean {
  if (installed || isStandalone()) return false;
  if (!isMobile()) return false;
  return hasNativePrompt() || isIOS();
}

/** Déclenche l'installation native (Android/Chromium). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const dp = deferredPrompt;
  if (!dp) return 'unavailable';
  deferredPrompt = null; // un prompt n'est consommable qu'une seule fois
  try {
    await dp.prompt();
    const choice = await dp.userChoice;
    return choice.outcome === 'accepted' ? 'accepted' : 'dismissed';
  } catch {
    return 'dismissed';
  }
}
