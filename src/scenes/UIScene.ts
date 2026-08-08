import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { label, iconBadge } from '../ui/theme';
import { glyphTexture } from '../art/icons';
import type { GameScene } from './GameScene';
import type { PowerDef } from '../config/powers';
import { RARITY_COLORS, RARITY_NAMES } from '../config/powers';
import { RunState } from '../systems/RunState';
import { formatTime } from '../systems/SaveSystem';

export class UIScene extends Phaser.Scene {
  private gs!: GameScene;
  private hpBar!: Phaser.GameObjects.Graphics;
  private shieldBar!: Phaser.GameObjects.Graphics;
  private shieldBg!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private levelText!: Phaser.GameObjects.Text;
  private currencyText!: Phaser.GameObjects.Text;
  private reviveIcon!: Phaser.GameObjects.Sprite;
  private reviveText!: Phaser.GameObjects.Text;
  private skillBtn!: Phaser.GameObjects.Container;
  private skillBtnBg!: Phaser.GameObjects.Graphics;
  private skillBtnText!: Phaser.GameObjects.Text;
  private skillBtnTween?: Phaser.Tweens.Tween;
  private timerText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private powersLayer!: Phaser.GameObjects.Container;

  private dashBadge!: Phaser.GameObjects.Container;
  private dashOverlay!: Phaser.GameObjects.Arc;
  private dashPips!: Phaser.GameObjects.Container;
  private specialBadge!: Phaser.GameObjects.Container;
  private specialOverlay!: Phaser.GameObjects.Arc;

  private hurtFx!: Phaser.GameObjects.Graphics;
  private bossLayer!: Phaser.GameObjects.Container;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossName!: Phaser.GameObjects.Text;
  private bossPhase!: Phaser.GameObjects.Text;
  private bossMaxHp = 1;

  private touch = false;
  // Revue d'un pouvoir déjà collecté (met le jeu en pause).
  private reviewing = false;
  private reviewOverlay?: Phaser.GameObjects.Container;
  private powerHits: { x: number; def: PowerDef; n: number }[] = [];
  private domRoot?: HTMLDivElement;
  private domCleanup: (() => void)[] = [];
  private gameplayActive = true;

  constructor() { super('UI'); }

  init(data: { gameScene: GameScene }): void { this.gs = data.gameScene; }

