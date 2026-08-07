import { META_UPGRADES, getMetaById } from '../config/metaUpgrades';
import { PLAYER_BASE, type PlayerStats } from '../config/game';

const KEY = 'chaton-bretteur-save-v1';

export interface SaveData {
  currency: number;
  upgrades: Record<string, number>; // id -> tier acheté
  unlockedExtreme: boolean;
  bestZone: number;
  clears: number;
  settings: { volume: number; muted: boolean };
}

function defaults(): SaveData {
  return {
    currency: 0,
    upgrades: {},
    unlockedExtreme: false,
    bestZone: 0,
    clears: 0,
    settings: { volume: 0.7, muted: false },
  };
}

class Save {
  data: SaveData = defaults();

  load(): void {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.data = { ...defaults(), ...JSON.parse(raw) };
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

  canBuy(id: string): boolean {
    const cost = this.nextCost(id);
    return cost !== null && this.data.currency >= cost;
  }

  buy(id: string): boolean {
    const cost = this.nextCost(id);
    if (cost === null || this.data.currency < cost) return false;
    this.data.currency -= cost;
    this.data.upgrades[id] = this.tierOf(id) + 1;
    this.save();
    return true;
  }

  hasFlag(flag: string): boolean {
    return META_UPGRADES.some((m) => m.flag === flag && this.tierOf(m.id) > 0);
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
}

export const SaveSystem = new Save();
