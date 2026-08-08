import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config/game';
import { button, label, panel, iconBadge } from '../ui/theme';
import { SaveSystem, formatTime } from '../systems/SaveSystem';
import { META_UPGRADES } from '../config/metaUpgrades';
import { MATERIALS, materialById } from '../config/materials';
import { CONSUMABLES, consumableById } from '../config/consumables';
import { DIFFICULTIES } from '../config/difficulty';
import { glyphTexture } from '../art/icons';
import { AudioManager } from '../systems/AudioManager';
import { RunState } from '../systems/RunState';

export class HubScene extends Phaser.Scene {
  private selectedDiff = 'normal';
  private currencyText!: Phaser.GameObjects.Text;
  private cardsLayer!: Phaser.GameObjects.Container;
  private invLayer!: Phaser.GameObjects.Container;
  private diffButtons: { id: string; g: Phaser.GameObjects.Graphics; x: number; y: number; w: number; h: number }[] = [];
  private diffLayer!: Phaser.GameObjects.Container;

  constructor() { super('Hub'); }

  create(): void {
    this.cameras.main.setBackgroundColor(0x140f1e);
    this.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'floor_foret').setAlpha(0.25);

    label(this, GAME_WIDTH / 2, 34, 'CAMP DU CHATON', 28, '#f4c430');
    label(this, GAME_WIDTH / 2, 62, 'Dépense tes Croquettes Dorées pour devenir plus fort', 13, '#9a8fb0');

    // feu de camp + chat (coin bas-gauche, sous la grille de cartes)
    const fire = this.add.particles(70, GAME_HEIGHT - 44, 'px', {
      speedY: { min: -40, max: -80 }, speedX: { min: -10, max: 10 },
      scale: { start: 1.2, end: 0 }, lifespan: 600, frequency: 40,
      tint: [0xffd24a, 0xff6a1f, 0xe8384f], blendMode: 'ADD',
    });
    fire.setDepth(1);
    this.add.sprite(128, GAME_HEIGHT - 44, 'cat').setScale(2.4).setFlipX(true);

    // monnaie
    const coin = iconBadge(this, GAME_WIDTH - 150, 36, glyphTexture('coin'), COLORS.gold, 0x3a2f10, 16);
    coin.setDepth(2);
    this.currencyText = label(this, GAME_WIDTH - 120, 36, '', 20, '#f4c430', 0);
    this.refreshCurrency();

    // sélecteur de difficulté
    label(this, GAME_WIDTH / 2, 86, 'Difficulté', 16, '#f4e9c1');
    this.diffLayer = this.add.container(0, 0);
    this.buildDifficulty();

    // grille d'améliorations
    this.cardsLayer = this.add.container(0, 0);
    this.buildCards();

    // inventaire de matériaux de boss (bande sous la grille)
    this.invLayer = this.add.container(0, 0);
    this.buildInventory();

    // partir
    button(this, GAME_WIDTH / 2, GAME_HEIGHT - 40, 300, 56, '🐾  PARTIR À L’AVENTURE', () => {
      AudioManager.play('ui');
      RunState.reset(this.selectedDiff);
      RunState.setConsumables(SaveSystem.loadout);
      this.scene.start('Game');
    }, { fill: 0x2a4a2a, border: 0x6ad46a, size: 20 });

    button(this, 70, 34, 100, 40, '‹ Menu', () => this.scene.start('Menu'), { size: 14 });

    // Boutique de consommables (objets portés en run)
    button(this, GAME_WIDTH - 150, GAME_HEIGHT - 40, 210, 52, '🧪  BOUTIQUE', () => this.openShop(),
      { fill: 0x2a2a4a, border: 0x8a7aff, textColor: '#d8d0ff', size: 16 });

