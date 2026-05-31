import { gsap } from 'gsap';
import { easeInOut, createFlipCard, getDisplayTexture, makeFlyCard } from './utils';

export default class InitialDrawAnimation {
  static requires = ['players', 'zoneManager', 'handRenderer', 'app', 'zoneRenderer'];

  constructor(ctx) {
    this.ctx = ctx;
  }

   async animateInitialDraw(initialCards) {
    await this._drawCardsForPlayer(1, initialCards[1] || [], true);
    await this._drawCardsForPlayer(2, initialCards[2] || [], false);
  }

  async animateInitialDrawToHand(pid, cards) {
    const { players, zoneManager, handRenderer, app, zoneRenderer } = this.ctx;
    const p = players[pid];

    const handZone = zoneManager.getZone(pid, 'hand');
    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!handZone || !deckZone) {
      for (const card of cards) {
        p.hand.push(card);
      }
      handRenderer.render(pid);
      return;
    }

    const finalCount = p.hand.length + cards.length;
    const layout = handRenderer.computeLayout(handZone, finalCount);
    if (!layout) {
      for (const card of cards) {
        p.hand.push(card);
      }
      handRenderer.render(pid);
      return;
    }

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const deckC = deckZone.toGlobal(new PIXI.Point(deckZone.width / 2, deckZone.height / 2));
    const fromPos = app.stage.toLocal(deckC);
    const backTexture = PIXI.Texture.from('assets/imgs/back.webp');

    const flightDuration = 0.6;
    const fadeInMs = 0.04;
    const delayMs = 0.06;
    const arcHeight = 50;
    const startScale = 0.4;
    const peakScale = 1.1;
    const landScale = 0.95;