  create(): void {
    // Armure (bouclier ramassé) : barre grise distincte AU-DESSUS de la vie.
    this.shieldBg = this.add.graphics().setDepth(1).setVisible(false);
    this.shieldBg.fillStyle(0x14161c, 1).fillRoundedRect(18, 6, 264, 8, 4);
    this.shieldBar = this.add.graphics().setDepth(2);

    // HP
    this.add.graphics().fillStyle(COLORS.hpBack, 1).fillRoundedRect(18, 16, 264, 22, 6).setDepth(1);
    this.hpBar = this.add.graphics().setDepth(2);
    this.hpText = label(this, 150, 27, '', 13, '#ffffff').setDepth(3);

    // XP (jauge bleue sous la vie) + niveau
    this.add.graphics().fillStyle(0x10233a, 1).fillRoundedRect(18, 42, 264, 10, 4).setDepth(1);
    this.xpBar = this.add.graphics().setDepth(2);
    this.levelText = label(this, 292, 47, 'Nv 0', 12, '#8fd0ff', 0).setDepth(3);

    // dash / special indicators
    this.dashBadge = iconBadge(this, 310, 27, glyphTexture('dash'), COLORS.dash, COLORS.panelLight, 17).setDepth(2);
    this.dashOverlay = this.add.circle(310, 27, 17, 0x000000, 0.6).setDepth(3);
    this.dashPips = this.add.container(0, 0).setDepth(4);
    this.specialBadge = iconBadge(this, 356, 27, glyphTexture('special'), COLORS.special, COLORS.panelLight, 17).setDepth(2);
    this.specialOverlay = this.add.circle(356, 27, 17, 0x000000, 0.6).setDepth(3);

    // currency
    iconBadge(this, GAME_WIDTH - 108, 26, glyphTexture('coin'), COLORS.gold, 0x3a2f10, 14).setDepth(2);
    this.currencyText = label(this, GAME_WIDTH - 88, 26, '0', 18, '#f4c430', 0).setDepth(3);

    // chronomètre du run (stoppé pendant le choix des boons)
    this.timerText = label(this, GAME_WIDTH - 138, 27, '⏱ 0:00', 14, '#f4e9c1', 1).setDepth(3);

    // Compteur de Retombées Félines restantes (logo = tête du chaton) près des pièces.
    this.reviveIcon = this.add.sprite(GAME_WIDTH - 232, 24, 'cat').setScale(0.62).setDepth(2).setVisible(false);
    this.reviveText = label(this, GAME_WIDTH - 218, 26, '', 16, '#eaf4ff', 0).setDepth(3).setVisible(false);
    this.onRevives(this.gs.reviveLeft());

    // Bouton COMPÉTENCE (sous les pièces) : clignote quand un choix est dispo ;
    // le joueur clique pour choisir (évite les sélections auto par erreur).
    const sbw = 176, sbh = 34, sbx = GAME_WIDTH - 12 - sbw, sby = 48;
    this.skillBtnBg = this.add.graphics();
    this.skillBtnText = label(this, sbx + sbw / 2, sby + sbh / 2, '', 15, '#0e1a0e').setDepth(7);
    this.skillBtn = this.add.container(0, 0, [this.skillBtnBg, this.skillBtnText]).setDepth(6).setVisible(false);
    this.skillBtnBg.clear();
    this.skillBtnBg.fillStyle(0x59d96a, 1).fillRoundedRect(sbx, sby, sbw, sbh, 8);
    this.skillBtnBg.lineStyle(3, 0xeafff0, 1).strokeRoundedRect(sbx, sby, sbw, sbh, 8);
    this.skillBtn.setSize(sbw, sbh);
    const hit = this.add.rectangle(sbx + sbw / 2, sby + sbh / 2, sbw, sbh, 0x000000, 0.001)
      .setInteractive({ useHandCursor: true }).setDepth(8);
    hit.on('pointerdown', () => { this.gs.redeemBoon(); });
    this.skillBtn.add(hit);

    // progress (aligné à gauche après les jauges de cooldown)
    this.progressText = label(this, 400, 22, '', 15, '#f4e9c1', 0).setDepth(3);

    // powers acquis (décalés sous la barre d'XP)
    this.powersLayer = this.add.container(0, 64).setDepth(3);

    // boss bar
    this.bossLayer = this.add.container(0, 0).setDepth(5).setVisible(false);
    const bx = GAME_WIDTH / 2, bw = 560;
    this.bossName = label(this, bx, GAME_HEIGHT - 44, '', 16, '#ff9db0');
    this.bossPhase = label(this, bx + bw / 2 - 4, GAME_HEIGHT - 44, '', 12, '#f4c430', 1);
    const bbg = this.add.graphics();
    bbg.fillStyle(0x2a0a14, 1).fillRoundedRect(bx - bw / 2, GAME_HEIGHT - 30, bw, 16, 5);
    this.bossBar = this.add.graphics();
    this.bossLayer.add([bbg, this.bossBar, this.bossName, this.bossPhase]);

    // Flash rouge sur les bords de l'écran quand le chaton est touché.
    this.hurtFx = this.add.graphics().setDepth(20).setAlpha(0).setScrollFactor(0);
    this.drawHurtBorder();

    this.setupEvents();
    this.setupTouch();

    // état initial (les events peuvent être émis avant l'abonnement)
    const p = this.gs.player;
    if (p) {
      this.onHp(p.hp, p.stats.maxHp, p.shield, p.maxShield);
      this.onCooldowns(0, 0, p.dashCharges());
    }
    this.onXp(RunState.xp, RunState.xpForLevel(), RunState.level);
    this.currencyText.setText(`${RunState.currencyEarned}`);
    this.onPowers(RunState.powers);
  }

  private timerHidden = false;
  private onHideTimer(): void { this.timerHidden = true; this.timerText.setVisible(false); }

  update(): void {
    // le chrono se fige de lui-même : durationSec() est en pause pendant les menus
    if (!this.timerHidden) this.timerText.setText(`⏱ ${formatTime(RunState.durationSec())}`);
  }

