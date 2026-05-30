import { easeInOut, easeOutCubic, createFlipCard, makeFlyCard, getDisplayTexture, narrowContext } from './utils';
import FlyToBottomDeckAnimation from './FlyToBottomDeckAnimation';
import FlyToHandAnimation from './FlyToHandAnimation';

export default class CardPickAnimation {
  static requires = ['app', 'zoneManager', 'handRenderer', 'ui'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * 1. All hand cards fly to center with overlay background
   * 2. Player clicks a card to select (highlight with red border)
   * 3. Player clicks confirm
   * 4. Selected card flies to trash, others fly back to hand
   *
   * @param {number} pid - Player ID
   * @param {object} player - Player object
   * @param {string} prompt - Prompt text
   * @returns {Promise<object>} - Selected card or null
   */
  async animate(pid, player, prompt) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!handZone) return null;

    const cards = [...player.hand];
    const cardW = 100, cardH = 140;
    const flyCardW = cardW * 0.95, flyCardH = cardH * 0.95;

    // Use computed layout for reliable starting positions (sprites may be mid-animation)
    const handLayout = handRenderer.computeLayout(handZone, cards.length);
    const oldSprites = handRenderer.handSprites[pid] || [];

    // Compute layout for center display — same size as mulligan, constrained to hand zone width
    const displayScale = 1.5;
    const displayW = flyCardW * displayScale;
    const displayH = flyCardH * displayScale;
    const centerY = 400;

    const zoneW = handZone.width - 20;
    const gap = 12;
    const minSpacing = displayW * 0.3;
    let spacing;
    if (cards.length <= 1) {
      spacing = displayW + gap;
    } else if (cards.length * displayW + (cards.length - 1) * gap <= zoneW) {
      spacing = displayW + gap;
    } else {
      spacing = (zoneW - displayW) / (cards.length - 1);
      spacing = Math.max(spacing, minSpacing);
    }

    const totalW = (cards.length - 1) * spacing + displayW;
    const startX = 600 - totalW / 2;

    // Create fly cards for each hand card using makeFlyCard (consistent with other animations)
    const flyCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const tex = getDisplayTexture(pid, card);
      const flyCard = makeFlyCard(tex, card, flyCardW, flyCardH);
      flyCard.eventMode = 'none';
      flyCard._isCardPickFlyCard = true;

      // Start from hand layout position
      if (handLayout && handLayout.positions[i]) {
        const lp = handLayout.positions[i];
        const globalPos = handZone.toGlobal(new PIXI.Point(lp.x + cardW * 0.95 / 2, lp.y + cardH * 0.95 / 2));
        const stagePos = app.stage.toLocal(globalPos);
        flyCard.x = stagePos.x;
        flyCard.y = stagePos.y;
      } else {
        flyCard.x = 600;
        flyCard.y = 400;
      }

      // Target center position
      flyCard._targetX = startX + i * spacing + displayW / 2;
      flyCard._targetY = centerY;
      flyCard._startX = flyCard.x;
      flyCard._startY = flyCard.y;

      flyCard._startScale = 0.95;
      flyCard._targetScale = displayScale;
      flyCard.scale.set(flyCard._startScale);