    const promises = [];
    for (let cIdx = 0; cIdx < cards.length; cIdx++) {
      const card = cards[cIdx];
      const targetSlot = p.hand.length + cIdx;
      const targetPos = layout.positions[targetSlot] || layout.positions[layout.positions.length - 1];
      const toPos = app.stage.toLocal(
        handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2))
      );

      const flyCard = makeFlyCard(backTexture, card, cardW, cardH);
      flyCard.position.set(fromPos.x, fromPos.y);
      flyCard.pivot.set(cardW / 2, cardH / 2);
      flyCard.scale.set(startScale, startScale);
      flyCard.alpha = 0;
      app.stage.addChild(flyCard);

      promises.push(new Promise((resolve) => {
        const tl = gsap.timeline({
          delay: cIdx * delayMs,
          onComplete: () => {
            if (flyCard.parent) app.stage.removeChild(flyCard);
            p.hand.push(card);
            handRenderer.addSpriteAt(pid, targetSlot, card, layout);
            resolve();
          },
        });

        // Fade in
        tl.to(flyCard, { alpha: 1, duration: fadeInMs, ease: 'none' });

        // Fly to hand with arc and scale interpolation
        const proxy = { t: 0 };
        tl.to(proxy, {
          t: 1,
          duration: flightDuration - fadeInMs,
          ease: 'sine.inOut',
          onUpdate: () => {
            const rawT = proxy.t;
            const et = rawT;

            flyCard.x = fromPos.x + (toPos.x - fromPos.x) * et;
            flyCard.y = fromPos.y + (toPos.y - fromPos.y) * et
                          - 4 * arcHeight * rawT * (1 - rawT);

            let s;
            if (rawT <= 0.5) {
              const ht = rawT / 0.5;
              s = startScale + (peakScale - startScale) * ht;
            } else {
              const ht = (rawT - 0.5) / 0.5;
              s = peakScale + (landScale - peakScale) * ht;
            }
            flyCard.scale.set(s, s);
            flyCard.alpha = 1;
          },
        });
      }));
    }
    await Promise.all(promises);
  }

   async _drawCardsForPlayer(pid, cards, shouldFlip) {
    const { players, zoneManager, handRenderer } = this.ctx;
    const p = players[pid];
    for (const card of cards) {
      p.hand.splice(Math.floor(p.hand.length / 2), 0, card);
    }

    const handZone = zoneManager.getZone(pid, 'hand');
    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!handZone || !deckZone) {
      handRenderer.render(pid);
      return;
    }

    const layout = handRenderer.computeLayout(handZone, p.hand.length);
    if (!layout) {
      handRenderer.render(pid);
      return;
    }

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const centerSpacing = cardW * 1.5 + 5;
    const centerC = new PIXI.Point(600, 400);
    const centerPos = this.ctx.app.stage.toLocal(centerC);
    const deckC = deckZone.toGlobal(new PIXI.Point(deckZone.width / 2, deckZone.height / 2));
    const fromPos = this.ctx.app.stage.toLocal(deckC);

    const slotOrder = Array.from({ length: layout.positions.length }, (_, i) => i)
      .sort(() => Math.random() - 0.5);

    const promises = cards.map((card, i) => this._animateSingleCardFly(pid, card, i, cards, layout, centerPos, centerSpacing, fromPos, handZone, cardW, cardH, shouldFlip, slotOrder));
    await Promise.all(promises);

    const newHand = new Array(p.hand.length);
    for (let i = 0; i < cards.length; i++) {
      newHand[slotOrder[i]] = cards[i];
    }
    p.hand.length = 0;
    p.hand.push(...newHand);

    handRenderer.render(pid);
  }

  // --- Mulligan: fly from deck to center, stop there, return sprite positions ---

  async animateToCenterForMulligan(pid, cards) {
    const { zoneManager, app } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!deckZone) return;

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const centerSpacing = cardW * 1.5 + 5;
    const centerC = new PIXI.Point(600, 400);
    const centerPos = app.stage.toLocal(centerC);
    const deckC = deckZone.toGlobal(new PIXI.Point(deckZone.width / 2, deckZone.height / 2));
    const fromPos = app.stage.toLocal(deckC);

    this._mulliganSprites = [];

    const promises = cards.map((card, i) => {
      const offset = i - (cards.length - 1) / 2;
      const targetX = centerPos.x + offset * centerSpacing;
      const targetY = centerPos.y;
      return this._animateFlyToCenter(pid, card, fromPos, targetX, targetY, cardW, cardH);
    });

    await Promise.all(promises);
  }

  _animateFlyToCenter(pid, card, fromPos, targetX, targetY, cardW, cardH) {
    const { app } = this.ctx;

    const flyCard = createFlipCard(getDisplayTexture(pid, card), card, cardW, cardH);
    flyCard.position.set(fromPos.x, fromPos.y);
    app.stage.addChild(flyCard);

    this._mulliganSprites.push({ flyCard, card });

    return new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: 0.6,
        ease: 'sine.inOut',
        onUpdate: function () {
          const eased = proxy.t;

          const flipSign = 2 * eased - 1;
          const growthScale = 1 + eased * 0.5;

          if (eased < 0.5) flyCard.showBack();
          else flyCard.showFront();

          flyCard.scale.set(Math.abs(flipSign) * growthScale, growthScale);
          flyCard.x = fromPos.x + (targetX - fromPos.x) * eased;
          flyCard.y = fromPos.y + (targetY - fromPos.y) * eased;
        },
        onComplete: () => {
          flyCard.scale.set(1.5, 1.5);
          resolve();
        },
      });
    });
  }

  // --- Animate sprites from center to hand slots ---

  async flyFromCenterToHand(pid) {
    const { players, zoneManager, handRenderer, app } = this.ctx;
    const p = players[pid];
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!handZone || !this._mulliganSprites || this._mulliganSprites.length === 0) return;

    const layout = handRenderer.computeLayout(handZone, p.hand.length);
    if (!layout) return;

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;

    const sprites = this._mulliganSprites;

    const slotOrder = Array.from({ length: layout.positions.length }, (_, i) => i)
      .sort(() => Math.random() - 0.5);

    const promises = sprites.map(({ flyCard, card }, spriteIdx) => {
      return new Promise((resolve) => {
        const handIdx = slotOrder[spriteIdx] ?? layout.positions.length - 1;
        const targetPos = layout.positions[handIdx] || layout.positions[layout.positions.length - 1];

        const toPos = app.stage.toLocal(
          handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2))
        );

        const fromX = flyCard.x;
        const fromY = flyCard.y;

        const proxy = { t: 0 };
        gsap.to(proxy, {
          t: 1,
          duration: 0.5,
          ease: 'sine.inOut',
          onUpdate: function () {
            const eased = proxy.t;
            flyCard.x = fromX + (toPos.x - fromX) * eased;
            flyCard.y = fromY + (toPos.y - fromY) * eased;
            flyCard.scale.set(1.5 - eased * 0.55, 1.5 - eased * 0.55);
          },
          onComplete: () => {
            flyCard.scale.set(0.95, 0.95);
            resolve();
          },
        });
      });
    });

    await Promise.all(promises);

    const newHand = new Array(p.hand.length);
    sprites.forEach(({ card }, spriteIdx) => {
      newHand[slotOrder[spriteIdx]] = card;
    });
    p.hand.length = 0;
    p.hand.push(...newHand);

    // Remove fly-cards from stage
    for (const { flyCard } of sprites) {
      if (flyCard.parent) {
        app.stage.removeChild(flyCard);
      }
    }
    this._mulliganSprites = [];

    handRenderer.render(pid);
  }

  // --- AI Mulligan: hand cards fly to deck, shuffle, draw 5 new face-down ---

  async animateAIMulligan(pid, shuffleAnim) {
    const { players, zoneManager, handRenderer, app, zoneRenderer } = this.ctx;
    const p = players[pid];
    const handZone = zoneManager.getZone(pid, 'hand');
    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!handZone || !deckZone) return;

    const handCards = [...p.hand];
    if (handCards.length === 0) return;

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
    const deckCenter = deckZone.toGlobal(new PIXI.Point(deckZone.width / 2, deckZone.height / 2));
    const toPos = app.stage.toLocal(deckCenter);

    // Compute layout BEFORE clearing hand, so we know card positions
    const layout = handRenderer.computeLayout(handZone, handCards.length);
    if (!layout) return;

    // Clear hand data and sprites immediately so old sprites disappear
    handCards.forEach(c => p.deck.cards.push(c));
    p.hand.length = 0;
    handRenderer.render(pid);

    // Phase 1: Each card flies from right to left into deck (face-down)
    const flyPromises = handCards.map((card, i) => {
      return new Promise((resolve) => {
        const targetPos = layout.positions[i] || layout.positions[layout.positions.length - 1];
        const fromPos = app.stage.toLocal(
          handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2))
        );

        const flyCard = makeFlyCard(backTexture, card, cardW, cardH);
        flyCard.position.set(fromPos.x, fromPos.y);
        flyCard.scale.set(0.95, 0.95);
        flyCard.alpha = 1;
        app.stage.addChild(flyCard);

        const arcHeight = 50;

        const proxy = { t: 0 };
        gsap.to(proxy, {
          t: 1,
          duration: 0.5,
          delay: (handCards.length - 1 - i) * 0.08,
          ease: 'sine.inOut',
          onUpdate: function () {
            const eased = proxy.t;
            const t = eased;

            flyCard.x = fromPos.x + (toPos.x - fromPos.x) * eased;
            flyCard.y = fromPos.y + (toPos.y - fromPos.y) * eased
                          - 4 * arcHeight * t * (1 - t);
            flyCard.alpha = 1 - eased * 0.3;
            const s = 0.95 - eased * 0.3;
            flyCard.scale.set(s, s);
          },
          onComplete: () => {
            if (flyCard.parent) app.stage.removeChild(flyCard);
            resolve();
          },
        });
      });
    });

    await Promise.all(flyPromises);

    // Phase 2: Shuffle animation
    if (shuffleAnim) {
      await shuffleAnim.animateShuffle(pid);
    }

    // Phase 3: Draw 5 new cards face-down
    const newCards = [];
    for (let i = 0; i < 5 && p.deck.cards.length > 0; i++) {
      const card = p.deck.draw();
      if (card) newCards.push(card);
    }
    await this.animateInitialDrawToHand(pid, newCards);
  }

  // --- Animate sprites from center back to deck (for mulligan redraw) ---

  async flyFromCenterToDeck(pid) {
    const { zoneManager, app } = this.ctx;
    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!deckZone) return;

    const deckCenter = deckZone.toGlobal(new PIXI.Point(deckZone.width / 2, deckZone.height / 2));
    const toPos = app.stage.toLocal(deckCenter);

    if (!this._mulliganSprites || this._mulliganSprites.length === 0) return;

    const sprites = this._mulliganSprites;

    const promises = sprites.map(({ flyCard }, idx) => {
      return new Promise((resolve) => {
        const fromX = flyCard.x;
        const fromY = flyCard.y;
        const arcHeight = 50;

        const proxy = { t: 0 };
        gsap.to(proxy, {
          t: 1,
          duration: 0.6,
          delay: idx * 0.06,
          ease: 'sine.inOut',
          onUpdate: function () {
            const eased = proxy.t;
            const t = eased;

            flyCard.x = fromX + (toPos.x - fromX) * eased;
            flyCard.y = fromY + (toPos.y - fromY) * eased
                          - 4 * arcHeight * t * (1 - t);

            // Flip from face-up to face-down
            const flipSign = 1 - 2 * t;
            const shrinkScale = 1.5 - eased * 0.55;
            flyCard.scale.set(flipSign * shrinkScale, shrinkScale);

            if (t < 0.5) flyCard.showFront();
            else flyCard.showBack();

            flyCard.alpha = 1;
          },
          onComplete: () => {
            if (flyCard.parent) {
              app.stage.removeChild(flyCard);
            }
            resolve();
          },
        });
      });
    });

    await Promise.all(promises);
    this._mulliganSprites = [];
  }

    _animateSingleCardFly(pid, card, i, cards, layout, centerPos, centerSpacing, fromPos, handZone, cardW, cardH, shouldFlip, slotOrder) {
    const { app } = this.ctx;
    const handIdx = slotOrder ? slotOrder[i] : i;
    const targetPos = layout.positions[handIdx] || layout.positions[layout.positions.length - 1];

    const offset = i - (cards.length - 1) / 2;
    const centerX = centerPos.x + offset * centerSpacing;

    const toPos = app.stage.toLocal(
      handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2))
    );

    const flyCard = shouldFlip
      ? createFlipCard(getDisplayTexture(pid, card), card, cardW, cardH)
      : makeFlyCard(getDisplayTexture(pid, card) || PIXI.Texture.from('assets/imgs/back.webp'), card, cardW, cardH);
    flyCard.position.set(fromPos.x, fromPos.y);
    app.stage.addChild(flyCard);

    const phase1 = 0.45, phase2 = 0.2, phase3 = 0.5;

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          app.stage.removeChild(flyCard);
          resolve();
        },
      });

      // Phase 1: Fly from deck up to the center, flipping from back to front if shouldFlip
      const proxy1 = { t: 0 };
      tl.to(proxy1, {
        t: 1,
        duration: phase1,
        ease: 'sine.inOut',
        onUpdate: () => {
          const moveEase = proxy1.t;

          if (shouldFlip) {
            const flipSign = 2 * moveEase - 1;
            const growthScale = 1 + moveEase * 0.5;

            if (proxy1.t < 0.5) flyCard.showBack();
            else flyCard.showFront();

            flyCard.scale.set(Math.abs(flipSign) * growthScale, growthScale);
          } else {
            flyCard.scale.set(1 + moveEase * 0.5, 1 + moveEase * 0.5);
          }

          flyCard.x = fromPos.x + (centerX - fromPos.x) * moveEase;
          flyCard.y = fromPos.y + (centerPos.y - fromPos.y) * moveEase;
        },
      });

      // Phase 2: Hold face-up at center at 1.5x scale (dramatic pause)
      tl.to({}, { duration: phase2, onUpdate: () => {
        flyCard.x = centerX;
        flyCard.y = centerPos.y;
        flyCard.scale.set(1.5, 1.5);
      }});

      // Phase 3: Fly from center down to the hand slot, scaling back to 1.0
      const proxy3 = { t: 0 };
      tl.to(proxy3, {
        t: 1,
        duration: phase3,
        ease: 'sine.inOut',
        onUpdate: () => {
          const ease = proxy3.t;
          flyCard.x = centerX + (toPos.x - centerX) * ease;
          flyCard.y = centerPos.y + (toPos.y - centerPos.y) * ease;
          flyCard.scale.set(1.5 - ease * 0.5, 1.5 - ease * 0.5);
        },
      });
    });
  }
}
