import { easeInOut, createFlipCard, getDisplayTexture, makeFlyCard, delay } from './utils';

export default class MultipleDrawAnimation {
  static requires = ['app', 'zoneManager', 'handRenderer', 'ui'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Draw a single card with flip animation (used during Draw Phase).
   * For P1: card flips face-up. For P2: card stays face-down.
   *
   * @param {number} pid - Player ID
   * @param {object} player - Player object
   * @param {object} card - Card to draw
   * @param {number} handIdx - Target index in hand (optional, defaults to middle)
   * @returns {Promise<void>}
   */
  async drawOne(pid, player, card, handIdx) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!deckZone || !handZone) return;

    const shouldFlip = pid === 1;

    // Insert card at hand index
    const insertIdx = handIdx !== undefined ? handIdx : Math.floor(player.hand.length / 2);
    player.hand.splice(insertIdx, 0, card);

    const cardW = 100, cardH = 140;
    const layout = handRenderer.computeLayout(handZone, player.hand.length);
    if (!layout) return;

    const targetPos = layout.positions[insertIdx] || layout.positions[layout.positions.length - 1];
    const handC = handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2 * 0.95, targetPos.y + cardH / 2 * 0.95));
    const toPos = app.stage.toLocal(handC);

    // Get old sprite positions
    const oldSprites = handRenderer.handSprites[pid] || [];
    const oldPositions = oldSprites.map(s => s ? { x: s.position.x, y: s.position.y } : null);

    // Compute new positions for existing sprites
    const spriteTargets = [];
    for (let i = 0; i < oldSprites.length; i++) {
      const newIdx = i < insertIdx ? i : i + 1;
      const newPos = layout.positions[newIdx] || layout.positions[layout.positions.length - 1];
      spriteTargets.push({
        sprite: oldSprites[i],
        from: oldPositions[i] || newPos,
        to: newPos
      });
    }

    const deckTopLeft = deckZone.getGlobalPosition();
    const deckC = new PIXI.Point(deckTopLeft.x + deckZone.width / 2, deckTopLeft.y + deckZone.height / 2);
    const centerC = new PIXI.Point(app.screen.width / 2, app.screen.height / 2);
    const fromPos = app.stage.toLocal(deckC);
    const centerPos = app.stage.toLocal(centerC);

    // Create fly card
    const flyCard = shouldFlip
      ? createFlipCard(getDisplayTexture(pid, card), card, cardW, cardH)
      : makeFlyCard(getDisplayTexture(pid, card) || PIXI.Texture.from('assets/imgs/back.webp'), card, cardW, cardH);
    flyCard.position.copyFrom(fromPos);
    app.stage.addChild(flyCard);

    // Animate
    const s1 = 450, hold = 300, s2 = 250, total = s1 + hold + s2;
    const start = performance.now();

    return new Promise((resolve) => {
      requestAnimationFrame(function tick(now) {
        const elapsed = now - start;

        if (elapsed < s1) {
          // Phase 1: Fly from deck to center with flip
          const progress = elapsed / s1;
          const e = easeInOut(progress);
          const flipSign = shouldFlip ? (2 * e - 1) : 1;
          const growthScale = 1 + e * 0.5;

          if (shouldFlip) {
            if (progress < 0.5) flyCard.showBack();
            else flyCard.showFront();
          }

          flyCard.x = fromPos.x + (centerPos.x - fromPos.x) * e;
          flyCard.y = fromPos.y + (centerPos.y - fromPos.y) * e;
          flyCard.scale.set(Math.abs(flipSign) * growthScale, growthScale);
          requestAnimationFrame(tick);
        } else if (elapsed < s1 + hold) {
          // Phase 2: Hold at center
          flyCard.x = centerPos.x;
          flyCard.y = centerPos.y;
          flyCard.scale.set(1.5, 1.5);
          requestAnimationFrame(tick);
        } else if (elapsed < total) {
          // Phase 3: Fly to hand + shift existing sprites
          const t = (elapsed - s1 - hold) / s2;
          const e = easeInOut(t);

          flyCard.x = centerPos.x + (toPos.x - centerPos.x) * e;
          flyCard.y = centerPos.y + (toPos.y - centerPos.y) * e;
          flyCard.scale.set(1.5 - e * 0.5, 1.5 - e * 0.5);

          for (const st of spriteTargets) {
            if (!st.sprite || !st.sprite.parent) continue;
            st.sprite.position.x = st.from.x + (st.to.x - st.from.x) * e;
            st.sprite.position.y = st.from.y + (st.to.y - st.from.y) * e;
          }

          requestAnimationFrame(tick);
        } else {
          // Done
          if (flyCard.parent) flyCard.parent.removeChild(flyCard);
          handRenderer.render(pid);
          resolve();
        }
      });
    });
  }

  /**
   * Draw X new cards with flip animation:
   * 1. Cards fly from deck to center side-by-side with flip
   * 2. Cards fly from center to hand at random positions
   * 3. Existing hand cards shift to new positions
   *
   * @param {number} pid - Player ID
   * @param {object} player - Player object
   * @param {number} count - Number of cards to draw
   * @param {boolean} shouldFlip - Whether cards flip face-up
   * @returns {Promise<Array>} - Array of drawn cards
   */
  async drawCards(pid, player, count, shouldFlip, speedMultiplier = 1.2) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!deckZone || !handZone) return [];

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const centerSpacing = cardW * 1.5 + 5;
    const centerC = new PIXI.Point(app.screen.width / 2, app.screen.height / 2);
    const centerPos = app.stage.toLocal(centerC);
    const deckTopLeft = deckZone.getGlobalPosition();
    const deckC = new PIXI.Point(deckTopLeft.x + deckZone.width / 2, deckTopLeft.y + deckZone.height / 2);
    const fromPos = app.stage.toLocal(deckC);

    // Draw cards at random positions
    const drawnCards = [];
    for (let i = 0; i < count && player.deck.cards.length > 0; i++) {
      const card = player.deck.draw();
      if (card) {
        const insertIdx = Math.floor(Math.random() * (player.hand.length + 1));
        player.hand.splice(insertIdx, 0, card);
        drawnCards.push(card);
      }
    }
    if (drawnCards.length === 0) return [];

    const newLayout = handRenderer.computeLayout(handZone, player.hand.length);
    if (!newLayout) return drawnCards;

    // Get old sprite positions
    const oldSprites = handRenderer.handSprites[pid] || [];
    const oldPositions = oldSprites.map(s => s ? { x: s.position.x, y: s.position.y } : null);

    // Phase 1: Fly from deck to center with flip
    const sprites = [];
    await Promise.all(drawnCards.map((card, i) => {
      const offset = i - (drawnCards.length - 1) / 2;
      const targetX = centerPos.x + offset * centerSpacing;
      const targetY = centerPos.y;
      return this._flyToCenter(pid, card, shouldFlip, fromPos, targetX, targetY, cardW, cardH, speedMultiplier).then(fc => {
        sprites.push({ flyCard: fc, card });
      });
    }));

    // Phase 2: Hold at center
    await delay(300 / speedMultiplier);

    // Phase 3: Fly from center to hand + shift existing sprites
    await this._flyDrawnCardsToHand(pid, player, sprites, newLayout, cardW, cardH, oldSprites, oldPositions, centerPos, speedMultiplier);

    return drawnCards;
  }

  async _flyDrawnCardsToHand(pid, player, sprites, layout, cardW, cardH, oldSprites, oldPositions, centerPos, speedMultiplier = 1.2) {
    const { app, handRenderer } = this.ctx;
    const handZone = this.ctx.zoneManager.getZone(pid, 'hand');

    // Build targets for drawn cards, sorted by final index for correct iteration
    const drawnTargets = [];
    for (const sp of sprites) {
      const finalIdx = player.hand.indexOf(sp.card);
      const targetPos = layout.positions[finalIdx];
      const handC = handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2));
      const toPos = app.stage.toLocal(handC);
      drawnTargets.push({ flyCard: sp.flyCard, toPos, finalIdx, _fromX: sp.flyCard.x, _fromY: sp.flyCard.y });
    }
    drawnTargets.sort((a, b) => a.finalIdx - b.finalIdx);

    // Build targets for existing sprites
    const oldSpriteTargets = [];
    let newSpriteIdx = 0;
    let drawnIdx = 0;
    for (let i = 0; i < player.hand.length; i++) {
      if (drawnIdx < drawnTargets.length && drawnTargets[drawnIdx].finalIdx === i) {
        drawnIdx++;
      } else {
        if (newSpriteIdx < oldSprites.length && oldSprites[newSpriteIdx]) {
          const targetPos = layout.positions[i];
          oldSpriteTargets.push({
            sprite: oldSprites[newSpriteIdx],
            from: oldPositions[newSpriteIdx] || targetPos,
            to: targetPos
          });
        }
        newSpriteIdx++;
      }
    }

    // Animate
    const duration = 500 / speedMultiplier;
    const start = performance.now();

    await new Promise((resolve) => {
      requestAnimationFrame(function tick(now) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const eased = easeInOut(t);

        for (const dt of drawnTargets) {
          dt.flyCard.x = dt._fromX + (dt.toPos.x - dt._fromX) * eased;
          dt.flyCard.y = dt._fromY + (dt.toPos.y - dt._fromY) * eased;
          dt.flyCard.scale.set(1.5 - eased * 0.55, 1.5 - eased * 0.55);
        }

        for (const st of oldSpriteTargets) {
          st.sprite.position.x = st.from.x + (st.to.x - st.from.x) * eased;
          st.sprite.position.y = st.from.y + (st.to.y - st.from.y) * eased;
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          for (const dt of drawnTargets) {
            if (dt.flyCard.parent) dt.flyCard.parent.removeChild(dt.flyCard);
          }
          handRenderer.render(pid);
          resolve();
        }
      });
    });
  }

  /**
   * Full mulligan flow:
   * 1. Cards fly from deck to center with flip
   * 2. Player decides keep/mulligan
   * 3. If keep: cards fly from center to hand
   * 4. If mulligan: cards flip back and fly to deck, then new cards drawn
   *
   * @param {number} pid - Player ID
   * @param {object} player - Player object
   * @param {boolean} shouldFlip - Whether cards flip face-up at center
   * @returns {Promise<boolean>} - true if kept, false if mulligan
   */
  async animateMulligan(pid, player, shouldFlip) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!deckZone || !handZone) return true;

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const centerSpacing = cardW * 1.5 + 5;
    const centerC = new PIXI.Point(app.screen.width / 2, app.screen.height / 2);
    const centerPos = app.stage.toLocal(centerC);
    const deckTopLeft = deckZone.getGlobalPosition();
    const deckC = new PIXI.Point(deckTopLeft.x + deckZone.width / 2, deckTopLeft.y + deckZone.height / 2);
    const fromPos = app.stage.toLocal(deckC);

    const layout = handRenderer.computeLayout(handZone, player.hand.length);
    if (!layout) return true;

    const slotOrder = Array.from({ length: player.hand.length }, (_, i) => i)
      .sort(() => Math.random() - 0.5);

    // Phase 1: Fly from deck to center with flip
    const sprites = [];
    await Promise.all(player.hand.map((card, i) => {
      const offset = i - (player.hand.length - 1) / 2;
      const targetX = centerPos.x + offset * centerSpacing;
      const targetY = centerPos.y;
      return this._flyToCenter(pid, card, shouldFlip, fromPos, targetX, targetY, cardW, cardH).then(fc => {
        sprites.push({ flyCard: fc, card });
      });
    }));

    // Phase 2: Show mulligan overlay
    const kept = await this._showMulliganOverlay(pid, player);

    if (kept) {
      // Phase 3: Fly from center to hand
      await this._flyToHand(pid, player, sprites, layout, slotOrder, centerPos, cardW, cardH);
      return true;
    } else {
      // Phase 4: Fly back to deck with flip
      await this._flyToDeck(pid, sprites, fromPos, cardW, cardH);
      return false;
    }
  }

  _flyToCenter(pid, card, shouldFlip, fromPos, targetX, targetY, cardW, cardH, speedMultiplier = 1.2) {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      const flyCard = shouldFlip
        ? createFlipCard(getDisplayTexture(pid, card), card, cardW, cardH)
        : makeFlyCard(getDisplayTexture(pid, card) || PIXI.Texture.from('assets/imgs/back.webp'), card, cardW, cardH);
      flyCard.position.set(fromPos.x, fromPos.y);
      flyCard._card = card;
      app.stage.addChild(flyCard);

       const duration = 600 / speedMultiplier;
       const start = performance.now();

       const tick = (now) => {
         const elapsed = now - start;
         const t = Math.min(elapsed / duration, 1);
         const eased = easeInOut(t);

         if (shouldFlip) {
           const flipSign = 2 * eased - 1;
          const growthScale = 1 + eased * 0.5;
          if (t < 0.5) flyCard.showBack();
          else flyCard.showFront();
           flyCard.scale.set(Math.abs(flipSign) * growthScale, growthScale);
          } else {
            flyCard.scale.set(1 + eased * 0.5, 1 + eased * 0.5);
          }

          flyCard.x = fromPos.x + (targetX - fromPos.x) * eased;
        flyCard.y = fromPos.y + (targetY - fromPos.y) * eased;

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          flyCard.scale.set(1.5, 1.5);
          resolve(flyCard);
        }
      };

      requestAnimationFrame(tick);
    });
  }

  _showMulliganOverlay(pid, player) {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      // Dark overlay
      const mulliganOverlay = new PIXI.Graphics();
      mulliganOverlay.name = 'mulligan-overlay';
      mulliganOverlay.rect(0, 0, app.screen.width, app.screen.height)
             .fill({ color: 0x000000, alpha: 1 });
      mulliganOverlay.eventMode = 'none';
      app.stage.addChild(mulliganOverlay);
      // Reparent below fly cards so they're visible above overlay
      const flyIdx = app.stage.children.findIndex(c => c._frontSprite);
      if (flyIdx > 0) {
        app.stage.removeChild(mulliganOverlay);
        app.stage.addChildAt(mulliganOverlay, flyIdx);
      }
      mulliganOverlay.alpha = 0.7;

      const mulliganPrompt = new PIXI.Text({
        text: 'Keep your hand or mulligan?',
        style: { fontSize: 28, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      mulliganPrompt.name = 'mulliganPrompt';
      mulliganPrompt.anchor.set(0.5, 0);
      mulliganPrompt.position.set(600, 180);
      mulliganPrompt.alpha = 0;
      mulliganPrompt.eventMode = 'none';
      app.stage.addChild(mulliganPrompt);

      // Buttons
      const btnW = 180, btnH = 48;
      const totalW = btnW * 2 + 20;
      const startX = 600 - totalW / 2;
      const btnY = 590;

      // Keep button
      const keepButtonBg = new PIXI.Graphics();
      keepButtonBg.name = 'keepButton';
      keepButtonBg.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0x4CAF50, alpha: 0.85 });
      keepButtonBg.position.set(startX, btnY);
      keepButtonBg.eventMode = 'static';
      keepButtonBg.cursor = 'pointer';
      keepButtonBg.alpha = 0;

      const keepButtonText = new PIXI.Text({
        text: 'Keep Hand',
        style: { fontSize: 18, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      keepButtonText.name = 'keepButtonText';
      keepButtonText.anchor.set(0.5);
      keepButtonText.position.set(startX + btnW / 2, btnY + btnH / 2);
      keepButtonText.eventMode = 'none';
      keepButtonText.alpha = 0;

      // Mulligan button
      const mulliganButtonBg = new PIXI.Graphics();
      mulliganButtonBg.name = 'mulliganButton';
      mulliganButtonBg.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0xff9800, alpha: 0.85 });
      mulliganButtonBg.position.set(startX + btnW + 20, btnY);
      mulliganButtonBg.eventMode = 'static';
      mulliganButtonBg.cursor = 'pointer';
      mulliganButtonBg.alpha = 0;

      const mulliganButtonText = new PIXI.Text({
        text: 'Mulligan',
        style: { fontSize: 18, fill: 0xffffff, fontFamily: 'Russo One' }
      });
      mulliganButtonText.name = 'mulliganButtonText';
      mulliganButtonText.anchor.set(0.5);
      mulliganButtonText.position.set(startX + btnW + 20 + btnW / 2, btnY + btnH / 2);
      mulliganButtonText.eventMode = 'none';
      mulliganButtonText.alpha = 0;

      const setupUI = () => {
        app.stage.addChild(keepButtonBg);
        app.stage.addChild(keepButtonText);
        app.stage.addChild(mulliganButtonBg);
        app.stage.addChild(mulliganButtonText);
        mulliganPrompt.alpha = 1;
        keepButtonBg.alpha = 1;
        keepButtonText.alpha = 1;
        mulliganButtonBg.alpha = 1;
        mulliganButtonText.alpha = 1;

        // Hover handlers: show card info on fly cards
        for (const child of app.stage.children) {
          if (!child._card || !child._frontSprite) continue;
          child.eventMode = 'static';
          child.cursor = 'pointer';
          const c = child._card;
          child.on('pointerover', () => {
            this.ctx.ui.showCardInfo(c, pid);
          });
          child.on('pointerout', () => {
            const panel = document.getElementById('card-info-panel');
            if (panel) panel.innerHTML = '';
          });
        }
      };
      setupUI();

      const cleanup = () => {
        const panel = document.getElementById('card-info-panel');
        if (panel) panel.innerHTML = '';
        if (mulliganOverlay.parent) mulliganOverlay.parent.removeChild(mulliganOverlay);
        if (mulliganPrompt.parent) mulliganPrompt.parent.removeChild(mulliganPrompt);
        if (keepButtonBg.parent) keepButtonBg.parent.removeChild(keepButtonBg);
        if (keepButtonText.parent) keepButtonText.parent.removeChild(keepButtonText);
        if (mulliganButtonBg.parent) mulliganButtonBg.parent.removeChild(mulliganButtonBg);
        if (mulliganButtonText.parent) mulliganButtonText.parent.removeChild(mulliganButtonText);
      };

      keepButtonBg.on('pointerdown', () => { cleanup(); resolve(true); });
      mulliganButtonBg.on('pointerdown', () => { cleanup(); resolve(false); });
    });
  }

  async _flyToHand(pid, player, sprites, layout, slotOrder, centerPos, cardW, cardH) {
    const { app, handRenderer } = this.ctx;
    const handZone = this.ctx.zoneManager.getZone(pid, 'hand');

    const promises = sprites.map(({ flyCard, card }, spriteIdx) => {
      return new Promise((resolve) => {
        const handIdx = slotOrder[spriteIdx] ?? layout.positions.length - 1;
        const targetPos = layout.positions[handIdx] || layout.positions[layout.positions.length - 1];
        const toPos = app.stage.toLocal(
          handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2))
        );

        const fromX = flyCard.x;
        const fromY = flyCard.y;
        const duration = 500;
        const start = performance.now();

        const tick = (now) => {
          const elapsed = now - start;
          const t = Math.min(elapsed / duration, 1);
          const eased = easeInOut(t);

          flyCard.x = fromX + (toPos.x - fromX) * eased;
          flyCard.y = fromY + (toPos.y - fromY) * eased;
          flyCard.scale.set(1.5 - eased * 0.55, 1.5 - eased * 0.55);

          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            flyCard.scale.set(0.95, 0.95);
            resolve();
          }
        };

        requestAnimationFrame(tick);
      });
    });

    await Promise.all(promises);

    // Reorder hand according to slot order
    const newHand = new Array(player.hand.length);
    sprites.forEach(({ card }, spriteIdx) => {
      newHand[slotOrder[spriteIdx]] = card;
    });
    player.hand.length = 0;
    player.hand.push(...newHand);

    // Cleanup fly cards
    for (const { flyCard } of sprites) {
      if (flyCard.parent) flyCard.parent.removeChild(flyCard);
    }

    handRenderer.render(pid);
  }

  async _flyToDeck(pid, sprites, fromPos, cardW, cardH) {
    const { app, zoneManager } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    const deckTopLeft = deckZone.getGlobalPosition();
    const deckCenter = new PIXI.Point(deckTopLeft.x + deckZone.width / 2, deckTopLeft.y + deckZone.height / 2);
    const toPos = app.stage.toLocal(deckCenter);

    const promises = sprites.map(({ flyCard }, idx) => {
      return new Promise((resolve) => {
        const fromX = flyCard.x;
        const fromY = flyCard.y;
        const duration = 600;
        const delay = idx * 60;
        const start = performance.now();

        const arcHeight = 50;
        const tick = (now) => {
          const elapsed = now - start - delay;
          if (elapsed < 0) {
            requestAnimationFrame(tick);
            return;
          }
          const t = Math.min(elapsed / duration, 1);
          const eased = easeInOut(t);

          flyCard.x = fromX + (toPos.x - fromX) * eased;
          flyCard.y = fromY + (toPos.y - fromY) * eased
                        - 4 * arcHeight * t * (1 - t);

          const flipSign = 1 - 2 * t;
          const shrinkScale = 1.5 - eased * 0.55;
          flyCard.scale.set(flipSign * shrinkScale, shrinkScale);

          if (t < 0.5) flyCard.showFront();
          else flyCard.showBack();

          flyCard.alpha = 1;

          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            if (flyCard.parent) flyCard.parent.removeChild(flyCard);
            resolve();
          }
        };

        requestAnimationFrame(tick);
      });
    });

    await Promise.all(promises);
  }
}
