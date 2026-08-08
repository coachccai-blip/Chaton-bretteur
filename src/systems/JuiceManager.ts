import Phaser from 'phaser';

/** Effets de "game feel" : shake, hit-stop, particules, flash. */
export class JuiceManager {
  private scene: Phaser.Scene;
  private frozenUntil = 0;
  private frozen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  shake(duration = 120, intensity = 0.006): void {
    this.scene.cameras.main.shake(duration, intensity);
  }

  /**
   * Micro-pause pour donner du poids aux impacts. Robuste aux appels qui se
   * chevauchent : un seul état "gelé", et la reprise se replanifie tant que la
   * fenêtre est prolongée — la physique finit TOUJOURS par redémarrer (évite un
   * soft-lock si le dernier ennemi meurt pendant un hit-stop). On utilise
   * l'horloge de la scène (et non window.setTimeout) pour que la reprise se
   * mette en pause avec la scène (menu de récompense) et reprenne au retour.
   */
  hitStop(ms = 45): void {
    this.frozenUntil = Math.max(this.frozenUntil, performance.now() + ms);
    if (this.frozen) return;
    this.frozen = true;
    this.scene.physics.world.pause();
    this.scheduleResume();
  }

  private scheduleResume(): void {
    const remaining = Math.max(1, this.frozenUntil - performance.now());
    this.scene.time.delayedCall(remaining, () => {
      if (performance.now() >= this.frozenUntil - 5) {
        this.frozen = false;
        this.scene.physics.world.resume();
      } else {
        this.scheduleResume(); // fenêtre prolongée entre-temps : on recontrôle
      }
    });
  }

  /** Flash de teinte pleine sur une entité touchée (blanc par défaut). */
  flash(obj: Phaser.GameObjects.Sprite, ms = 90, color = 0xffffff): void {
    obj.setTintFill(color);
    this.scene.time.delayedCall(ms, () => {
      if (obj.active) obj.clearTint();
    });
  }

