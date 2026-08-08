import type { PowerDef } from '../config/powers';

/** État d'un run en cours, partagé entre les scènes. */
class Run {
  difficultyId = 'normal';
  zoneIndex = 0;
  roomIndex = 0; // salle de combat courante dans la zone (0-based)
  powers: PowerDef[] = [];
  currencyEarned = 0;
  kills = 0;
  revivesUsed = 0;
  victory = false;

  // Expérience / niveau : on gagne un boon à chaque montée de niveau. Réglé pour
  // atteindre ~niveau 6/12/18… au boss 1/2/3… si l'on fait tous les combats.
  xp = 0;
  level = 0;
  xpForLevel(level = this.level): number { return Math.round(34 * Math.pow(1.09, level)); }

  // chronomètre du run (se met en pause pendant le choix des boons / la pause)
  private accumulatedMs = 0;
  private segmentStart = 0;
  private running = false;

  reset(difficultyId: string): void {
    this.difficultyId = difficultyId;
    this.zoneIndex = 0;
    this.roomIndex = 0;
    this.powers = [];
    this.currencyEarned = 0;
    this.kills = 0;
    this.xp = 0;
    this.level = 0;
    this.revivesUsed = 0;
    this.victory = false;
    this.accumulatedMs = 0;
    this.segmentStart = performance.now();
    this.running = true;
  }

  addPower(p: PowerDef): void {
    this.powers.push(p);
  }

  /** Met le chronomètre en pause (ex. écran de choix de boon). */
  pauseTimer(): void {
    if (!this.running) return;
    this.accumulatedMs += performance.now() - this.segmentStart;
    this.running = false;
  }

  /** Relance le chronomètre après une pause. */
  resumeTimer(): void {
    if (this.running) return;
    this.segmentStart = performance.now();
    this.running = true;
  }

  elapsedMs(): number {
    return this.accumulatedMs + (this.running ? performance.now() - this.segmentStart : 0);
  }

  durationSec(): number {
    return Math.max(0, this.elapsedMs() / 1000);
  }
}

export const RunState = new Run();
