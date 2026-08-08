import { SaveSystem } from './SaveSystem';

/** Synthèse audio 100% procédurale (WebAudio) : aucun asset requis. */
class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private currentMood = '';

  private ensure(): void {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.applyVolume();
    } catch {
      this.ctx = null;
    }
  }

  resume(): void {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  applyVolume(): void {
    if (!this.master || !this.musicGain) return;
    const s = SaveSystem.data.settings;
    const v = s.muted ? 0 : s.volume;
    this.master.gain.value = v;
    if (this.currentMood) this.musicGain.gain.value = this.musicLevel();
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol = 0.3, slide = 0): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol = 0.3): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  play(name: string): void {
    this.ensure();
    if (!this.ctx) return;
    switch (name) {
      case 'sword': this.blip(520, 0.08, 'square', 0.18, -220); break;
      // Combo d'épée : un timbre par coup (1-2-3) + claquement du coup final.
      case 'slash1': this.blip(660, 0.07, 'square', 0.16, -320); this.noise(0.04, 0.08); break;
      case 'slash2': this.blip(540, 0.07, 'sawtooth', 0.16, -280); this.noise(0.04, 0.08); break;
      case 'slash3': this.blip(460, 0.08, 'square', 0.17, -340); this.noise(0.05, 0.09); break;
      case 'slashfin': this.blip(300, 0.16, 'sawtooth', 0.22, -240); this.blip(180, 0.14, 'square', 0.14, -120); this.noise(0.12, 0.16); break;
      case 'dash': this.blip(300, 0.14, 'sawtooth', 0.16, 260); break;
      case 'special': this.blip(180, 0.25, 'sawtooth', 0.2, 420); break;
      case 'hurt': this.blip(320, 0.12, 'square', 0.22, -160); break;
      case 'dead': this.blip(200, 0.5, 'sawtooth', 0.25, -150); break;
      case 'hitmob': this.noise(0.06, 0.12); break;
      case 'ui': this.blip(660, 0.05, 'square', 0.12); break;
      case 'coin': this.blip(880, 0.08, 'square', 0.14, 200); break;
      case 'power': this.blip(660, 0.1, 'triangle', 0.18, 220); this.blip(990, 0.12, 'triangle', 0.14, 180); break;
      case 'bossdie': this.blip(140, 0.8, 'sawtooth', 0.3, 300); this.noise(0.5, 0.2); break;
      case 'victory': this.arpUp(); break;
      case 'door': this.blip(520, 0.12, 'sine', 0.16, 260); this.blip(780, 0.12, 'sine', 0.12, 200); break;
      case 'fountain': [523, 659, 880].forEach((n, i) => setTimeout(() => this.blip(n, 0.18, 'sine', 0.16), i * 70)); break;
      case 'timestop': this.blip(180, 0.7, 'sawtooth', 0.28, -120); this.blip(90, 0.9, 'sine', 0.22, -40); this.noise(0.2, 0.12); break;
      case 'zap': this.blip(900, 0.06, 'square', 0.16, -400); this.noise(0.05, 0.1); break;
      case 'reaction': this.blip(300, 0.2, 'sawtooth', 0.22, 500); this.noise(0.12, 0.14); break;
      case 'spike': this.blip(220, 0.08, 'square', 0.14, 180); this.noise(0.06, 0.1); break;
      // --- éléments (appliqués sur l'ennemi) ---
      case 'freeze': this.blip(1400, 0.12, 'sine', 0.12, 500); this.blip(2100, 0.1, 'triangle', 0.08, 300); break;
      case 'burn': this.noise(0.16, 0.1); this.blip(160, 0.18, 'sawtooth', 0.1, 60); break;
      case 'poison': this.blip(300, 0.14, 'sine', 0.1, -120); this.blip(220, 0.18, 'sine', 0.08, -80); break;
      case 'shock': this.blip(1200, 0.05, 'square', 0.14, -700); this.noise(0.04, 0.08); break;
      case 'mark': this.blip(120, 0.16, 'square', 0.16, -30); break;
      // --- boons actifs ---
      case 'chidori': this.blip(1600, 0.22, 'square', 0.16, -1300); this.noise(0.18, 0.12); break;
      case 'rasengan': this.blip(420, 0.34, 'sine', 0.16, 260); this.noise(0.3, 0.1); this.blip(620, 0.28, 'triangle', 0.1, 180); break;
      case 'getsuga': this.blip(700, 0.16, 'sawtooth', 0.18, -420); this.noise(0.1, 0.1); break;
      case 'explosionbig': this.blip(90, 0.6, 'sawtooth', 0.3, 160); this.noise(0.5, 0.24); this.blip(60, 0.7, 'sine', 0.24, 40); break;
      case 'clone': this.blip(520, 0.12, 'sawtooth', 0.12, -260); break;
      case 'rayon': this.blip(240, 0.9, 'sawtooth', 0.24, 620); this.noise(0.85, 0.14); this.blip(680, 0.7, 'sine', 0.12, 200); break;
      case 'splash': this.noise(0.16, 0.12); this.blip(300, 0.14, 'sine', 0.12, -160); this.blip(520, 0.1, 'triangle', 0.08, -220); break;
      // revive « Retombée Féline » : accord ascendant céleste + éclat.
      case 'revive': this.blip(523, 0.5, 'sine', 0.16, 300); this.blip(784, 0.55, 'sine', 0.14, 260); this.blip(1046, 0.6, 'triangle', 0.12, 220); this.noise(0.2, 0.06); break;
      // --- attaques des monstres ---
      case 'eshot': this.blip(440, 0.06, 'square', 0.10, -180); break;
      case 'ecast': this.blip(200, 0.18, 'sawtooth', 0.10, 140); break;
      case 'eslam': this.noise(0.12, 0.13); this.blip(120, 0.16, 'sine', 0.14, -60); break;
      // --- attaques signatures des boss (plus fortes) ---
      case 'bossshot': this.blip(360, 0.1, 'sawtooth', 0.17, -160); this.noise(0.03, 0.06); break;
      case 'bosscast': this.blip(150, 0.28, 'sawtooth', 0.18, 150); this.noise(0.12, 0.09); break;
      case 'bossslam': this.blip(90, 0.42, 'sawtooth', 0.26, 120); this.noise(0.32, 0.18); break;
      case 'bosscharge': this.blip(200, 0.3, 'square', 0.2, 280); this.noise(0.16, 0.11); break;
      case 'toon': this.blip(320, 0.3, 'triangle', 0.2, 640); this.blip(880, 0.22, 'square', 0.12, 320); this.blip(1320, 0.16, 'sine', 0.1, 220); break;
      case 'domain': this.blip(160, 0.4, 'sine', 0.16, 120); this.blip(240, 0.4, 'triangle', 0.1, 90); break;
      // --- âmes ---
      case 'soul': this.blip(880, 0.14, 'sine', 0.14, 420); this.blip(1320, 0.12, 'triangle', 0.1, 260); break;
      case 'respawn': this.blip(200, 0.3, 'sawtooth', 0.2, -120); this.noise(0.16, 0.12); break;
    }
  }

  private arpUp(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.2, 'triangle', 0.2), i * 120));
  }

  // ==================================================================
  //  Musique procédurale multi-voix — 100% générée en direct (WebAudio),
  //  donc libre de droit. Séquenceur à lookahead pour un timing serré :
  //  nappe (pad), basse, arpège, mélodie (lead) et batterie par ambiance.
  // ==================================================================
  private schedTimer: number | null = null;
  private nextNoteTime = 0;
  private step16 = 0;
  private mood: MoodDef | null = null;

  private static semi(root: number, s: number): number { return root * Math.pow(2, s / 12); }
  private musicLevel(): number { return 0.42; } // le mute/volume passe par le master

  startMusic(mood: string): void {
    this.ensure();
    if (!this.ctx || !this.musicGain) return;
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    this.mood = MOODS[mood] ?? MOODS.menu;
    this.step16 = 0;
    if (this.schedTimer === null) {
      this.nextNoteTime = this.ctx.currentTime + 0.08;
      this.schedTimer = window.setInterval(() => this.scheduler(), 25);
    }
    // petit fondu d'entrée (évite les clics au changement de zone)
    const g = this.musicGain.gain, now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(0.0001, g.value), now);
    g.linearRampToValueAtTime(this.musicLevel(), now + 0.3);
  }

  private scheduler(): void {
    if (!this.ctx || !this.mood) return;
    const m = this.mood;
    const stepDur = 60 / m.bpm / 4; // durée d'une double-croche
    while (this.nextNoteTime < this.ctx.currentTime + 0.14) {
      this.scheduleStep(this.step16, this.nextNoteTime, stepDur, m);
      this.nextNoteTime += stepDur;
      this.step16 = (this.step16 + 1) % 64; // boucle de 4 mesures (16 pas chacune)
    }
  }

  private scheduleStep(step: number, t: number, stepDur: number, m: MoodDef): void {
    const bar = Math.floor(step / 16) % m.chords.length;
    const chord = m.chords[bar];
    const root = m.root;

    // nappe : tenue de l'accord sur toute la mesure
    if (step % 16 === 0) {
      const dur = stepDur * 16;
      for (const s of chord) this.pad(Audio.semi(root, s), t, dur, m.padVol);
    }
    // basse : fondamentale une octave plus bas
    if (m.bass && step % 8 === 0) {
      this.pluck(Audio.semi(root, chord[0] - 12), t, stepDur * 6, 'triangle', 0.24);
    }
    // arpège : parcourt les notes de l'accord
    if (m.arpEvery > 0 && step % m.arpEvery === 0) {
      const idx = Math.floor(step / m.arpEvery);
      const seq = m.arp === 'updown' ? [...chord, ...[...chord].reverse().slice(1, -1)] : chord;
      const note = (seq[idx % seq.length] ?? 0) + (m.arpOct ? 12 : 0);
      this.pluck(Audio.semi(root, note), t, stepDur * 2.2, m.arpWave, 0.13);
    }
    // mélodie
    if (m.lead) {
      const n = m.lead[step % m.lead.length];
      if (n !== null && n !== undefined) this.leadVoice(Audio.semi(root, n), t, stepDur * (m.leadLong ? 3 : 1.7));
    }
    // batterie
    if (m.drums) {
      if (step % 4 === 0) this.kick(t);
      if (step % 8 === 4) this.snare(t);
      if (step % 2 === 1) this.hat(t, 0.05);
      else if (m.drums === 'busy') this.hat(t, 0.028);
    }
  }

  private pad(freq: number, t: number, dur: number, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.7);
    g.gain.setValueAtTime(vol, t + dur - 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g); g.connect(this.musicGain);
    for (const d of [-7, 7]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  private pluck(freq: number, t: number, dur: number, wave: OscillatorType, vol: number): void {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator(); o.type = wave; o.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private leadVoice(freq: number, t: number, dur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private kick(t: number): void {
    if (!this.ctx || !this.musicGain) return;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.18);
  }

  private noiseBurst(t: number, dur: number, vol: number, hp: number): void {
    if (!this.ctx || !this.musicGain) return;
    const buf = this.ctx.createBuffer(1, Math.ceil(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.musicGain); src.start(t);
  }

  private snare(t: number): void { this.noiseBurst(t, 0.14, 0.12, 1400); }
  private hat(t: number, vol: number): void { this.noiseBurst(t, 0.04, vol, 7000); }

  stopMusic(): void {
    if (this.schedTimer !== null) { clearInterval(this.schedTimer); this.schedTimer = null; }
    if (this.musicGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(now);
      this.musicGain.gain.linearRampToValueAtTime(0.0001, now + 0.2);
    }
    this.currentMood = '';
    this.mood = null;
  }
}

/** Définition musicale d'une ambiance (accords en demi-tons relatifs à `root`). */
interface MoodDef {
  bpm: number;
  root: number;
  chords: number[][];  // une mesure par accord (boucle)
  padVol: number;
  bass: boolean;
  arp: 'up' | 'updown';
  arpEvery: number;    // 0 = pas d'arpège ; sinon période en pas de double-croche
  arpWave: OscillatorType;
  arpOct: boolean;     // arpège monté d'une octave
  lead?: (number | null)[];
  leadLong?: boolean;
  drums?: false | 'basic' | 'busy';
}

// Progressions mineures i–VI–III–VII (et variantes) : chaque accord = triade en demi-tons.
const MOODS: Record<string, MoodDef> = {
  // Menu — La mineur, rêveur
  menu: {
    bpm: 84, root: 220, padVol: 0.05, bass: true, arp: 'up', arpEvery: 4, arpWave: 'triangle', arpOct: true,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    lead: [12, null, null, 15, null, 19, null, 17, 15, null, 12, null, null, 10, null, null],
  },
  // Camp — Do majeur, chaleureux
  hub: {
    bpm: 96, root: 261.63, padVol: 0.05, bass: true, arp: 'up', arpEvery: 4, arpWave: 'triangle', arpOct: true,
    chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
  },
  // Forêt — Mi mineur, mystérieux et léger
  foret: {
    bpm: 90, root: 164.81, padVol: 0.055, bass: true, arp: 'updown', arpEvery: 3, arpWave: 'triangle', arpOct: true,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
  },
  // Marais — Ré mineur, lent et poisseux
  marais: {
    bpm: 76, root: 146.83, padVol: 0.065, bass: true, arp: 'up', arpEvery: 8, arpWave: 'sine', arpOct: false,
    chords: [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [7, 10, 14]],
  },
  // Forge — La mineur grave, martelé (batterie)
  forge: {
    bpm: 116, root: 110, padVol: 0.045, bass: true, arp: 'up', arpEvery: 2, arpWave: 'sawtooth', arpOct: true,
    chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]], drums: 'basic',
  },
  // Citadelle — Do mineur, menaçant
  citadelle: {
    bpm: 94, root: 130.81, padVol: 0.06, bass: true, arp: 'updown', arpEvery: 4, arpWave: 'square', arpOct: true,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [7, 11, 14]],
    lead: [null, null, 12, null, null, 15, null, 14, null, null, 12, null, 10, null, null, null], leadLong: true,
  },
  // Abysses de Givre — Sol mineur cristallin, lent et éthéré
  givre: {
    bpm: 80, root: 196, padVol: 0.07, bass: true, arp: 'updown', arpEvery: 4, arpWave: 'sine', arpOct: true,
    chords: [[0, 3, 7], [-2, 3, 7], [-4, 0, 5], [-5, 2, 7]],
    lead: [null, 19, null, null, 15, null, 12, null, null, 14, null, null, 10, null, null, null], leadLong: true,
  },
  // Nécropole Céleste — Fa mineur solennel, orageux (batterie)
  celeste: {
    bpm: 102, root: 174.61, padVol: 0.06, bass: true, arp: 'up', arpEvery: 4, arpWave: 'square', arpOct: true,
    chords: [[0, 3, 7], [5, 8, 12], [3, 7, 10], [-2, 5, 8]], drums: 'basic',
    lead: [12, null, 15, null, 19, null, 17, 15, null, 12, null, 14, null, null, null, null], leadLong: true,
  },
  // Faille du Néant — Do dièse mineur dissonant, cosmique et pressant
  neant: {
    bpm: 126, root: 138.59, padVol: 0.055, bass: true, arp: 'updown', arpEvery: 2, arpWave: 'sawtooth', arpOct: true,
    chords: [[0, 3, 6], [-1, 3, 7], [-4, 1, 6], [-2, 2, 8]], drums: 'busy',
    lead: [12, null, 13, null, 11, null, 12, null, 8, null, 6, null, 3, null, null, null],
  },
  // Boss — Ré mineur, épique et rapide (batterie soutenue + stabs)
  boss: {
    bpm: 134, root: 146.83, padVol: 0.05, bass: true, arp: 'up', arpEvery: 2, arpWave: 'sawtooth', arpOct: true,
    chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [7, 11, 14]], drums: 'busy',
    lead: [12, null, 12, null, 15, null, 14, 12, 10, null, 10, null, 7, null, null, null],
  },
  // Victoire — Do majeur éclatant
  victory: {
    bpm: 120, root: 261.63, padVol: 0.05, bass: true, arp: 'up', arpEvery: 2, arpWave: 'triangle', arpOct: true,
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    lead: [12, 14, 16, 19, 16, 19, 24, null, 19, 16, 12, null, 14, null, null, null],
  },
};

export const AudioManager = new Audio();