  /** Dessine un cadre rouge à dégradé doux (bords opaques → centre transparent). */
  private drawHurtBorder(): void {
    const g = this.hurtFx; g.clear();
    const layers = 20, band = 96; // épaisseur totale du halo
    for (let i = 0; i < layers; i++) {
      const t = (i / layers) * band;
      const a = 0.85 * (1 - i / layers); // dégradé linéaire, bord bien opaque
      g.lineStyle(band / layers + 3, 0xff1420, a);
      g.strokeRect(t, t, GAME_WIDTH - t * 2, GAME_HEIGHT - t * 2);
    }
  }

  /** Pulse rouge de bord à l'impact (sévérité 0..1 selon les dégâts). */
  private onHurt(severity: number): void {
    this.tweens.killTweensOf(this.hurtFx);
    this.hurtFx.setAlpha(Phaser.Math.Clamp(0.55 + severity * 0.45, 0.5, 1));
    this.tweens.add({ targets: this.hurtFx, alpha: 0, duration: 420, ease: 'Cubic.easeOut' });
  }

  private onCurrency(n: number): void { this.currencyText.setText(`${n}`); }
  private onRevives(n: number): void {
    const show = n > 0;
    this.reviveIcon.setVisible(show);
    this.reviveText.setVisible(show).setText(`×${n}`);
  }
  private onBossName(name: string): void { this.bossName.setText(name); this.bossLayer.setVisible(true); }
  private onBossPhase(cur: number, total: number): void { this.bossPhase.setText(`Phase ${cur}/${total}`); }

