import { gsap } from 'gsap';
import { makeFlyCard, getDisplayTexture } from '../core/animations/utils';

class SelectionOverlay {
  constructor(app, renderer, game) {
    this.app = app;
    this.renderer = renderer;
    this.game = game;
    this.container = null;
    this.flyCards = [];
  }

  showMulligan(pid, cards, options) {
    return new Promise((resolve) => {
      this.flyCards = [];
      this._setupOverlay();
      this._setupPrompt(options.prompt || 'Keep your hand or mulligan?');
      this._setupButtons([
        {
          label: 'Keep Hand',
          color: 0x4CAF50,
          callback: () => { this._destroyOverlay(); resolve(true); }
        },
        {
          label: 'Mulligan',
          color: 0xff9800,
          callback: () => { this._destroyOverlay(); resolve(false); }
        },
      ]);
    });
  }

  _destroyOverlay() {
    if (!this.container) return;
    this.container.eventMode = 'auto';
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container = null;
    this.cardSprites = [];
    this.buttons = [];
    this.promptText = null;
  }

  _setupOverlay() {
    this.container = new PIXI.Container();
    this.container.name = 'selectionOverlay';
    this.container.eventMode = 'auto';
    this.container.hitArea = null;

    const overlayBackground = new PIXI.Graphics();
    overlayBackground.name = 'overlayBg';
    overlayBackground.rect(0, 0, this.app.renderer.width, this.app.renderer.height).fill({ color: 0x000000, alpha: 0.6 });
    overlayBackground.eventMode = 'none';
    this.container.addChild(overlayBackground);

    this.promptText = null;
    this.cardSprites = [];
    this.buttons = [];

    this.app.stage.addChild(this.container);
  }

  _setupPrompt(text) {
    this.promptText = new PIXI.Text({
      text: text,
      style: {
        fontSize: 28,
        fill: 0xffffff,
        fontFamily: 'Russo One',
      },
    });
    this.promptText.name = 'overlayPrompt';
    this.promptText.anchor.set(0.5, 0);
    this.promptText.position.set(600, 200);
    this.container.addChild(this.promptText);
  }

