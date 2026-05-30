import { easeInOut, easeOutQuad, createFlipCard } from './utils';

export default class AICounterAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * AI counter card: fly from hand to center with flip.
   * Resolves when the card is held at center, ready for fade-out + power-up.
   *
   * @param {number} pid - Player ID (2 = opponent)
   * @param {object} card - Card object
   * @returns {Promise<{ flyCard: PIXI.Container }>}
   */
  async animateFlyToCenter(pid, card) {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      const cardW = 100, cardH = 140;
      const handZone = this.ctx.zoneManager.getZone(pid, 'hand');

      const displayTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
      const flyCard = createFlipCard(displayTexture, card, cardW, cardH);

      let startPos;
      if (handZone) {
        const handCenter = handZone.toGlobal(
          new PIXI.Point(handZone.width / 2, handZone.height / 2)
        );
        startPos = app.stage.toLocal(handCenter);
      } else {
        startPos = new PIXI.Point(600, 100);
      }

      const centerPos = new PIXI.Point(600, 400);

      flyCard.position.copyFrom(startPos);
      flyCard.scale.set(1, 1);
      flyCard.showBack();
      app.stage.addChild(flyCard);

      const flyDur = 450;
      const holdDur = 300;
      const total = flyDur + holdDur;

      const start = performance.now();

      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / total, 1);

        if (t < flyDur / total) {
          // Phase 1: Fly from hand to center, scale up, flip midway
          const p = elapsed / flyDur;
          const e = easeInOut(p);

          flyCard.x = startPos.x + (centerPos.x - startPos.x) * e;
          flyCard.y = startPos.y + (centerPos.y - startPos.y) * e;

          const baseScale = 1 + 0.6 * e;
          const flipSign = 1 - p * 2;

          if (p < 0.5) {
            flyCard.showBack();
            flyCard.scale.set(Math.abs(flipSign) * baseScale, baseScale);
          } else if (p < 0.52) {
            flyCard.scale.x = 0;
          } else {
            flyCard.showFront();
            flyCard.scale.set(Math.abs(flipSign) * baseScale, baseScale);
          }
        } else {
          // Phase 2: Hold at center, fully revealed
          flyCard.x = centerPos.x;
          flyCard.y = centerPos.y;
          flyCard.showFront();
          flyCard.scale.set(1.6, 1.6);
          flyCard.alpha = 1;

          if (t >= 1) {
            resolve({ flyCard });
            return;
          }
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }

  /**
   * Fade out a fly-card while flying toward the defender target.
   * @param {PIXI.Container} flyCard - The card to fade out
   * @param {PIXI.Point} targetGlobal - Global position of the defender card
   * @returns {Promise<void>}
   */
  async animateFadeOut(flyCard, targetGlobal) {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      const fadeDur = 250;
      const t0 = performance.now();

      const startPos = new PIXI.Point(flyCard.position.x, flyCard.position.y);
      const endPos = targetGlobal
        ? app.stage.toLocal(targetGlobal)
        : new PIXI.Point(startPos.x, startPos.y);

      const tick = (now) => {
        const t = Math.min((now - t0) / fadeDur, 1);
        const e = easeOutQuad(t);

        // Fly toward defender target
        flyCard.position.x = startPos.x + (endPos.x - startPos.x) * e;
        flyCard.position.y = startPos.y + (endPos.y - startPos.y) * e;

        // Fade out
        flyCard.alpha = 1 - e;

        if (t >= 1) {
          if (flyCard.parent) flyCard.parent.removeChild(flyCard);
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }
}
