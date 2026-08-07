import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { label, iconBadge } from '../ui/theme';
import { glyphTexture } from '../art/icons';
import type { GameScene } from './GameScene';
import type { PowerDef } from '../config/powers';
import { RARITY_COLORS } from '../config/powers';
import { RunState } from '../systems/RunState';

export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private hpBar!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private currencyText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private powersLayer!: Phaser.GameObjects.Container;

  private dashBadge!: Phaser.GameObjects.Container;
  private dashOverlay!: Phaser.GameObjects.Arc;
  private dashPips!: Phaser.GameObjects.Container;
  private specialBadge!: Phaser.GameObjects.Container;
  private specialOverlay!: Phaser.GameObjects.Arc;

  private bossLayer!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private bossPhase!: Phaser.GameObjects.Text;
  private bossMaxHp = 1;

  private touch = false;
  private touchLayer!: Phaser.GameObjects.Container;

  constructor() { super('UI'); }

  init(data: { gameScene: GameScene }): void { this.gs = data.gameScene; }

  create(): void {
    // HP
    this.add.graphics().fillStyle(COLORS.hpBack, 1).fillRoundedRect(18, 16, 264, 22, 6).setDepth(1);
    this.hpBar = this.add.graphics().setDepth(2);
    this.hpText = label(this, 150, 27, '', 13, '#ffffff').setDepth(3);

    // dash / special indicators
    this.dashBadge = iconBadge(this, 310, 27, glyphTexture('dash'), COLORS.dash, COLORS.panelLight, 17).setDepth(2);
    this.dashOverlay = this.add.circle(310, 27, 17, 0x000000, 0.6).setDepth(3);
    this.dashPips = this.add.container(0, 0).setDepth(4);
    this.specialBadge = iconBadge(this, 356, 27, glyphTexture('special'), COLORS.special, COLORS.panelLight, 17).setDepth(2);
    this.specialOverlay = this.add.circle(356, 27, 17, 0x000000, 0.6).setDepth(3);

    // currency
    iconBadge(this, GAME_WIDTH - 108, 26, glyphTexture('coin'), COLORS.gold, 0x3a2f10, 14).setDepth(2);
    this.currencyText = label(this, GAME_WIDTH - 88, 26, '0', 18, '#f4c430', 0).setDepth(3);

    // progress (aligné à gauche après les jauges de cooldown)
    this.progressText = label(this, 400, 22, '', 15, '#f4e9c1', 0).setDepth(3);

    // powers acquis
    this.powersLayer = this.add.container(0, 50).setDepth(3);

    // boss bar
    this.bossLayer = this.add.container(0, 0).setDepth(5).setVisible(false);
    const bx = GAME_WIDTH / 2, bw = 560;
    this.bossName = label(this, bx, GAME_HEIGHT - 44, '', 16, '#ff9db0');
    this.bossPhase = label(this, bx + bw / 2 - 4, GAME_HEIGHT - 44, '', 12, '#f4c430', 1);
    const bbg = this.add.graphics();
    bbg.fillStyle(0x2a0a14, 1).fillRoundedRect(bx - bw / 2, GAME_HEIGHT - 30, bw, 16, 5);
    this.bossBar = this.add.graphics();
    this.bossLayer.add([bbg, this.bossBar, this.bossName, this.bossPhase]);

    this.setupEvents();
    this.setupTouch();

    // état initial (les events peuvent être émis avant l'abonnement)
    const p = this.gs.player;
    if (p) {
      this.onHp(p.hp, p.stats.maxHp, p.shield, p.maxShield);
      this.onCooldowns(0, 0, p.dashCharges());
    }
    this.currencyText.setText(`${RunState.currencyEarned}`);
    this.onPowers(RunState.powers);
  }

  private setupEvents(): void {
    const e = this.gs.events;
    e.on('hp', this.onHp, this);
    e.on('cooldowns', this.onCooldowns, this);
    e.on('currency', (n: number) => this.currencyText.setText(`${n}`));
    e.on('powers', this.onPowers, this);
    e.on('progress', this.onProgress, this);
    e.on('bossName', (name: string) => { this.bossName.setText(name); this.bossLayer.setVisible(true); });
    e.on('bossHp', this.onBossHp, this);
    e.on('bossPhase', (cur: number, total: number) => this.bossPhase.setText(`Phase ${cur}/${total}`));

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      e.off('hp', this.onHp, this);
      e.off('cooldowns', this.onCooldowns, this);
      e.off('powers', this.onPowers, this);
      e.off('progress', this.onProgress, this);
      e.off('bossHp', this.onBossHp, this);
    });
  }

  private onHp(hp: number, max: number, shield: number, maxShield: number): void {
    this.hpBar.clear();
    const w = 264;
    const frac = Phaser.Math.Clamp(hp / max, 0, 1);
    this.hpBar.fillStyle(COLORS.hp, 1).fillRoundedRect(18, 16, Math.max(2, w * frac), 22, 6);
    if (maxShield > 0 && shield > 0) {
      const sFrac = Phaser.Math.Clamp(shield / max, 0, 1);
      this.hpBar.fillStyle(COLORS.shield, 0.85).fillRoundedRect(18, 16, Math.max(2, w * Math.min(1, frac + sFrac)), 6, 4);
    }
    this.hpText.setText(`${Math.ceil(hp)} / ${max}`);
  }

  private onCooldowns(dashFrac: number, specialFrac: number, charges: number): void {
    this.dashOverlay.setScale(1, dashFrac).setPosition(310, 27 + 17 * (1 - dashFrac));
    this.dashOverlay.setVisible(dashFrac > 0.02);
    this.specialOverlay.setScale(1, specialFrac).setPosition(356, 27 + 17 * (1 - specialFrac));
    this.specialOverlay.setVisible(specialFrac > 0.02);
    // pips de charges
    this.dashPips.removeAll(true);
    for (let i = 0; i < charges; i++) {
      this.dashPips.add(this.add.circle(298 + i * 8, 46, 3, COLORS.dash));
    }
  }

  private onPowers(powers: PowerDef[]): void {
    this.powersLayer.removeAll(true);
    const counts = new Map<string, { def: PowerDef; n: number }>();
    for (const p of powers) {
      const c = counts.get(p.id);
      if (c) c.n++; else counts.set(p.id, { def: p, n: 1 });
    }
    let i = 0;
    for (const { def, n } of counts.values()) {
      const x = 26 + i * 32;
      if (x > GAME_WIDTH - 200) break;
      const b = iconBadge(this, x, 0, glyphTexture(def.icon), RARITY_COLORS[def.rarity], COLORS.panel, 13);
      this.powersLayer.add(b);
      if (n > 1) this.powersLayer.add(label(this, x + 10, 8, `${n}`, 11, '#f4c430'));
      i++;
    }
  }

  private onProgress(zoneName: string, room: number, total: number, isBoss: boolean, label?: string): void {
    if (isBoss) this.progressText.setText(`${zoneName} — BOSS`);
    else if (label && label !== 'Combat') this.progressText.setText(`${zoneName} — ${label}`);
    else this.progressText.setText(`${zoneName} — Salle ${room}/${total}`);
    if (!isBoss) this.bossLayer.setVisible(false);
  }

  private onBossHp(hp: number, max: number): void {
    this.bossMaxHp = max;
    this.bossBar.clear();
    const bx = GAME_WIDTH / 2, bw = 560;
    const frac = Phaser.Math.Clamp(hp / max, 0, 1);
    this.bossBar.fillStyle(0xe8384f, 1).fillRoundedRect(bx - bw / 2, GAME_HEIGHT - 30, Math.max(2, bw * frac), 16, 5);
    if (hp <= 0) this.time.delayedCall(1500, () => this.bossLayer.setVisible(false));
  }

  // ---------------- contrôles tactiles ----------------
  private setupTouch(): void {
    this.touch = this.sys.game.device.input.touch || navigator.maxTouchPoints > 0;
    this.touchLayer = this.add.container(0, 0).setDepth(20).setVisible(this.touch);

    // joystick
    const jx = 110, jy = GAME_HEIGHT - 100, jr = 60;
    const base = this.add.circle(jx, jy, jr, 0xffffff, 0.08).setStrokeStyle(3, 0xffffff, 0.25);
    const thumb = this.add.circle(jx, jy, 28, 0xffffff, 0.25).setStrokeStyle(2, 0xffffff, 0.4);
    this.touchLayer.add([base, thumb]);
    let jpid = -1;

    const zone = this.add.zone(0, GAME_HEIGHT / 2, GAME_WIDTH * 0.5, GAME_HEIGHT).setOrigin(0, 0.5).setInteractive();
    this.touchLayer.add(zone);
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => { jpid = p.id; this.moveThumb(p, jx, jy, jr, thumb); });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => { if (p.id === jpid) this.moveThumb(p, jx, jy, jr, thumb); });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id === jpid) { jpid = -1; thumb.setPosition(jx, jy); this.gs.controls.setStick(0, 0); }
    });

    // boutons d'action
    const mk = (x: number, y: number, glyph: string, tint: number, press: () => void, r: number) => {
      const disc = this.add.circle(x, y, r, tint, 0.22).setStrokeStyle(3, tint, 0.7).setInteractive();
      const ic = this.add.image(x, y, glyph).setTint(tint).setScale((r * 1.2) / 24);
      disc.on('pointerdown', () => { press(); disc.setScale(0.9); });
      disc.on('pointerup', () => disc.setScale(1));
      disc.on('pointerout', () => disc.setScale(1));
      this.touchLayer.add([disc, ic]);
    };
    const bx = GAME_WIDTH - 80, by = GAME_HEIGHT - 90;
    mk(bx, by, glyphTexture('sword'), 0xffd24a, () => this.gs.controls.pressAttack(), 40);
    mk(bx - 84, by + 6, glyphTexture('dash'), COLORS.dash, () => this.gs.controls.pressDash(), 32);
    mk(bx - 28, by - 78, glyphTexture('special'), COLORS.special, () => this.gs.controls.pressSpecial(), 32);

    // basculer visibilité selon la source d'entrée
    window.addEventListener('keydown', () => this.touchLayer.setVisible(false));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { if (p.wasTouch) this.touchLayer.setVisible(true); });
  }

  private moveThumb(p: Phaser.Input.Pointer, jx: number, jy: number, jr: number, thumb: Phaser.GameObjects.Arc): void {
    const dx = p.x - jx, dy = p.y - jy;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, jr);
    const nx = (dx / d), ny = (dy / d);
    thumb.setPosition(jx + nx * cl, jy + ny * cl);
    this.gs.controls.setStick(nx * (cl / jr), ny * (cl / jr));
  }
}
