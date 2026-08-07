import type { PowerDef } from '../config/powers';

/** État d'un run en cours, partagé entre les scènes. */
class Run {
  difficultyId = 'normal';
  zoneIndex = 0;
  roomIndex = 0; // salle de combat courante dans la zone (0-based)
  powers: PowerDef[] = [];
  currencyEarned = 0;
  kills = 0;
  startTime = 0;
  reviveUsed = false;
  victory = false;

  reset(difficultyId: string): void {
    this.difficultyId = difficultyId;
    this.zoneIndex = 0;
    this.roomIndex = 0;
    this.powers = [];
    this.currencyEarned = 0;
    this.kills = 0;
    this.startTime = performance.now();
    this.reviveUsed = false;
    this.victory = false;
  }

  addPower(p: PowerDef): void {
    this.powers.push(p);
  }

  durationSec(): number {
    return Math.max(0, (performance.now() - this.startTime) / 1000);
  }
}

export const RunState = new Run();