  /** Explosion de particules courtes. */
  burst(x: number, y: number, color: number, count = 8, speed = 140, scale = 1): void {
    const p = this.scene.add.particles(x, y, 'px', {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: scale, end: 0 },
      lifespan: { min: 200, max: 380 },
      quantity: count,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });
    p.setDepth(60);
    p.explode(count);
    this.scene.time.delayedCall(500, () => p.destroy());
  }

  /** Traînée directionnelle (dash). */
  dashTrail(x: number, y: number, color: number): void {
    const p = this.scene.add.particles(x, y, 'px', {
      speed: 20,
      scale: { start: 1.2, end: 0 },
      lifespan: 260,
      quantity: 6,
      tint: color,
      blendMode: 'ADD',
      emitting: false,
    });
    p.setDepth(6);
    p.explode(6);
    this.scene.time.delayedCall(400, () => p.destroy());
  }

  /** Anneau de choc qui s'agrandit (spécial, ondes de boss). */
  ring(x: number, y: number, radius: number, color: number, ms = 300): void {
    const g = this.scene.add.circle(x, y, 8, color, 0.25);
    g.setStrokeStyle(3, color, 0.9);
    g.setDepth(55);
    this.scene.tweens.add({
      targets: g,
      radius,
      alpha: 0,
      duration: ms,
      ease: 'Cubic.easeOut',
      onUpdate: () => g.setStrokeStyle(3, color, g.alpha),
      onComplete: () => g.destroy(),
    });
  }

  /** Explosion de chaleur (spécial) : onde rouge incandescente + braises. */
  heatBlast(x: number, y: number, radius: number): void {
    const s = this.scene;
    const ADD = Phaser.BlendModes.ADD;
    // onde de chaleur : disque rouge qui s'étend
    const wave = s.add.circle(x, y, radius * 0.28, 0xff4a1f, 0.4).setDepth(54).setBlendMode(ADD);
    s.tweens.add({ targets: wave, radius: radius * 1.15, alpha: 0, duration: 400, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    // cœur incandescent
    const core = s.add.circle(x, y, radius * 0.45, 0xffe6a0, 0.6).setDepth(56).setBlendMode(ADD);
    s.tweens.add({ targets: core, scale: 1.4, alpha: 0, duration: 240, ease: 'Quad.easeOut', onComplete: () => core.destroy() });
    // anneaux concentriques rouge -> orange -> jaune
    this.ring(x, y, radius, 0xff2a1f, 360);
    this.ring(x, y, radius * 0.78, 0xff8a2a, 300);
    this.ring(x, y, radius * 0.52, 0xffe08a, 240);
    // braises projetées
    this.burst(x, y, 0xff5a1f, 24, 320, 1.9);
    this.burst(x, y, 0xffd24a, 14, 220, 1.2);
    // vagues de chaleur montantes
    const heat = s.add.particles(x, y, 'px', {
      speedY: { min: -120, max: -60 }, speedX: { min: -50, max: 50 },
      scale: { start: 1.6, end: 0 }, lifespan: 520, quantity: 16,
      tint: [0xff3a1f, 0xff8a2a, 0xffd24a], blendMode: 'ADD', emitting: false,
    });
    heat.setDepth(57);
    heat.explode(16);
    s.time.delayedCall(700, () => heat.destroy());
  }

  /** VFX d'application d'un élément sur un ennemi (particules dédiées). */
  elementFx(x: number, y: number, el: string): void {
    const s = this.scene, ADD = Phaser.BlendModes.ADD, cy = y - 8;
    switch (el) {
      case 'freeze': {
        this.burst(x, cy, 0xbff7f6, 9, 130, 1.0);
        this.ring(x, cy, 24, 0x9fe6ff, 240);
        break;
      }
      case 'burn': {
        const p = s.add.particles(x, cy, 'px', { speedY: { min: -95, max: -45 }, speedX: { min: -32, max: 32 }, scale: { start: 1.3, end: 0 }, lifespan: 440, quantity: 11, tint: [0xff3a1f, 0xff8a2a, 0xffd24a], blendMode: 'ADD', emitting: false });
        p.setDepth(60); p.explode(11); s.time.delayedCall(600, () => p.destroy());
        break;
      }
      case 'poison': {
        const p = s.add.particles(x, cy, 'px', { speedY: { min: -62, max: -22 }, speedX: { min: -26, max: 26 }, scale: { start: 1.1, end: 0 }, lifespan: 560, quantity: 9, tint: [0x8fd94a, 0xdfff9a], blendMode: 'ADD', emitting: false });
        p.setDepth(60); p.explode(9); s.time.delayedCall(700, () => p.destroy());
        break;
      }
      case 'shock': {
        this.burst(x, cy, 0xfff27a, 8, 210, 0.9);
        const g = s.add.graphics().setDepth(61).setBlendMode(ADD);
        g.lineStyle(2, 0xffffff, 0.9);
        let px = x, py = cy - 16; g.beginPath(); g.moveTo(px, py);
        for (let i = 0; i < 4; i++) { px += (Math.random() * 2 - 1) * 11; py += 8; g.lineTo(px, py); }
        g.strokePath();
        s.tweens.add({ targets: g, alpha: 0, duration: 150, onComplete: () => g.destroy() });
        break;
      }
      case 'mark': {
        this.ring(x, cy, 26, 0xff5a7a, 240);
        this.burst(x, cy, 0xff9db0, 6, 120, 0.8);
        break;
      }
      default: this.burst(x, cy, 0xffffff, 6, 120, 0.8);
    }
  }

  /** Tourbillon (Rasengan) : spirale qui tourne et s'estompe. */
  spiral(x: number, y: number, color: number, radius: number): void {
    const s = this.scene;
    const g = s.add.circle(x, y, radius * 0.55, color, 0.28).setDepth(56).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: g, scale: 1.5, alpha: 0, duration: 340, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
    const p = s.add.particles(x, y, 'px', {
      speed: { min: 40, max: radius * 2.2 }, angle: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0 }, lifespan: 360, quantity: 22,
      tint: [color, 0xbff7f6, 0xffffff], blendMode: 'ADD', emitting: false, rotate: { start: 0, end: 360 },
    });
    p.setDepth(57); p.explode(22);
    s.time.delayedCall(520, () => p.destroy());
    this.ring(x, y, radius, color, 320);
  }

  /** Texte flottant (dégâts, gains). */
  popText(x: number, y: number, text: string, color: string, size = 16): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    t.setOrigin(0.5).setDepth(80);
    this.scene.tweens.add({
      targets: t,
      y: y - 28,
      alpha: 0,
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
