# 🐾 Le Chaton Bretteur

Un **roguelite d'action top-down** dans l'esprit de *Hades*, jouable au **clavier/souris**, à la **manette** et au **tactile** (mobile). Vous incarnez un petit chaton chevalier qui taille les monstres à l'épée à travers 4 zones, gagne des pouvoirs, et devient plus fort de run en run grâce à une progression permanente.

Développé en **Phaser 3 + Vite + TypeScript**.

## 🏰 Salles, portes & ambiance (façon Dead Cells / Hades)

- **Ambiance** : lumière dynamique autour du chaton, vignette, brouillard, particules d'ambiance par zone (lucioles, bulles toxiques, braises, poussière spectrale), parallaxe, ombres portées, murs de pierre en relief. Décors (props) éclairés dispersés.
- **Salles à formes variées** : piliers, blocs centraux, coins coupés, barres latérales… en **collision** — les monstres ne traversent plus les murs.
- **Portes** : après chaque salle, on choisit entre plusieurs **portes** dont l'icône indique le contenu de la salle suivante — ⚔️ Combat (boon), ❤️ Fontaine de vie, 🪙 Marchand, ⭐ Trésor, 💥 Boss.
- **Salles spéciales** : fontaine (gros soin + PV max), marchand (achats en Croquettes du run : soin / PV max / boon), trésor (or + boon offert).
- **Animations de pouvoirs** soignées — ex. **The World** : voile indigo, ondes « ZA WARUDO », horloge qui s'arrête, ennemis figés, tandis que le chaton passe au premier plan. Éclairs pixelisés, ondes tranchantes, explosions, domaines… chacun avec son **SFX synthétisé** dédié.

## 🎨 Graphismes : pixel art 100 % généré par code

Le brief prévoyait des assets PNG fournis séparément. Comme aucune image n'était disponible, **tous les visuels sont générés par le code** au démarrage — aucun fichier image n'est requis :

- **Le chaton et l'épée** sont des sprites pixel art dessinés à la main sous forme de grilles de pixels (`src/art/hero.ts`), rendus sur des textures canvas (`PixelArtGenerator.ts`).
- **Les monstres et les boss** sont générés par un **rasteriseur paramétrique** (`src/art/critters.ts`) : une « recette » (couleur, ventre, yeux, et une caractéristique — oreilles, cornes, ailes, chapeau, couronne, champignon, araignée…) est transformée en pixels nets. Cela donne 12 monstres et 4 boss distincts sans dessiner chacun à la main.
- **Les icônes** (pouvoirs, HUD) sont des masques 8×8 monochromes teintés à l'usage (`src/art/icons.ts`).
- **Les sols de zones** sont des tuiles bruitées procédurales, une palette par zone.
- **L'audio** (SFX + musique) est lui aussi **synthétisé en direct via WebAudio** (`src/systems/AudioManager.ts`) — aucun fichier son requis.

Le rendu utilise `pixelArt: true` (nearest-neighbor) pour un rendu net et « croustillant ».

> Pour remplacer un visuel par un vrai PNG plus tard : chargez-le dans `BootScene` sous la même clé de texture (`cat`, `mob_slime`, `boss_araignee`, …) et il sera utilisé automatiquement.

## ▶️ Lancer le jeu

```bash
npm install
npm run dev      # serveur de dev (http://localhost:5173)
npm run build    # build de production -> dist/
npm run preview  # prévisualiser le build
```

## 🎮 Contrôles

| Action | Clavier/Souris | Manette | Tactile |
|---|---|---|---|
| Déplacement | ZQSD / WASD / flèches | stick gauche | joystick (bas-gauche) |
| Visée | souris | stick droit | direction du déplacement |
| Attaque épée | clic gauche | ✕ / carré | bouton ⚔ |
| Dash (i-frames) | Espace / Shift | croix (A) | bouton dash |
| Spécial (AoE) | clic droit / E | rond (B) / gâchette | bouton spécial |
| Pause | Échap | — | — |

Combo d'épée à 3 coups (le 3ᵉ projette), dash avec invincibilité, tourbillon spécial à cooldown.

## 🧭 Boucle de jeu

`Menu → Camp (Hub) → Run (Forêt → Marais → Forge → Citadelle) → Mort/Victoire → Camp`

- Chaque salle nettoyée = **choix d'1 pouvoir parmi 3** (temporaire, remis à zéro au run suivant) + Croquettes Dorées.
- Chaque zone se termine par un **boss** à phases et patterns télégraphiés.
- **Croquettes Dorées** conservées à la mort → dépensées au Camp pour des **améliorations permanentes** (sauvegarde `localStorage`).
- 4 difficultés (Facile / Normal / Difficile / Extrême, cette dernière débloquée après un premier clear).

