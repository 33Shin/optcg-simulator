import { easeInOut, easeOutCubic, makeFlyCard, getDisplayTexture } from './utils';

export default class FlyToBottomDeckAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate cards flying to the bottom of the deck.
   * Deck lifts up, cards slide in and flip face-down, then deck drops.
   *
   * @param {number} pid - Player ID
   * @param {Array<{card: object, stageX: number, stageY: number}>} cardEntries - Cards with their stage-local positions
   * @param {object} [options] - Optional settings
   * @param {number} [options.duration] - Animation duration in ms (default 1300)
   * @returns {Promise<void>}
   */
  async animate(pid, cardEntries, options = {}) {
    const { app, zoneManager } = this.ctx;

    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!deckZone) return Promise.resolve();

    const duration = options.duration || 1300;
    const cardW = 100, cardH = 140;
    const deckCardH = Math.max(deckZone.height - 20, 100);
    const targetScale = deckCardH / cardH;

    // Capture deck center BEFORE adding fly cards (bounds change with children)
    const deckCenterX = deckZone.width / 2;
    const deckCenterY = deckZone.height / 2;

    // Grab existing deck sprites for lift animation
    const deckSprites = deckZone.children.filter(c => c.isCardBack);
    const deckOrigPositions = deckSprites.map(s => ({ x: s.x, y: s.y }));
    const liftAmount = 40;

    // Convert stage-local positions to deck zone local and create fly cards
    const insertBeforeIdx = deckSprites.length ? deckZone.children.indexOf(deckSprites[0]) : deckZone.children.length;

    const flyCards = [];
    for (const entry of cardEntries) {
      const tex = getDisplayTexture(pid, entry.card);
      const flyCard = makeFlyCard(tex, entry.card, cardW * 0.95, cardH * 0.95);

      // Convert stage-local → world → deck-zone local for correct positioning
      const worldPos = app.stage.toGlobal(new PIXI.Point(entry.stageX, entry.stageY));
      const lp = deckZone.toLocal(worldPos);

      flyCard.x = lp.x;
      flyCard.y = lp.y;
      flyCard.scale.set(targetScale * 1.5);
      flyCard.alpha = 1;
      flyCard.eventMode = 'none';
      flyCard.name = `bottom-deck-fly-${entry.card.cardId || entry.card}`;

      if (flyCard.parent) flyCard.parent.removeChild(flyCard);
      deckZone.addChildAt(flyCard, insertBeforeIdx);

      flyCards.push({
        flyCard,
        card: entry.card,
        startX: lp.x,
        startY: lp.y,
        targetX: deckCenterX,
        targetY: deckCenterY,
      });
    }

    return new Promise((resolve) => {
      const start = performance.now();

      requestAnimationFrame(function tick(now) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);

        // Phase A: lift [0.4-0.55], hold until card arrives + buffer, drop [0.85-1]
        let liftT;
        if (t <= 0.4) liftT = 0;
        else if (t <= 0.55) liftT = easeInOut((t - 0.4) / 0.15);
        else if (t <= 0.85) liftT = 1;
        else liftT = 1 - easeOutCubic((t - 0.85) / 0.15);

        // Lift deck sprites
        for (let i = 0; i < deckSprites.length; i++) {
          const orig = deckOrigPositions[i];
          if (orig && deckSprites[i].parent) {
            deckSprites[i].y = orig.y - liftAmount * liftT;
          }
        }

        // Selected cards: flip face-down, shrink, then slide to deck center
        for (const fc of flyCards) {
          const sp = fc.flyCard;

          // Hide when deck starts dropping — card is already at deck position
          if (t > 0.85) { sp.alpha = 0; continue; }

          // Flip + shrink phase [0-0.5]
          let flipT = Math.min(t / 0.5, 1);
          const flipSign = 1 - 2 * flipT;
          const shrinkScale = targetScale * 1.5 - flipT * (targetScale * 1.5 - targetScale);

          // Swap to back texture at midpoint of flip
          if (flipT > 0.5 && sp.children[0] && sp.children[0].texture) {
            sp.children[0].texture = PIXI.Texture.from('assets/imgs/back.webp');
          }

          // Slide from start position to deck center
          const slideEased = easeInOut(Math.min(t / 0.5, 1));
          sp.x = fc.startX + (fc.targetX - fc.startX) * slideEased;
          sp.y = fc.startY + (fc.targetY - fc.startY) * slideEased;

          // Use absolute scale after flip completes so the back texture isn't mirrored
          const finalScaleX = flipT >= 0.5 ? shrinkScale : flipSign * shrinkScale;
          sp.scale.set(finalScaleX, shrinkScale);
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          // Keep fly cards in deck zone so they remain visible after animation
          resolve();
        }
      });
    });
  }
}
