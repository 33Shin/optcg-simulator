import { gsap } from 'gsap';
import { makeFlyCard, getDisplayTexture } from './utils';

export default class FlyToBottomDeckAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  async animate(pid, cardEntries, options = {}) {
    const { app, zoneManager } = this.ctx;

    const deckZone = zoneManager.getZone(pid, 'deck');
    if (!deckZone) return Promise.resolve();

    const duration = options.duration || 1300;
    const cardW = 100, cardH = 140;
    const deckCardH = Math.max(deckZone.height - 20, 100);
    const targetScale = deckCardH / cardH;

    const deckCenterX = deckZone.width / 2;
    const deckCenterY = deckZone.height / 2;

    // Capture existing deck card sprites and their positions
    const deckSprites = deckZone.children.filter(c => c.isCardBack);
    const deckOrigPositions = deckSprites.map(s => ({ x: s.x, y: s.y }));
    const liftAmount = 50;

    // Hide real deck sprites during animation (ghost deck replaces them)
    for (const ds of deckSprites) {
      ds.alpha = 0;
    }

    // Position ghost deck at the real deck's global position
    const deckGlobal = deckZone.toGlobal(new PIXI.Point(0, 0));
    const stageDeckPos = app.stage.toLocal(deckGlobal);

    // Create fly cards on stage first (so ghost deck renders on top)
    const flyCards = [];
    for (const entry of cardEntries) {
      const tex = getDisplayTexture(pid, entry.card);
      const flyCard = makeFlyCard(tex, entry.card, cardW * 0.95, cardH * 0.95);

      flyCard.x = entry.stageX;
      flyCard.y = entry.stageY;
      flyCard.scale.set(targetScale * 1.5);
      flyCard.alpha = 1;
      flyCard.eventMode = 'none';
      flyCard.name = `bottom-deck-fly-${entry.card.cardId || entry.card}`;

      if (flyCard.parent) flyCard.parent.removeChild(flyCard);
      app.stage.addChild(flyCard);

      flyCards.push({
        flyCard,
        card: entry.card,
        startX: entry.stageX,
        startY: entry.stageY,
        targetX: stageDeckPos.x + deckCenterX,
        targetY: stageDeckPos.y + deckCenterY,
      });
    }

    // --- Create ghost deck on stage AFTER fly cards (renders on top) ---
    const ghostDeck = new PIXI.Container();
    ghostDeck.name = 'ghost-deck';
    app.stage.addChild(ghostDeck);

    // Create ghost deck sprites (matching ZoneRenderer._renderCardStack)
    const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
    const ghostCardW = deckCardH * (5 / 7);
    const ghostSprites = [];
    for (let i = 0; i < deckSprites.length; i++) {
      const gs = new PIXI.Sprite(backTexture);
      gs.width = ghostCardW;
      gs.height = deckCardH;
      gs.isCardBack = true;
      gs.x = deckOrigPositions[i].x;
      gs.y = deckOrigPositions[i].y;
      ghostDeck.addChild(gs);
      ghostSprites.push(gs);
    }

    ghostDeck.position.copyFrom(stageDeckPos);

    // Deck lift proxy
    const deckLift = { offset: 0 };

    // --- Card fly animation ---
    const flyPromises = flyCards.map((fc) => {
      const sp = fc.flyCard;
      const backTex = PIXI.Texture.from('assets/imgs/back.webp');

      return new Promise((resolve) => {
        const tl = gsap.timeline({ onComplete: resolve });

        // Slide to deck center (completes at ~50% of total duration)
        tl.to(sp, {
          x: fc.targetX,
          y: fc.targetY,
          duration: (duration * 0.5) / 1000,
          ease: 'power2.inOut',
        });

        // Flip: scale.x narrows to 0 then restores (done by ~40%)
        tl.to(sp.scale, {
          x: 0,
          duration: (duration * 0.15) / 1000,
          ease: 'power2.in',
        }, 0);

        // Swap texture to back at flip midpoint
        tl.call(() => {
          if (sp.children[0] && sp.children[0].texture) {
            sp.children[0].texture = backTex;
          }
        }, [], (duration * 0.15) / 1000);

        // Restore scale.x and shrink to target scale
        tl.to(sp.scale, {
          x: targetScale,
          y: targetScale,
          duration: (duration * 0.25) / 1000,
          ease: 'power2.out',
        }, (duration * 0.15) / 1000);

        // Fade out near end
        tl.to(sp, {
          alpha: 0,
          duration: (duration * 0.1) / 1000,
          ease: 'power1.in',
        }, (duration * 0.9) / 1000);
      });
    });

    // --- Deck lift timeline ---
    const deckTl = gsap.timeline();
    deckTl.to(deckLift, {
      offset: liftAmount,
      duration: (duration * 0.2) / 1000,
      ease: 'power2.out',
    }, (duration * 0.25) / 1000);
    deckTl.to(deckLift, {
      offset: 0,
      duration: (duration * 0.15) / 1000,
      ease: 'power2.in',
    }, (duration * 0.7) / 1000);

    // Apply deck lift each frame via ticker
    const tickerCb = () => {
      for (let i = 0; i < ghostSprites.length; i++) {
        ghostSprites[i].y = deckOrigPositions[i].y - deckLift.offset;
      }
    };
    app.ticker.add(tickerCb);

    // Wait for card fly to finish
    await Promise.all(flyPromises);

    // Cleanup
    app.ticker.remove(tickerCb);
    // Restore real deck sprites
    for (const ds of deckSprites) {
      ds.alpha = 1;
    }
    for (const fc of flyCards) {
      if (fc.flyCard.parent) fc.flyCard.parent.removeChild(fc.flyCard);
    }
    if (ghostDeck.parent) ghostDeck.parent.removeChild(ghostDeck);
  }
}