  /** Compteur de compétences à récupérer : affiche/masque le bouton clignotant. */
  private onBoons(n: number): void {
    if (n > 0) {
      this.skillBtnText.setText(n > 1 ? `⭐ COMPÉTENCE ×${n}` : '⭐ COMPÉTENCE !');
      this.skillBtn.setVisible(true);
      if (!this.skillBtnTween) {
        this.skillBtnTween = this.tweens.add({ targets: this.skillBtn, alpha: 0.4, duration: 460, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else {
      this.skillBtn.setVisible(false).setAlpha(1);
      if (this.skillBtnTween) { this.skillBtnTween.stop(); this.skillBtnTween = undefined; }
    }
  }

  private setupEvents(): void {
    // GameScene est un singleton réutilisé : son émetteur PERSISTE d'un run à
    // l'autre. On enregistre des handlers NOMMÉS (jamais d'anonymes) et on les
    // retire tous au SHUTDOWN, sinon ils s'accumulent à chaque partie.
    const e = this.gs.events;
    e.on('hp', this.onHp, this);
    e.on('cooldowns', this.onCooldowns, this);
    e.on('currency', this.onCurrency, this);
    e.on('powers', this.onPowers, this);
    e.on('progress', this.onProgress, this);
    e.on('bossName', this.onBossName, this);
    e.on('bossHp', this.onBossHp, this);
    e.on('bossPhase', this.onBossPhase, this);
    e.on('hurt', this.onHurt, this);
    e.on('xp', this.onXp, this);
    e.on('boons', this.onBoons, this);
    e.on('revives', this.onRevives, this);
    e.on('hideTimer', this.onHideTimer, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      e.off('hp', this.onHp, this);
      e.off('cooldowns', this.onCooldowns, this);
      e.off('currency', this.onCurrency, this);
      e.off('powers', this.onPowers, this);
      e.off('progress', this.onProgress, this);
      e.off('bossName', this.onBossName, this);
      e.off('bossHp', this.onBossHp, this);
      e.off('bossPhase', this.onBossPhase, this);
      e.off('hurt', this.onHurt, this);
      e.off('xp', this.onXp, this);
      e.off('boons', this.onBoons, this);
      e.off('revives', this.onRevives, this);
      e.off('hideTimer', this.onHideTimer, this);
    });
  }

  private onHp(hp: number, max: number, shield: number, maxShield: number): void {
    this.hpBar.clear();
    const w = 264;
    const frac = Phaser.Math.Clamp(hp / max, 0, 1);
    this.hpBar.fillStyle(COLORS.hp, 1).fillRoundedRect(18, 16, Math.max(2, w * frac), 22, 6);
    // Barre d'armure grise au-dessus de la vie (visible seulement si on a du bouclier).
    this.shieldBar.clear();
    if (maxShield > 0) {
      this.shieldBg.setVisible(true);
      const sFrac = Phaser.Math.Clamp(shield / maxShield, 0, 1);
      if (shield > 0) {
        this.shieldBar.fillStyle(0x9aa4b4, 1).fillRoundedRect(18, 6, Math.max(2, w * sFrac), 8, 4);
        this.shieldBar.fillStyle(0xd6dce6, 0.9).fillRoundedRect(18, 6, Math.max(2, w * sFrac), 3, 3);
      }
    } else {
      this.shieldBg.setVisible(false);
    }
    this.hpText.setText(`${Math.ceil(hp)} / ${max}`);
  }

  private onXp(xp: number, need: number, level: number): void {
    this.xpBar.clear();
    const frac = Phaser.Math.Clamp(xp / Math.max(1, need), 0, 1);
    this.xpBar.fillStyle(0x59b8ff, 1).fillRoundedRect(18, 42, Math.max(2, 264 * frac), 10, 4);
    this.levelText.setText(`Nv ${level}`);
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
    this.powerHits = [];
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
      // Clic/tap sur l'icône → revue du pouvoir (pause). Zone invisible (souris + tactile-canvas).
      const z = this.add.zone(x, 0, 30, 30).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.openPowerReview(def, n));
      this.powersLayer.add(z);
      this.powerHits.push({ x, def, n }); // y ≈ 50 (offset de powersLayer)
      i++;
    }
  }

  /** Trouve le pouvoir sous un appui tactile (coords écran → coords jeu). */
  private powerAtScreen(clientX: number, clientY: number): { def: PowerDef; n: number } | null {
    const rect = this.game.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const gx = (clientX - rect.left) / rect.width * GAME_WIDTH;
    const gy = (clientY - rect.top) / rect.height * GAME_HEIGHT;
    if (gy < 50 || gy > 82) return null; // bande des pouvoirs (y ≈ 64)
    for (const h of this.powerHits) if (Math.abs(gx - h.x) < 16) return h;
    return null;
  }

  /** Met le jeu en pause et affiche la carte du pouvoir collecté (effets appliqués). */
  private openPowerReview(def: PowerDef, n: number): void {
    if (this.reviewing || !this.gameplayActive) return;
    this.reviewing = true;
    this.gameplayActive = false;
    this.gs.scene.pause();

    const c = this.add.container(0, 0).setDepth(50);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.72).setInteractive();
    bg.on('pointerdown', () => this.closePowerReview());
    const cw = 460, ch = 250, cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
    const col = RARITY_COLORS[def.rarity];
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.panel, 1).fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    panel.lineStyle(3, col, 1).strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    const icon = this.add.image(cx - cw / 2 + 52, cy - ch / 2 + 52, glyphTexture(def.icon)).setTint(col).setScale(2.2);
    const title = label(this, cx - cw / 2 + 92, cy - ch / 2 + 34, def.name + (n > 1 ? `  ×${n}` : ''), 20, '#f4e9c1', 0);
    const sub = label(this, cx - cw / 2 + 92, cy - ch / 2 + 62,
      `${RARITY_NAMES[def.rarity]}${def.god ? ' · ' + def.god : ''}`, 13, '#' + col.toString(16).padStart(6, '0'), 0);
    const desc = this.add.text(cx - cw / 2 + 28, cy - ch / 2 + 96, def.description, {
      fontFamily: 'monospace', fontSize: '15px', color: '#d8cff0', align: 'left', wordWrap: { width: cw - 56 }, lineSpacing: 5,
    }).setOrigin(0, 0);
    const hint = label(this, cx, cy + ch / 2 - 22, this.touch ? 'Touche pour reprendre' : 'Clique pour reprendre', 12, '#9a8fb0');
    c.add([bg, panel, icon, title, sub, desc, hint]);
    this.reviewOverlay = c;
  }

  private closePowerReview(): void {
    if (!this.reviewing) return;
    this.reviewing = false;
    this.reviewOverlay?.destroy(); this.reviewOverlay = undefined;
    this.gs.scene.resume();
    this.gameplayActive = true;
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

  // ---------------- contrôles tactiles (superposition DOM plein écran) ----------------
  // Rendus en DOM (et non dans le canvas) : les commandes couvrent TOUT l'écran,
  // y compris les bords letterbox — plus de « zones mortes » injouables, et les
  // boutons sont grands et calés dans les vrais coins de l'écran.
  private setupTouch(): void {
    this.touch = this.sys.game.device.input.touch || navigator.maxTouchPoints > 0;
    if (!this.touch) return; // desktop : clavier/souris/manette via Phaser

    document.getElementById('tc-root')?.remove(); // sécurité anti-doublon

    const root = document.createElement('div');
    root.id = 'tc-root';

    // -- joystick flottant (visuel) --
    const base = document.createElement('div');
    base.className = 'tc-joy';
    Object.assign(base.style, { width: '150px', height: '150px', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.28)' });
    const thumb = document.createElement('div');
    thumb.className = 'tc-joy';
    Object.assign(thumb.style, { width: '66px', height: '66px', background: 'rgba(255,255,255,0.22)', border: '2px solid rgba(255,255,255,0.45)' });

    // -- boutons d'action : grands, translucides-vifs, TAILLE RELATIVE À L'ÉCRAN --
    const mkBtn = (glyph: string, col: string, ring: string) => {
      const el = document.createElement('div');
      el.className = 'tc-btn';
      el.dataset.tcbtn = '1';
      el.textContent = glyph;
      Object.assign(el.style, { background: col, border: `3px solid ${ring}`, boxShadow: `0 0 22px ${ring}` });
      return el;
    };
    const attack = mkBtn('⚔', 'rgba(244,210,48,0.32)', 'rgba(244,210,48,1)');
    const dash = mkBtn('»', 'rgba(89,200,255,0.32)', 'rgba(89,200,255,1)');
    const special = mkBtn('✷', 'rgba(178,107,255,0.32)', 'rgba(178,107,255,1)');
    const pause = mkBtn('⏸', 'rgba(20,15,30,0.6)', 'rgba(255,255,255,0.6)');

    // Disposition responsive : les tailles suivent la plus petite dimension de
    // l'écran (vmin), recalculées à chaque rotation/redimensionnement.
    const layout = () => {
      const vmin = Math.min(window.innerWidth, window.innerHeight);
      const big = Math.round(Math.max(96, Math.min(vmin * 0.30, 168)));
      const med = Math.round(Math.max(74, Math.min(vmin * 0.23, 132)));
      const sml = Math.round(Math.max(42, Math.min(vmin * 0.12, 62)));
      const gap = Math.round(big * 0.14);
      const sbi = 'env(safe-area-inset-bottom, 0px)';
      const sri = 'env(safe-area-inset-right, 0px)';
      const set = (el: HTMLElement, s: number, css: Partial<CSSStyleDeclaration>) => {
        el.style.width = el.style.height = `${s}px`;
        el.style.fontSize = `${Math.round(s * 0.42)}px`;
        el.style.left = el.style.top = el.style.right = el.style.bottom = '';
        Object.assign(el.style, css as CSSStyleDeclaration);
      };
      set(attack, big, { right: `calc(${sri} + ${gap}px)`, bottom: `calc(${sbi} + ${gap}px)` });
      set(dash, med, { right: `calc(${sri} + ${big + gap * 2}px)`, bottom: `calc(${sbi} + ${Math.round(gap * 1.3)}px)` });
      set(special, med, { right: `calc(${sri} + ${gap}px)`, bottom: `calc(${sbi} + ${big + gap * 2}px)` });
      set(pause, sml, { top: 'calc(env(safe-area-inset-top,0px) + 10px)', right: `calc(${sri} + 12px)` });
      pause.style.fontSize = `${Math.round(sml * 0.5)}px`;
    };
    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
    this.domCleanup.push(() => {
      window.removeEventListener('resize', layout);
      window.removeEventListener('orientationchange', layout);
    });

    root.append(base, thumb, attack, dash, special, pause);
    document.body.appendChild(root);
    this.domRoot = root;

    // En plein écran, Phaser bascule le canvas dans un élément dédié : un overlay
    // resté sur <body> DISPARAÎT. On replace donc les boutons tactiles DANS
    // l'élément plein écran (et on les rend au <body> à la sortie).
    const reparentControls = () => {
      const fsEl = (document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) as HTMLElement | null;
      const host = fsEl ? (fsEl.tagName === 'CANVAS' ? (fsEl.parentElement ?? document.body) : fsEl) : document.body;
      if (root.parentElement !== host) host.appendChild(root);
    };
    document.addEventListener('fullscreenchange', reparentControls);
    document.addEventListener('webkitfullscreenchange', reparentControls);
    this.domCleanup.push(() => {
      document.removeEventListener('fullscreenchange', reparentControls);
      document.removeEventListener('webkitfullscreenchange', reparentControls);
    });

    // -- déplacement : n'importe quel appui sur la moitié gauche de l'écran --
    let moveId: number | null = null, ox = 0, oy = 0;
    const R = 66; // rayon max (px écran)
    const setJoy = (el: HTMLElement, x: number, y: number) => { el.style.left = `${x}px`; el.style.top = `${y}px`; };
    const onStart = (e: TouchEvent) => {
      // Revue d'un pouvoir ouverte : n'importe quel appui la referme (reprend le jeu).
      if (this.reviewing) { this.closePowerReview(); e.preventDefault(); return; }
      if (moveId !== null) return;
      // Appui sur la bande des pouvoirs (haut-gauche) → ouvre la revue (met en pause).
      for (const t of Array.from(e.changedTouches)) {
        const el0 = t.target as HTMLElement | null;
        if (el0 && el0.dataset && el0.dataset.tcbtn === '1') continue;
        const hit = this.powerAtScreen(t.clientX, t.clientY);
        if (hit) { this.openPowerReview(hit.def, hit.n); e.preventDefault(); return; }
      }
      if (!this.gameplayActive) return;
      for (const t of Array.from(e.changedTouches)) {
        const el = t.target as HTMLElement | null;
        if (el && el.dataset && el.dataset.tcbtn === '1') continue;   // c'est un bouton
        if (t.clientX > window.innerWidth * 0.5) continue;            // moitié droite = boutons
        moveId = t.identifier; ox = t.clientX; oy = t.clientY;
        setJoy(base, ox, oy); setJoy(thumb, ox, oy);
        base.style.display = thumb.style.display = 'block';
        e.preventDefault();
        break;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (moveId === null) return;
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== moveId) continue;
        const dx = t.clientX - ox, dy = t.clientY - oy;
        const d = Math.hypot(dx, dy) || 1, cl = Math.min(d, R);
        const nx = dx / d, ny = dy / d;
        setJoy(thumb, ox + nx * cl, oy + ny * cl);
        this.gs.controls.setStick(nx * (cl / R), ny * (cl / R));
        e.preventDefault();
      }
    };
    const onEnd = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier !== moveId) continue;
        moveId = null;
        base.style.display = thumb.style.display = 'none';
        this.gs.controls.setStick(0, 0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    this.domCleanup.push(() => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    });

    // -- boutons : appui = action --
    const bind = (el: HTMLElement, fn: () => void) => {
      const down = (e: TouchEvent) => { e.preventDefault(); e.stopPropagation(); if (this.gameplayActive) fn(); el.style.transform = 'scale(0.9)'; };
      const up = () => { el.style.transform = 'scale(1)'; };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up);
      this.domCleanup.push(() => { el.removeEventListener('touchstart', down); el.removeEventListener('touchend', up); });
    };
    bind(attack, () => this.gs.controls.pressAttack());
    bind(dash, () => this.gs.controls.pressDash());
    bind(special, () => this.gs.controls.pressSpecial());
    // la pause reste utilisable même quand le jeu est en pause (menu pause)
    pause.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); this.gs.controls.pressPause(); }, { passive: false });

    // -- masque l'overlay quand le jeu est en pause (Récompense / Pause) --
    const g = this.gs;
    const onPause = () => { this.gameplayActive = false; root.style.display = 'none'; this.gs.controls.setStick(0, 0); };
    const onResume = () => { this.gameplayActive = true; root.style.display = 'block'; };
    g.events.on(Phaser.Scenes.Events.PAUSE, onPause);
    g.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.domCleanup.push(() => {
      g.events.off(Phaser.Scenes.Events.PAUSE, onPause);
      g.events.off(Phaser.Scenes.Events.RESUME, onResume);
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyDomControls());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.destroyDomControls());
  }

  private destroyDomControls(): void {
    for (const fn of this.domCleanup) fn();
    this.domCleanup = [];
    this.domRoot?.remove();
    this.domRoot = undefined;
  }
}
