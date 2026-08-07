import { SaveSystem } from './SaveSystem';

/** Synthèse audio 100% procédurale (WebAudio) : aucun asset requis. */
class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
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
    this.musicGain.gain.value = 0.35;
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
    }
  }

  private arpUp(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.2, 'triangle', 0.2), i * 120));
  }

  // ---- musique procédurale ----
  private moods: Record<string, number[]> = {
    menu: [220, 277, 330, 277],
    foret: [196, 233, 294, 233],
    marais: [174, 207, 261, 207],
    forge: [220, 261, 329, 392],
    citadelle: [155, 185, 233, 311],
    boss: [147, 175, 220, 262, 220, 175],
    hub: [261, 329, 392, 329],
  };

  startMusic(mood: string): void {
    this.ensure();
    if (!this.ctx || this.currentMood === mood) return;
    this.currentMood = mood;
    this.stopMusicTimer();
    const seq = this.moods[mood] ?? this.moods.menu;
    this.step = 0;
    const tempo = mood === 'boss' ? 260 : 360;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const s = SaveSystem.data.settings;
      const v = s.muted ? 0 : s.volume * 0.5;
      const t = this.ctx.currentTime;
      const base = seq[this.step % seq.length];
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = base;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v * 0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(g); g.connect(this.musicGain);
      osc.start(t); osc.stop(t + 0.4);
      // basse une octave en dessous tous les 2 temps
      if (this.step % 2 === 0) {
        const bass = this.ctx.createOscillator();
        const bg = this.ctx.createGain();
        bass.type = 'sine';
        bass.frequency.value = base / 2;
        bg.gain.setValueAtTime(v * 0.5, t);
        bg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        bass.connect(bg); bg.connect(this.musicGain);
        bass.start(t); bass.stop(t + 0.55);
      }
      this.step++;
    }, tempo);
  }

  private stopMusicTimer(): void {
    if (this.musicTimer !== null) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  stopMusic(): void {
    this.stopMusicTimer();
    this.currentMood = '';
  }
}

export const AudioManager = new Audio();