## 🏗️ Architecture (data-driven)

Le contenu vit dans des fichiers de config ; le moteur les consomme. Ajouter du contenu = ajouter une entrée.

```
src/
  config/      game, difficulty, powers, metaUpgrades, enemies, bosses, worlds  ← toutes les données
  art/         génération pixel art (hero, critters, icons, tiles)
  systems/     Save, RunState, Input, Juice, Audio, PowerSystem
  entities/    Player, Enemy, Boss, Projectile
  scenes/      Boot, Menu, Hub, Game, UI, Reward, Pause, GameOver, Victory
  ui/          thème (boutons, panneaux, badges d'icônes)
```

- **Ajouter un pouvoir / boon divin** : une entrée dans `src/config/powers.ts`. Un boon peut patcher les stats, poser un hook (`onHit`/`onKill`/`onDash`/`onRoomClear`), déclencher un effet récurrent (`addPeriodic`), modifier le Spécial/Dash (`addSpecialFlag`/`addDashFlag`) ou appeler les effets actifs de combat via `p.combat` (éclair chaîné, onde tranchante, explosion, arrêt du temps, domaine…).
- **Ajouter un monstre** : une entrée dans `src/config/enemies.ts` (avec son `signature` : attaque signature télégraphiée) + une recette dans `src/art/critters.ts`.
- **Ajouter/éditer un boss** : `src/config/bosses.ts`. Chaque boss a plusieurs phases et un jeu d'**attaques signatures** télégraphiées et distinctes — éventail, anneau, spirale, nova, onde de choc, saut-plongeon, langue/faisceau en ligne, faisceaux en croix, geysers, flaques persistantes (lave/toxique), pièges de toile, invocations, charge. Les VFX (télégraphes, éruptions, rails, colonnes de pixels) sont générés par code.
- **Équilibrage** : `src/config/game.ts` et `difficulty.ts`.

## ☁️ Déploiement Netlify

`netlify.toml` est fourni (build `npm run build`, publish `dist`, redirect SPA). Connectez le repo à Netlify, ou glissez-déposez le dossier `dist/` sur Netlify Drop. `base: './'` (Vite) garantit des chemins d'assets relatifs corrects.

## ⚡ Boons divins & combos élémentaires (façon Hades)

Chaque salle propose 3 boons. Au-delà des stats, les **boons divins** (référencés manga/anime) ajoutent des capacités **actives qui se combinent** :

- **Éléments on-hit** : Foudre d’Elektor (Choc + éclair chaîné), Flamme d’Igneel (Brûlure), Givre de Rukia (Gel), Crocs Venimeux (Poison), Haki de l’Armement (Marque : +30% de dégâts subis).
- **Réactions de combo** : appliquer deux éléments différents déclenche une réaction dévastatrice — **Surcharge** (Gel+Choc), **Toxine** (Brûlure+Poison, AoE), **Vapeur**, **Corrosion**, **Plasma**. Empiler les bons éléments = tout fondre.
- **Spécial** : Getsuga Tenshō (onde tranchante à distance), EXPLOSION de Megumin, The World (arrêt du temps).
- **Dash** : Chidori (dash-choc perforant), Rasengan (explosion en fin de dash).
- **Invocations / domaines** : Kage Bunshin (clone d’ombre), Sanctuaire Malfaisant de Sukuna (domaine récurrent).
- **Passifs** : ORA ORA (rafale multi-coups), Poing de Saitama (élimination instantanée), Bankai (rage à bas PV), Soif d’Alucard (vol de vie), Sharingan / Ultra Instinct (esquive), Gear Second.

Les monstres montent en puissance par zone et possèdent chacun une **attaque signature télégraphiée** (bond, moulinet de zone, salve en éventail, crachat de flaque, téléportation spectrale, sceau explosif…) qu’il faut esquiver au dash. Un build sans synergie ne tient pas la distance : les mauvais choix se paient.

## ✅ Contenu implémenté

Combat complet (combo/dash/spécial, i-frames, knockback) · 21 pouvoirs data-driven · 8 améliorations permanentes + sauvegarde · 4 difficultés · 12 monstres (6 archétypes IA télégraphiés) · 4 zones à thème + dangers d'environnement · 4 boss à phases · HUD, Camp, récompenses, game over (résumé), victoire, pause/options · juice (screen shake, hit-stop, particules, flash, slow-mo) · audio procédural · responsive desktop + mobile.