  _setupButtons(buttons) {
    const btnW = 180;
    const btnH = 48;
    const totalW = buttons.length * btnW + (buttons.length - 1) * 20;
    const startX = 600 - totalW / 2;
    const Y = 590;

    buttons.forEach((btn, i) => {
      const bx = startX + i * (btnW + 20);

      const buttonBackground = new PIXI.Graphics();
      buttonBackground.name = `overlayButton_${btn.label}`;
      buttonBackground.roundRect(0, 0, btnW, btnH, 10).fill({ color: btn.color, alpha: 0.85 });
      buttonBackground.position.set(bx, Y);
      buttonBackground.eventMode = 'static';
      buttonBackground.cursor = 'pointer';
      buttonBackground.hitArea = new PIXI.Rectangle(0, 0, btnW, btnH);

      const buttonText = new PIXI.Text({
        text: btn.label,
        style: {
          fontSize: 18,
          fill: 0xffffff,
          fontFamily: 'Russo One',
        },
      });
      buttonText.name = `overlayButtonText_${btn.label}`;
      buttonText.anchor.set(0.5);
      buttonText.position.set(bx + btnW / 2, Y + btnH / 2);
      buttonText.eventMode = 'none';

      const buttonHoverBackground = new PIXI.Graphics();
      buttonHoverBackground.name = `overlayButtonHover_${btn.label}`;
      buttonHoverBackground.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0xffffff, alpha: 0 });
      buttonHoverBackground.position.set(bx, Y);
      buttonHoverBackground.eventMode = 'none';

      buttonBackground.on('pointerover', () => {
        buttonHoverBackground.alpha = 0.15;
      });
      buttonBackground.on('pointerout', () => {
        buttonHoverBackground.alpha = 0;
      });
      buttonBackground.on('pointerdown', btn.callback);

      this.container.addChild(buttonHoverBackground);
      this.container.addChild(buttonBackground);
      this.container.addChild(buttonText);
      this.buttons.push({ bg: buttonBackground, hoverBg: buttonHoverBackground, text: buttonText });
    });
  }

  _destroy() {
    if (this.container) {
      this.app.stage.removeChild(this.container);
      this.container = null;
    }
    this.cardSprites = [];
    this.buttons = [];
    this.promptText = null;
  }

  /**
   * Show a dialog to select an opponent's character.
   * Ghost cards fly from opponent field to center overlay.
   * @param {Array} characters - Array of opponent character cards
   * @param {string} prompt - Prompt text to display
   * @returns {Promise<object|null>} - Selected character card or null
   */
  async showOpponentCharacterPick(characters, prompt) {
    return new Promise((resolve) => {
      const { zoneManager, players } = this.game;
      if (!zoneManager || !players) { resolve(null); return; }

      this._setupOverlay();

      const cardW = 100, cardH = 140;
      const flyCardW = cardW, flyCardH = cardH;
      const displayScale = 1.5;
      const displayW = flyCardW * displayScale;
      const displayH = flyCardH * displayScale;
      const centerY = 400;
      const gap = 12;
      const minSpacing = displayW * 0.3;
      const zoneW = this.app.renderer.width - 40;
      let spacing;
      if (characters.length <= 1) {
        spacing = displayW + gap;
      } else if (characters.length * displayW + (characters.length - 1) * gap <= zoneW) {
        spacing = displayW + gap;
      } else {
        spacing = (zoneW - displayW) / (characters.length - 1);
        spacing = Math.max(spacing, minSpacing);
      }
      const totalW = (characters.length - 1) * spacing + displayW;
      const startX = 600 - totalW / 2;

      // Find opponent pid
      let oppPid = null;
      for (const [pid, p] of Object.entries(players)) {
        if (p.field.includes(characters[0])) { oppPid = parseInt(pid); break; }
      }
      if (!oppPid) { this._destroyOverlay(); resolve(null); return; }

      // Build from-position mapping
      const cardData = [];
      for (const card of characters) {
        const slotIdx = players[oppPid].field.indexOf(card);
        const zone = zoneManager.getZone(oppPid, `field_slot_${slotIdx}`);
        if (zone) {
          const globalPos = zone.toGlobal(new PIXI.Point(zone.width / 2, zone.height / 2));
          const stagePos = this.app.stage.toLocal(globalPos);
          cardData.push({ card, fromX: stagePos.x, fromY: stagePos.y });
        } else {
          cardData.push({ card, fromX: 600, fromY: 200 });
        }
      }

      // Create dark overlay first (below fly cards)
      const overlay = new PIXI.Graphics();
      overlay.rect(0, 0, this.app.renderer.width, this.app.renderer.height)
        .fill({ color: 0x000000, alpha: 1 });
      overlay.alpha = 0;
      overlay.eventMode = 'none';
      this.app.stage.addChild(overlay);

      // Create fly cards at field positions
      const flyCards = [];
      const selectBorders = [];
      const bobIds = [];
      for (let i = 0; i < cardData.length; i++) {
        const { card, fromX, fromY } = cardData[i];
        const tex = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
        const fc = makeFlyCard(tex, card, flyCardW, flyCardH);
        fc.x = fromX;
        fc.y = fromY;
        fc.alpha = 1;
        fc.eventMode = 'none';
        fc._targetX = startX + i * spacing + displayW / 2;
        fc._targetY = centerY;
        fc._startX = fromX;
        fc._startY = fromY;
        fc._startScale = 1.0;
        fc._targetScale = displayScale;
        fc.scale.set(fc._startScale);
        this.app.stage.addChild(fc);
        flyCards.push({ flyCard: fc, card });

        // Power text below card — scale down to match flyCard sprite ratio (0.95)
        const hasDONBonus = card._donBonusActive && card.donAttached > 0;
        const pwr = this.renderer.setPowerBadge(fc, card.currentPower || card.power || 0, hasDONBonus);
        pwr.eventMode = 'none';

        // Selection border
        const border = new PIXI.Graphics();
        border.roundRect(-4, -4, displayW + 8, displayH + 8, 8)
          .stroke({ width: 4, color: 0xff3333, alpha: 0 });
        border.x = fc._targetX;
        border.y = fc._targetY;
        border.eventMode = 'none';
        this.app.stage.addChild(border);
        selectBorders.push(border);
      }

      // Phase 1: Fly to center + overlay fade in
      this._flyOpponentCardsToCenter(flyCards, overlay, 400).then(() => {
        // Phase 2: Show selection UI
        this._showOpponentSelection(flyCards, characters, prompt, overlay, selectBorders, bobIds).then((selected) => {
          bobIds.forEach(id => cancelAnimationFrame(id));
          // Cleanup
          for (const fc of flyCards) {
            if (fc.flyCard.parent) fc.flyCard.parent.removeChild(fc.flyCard);
          }
          for (const border of selectBorders) {
            if (border.parent) border.parent.removeChild(border);
          }
          if (overlay && overlay.parent) overlay.parent.removeChild(overlay);
          this._destroyOverlay();
          resolve(selected);
        });
      });
    });
  }

  _flyOpponentCardsToCenter(flyCards, overlay, duration) {
    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: duration / 1000,
        ease: 'sine.inOut',
        onUpdate: () => {
          const e = _p.t;
          overlay.alpha = e * 0.7;
          for (const fc of flyCards) {
            const sp = fc.flyCard;
            sp.x = sp._startX + (sp._targetX - sp._startX) * e;
            sp.y = sp._startY + (sp._targetY - sp._startY) * e;
            const s = sp._startScale + (sp._targetScale - sp._startScale) * e;
            sp.scale.set(s);
          }
        },
        onComplete: () => resolve(),
      });
    });
  }

  _showOpponentSelection(flyCards, characters, prompt, overlay, selectBorders, bobIds) {
    return new Promise((resolve) => {
      const baseScale = flyCards[0].flyCard.scale.x;
      const bobAmount = 3;
      const bobSpeed = 1.5;
      const hoverLift = -8;

      // Prompt text
      const promptText = new PIXI.Text({
        text: prompt || 'Select a Character',
        style: { fontSize: 28, fill: 0xffffff, fontFamily: 'Russo One' },
      });
      promptText.anchor.set(0.5, 0);
      promptText.position.set(600, 180);
      promptText.eventMode = 'none';
      this.app.stage.addChild(promptText);

      let selectedIndex = -1;

      // Setup interaction
      for (let i = 0; i < flyCards.length; i++) {
        const sp = flyCards[i].flyCard;
        sp.eventMode = 'static';
        sp.cursor = 'pointer';
        let _bobId = null;

        const _stopBob = () => {
          if (_bobId) { cancelAnimationFrame(_bobId); _bobId = null; }
        };
        const _startBob = () => {
          if (_bobId) return;
          const t0 = performance.now();
          const tick = () => {
            const bob = -Math.sin((performance.now() - t0) / 1000 * bobSpeed) * bobAmount;
            sp.y = sp._targetY + bob;
            _bobId = requestAnimationFrame(tick);
          };
          _bobId = requestAnimationFrame(tick);
          bobIds.push(_bobId);
        };

        const thisI = i;
        sp.on('pointerover', () => {
          if (selectedIndex !== thisI) {
            sp.scale.set(baseScale * 1.1);
            sp.y = sp._targetY + hoverLift;
            _startBob();
          }
        });
        sp.on('pointerout', () => {
          if (selectedIndex !== thisI) {
            sp.scale.set(baseScale);
            sp.y = sp._targetY;
            _stopBob();
          }
        });
        sp.on('pointerdown', () => {
          _stopBob();
          if (selectedIndex >= 0) {
            selectBorders[selectedIndex].alpha = 0;
            flyCards[selectedIndex].flyCard.scale.set(baseScale);
            flyCards[selectedIndex].flyCard.filters = [];
            flyCards[selectedIndex].flyCard.y = flyCards[selectedIndex].flyCard._targetY;
          }
          selectedIndex = thisI;
          selectBorders[thisI].alpha = 1;
          flyCards[thisI].flyCard.scale.set(baseScale * 1.1);
          flyCards[thisI].flyCard.y = flyCards[thisI].flyCard._targetY + hoverLift;
          const glow = new PIXI.filters.GlowFilter({
            distance: 21,
            outerStrength: 2.2,
            innerStrength: 0.1,
            color: 0x00ff99,
            quality: 0.2,
          });
          flyCards[thisI].flyCard.filters = [glow];
        });
      }

      // Confirm + Skip buttons
      const btnW = 180, btnH = 48;
      const gap = 20;
      const totalBtnW = btnW * 2 + gap;
      const btnStartX = 600 - totalBtnW / 2;
      const btnY = 590;

      const btnExtras = [];
      const btnConfigs = [
        { label: 'Confirm', color: 0xff3333, action: 'confirm' },
        { label: 'Skip', color: 0x666666, action: 'skip' },
      ];
      for (let b = 0; b < btnConfigs.length; b++) {
        const { label, color, action } = btnConfigs[b];
        const bx = btnStartX + b * (btnW + gap);

        const bg = new PIXI.Graphics();
        bg.roundRect(0, 0, btnW, btnH, 10).fill({ color, alpha: 0.85 });
        bg.position.set(bx, btnY);
        bg.eventMode = 'static';
        bg.cursor = 'pointer';

        const txt = new PIXI.Text({
          text: label,
          style: { fontSize: 18, fill: 0xffffff, fontFamily: 'Russo One' },
        });
        txt.anchor.set(0.5);
        txt.position.set(bx + btnW / 2, btnY + btnH / 2);
        txt.eventMode = 'none';

        const hv = new PIXI.Graphics();
        hv.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0xffffff, alpha: 0 });
        hv.position.set(bx, btnY);
        hv.eventMode = 'none';

        bg.on('pointerover', () => { hv.alpha = 0.15; });
        bg.on('pointerout', () => { hv.alpha = 0; });

        const finalAction = action;
        bg.on('pointerdown', () => {
          const selected = finalAction === 'skip' ? null : (selectedIndex >= 0 ? characters[selectedIndex] : null);
          this._cleanup(promptText, overlay, ...btnExtras);
          resolve(selected);
        });

        btnExtras.push(bg, txt, hv);
        this.app.stage.addChild(hv);
        this.app.stage.addChild(bg);
        this.app.stage.addChild(txt);
      }
    });
  }

  _cleanup(...elements) {
    for (const el of elements) {
      if (el && el.parent) el.parent.removeChild(el);
    }
  }

  /**
   * Show a dialog to select a Blocker character.
   * @param {Array} blockers - Array of active characters with Blocker keyword
   * @param {object} attacker - The attacking character/leader
   * @returns {Promise<object|null>} - Selected blocker card or null
   */
  showBlockerSelection(blockers, attacker) {
    return new Promise((resolve) => {
      this._setupOverlay();

      this._setupPrompt(
        `Incoming attack! (${attacker.name || 'Attacker'})\nSelect a Blocker or skip.`
      );

      const btnW = 140;
      const btnH = 48;
      const gap = 16;
      const totalW = (blockers.length + 1) * btnW + blockers.length * gap;
      const startX = 600 - totalW / 2;
      const Y = 560;

      const buttons = [];

      // One button per blocker
      for (let i = 0; i < blockers.length; i++) {
        buttons.push({
          label: blockers[i].name.length > 12 ? blockers[i].name.slice(0, 11) + '…' : blockers[i].name,
          sublabel: `${blockers[i].currentPower} PWR`,
          color: 0x2196F3,
          callback: () => {
            this._destroyOverlay();
            resolve(blockers[i]);
          },
        });
      }

      // Skip button
      buttons.push({
        label: 'Skip',
        sublabel: '',
        color: 0x666666,
        callback: () => {
          this._destroyOverlay();
          resolve(null);
        },
      });

      this._setupBlockerButtons(buttons, btnW, btnH, gap, startX, Y);
    });
  }

  _setupBlockerButtons(buttons, btnW, btnH, gap, startX, startY) {
    buttons.forEach((btn, i) => {
      const bx = startX + i * (btnW + gap);

      // Background
      const bg = new PIXI.Graphics();
      bg.name = `blockerBtn_${i}`;
      bg.roundRect(0, 0, btnW, btnH, 10)
        .fill({ color: btn.color, alpha: 0.85 });
      bg.position.set(bx, startY);
      bg.eventMode = 'static';
      bg.cursor = 'pointer';

      // Main label
      const text = new PIXI.Text({
        text: btn.label,
        style: {
          fontSize: 14,
          fill: 0xffffff,
          fontFamily: 'Russo One',
        },
      });
      text.name = `blockerBtnText_${i}`;
      text.anchor.set(0.5);
      text.position.set(bx + btnW / 2, startY + btnH / 2 - 8);
      text.eventMode = 'none';

      // Sub label (power)
      let sub = null;
      if (btn.sublabel) {
        sub = new PIXI.Text({
          text: btn.sublabel,
          style: {
            fontSize: 12,
            fill: 0xcccccc,
            fontFamily: 'Russo One',
          },
        });
        sub.name = `blockerBtnSub_${i}`;
        sub.anchor.set(0.5);
        sub.position.set(bx + btnW / 2, startY + btnH / 2 + 10);
        sub.eventMode = 'none';
      }

      // Hover overlay
      const hover = new PIXI.Graphics();
      hover.name = `blockerBtnHover_${i}`;
      hover.roundRect(0, 0, btnW, btnH, 10)
        .fill({ color: 0xffffff, alpha: 0 });
      hover.position.set(bx, startY);
      hover.eventMode = 'none';

      bg.on('pointerover', () => { hover.alpha = 0.15; });
      bg.on('pointerout', () => { hover.alpha = 0; });
      bg.on('pointerdown', btn.callback);

      this.container.addChild(hover);
      this.container.addChild(bg);
      this.container.addChild(text);
      if (sub) this.container.addChild(sub);
    });
  }
}

export default SelectionOverlay;