      flyCard.alpha = 1;
      app.stage.addChild(flyCard);
      flyCards.push({ flyCard, card });
    }

    // Hide original hand sprites
    for (const sp of oldSprites) {
      if (sp) sp.visible = false;
    }

    // Phase 1: Fly to center + overlay fade in
    await this._flyToCenter(flyCards, 400);

    // Phase 2: Show selection UI
    const selected = await this._showSelection(pid, flyCards, cards, prompt, cardW, cardH, displayScale);

    if (!selected) {
      // No card selected: restore hand
      const overlay = flyCards[0].flyCard._overlay;
      if (overlay && overlay.parent) overlay.parent.removeChild(overlay);
      for (const fc of flyCards) {
        if (fc.flyCard.parent) fc.flyCard.parent.removeChild(fc.flyCard);
      }
      return null;
    }

    // Phase 3: Animate selected to trash, others return to hand
    await this._animateResult(pid, player, flyCards, cards, selected, cardW, cardH);

    return selected;
  }

  _flyToCenter(flyCards, duration) {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      // Create overlay
      const overlay = new PIXI.Graphics();
      overlay.name = 'cardpick-overlay';
      overlay.rect(0, 0, app.screen.width, app.screen.height)
             .fill({ color: 0x000000, alpha: 1 });
      overlay.alpha = 0;
      overlay.eventMode = 'none';
      app.stage.addChild(overlay);
      // Reparent below fly cards (they're already on stage)
      const flyIdx = app.stage.children.findIndex(c => c._isCardPickFlyCard);
      if (flyIdx >= 0) {
        app.stage.removeChild(overlay);
        app.stage.addChildAt(overlay, flyIdx);
      }

      const start = performance.now();

      requestAnimationFrame(function tick(now) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const e = easeInOut(t);

        overlay.alpha = e * 0.7;

        for (const fc of flyCards) {
          const sp = fc.flyCard;
          sp.x = sp._startX + (sp._targetX - sp._startX) * e;
          sp.y = sp._startY + (sp._targetY - sp._startY) * e;
          const s = sp._startScale + (sp._targetScale - sp._startScale) * e;
          sp.scale.set(s);
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          overlay._ref = overlay;
          for (const fc of flyCards) fc.flyCard._overlay = overlay;
          resolve(overlay);
        }
      });
    });
  }

  _showSelection(pid, flyCards, cards, prompt, cardW, cardH, displayScale) {
    return new Promise((resolve) => {
      const { app } = this.ctx;
      const overlay = flyCards[0].flyCard._overlay;
      const displayW = cardW * 0.95 * displayScale;
      const displayH = cardH * 0.95 * displayScale;

      // Prompt text
      const cardPickPromptText = new PIXI.Text({
        text: prompt || 'Choose 1 card',
        style: { fontSize: 28, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      cardPickPromptText.name = 'cardPickPrompt';
      cardPickPromptText.anchor.set(0.5, 0);
      cardPickPromptText.position.set(600, 180);
      cardPickPromptText.eventMode = 'none';
      app.stage.addChild(cardPickPromptText);

      let selectedIndex = -1;
      const selectBorders = [];
      const bobIds = [];

      // Setup interaction on fly cards
      for (let i = 0; i < flyCards.length; i++) {
        const sp = flyCards[i].flyCard;
        sp.eventMode = 'static';
        sp.cursor = 'pointer';
        const baseScale = sp.scale.x;
        const bobAmount = 3;
        const bobSpeed = 1.5;
        const hoverLift = -8;
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

        // Selection border
        const selectBorder = new PIXI.Graphics();
        selectBorder.roundRect(-4, -4, displayW + 8, displayH + 8, 8)
                   .stroke({ width: 4, color: 0xff3333, alpha: 0 });
        selectBorder.x = sp._targetX;
        selectBorder.y = sp._targetY;
        selectBorder.eventMode = 'none';
        app.stage.addChild(selectBorder);
        selectBorders.push(selectBorder);

        const thisI = i;
        sp.on('pointerover', () => {
          if (selectedIndex !== thisI) {
            sp.scale.set(baseScale * 1.1);
            sp.y = sp._targetY + hoverLift;
            _startBob();
            this.ctx.ui.showCardInfo(cards[thisI], pid);
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
            quality: 0.2
          });
          glow._tickerTime = 0;
          flyCards[thisI].flyCard.filters = [glow];
          enableBtn();
        });
      }

      // Confirm button (disabled until a card is selected)
      const btnW = 180, btnH = 48;
      const btnX = 600 - btnW / 2, btnY = 590;
      let btnEnabled = false;

      const confirmButtonBg = new PIXI.Graphics();
      confirmButtonBg.name = 'confirmButton';
      confirmButtonBg.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0xff3333, alpha: 1 });
      confirmButtonBg.position.set(btnX, btnY);
      confirmButtonBg.alpha = 0.35;
      confirmButtonBg.eventMode = 'none';

      const confirmButtonText = new PIXI.Text({
        text: 'Confirm',
        style: { fontSize: 18, fill: 0x666666, fontFamily: 'Russo One' }
      });
      confirmButtonText.name = 'confirmButtonText';
      confirmButtonText.anchor.set(0.5);
      confirmButtonText.position.set(btnX + btnW / 2, btnY + btnH / 2);
      confirmButtonText.eventMode = 'none';

      const confirmButtonHover = new PIXI.Graphics();
      confirmButtonHover.name = 'confirmButtonHover';
      confirmButtonHover.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0xffffff, alpha: 0 });
      confirmButtonHover.position.set(btnX, btnY);
      confirmButtonHover.eventMode = 'none';

      const enableBtn = () => {
        btnEnabled = true;
        confirmButtonBg.alpha = 1;
        confirmButtonBg.eventMode = 'static';
        confirmButtonBg.cursor = 'pointer';
        confirmButtonText.style.fill = 0xffffff;
        confirmButtonBg.on('pointerover', () => { confirmButtonHover.alpha = 0.15; });
        confirmButtonBg.on('pointerout', () => { confirmButtonHover.alpha = 0; });
      };

      confirmButtonBg.on('pointerdown', () => {
        if (!btnEnabled) return;
        bobIds.forEach(id => cancelAnimationFrame(id));
        const selected = selectedIndex >= 0 ? cards[selectedIndex] : null;
        this._cleanup(confirmButtonBg, confirmButtonText, confirmButtonHover, cardPickPromptText, selectBorders);
        resolve(selected);
      });

      app.stage.addChild(confirmButtonHover);
      app.stage.addChild(confirmButtonBg);
      app.stage.addChild(confirmButtonText);
    });
  }

  _cleanup(...elements) {
    for (const el of elements) {
      if (el && el.parent) el.parent.removeChild(el);
    }
  }

  /**
   * Nami-specific pick: select 2 cards and choose top/bottom of deck.
   * @param {number} pid - Player ID
   * @param {object} player - Player object
   * @returns {Promise<{cards: Array, position: 'top'|'bottom'}|null>}
   */
  async animateNami(pid, player) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!handZone) return null;

    const cards = [...player.hand];
    const cardW = 100, cardH = 140;
    const flyCardW = cardW * 0.95, flyCardH = cardH * 0.95;

    const handLayout = handRenderer.computeLayout(handZone, cards.length);
    const oldSprites = handRenderer.handSprites[pid] || [];

    const displayScale = 1.5;
    const displayW = flyCardW * displayScale;
    const displayH = flyCardH * displayScale;
    const centerY = 400;

    const zoneW = handZone.width - 20;
    const gap = 12;
    const minSpacing = displayW * 0.3;
    let spacing;
    if (cards.length <= 1) {
      spacing = displayW + gap;
    } else if (cards.length * displayW + (cards.length - 1) * gap <= zoneW) {
      spacing = displayW + gap;
    } else {
      spacing = (zoneW - displayW) / (cards.length - 1);
      spacing = Math.max(spacing, minSpacing);
    }

    const totalW = (cards.length - 1) * spacing + displayW;
    const startX = 600 - totalW / 2;

    const flyCards = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const tex = getDisplayTexture(pid, card);
      const flyCard = makeFlyCard(tex, card, flyCardW, flyCardH);
      flyCard.eventMode = 'none';
      flyCard._isCardPickFlyCard = true;

      if (handLayout && handLayout.positions[i]) {
        const lp = handLayout.positions[i];
        const globalPos = handZone.toGlobal(new PIXI.Point(lp.x + cardW * 0.95 / 2, lp.y + cardH * 0.95 / 2));
        const stagePos = app.stage.toLocal(globalPos);
        flyCard.x = stagePos.x;
        flyCard.y = stagePos.y;
      } else {
        flyCard.x = 600;
        flyCard.y = 400;
      }

      flyCard._targetX = startX + i * spacing + displayW / 2;
      flyCard._targetY = centerY;
      flyCard._startX = flyCard.x;
      flyCard._startY = flyCard.y;
      flyCard._startScale = 0.95;
      flyCard._targetScale = displayScale;
      flyCard.scale.set(flyCard._startScale);
      flyCard.alpha = 1;
      app.stage.addChild(flyCard);
      flyCards.push({ flyCard, card });
    }

    for (const sp of oldSprites) {
      if (sp) sp.visible = false;
    }

    await this._flyToCenter(flyCards, 400);

    const result = await this._showNamiSelection(pid, flyCards, cards, cardW, cardH, displayScale);

    if (!result) {
      const overlay = flyCards[0].flyCard._overlay;
      if (overlay && overlay.parent) overlay.parent.removeChild(overlay);
      for (const fc of flyCards) {
        if (fc.flyCard.parent) fc.flyCard.parent.removeChild(fc.flyCard);
      }
      return null;
    }

    await this._animateNamiResult(pid, player, flyCards, cards, result.cards, result.position, cardW, cardH);

    return { cards: result.cards, position: result.position };
  }

  _showNamiSelection(pid, flyCards, cards, cardW, cardH, displayScale) {
    return new Promise((resolve) => {
      const { app } = this.ctx;
      const overlay = flyCards[0].flyCard._overlay;
      const displayW = cardW * 0.95 * displayScale;
      const displayH = cardH * 0.95 * displayScale;

      const namiPromptText = new PIXI.Text({
        text: 'Choose 2 cards to return to deck',
        style: { fontSize: 28, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      namiPromptText.name = 'namiPrompt';
      namiPromptText.anchor.set(0.5, 0);
      namiPromptText.position.set(600, 180);
      namiPromptText.eventMode = 'none';
      app.stage.addChild(namiPromptText);

      const selectedIndices = [];
      const selectBorders = [];
      const numberBadges = [];
      const bobIds = [];
      const baseScaleVal = displayScale;

      for (let i = 0; i < flyCards.length; i++) {
        const sp = flyCards[i].flyCard;
        sp.eventMode = 'static';
        sp.cursor = 'pointer';
        const bobAmount = 3;
        const bobSpeed = 1.5;
        const hoverLift = -8;
        let _bobId = null;

        const _stopBob = () => { if (_bobId) { cancelAnimationFrame(_bobId); _bobId = null; } };
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

        const selectBorder = new PIXI.Graphics();
        selectBorder.roundRect(-4, -4, displayW + 8, displayH + 8, 8)
                   .stroke({ width: 4, color: 0x00ff99, alpha: 0 });
        selectBorder.x = sp._targetX;
        selectBorder.y = sp._targetY;
        selectBorder.eventMode = 'none';
        app.stage.addChild(selectBorder);
        selectBorders.push(selectBorder);

        // Number badge (circle + text) placed above card
        const badgeBg = new PIXI.Graphics();
        badgeBg.circle(0, 0, 16).fill({ color: 0x00ff99 });
        badgeBg.x = sp._targetX;
        badgeBg.y = sp._targetY - displayH / 2 - 18;
        badgeBg.alpha = 0;
        badgeBg.eventMode = 'none';

        const badgeText = new PIXI.Text({
          text: '',
          style: { fontSize: 20, fill: 0x000000, fontFamily: 'Russo One', fontWeight: 'bold' }
        });
        badgeText.anchor.set(0.5);
        badgeText.x = badgeBg.x;
        badgeText.y = badgeBg.y;
        badgeText.eventMode = 'none';

        app.stage.addChild(badgeBg);
        app.stage.addChild(badgeText);
        numberBadges.push({ bg: badgeBg, text: badgeText });

        const thisI = i;
        sp.on('pointerover', () => {
          if (!selectedIndices.includes(thisI)) {
            sp.scale.set(baseScaleVal * 1.1);
            sp.y = sp._targetY + hoverLift;
            _startBob();
            this.ctx.ui.showCardInfo(cards[thisI], pid);
          }
        });
        sp.on('pointerout', () => {
          if (!selectedIndices.includes(thisI)) {
            sp.scale.set(baseScaleVal);
            sp.y = sp._targetY;
            _stopBob();
          }
        });
        sp.on('pointerdown', () => {
          _stopBob();
          const selIdx = selectedIndices.indexOf(thisI);
          if (selIdx !== -1) {
            // Deselect: remove from list, renumber remaining
            selectedIndices.splice(selIdx, 1);
            selectBorders[thisI].alpha = 0;
            flyCards[thisI].flyCard.scale.set(baseScaleVal);
            flyCards[thisI].flyCard.filters = [];
            flyCards[thisI].flyCard.y = flyCards[thisI].flyCard._targetY;
            numberBadges[thisI].bg.alpha = 0;
            numberBadges[thisI].text.text = '';
          } else if (selectedIndices.length < 2) {
            selectedIndices.push(thisI);
            selectBorders[thisI].alpha = 1;
            flyCards[thisI].flyCard.scale.set(baseScaleVal * 1.1);
            flyCards[thisI].flyCard.y = flyCards[thisI].flyCard._targetY + hoverLift;
            const glow = new PIXI.filters.GlowFilter({
              distance: 21,
              outerStrength: 2.2,
              innerStrength: 0.1,
              color: 0x00ff99,
              quality: 0.2
            });
            glow._tickerTime = 0;
            flyCards[thisI].flyCard.filters = [glow];
          }
          // Renumber all selected cards
          for (const ni of selectedIndices) {
            const order = selectedIndices.indexOf(ni) + 1;
            numberBadges[ni].bg.alpha = 1;
            numberBadges[ni].text.text = String(order);
          }
          enableBtn();
        });
      }

      // Position buttons (top/bottom) — also act as confirm once 2 cards selected
      const posY = 530;

      const topDeckButtonBg = new PIXI.Graphics();
      topDeckButtonBg.name = 'topDeckButton';
      topDeckButtonBg.roundRect(0, 0, 140, 40, 8).fill({ color: 0x2196F3 });
      topDeckButtonBg.position.set(430, posY);
      topDeckButtonBg.eventMode = 'none';

      const topDeckButtonText = new PIXI.Text({
        text: 'Top of Deck',
        style: { fontSize: 16, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      topDeckButtonText.name = 'topDeckButtonText';
      topDeckButtonText.anchor.set(0.5);
      topDeckButtonText.position.set(430 + 70, posY + 20);
      topDeckButtonText.eventMode = 'none';

      const bottomDeckButtonBg = new PIXI.Graphics();
      bottomDeckButtonBg.name = 'bottomDeckButton';
      bottomDeckButtonBg.roundRect(0, 0, 140, 40, 8).fill({ color: 0x9C27B0 });
      bottomDeckButtonBg.position.set(630, posY);
      bottomDeckButtonBg.eventMode = 'none';

      const bottomDeckButtonText = new PIXI.Text({
        text: 'Bottom of Deck',
        style: { fontSize: 16, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      bottomDeckButtonText.name = 'bottomDeckButtonText';
      bottomDeckButtonText.anchor.set(0.5);
      bottomDeckButtonText.position.set(630 + 70, posY + 20);
      bottomDeckButtonText.eventMode = 'none';

      const enableBtns = () => {
        const enabled = selectedIndices.length === 2;
        topDeckButtonBg.alpha = enabled ? 1 : 0.35;
        topDeckButtonBg.eventMode = enabled ? 'static' : 'none';
        bottomDeckButtonBg.alpha = enabled ? 1 : 0.35;
        bottomDeckButtonBg.eventMode = enabled ? 'static' : 'none';
      };

      enableBtns();

      const doResolve = (pos) => {
        bobIds.forEach(id => cancelAnimationFrame(id));
        const selectedCards = [];
        for (const idx of selectedIndices) selectedCards.push(cards[idx]);
        this._cleanup(namiPromptText, ...selectBorders, topDeckButtonBg, topDeckButtonText, bottomDeckButtonBg, bottomDeckButtonText);
        for (const nb of numberBadges) {
          if (nb.bg.parent) nb.bg.parent.removeChild(nb.bg);
          if (nb.text.parent) nb.text.parent.removeChild(nb.text);
        }
        resolve({ cards: selectedCards, position: pos });
      };

      topDeckButtonBg.on('pointerdown', () => { if (selectedIndices.length === 2) doResolve('top'); });
      bottomDeckButtonBg.on('pointerdown', () => { if (selectedIndices.length === 2) doResolve('bottom'); });

      // Re-bind enableBtn reference for card selection callback
      const enableBtn = () => { enableBtns(); };

      app.stage.addChild(topDeckButtonBg);
      app.stage.addChild(topDeckButtonText);
      app.stage.addChild(bottomDeckButtonBg);
      app.stage.addChild(bottomDeckButtonText);
    });
  }

  async _animateNamiResult(pid, player, flyCards, cards, selectedCardArr, position, cardW, cardH) {
    if (position === 'top') {
      await this._animateNamiResultTop(pid, player, flyCards, cards, selectedCardArr, cardW, cardH);
    } else {
      await this._animateNamiResultBottom(pid, player, flyCards, cards, selectedCardArr, cardW, cardH);
    }
  }

  async _animateNamiResultTop(pid, player, flyCards, cards, selectedCardArr, cardW, cardH) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!deckZone || !handZone) return;

    const deckCardH = Math.max(deckZone.height - 20, 100);
    const deckCardW = deckCardH * (5 / 7);
    const showCount = Math.min(player.deck.cards.length, 5);
    const topIdx = showCount - 1;
    const topLocalX = (deckZone.width - deckCardW) / 2 + (topIdx - Math.floor(showCount / 2)) * 3 + deckCardW / 2;
    const topLocalY = (deckZone.height - deckCardH) / 2 + (topIdx - Math.floor(showCount / 2)) * 2 + deckCardH / 2;
    const topPosLocal = new PIXI.Point(topLocalX, topLocalY);
    const topPosGlobal = deckZone.toGlobal(topPosLocal);
    const deckTopPos = app.stage.toLocal(topPosGlobal);
    const targetScale = deckCardH / cardH;

    const newLayout = handRenderer.computeLayout(handZone, player.hand.length - selectedCardArr.length);
    for (const fc of flyCards) {
      fc.flyCard.eventMode = 'none';
      fc.flyCard.filters = [];
    }

    const selectedSet = new Set(selectedCardArr);
    const returnTargets = [];
    let layoutIdx = 0;
    for (let i = 0; i < flyCards.length; i++) {
      if (selectedSet.has(flyCards[i].card)) continue;
      if (newLayout && layoutIdx < newLayout.positions.length) {
        const tp = newLayout.positions[layoutIdx];
        const hc = handZone.toGlobal(new PIXI.Point(tp.x + cardW * 0.95 / 2, tp.y + cardH * 0.95 / 2));
        returnTargets.push({ flyCard: flyCards[i].flyCard, toPos: app.stage.toLocal(hc) });
      }
      layoutIdx++;
    }

    const overlay = flyCards[0].flyCard._overlay;
    const duration = 700;

    await Promise.all([
      // Selected cards fly to deck + overlay fade
      new Promise((resolve) => {
        const start = performance.now();
        requestAnimationFrame(function tick(now) {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const e = easeInOut(t);

          if (overlay) overlay.alpha = 0.7 * (1 - e);

          for (const sc of selectedCardArr) {
            const idx = cards.indexOf(sc);
            if (idx < 0) continue;
            const sp = flyCards[idx].flyCard;
            const flipSign = 1 - 2 * e;
            const shrinkScale = sp._targetScale - e * (sp._targetScale - targetScale);
            sp.x = sp._targetX + (deckTopPos.x - sp._targetX) * e;
            sp.y = sp._targetY + (deckTopPos.y - sp._targetY) * e;

            // Use absolute scale after flip completes so the back texture isn't mirrored
            const scaleX = e >= 0.5 ? shrinkScale : flipSign * shrinkScale;
            sp.scale.set(scaleX, shrinkScale);
            sp.alpha = 1;
            if (e > 0.5 && sp.children[0] && sp.children[0].texture) {
              sp.children[0].texture = PIXI.Texture.from('assets/imgs/back.webp');
            }
          }

          if (t >= 1) resolve();
          else requestAnimationFrame(tick);
        });
      }),
      // Non-selected cards return to hand
      new FlyToHandAnimation(narrowContext(this.ctx, FlyToHandAnimation)).animate(pid, returnTargets, { duration }),
    ]);

    if (overlay && overlay.parent) overlay.parent.removeChild(overlay);
    for (const fc of flyCards) {
      if (fc.flyCard.parent) fc.flyCard.parent.removeChild(fc.flyCard);
    }
    for (const sc of selectedCardArr) {
      const idx = player.hand.indexOf(sc);
      if (idx !== -1) player.hand.splice(idx, 1);
    }

    for (const sc of selectedCardArr) player.deck.cards.push(sc);
  }

  async _animateNamiResultBottom(pid, player, flyCards, cards, selectedCardArr, cardW, cardH) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!deckZone || !handZone) return;

    const newLayout = handRenderer.computeLayout(handZone, player.hand.length - selectedCardArr.length);
    for (const fc of flyCards) fc.flyCard.eventMode = 'none';

    const selectedSet = new Set(selectedCardArr);
    const returnTargets = [];
    let layoutIdx = 0;
    for (let i = 0; i < flyCards.length; i++) {
      if (selectedSet.has(flyCards[i].card)) continue;
      if (newLayout && layoutIdx < newLayout.positions.length) {
        const tp = newLayout.positions[layoutIdx];
        const hc = handZone.toGlobal(new PIXI.Point(tp.x + cardW * 0.95 / 2, tp.y + cardH * 0.95 / 2));
        returnTargets.push({ flyCard: flyCards[i].flyCard, toPos: app.stage.toLocal(hc) });
      }
      layoutIdx++;
    }

    const overlay = flyCards[0].flyCard._overlay;
    if (overlay && overlay.parent) overlay.parent.removeChild(overlay);

    // Build card entries with stage-local positions for the bottom-deck animation
    const cardEntries = [];
    for (const sc of selectedCardArr) {
      const idx = flyCards.findIndex(fc => fc.card === sc);
      if (idx < 0) continue;
      const sp = flyCards[idx].flyCard;
      cardEntries.push({
        card: sc,
        stageX: sp._targetX,
        stageY: sp._targetY,
      });
      // Hide original fly cards so only the deck-zone animation is visible
      sp.filters = [];
      sp.alpha = 0;
    }

    // Run bottom-deck animation and hand-return animation in parallel
    const bottomDeckAnim = new FlyToBottomDeckAnimation(narrowContext(this.ctx, FlyToBottomDeckAnimation));
    await Promise.all([
      bottomDeckAnim.animate(pid, cardEntries, { duration: 1200 }),
      new FlyToHandAnimation(narrowContext(this.ctx, FlyToHandAnimation)).animate(pid, returnTargets, { duration: 700 }),
    ]);

    // Cleanup fly cards and update hand state
    if (overlay && overlay.parent) overlay.parent.removeChild(overlay);
    for (const fc of flyCards) {
      const sp = fc.flyCard;
      if (!(sp.name && sp.name.startsWith('bottom-deck-fly-')) && sp.parent) sp.parent.removeChild(sp);
    }
    for (const sc of selectedCardArr) {
      const idx = player.hand.indexOf(sc);
      if (idx !== -1) player.hand.splice(idx, 1);
    }

    for (const sc of selectedCardArr) player.deck.cards.unshift(sc);
  }

  async _animateResult(pid, player, flyCards, cards, selectedCard, cardW, cardH) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const trashZone = zoneManager.getZone(pid, 'trash');
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!trashZone || !handZone) return;

    const trashTopLeft = trashZone.getGlobalPosition();
    const trashCenter = new PIXI.Point(trashTopLeft.x + trashZone.width / 2, trashTopLeft.y + trashZone.height / 2);
    const trashPos = app.stage.toLocal(trashCenter);
    // Match trash card size: zone renders at (zone.height - 20) height
    const trashCardH = trashZone.height - 20;
    const targetScale = trashCardH / cardH;

    const newLayout = handRenderer.computeLayout(handZone, player.hand.length - 1);

    let selectedIdx = -1;
    for (let i = 0; i < cards.length; i++) {
      if (cards[i] === selectedCard) { selectedIdx = i; break; }
    }

    for (const fc of flyCards) {
      fc.flyCard.eventMode = 'none';
      fc.flyCard.filters = [];
    }

    const returnTargets = [];
    let layoutIdx = 0;
    for (let i = 0; i < flyCards.length; i++) {
      if (i === selectedIdx) continue;
      if (newLayout && layoutIdx < newLayout.positions.length) {
        const tp = newLayout.positions[layoutIdx];
        const hc = handZone.toGlobal(new PIXI.Point(tp.x + cardW * 0.95 / 2, tp.y + cardH * 0.95 / 2));
        returnTargets.push({ flyCard: flyCards[i].flyCard, toPos: app.stage.toLocal(hc) });
      }
      layoutIdx++;
    }

    const overlay = flyCards[0].flyCard._overlay;
    const duration = 600;

    await Promise.all([
      // Selected card flies to trash + overlay fade
      new Promise((resolve) => {
        const start = performance.now();
        requestAnimationFrame(function tick(now) {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const e = easeInOut(t);

          if (overlay) overlay.alpha = 0.7 * (1 - e);

          if (selectedIdx >= 0) {
            const sp = flyCards[selectedIdx].flyCard;
            sp.x = sp._targetX + (trashPos.x - sp._targetX) * e;
            sp.y = sp._targetY + (trashPos.y - sp._targetY) * e;
            const curScale = sp._targetScale - e * (sp._targetScale - targetScale);
            sp.scale.set(curScale);
            sp.alpha = 1;
          }

          if (t >= 1) resolve();
          else requestAnimationFrame(tick);
        });
      }),
      // Non-selected cards return to hand
      new FlyToHandAnimation(narrowContext(this.ctx, FlyToHandAnimation)).animate(pid, returnTargets, { duration }),
    ]);

    if (overlay && overlay.parent) overlay.parent.removeChild(overlay);
    for (const fc of flyCards) {
      if (fc.flyCard.parent) fc.flyCard.parent.removeChild(fc.flyCard);
    }
    const idx = player.hand.indexOf(selectedCard);
    if (idx !== -1) player.hand.splice(idx, 1);
    player.trash.push(selectedCard);
  }
}
