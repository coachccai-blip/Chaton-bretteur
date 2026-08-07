import Phaser from 'phaser';

/**
 * Entrées unifiées : clavier+souris, manette, tactile (joystick + boutons).
 * Instancié par GameScene ; les contrôles tactiles (UIScene) appellent les
 * méthodes press... / setStick.
 */
export class InputManager {
  private scene: Phaser.Scene;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;

  // état joystick tactile (-1..1)
  private stick = new Phaser.Math.Vector2(0, 0);
  private stickActive = false;

  // visée souris
  private pointer = new Phaser.Math.Vector2(0, 0);
  private mouseAimActive = false;

  // boutons edge-triggered
  private queuedDash = false;
  private queuedAttack = false;
  private queuedSpecial = false;

  private pausePressed = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const kb = scene.input.keyboard!;
    this.keys = {
      w: kb.addKey('W'), a: kb.addKey('A'), s: kb.addKey('S'), d: kb.addKey('D'),
      z: kb.addKey('Z'), q: kb.addKey('Q'),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      shift: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      e: kb.addKey('E'),
      esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };

    kb.on('keydown-SPACE', () => (this.queuedDash = true));
    kb.on('keydown-SHIFT', () => (this.queuedDash = true));
    kb.on('keydown-E', () => (this.queuedSpecial = true));
    kb.on('keydown-ESC', () => (this.pausePressed = true));

    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      this.pointer.set(p.worldX, p.worldY);
      this.mouseAimActive = true;
    });
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) return;
      this.pointer.set(p.worldX, p.worldY);
      this.mouseAimActive = true;
      if (p.rightButtonDown()) this.queuedSpecial = true;
      else this.queuedAttack = true;
    });
  }

  // ---- appelé par les boutons tactiles (UIScene) ----
  setStick(x: number, y: number): void {
    this.stick.set(x, y);
    this.stickActive = x !== 0 || y !== 0;
  }
  pressDash(): void { this.queuedDash = true; }
  pressAttack(): void { this.queuedAttack = true; }
  pressSpecial(): void { this.queuedSpecial = true; }

  // ---- lecture par le Player ----
  getMove(): Phaser.Math.Vector2 {
    const v = new Phaser.Math.Vector2(0, 0);
    if (this.stickActive) {
      v.set(this.stick.x, this.stick.y);
    } else {
      const k = this.keys;
      if (k.a.isDown || k.q.isDown || k.left.isDown) v.x -= 1;
      if (k.d.isDown || k.right.isDown) v.x += 1;
      if (k.w.isDown || k.z.isDown || k.up.isDown) v.y -= 1;
      if (k.s.isDown || k.down.isDown) v.y += 1;
    }
    const pad = this.getPad();
    if (pad && v.lengthSq() < 0.02) {
      const lx = pad.axes[0]?.getValue() ?? 0;
      const ly = pad.axes[1]?.getValue() ?? 0;
      if (Math.abs(lx) > 0.2 || Math.abs(ly) > 0.2) v.set(lx, ly);
    }
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  /** Direction de visée depuis la position du joueur. */
  getAim(px: number, py: number, moveDir: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const pad = this.getPad();
    if (pad) {
      const rx = pad.axes[2]?.getValue() ?? 0;
      const ry = pad.axes[3]?.getValue() ?? 0;
      if (Math.abs(rx) > 0.25 || Math.abs(ry) > 0.25) return new Phaser.Math.Vector2(rx, ry).normalize();
    }
    if (this.mouseAimActive && !this.stickActive) {
      const d = new Phaser.Math.Vector2(this.pointer.x - px, this.pointer.y - py);
      if (d.lengthSq() > 4) return d.normalize();
    }
    if (moveDir.lengthSq() > 0.02) return moveDir.clone().normalize();
    return new Phaser.Math.Vector2(0, 1); // face au joueur par défaut
  }

  private getPad(): Phaser.Input.Gamepad.Gamepad | undefined {
    const gp = this.scene.input.gamepad;
    return gp && gp.total > 0 ? gp.getPad(0) : undefined;
  }

  /** Poll manette pour les boutons (edge géré via flags simples). */
  updatePad(): void {
    const pad = this.getPad();
    if (!pad) return;
    if (pad.A) this.queuedDash = true; // croix
    if (pad.X) this.queuedAttack = true; // carré
    if (pad.B || pad.R2) this.queuedSpecial = true; // rond / gâchette
  }

  consumeDash(): boolean { const v = this.queuedDash; this.queuedDash = false; return v; }
  consumeAttack(): boolean { const v = this.queuedAttack; this.queuedAttack = false; return v; }
  consumeSpecial(): boolean { const v = this.queuedSpecial; this.queuedSpecial = false; return v; }
  consumePause(): boolean { const v = this.pausePressed; this.pausePressed = false; return v; }

  clearQueued(): void {
    this.queuedDash = this.queuedAttack = this.queuedSpecial = false;
  }
}
