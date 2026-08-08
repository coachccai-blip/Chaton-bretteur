import { META_UPGRADES, getMetaById } from '../config/metaUpgrades';
import { PLAYER_BASE, type PlayerStats } from '../config/game';

const KEY = 'chaton-bretteur-save-v1';

export interface SaveData {
  currency: number;
  upgrades: Record<string, number>; // id -> tier acheté
  unlockedExtreme: boolean;
  bestZone: number;
  clears: number;
  bestTimes: Record<string, number>; // difficultyId -> meilleur temps de clear (secondes)
  materials: Record<string, number>; // id de matériau -> quantité possédée
  settings: { volume: number; muted: boolean };
}

function defaults(): SaveData {
  return {
    currency: 0,
    upgrades: {},
    unlockedExtreme: false,
    bestZone: 0,
    clears: 0,
    bestTimes: {},
    materials: {},
    settings: { volume: 0.7, muted: false },
  };
}

class Save {
  data: SaveData = defaults();

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = defaults();
        const parsed = JSON.parse(raw);
        // fusion profonde de `settings` : une sauvegarde antérieure à l'ajout
        // d'un champ (ex. `muted`) ne doit pas écraser tout l'objet par défaut.
        this.data = { ...d, ...parsed, settings: { ...d.settings, ...(parsed.settings ?? {}) } };
      }
    } catch {
      this.data = defaults();
    }
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* stockage indisponible : on ignore */
    }
  }

  reset(): void {
    this.data = defaults();
    this.save();
  }

  get currency(): number {
    return this.data.currency;
  }

  addCurrency(n: number): void {
    this.data.currency += Math.max(0, Math.round(n));
    this.save();
  }

  tierOf(id: string): number {
    return this.data.upgrades[id] ?? 0;
  }

  /** coût du prochain palier, ou null si max atteint. */
  nextCost(id: string): number | null {
    const def = getMetaById(id);
    if (!def) return null;
    const tier = this.tierOf(id);
    if (tier >= def.maxTier) return null;
    return def.costPerTier[tier];
  }

  // ---- Matériaux de boss ----
  materialCount(id: string): number { return this.data.materials[id] ?? 0; }
  addMaterial(id: string, n = 1): void {
    this.data.materials[id] = this.materialCount(id) + n;
    this.save();
  }
  /** Coût en matériaux du prochain palier (vide si aucun / max atteint). */
  matCostOf(id: string): Record<string, number> {
    const def = getMetaById(id);
    if (!def || !def.matCost || this.tierOf(id) >= def.maxTier) return {};
    return def.matCost;
  }
  hasMaterialsFor(id: string): boolean {
    const cost = this.matCostOf(id);
    return Object.entries(cost).every(([k, v]) => this.materialCount(k) >= v);
  }

  canBuy(id: string): boolean {
    const cost = this.nextCost(id);
    return cost !== null && this.data.currency >= cost && this.hasMaterialsFor(id);
  }

  buy(id: string): boolean {
    const cost = this.nextCost(id);
    if (cost === null || this.data.currency < cost || !this.hasMaterialsFor(id)) return false;
    const mats = this.matCostOf(id);
    this.data.currency -= cost;
    for (const [k, v] of Object.entries(mats)) this.data.materials[k] = this.materialCount(k) - v;
    this.data.upgrades[id] = this.tierOf(id) + 1;
    this.save();
    return true;
  }

  hasFlag(flag: string): boolean {
    return META_UPGRADES.some((m) => m.flag === flag && this.tierOf(m.id) > 0);
  }

  /** Nombre de renaissances disponibles par run (= paliers de Retombée Féline). */
  reviveCharges(): number {
    let n = 0;
    for (const m of META_UPGRADES) if (m.flag === 'revive') n += this.tierOf(m.id);
    return n;
  }

  /** Stats de base du chaton après application de toutes les méta-améliorations. */
  computeBaseStats(): PlayerStats {
    const base: PlayerStats = JSON.parse(JSON.stringify(PLAYER_BASE));
    base.swordDamage = [...PLAYER_BASE.swordDamage];
    for (const def of META_UPGRADES) {
      const tier = this.tierOf(def.id);
      if (tier > 0) def.apply(base, tier);
    }
    return base;
  }

  recordZone(zoneIndex: number): void {
    if (zoneIndex > this.data.bestZone) {
      this.data.bestZone = zoneIndex;
      this.save();
    }
  }

  recordClear(): void {
    this.data.clears += 1;
    this.data.unlockedExtreme = true;
    this.save();
  }

  /** Meilleur temps de clear pour une difficulté (secondes), ou null. */
  bestTime(difficultyId: string): number | null {
    const t = this.data.bestTimes[difficultyId];
    return typeof t === 'number' ? t : null;
  }

  /** Enregistre un temps de clear ; renvoie true si c'est un nouveau record. */
  recordTime(difficultyId: string, seconds: number): boolean {
    const prev = this.data.bestTimes[difficultyId];
    if (prev === undefined || seconds < prev) {
      this.data.bestTimes[difficultyId] = seconds;
      this.save();
      return true;
    }
    return false;
  }
}

/** Formate un temps en m:ss. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const SaveSystem = new Save();