    AudioManager.startMusic('hub');
  }

  private refreshCurrency(): void {
    this.currencyText.setText(`${SaveSystem.currency}`);
  }

  private buildDifficulty(): void {
    this.diffLayer.removeAll(true);
    const total = DIFFICULTIES.length;
    const w = 150, gap = 12;
    const startX = GAME_WIDTH / 2 - ((w + gap) * total - gap) / 2 + w / 2;
    const y = 116;
    DIFFICULTIES.forEach((d, i) => {
      const locked = d.id === 'extreme' && !SaveSystem.data.unlockedExtreme;
      const x = startX + i * (w + gap);
      const g = this.add.graphics();
      const selected = this.selectedDiff === d.id;
      g.fillStyle(selected ? d.color : COLORS.panel, selected ? 0.9 : 0.7);
      g.lineStyle(3, selected ? 0xffffff : d.color, 1);
      g.fillRoundedRect(x - w / 2, y - 22, w, 44, 8);
      g.strokeRoundedRect(x - w / 2, y - 22, w, 44, 8);
      const t = label(this, x, y - 4, locked ? `${d.name} 🔒` : d.name, 16, locked ? '#7a7088' : '#f4e9c1');
      const sub = label(this, x, y + 12, `PV×${d.enemyHp} · Gain×${d.reward}`, 10, '#c9c0d8');
      this.diffLayer.add([g, t, sub]);
      if (!locked) {
        const hit = this.add.rectangle(x, y, w, 44, 0x000000, 0.001).setInteractive();
        hit.on('pointerdown', () => {
          this.selectedDiff = d.id;
          AudioManager.play('ui');
          this.buildDifficulty();
        });
        this.diffLayer.add(hit);
      }
    });
    // record de temps (clear complet) pour la difficulté sélectionnée
    const rec = SaveSystem.bestTime(this.selectedDiff);
    const dn = DIFFICULTIES.find((d) => d.id === this.selectedDiff)?.name ?? '';
    const recTxt = rec !== null ? `🏆 Record ${dn} : ${formatTime(rec)}` : `🏆 ${dn} : aucun record pour l'instant`;
    this.diffLayer.add(label(this, GAME_WIDTH / 2, 150, recTxt, 13, '#f4c430'));
  }

  private openShop(): void {
    AudioManager.play('ui');
    const c = this.add.container(0, 0).setDepth(200);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05030a, 0.85).setInteractive();
    const p = panel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 900, 500);
    c.add([bg, p]);
    label(this, GAME_WIDTH / 2, 44, '🧪  BOUTIQUE DE CONSOMMABLES', 24, '#d8d0ff').setDepth(201).setName('shopel');
    label(this, GAME_WIDTH / 2, 70, 'Achète avec des pièces + matériaux de boss. Porte jusqu’à 2 objets par run (touche 1/2 ou clic en jeu).', 12, '#9a8fb0').setDepth(201).setName('shopel');

    const rebuild = () => {
      // purge les éléments dynamiques précédents
      c.list.filter((o) => o.getData && o.getData('dyn')).forEach((o) => o.destroy());
      // --- slots de loadout (2) ---
      for (let i = 0; i < 2; i++) {
        const sx = GAME_WIDTH / 2 - 120 + i * 240, sy = 108;
        const id = SaveSystem.loadout[i];
        const def = id ? consumableById(id) : undefined;
        const box = this.add.graphics().setDepth(201); box.setData('dyn', true);
        box.fillStyle(0x1a1420, 0.9).fillRoundedRect(sx - 110, sy - 22, 220, 44, 8);
        box.lineStyle(2, def ? 0x8a7aff : 0x4a4358, 1).strokeRoundedRect(sx - 110, sy - 22, 220, 44, 8);
        c.add(box);
        if (def) {
          const img = this.add.image(sx - 92, sy, def.icon).setDepth(202); img.setScale(24 / Math.max(img.width, img.height)); img.setData('dyn', true);
          const nm = label(this, sx - 74, sy - 6, def.name, 12, '#eaf4ff', 0, 0.5).setDepth(202); nm.setData('dyn', true);
          const hint = label(this, sx - 74, sy + 9, 'Retirer (remboursé)', 9, '#8a8098', 0, 0.5).setDepth(202); hint.setData('dyn', true);
          const z = this.add.zone(sx, sy, 220, 44).setInteractive({ useHandCursor: true }).setDepth(203); z.setData('dyn', true);
          z.on('pointerdown', () => {
            // remboursement puis retrait
            SaveSystem.addCurrency(def.cost);
            for (const [k, v] of Object.entries(def.matCost)) SaveSystem.addMaterial(k, v);
            SaveSystem.unequipConsumable(i);
            AudioManager.play('coin'); this.refreshCurrency(); this.buildInventory(); rebuild();
          });
          c.add([img, nm, hint, z]);
        } else {
          const t = label(this, sx, sy, `Slot ${i + 1} libre`, 12, '#6a6478').setDepth(202); t.setData('dyn', true); c.add(t);
        }
      }
      // --- grille de consommables (4 × 2) ---
      const cols = 4, cw = 200, chh = 128, gapX = 14, gapY = 12;
      const startX = GAME_WIDTH / 2 - ((cw + gapX) * cols - gapX) / 2 + cw / 2;
      const startY = 220;
      CONSUMABLES.forEach((cd, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = startX + col * (cw + gapX), y = startY + row * (chh + gapY);
        const canAfford = SaveSystem.loadout.length < 2 && SaveSystem.currency >= cd.cost
          && Object.entries(cd.matCost).every(([k, v]) => SaveSystem.materialCount(k) >= v);
        const pnl = panel(this, x, y, cw, chh, COLORS.panel, canAfford ? 0x8a7aff : 0x4a4358, 0.95).setDepth(201); pnl.setData('dyn', true);
        const img = this.add.image(x - cw / 2 + 22, y - chh / 2 + 22, cd.icon).setDepth(202); img.setScale(24 / Math.max(img.width, img.height)); img.setData('dyn', true);
        const nm = label(this, x - cw / 2 + 42, y - chh / 2 + 16, cd.name, 13, '#eaf4ff', 0, 0.5).setDepth(202); nm.setData('dyn', true);
        const kindT = label(this, x - cw / 2 + 42, y - chh / 2 + 32, cd.kind === 'run' ? 'Permanent (run)' : 'Temporaire', 9, cd.kind === 'run' ? '#8fd0ff' : '#f4c430', 0, 0.5).setDepth(202); kindT.setData('dyn', true);
        const desc = label(this, x, y - chh / 2 + 52, cd.description, 10, '#c9c0d8', 0.5, 0).setDepth(202); desc.setWordWrapWidth(cw - 20); desc.setData('dyn', true);
        // coût
        const matEntry = Object.entries(cd.matCost)[0];
        const md = matEntry ? materialById(matEntry[0]) : undefined;
        const hasMat = matEntry ? SaveSystem.materialCount(matEntry[0]) >= matEntry[1] : true;
        const mimg = this.add.image(x - cw / 2 + 24, y + chh / 2 - 16, md?.icon ?? 'mat_wood').setDepth(202); mimg.setScale(20 / Math.max(mimg.width, mimg.height)); mimg.setData('dyn', true);
        const mtxt = label(this, x - cw / 2 + 36, y + chh / 2 - 16, `${matEntry ? matEntry[1] : ''}`, 11, hasMat ? '#f4c430' : '#ff6a6a', 0, 0.5).setDepth(202); mtxt.setData('dyn', true);
        const cLabel = label(this, x + cw / 2 - 12, y + chh / 2 - 16, `${cd.cost} 🥇`, 12, canAfford ? '#f4c430' : '#8a8098', 1, 0.5).setDepth(202); cLabel.setData('dyn', true);
        c.add([pnl, img, nm, kindT, desc, mimg, mtxt, cLabel]);
        const hit = this.add.rectangle(x, y, cw, chh, 0x000000, 0.001).setInteractive().setDepth(203); hit.setData('dyn', true);
        hit.on('pointerdown', () => {
          if (SaveSystem.buyConsumable(cd.id, cd.cost, cd.matCost)) {
            AudioManager.play('coin'); this.refreshCurrency(); this.buildInventory(); rebuild();
          } else { AudioManager.play('ui'); this.cameras.main.shake(120, 0.004); }
        });
        c.add(hit);
      });
    };
    rebuild();

    const close = button(this, GAME_WIDTH / 2, GAME_HEIGHT - 34, 200, 46, 'Fermer', () => {
      this.children.list.filter((o) => o.name === 'shopel').forEach((o) => o.destroy());
      c.destroy();
    }, { size: 16 });
    (close.container as Phaser.GameObjects.Container).setDepth(202);
    c.add(close.container);
  }

  private buildInventory(): void {
    this.invLayer.removeAll(true);
    const y = 458;
    const n = MATERIALS.length;
    const spacing = 60;
    const startX = GAME_WIDTH / 2 - (n - 1) * spacing / 2;
    this.invLayer.add(label(this, GAME_WIDTH / 2, y - 20, 'Ressources de boss (lâchées à leur 1re défaite)', 11, '#8a8098'));
    MATERIALS.forEach((md, i) => {
      const x = startX + i * spacing;
      const cnt = SaveSystem.materialCount(md.id);
      const img = this.add.image(x - 9, y, md.icon).setAlpha(cnt > 0 ? 1 : 0.35);
      img.setScale(24 / Math.max(img.width, img.height)); // taille uniforme
      const t = label(this, x + 8, y, `×${cnt}`, 12, cnt > 0 ? '#f4e9c1' : '#6a6478', 0, 0.5);
      this.invLayer.add([img, t]);
    });
  }

  private buildCards(): void {
    this.cardsLayer.removeAll(true);
    const cols = 4, cw = 210, ch = 86, gapX = 16, gapY = 10;
    const startX = GAME_WIDTH / 2 - ((cw + gapX) * cols - gapX) / 2 + cw / 2;
    const startY = 214;
    META_UPGRADES.forEach((m, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = startX + col * (cw + gapX);
      const y = startY + row * (ch + gapY);
      const tier = SaveSystem.tierOf(m.id);
      const cost = SaveSystem.nextCost(m.id);
      const maxed = cost === null;
      const canBuy = SaveSystem.canBuy(m.id);

      const p = panel(this, x, y, cw, ch, COLORS.panel, canBuy ? COLORS.gold : 0x4a4358, 0.95);
      const badge = iconBadge(this, x - cw / 2 + 24, y - ch / 2 + 22, glyphTexture(m.icon), 0xf4e9c1, COLORS.panelLight, 14);
      const name = label(this, x - cw / 2 + 46, y - ch / 2 + 22, m.name, 13, '#f4e9c1', 0, 0.5);
      // description ancrée sous le titre (grandit vers le bas -> jamais de chevauchement)
      const desc = label(this, x, y - ch / 2 + 40, m.description, 10, '#c9c0d8', 0.5, 0);
      desc.setWordWrapWidth(cw - 22);
      this.cardsLayer.add([p, badge, name, desc]);

      // pips de palier (bas-gauche)
      for (let t = 0; t < m.maxTier; t++) {
        const px = x - cw / 2 + 18 + t * 14;
        const pip = this.add.circle(px, y + ch / 2 - 13, 4.5, t < tier ? COLORS.gold : 0x3a3450)
          .setStrokeStyle(1, 0x000000, 0.4);
        this.cardsLayer.add(pip);
      }

      // coût (bas-droite, séparé des pips)
      const costStr = maxed ? 'MAX' : `${cost} 🥇`;
      const cLabel = label(this, x + cw / 2 - 12, y + ch / 2 - 13, costStr, 12, maxed ? '#6ad46a' : (canBuy ? '#f4c430' : '#8a8098'), 1, 0.5);
      this.cardsLayer.add(cLabel);

      // coût EN MATÉRIAUX de boss (icône + quantité, à gauche du coût en pièces)
      if (!maxed) {
        const mats = Object.entries(SaveSystem.matCostOf(m.id));
        mats.forEach(([mid, qty], k) => {
          const md = materialById(mid);
          const has = SaveSystem.materialCount(mid) >= qty;
          const ix = x + cw / 2 - 62 - k * 30;
          const mimg = this.add.image(ix, y + ch / 2 - 13, md?.icon ?? 'mat_wood');
          // taille uniforme (~22 px, comme les médailles), aspect préservé : ne déborde plus.
          mimg.setScale(22 / Math.max(mimg.width, mimg.height));
          const mtxt = label(this, ix + 10, y + ch / 2 - 13, `${qty}`, 11, has ? '#f4c430' : '#ff6a6a', 0, 0.5);
          this.cardsLayer.add([mimg, mtxt]);
        });
      }

      if (!maxed) {
        const hit = this.add.rectangle(x, y, cw, ch, 0x000000, 0.001).setInteractive();
        hit.on('pointerdown', () => {
          if (SaveSystem.buy(m.id)) {
            AudioManager.play('coin');
            this.refreshCurrency();
            this.buildCards();
            this.buildInventory();
          } else {
            AudioManager.play('ui');
            this.cameras.main.shake(120, 0.004);
          }
        });
        this.cardsLayer.add(hit);
      }
    });
  }
}
