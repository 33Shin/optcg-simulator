import { gsap } from 'gsap';
import { createFlipCard } from './utils';

export default class AICounterAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

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

      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = proxy.t;

          if (t < flyDur / total) {
            const p = t / (flyDur / total);
            const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;

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
            flyCard.x = centerPos.x;
            flyCard.y = centerPos.y;
            flyCard.showFront();
            flyCard.scale.set(1.6, 1.6);
            flyCard.alpha = 1;
          }
        },
        onComplete: () => {
          resolve({ flyCard });
        },
      });
    });
  }

  async animateFadeOut(flyCard, targetGlobal) {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      const startPos = new PIXI.Point(flyCard.position.x, flyCard.position.y);
      const endPos = targetGlobal
        ? app.stage.toLocal(targetGlobal)
        : new PIXI.Point(startPos.x, startPos.y);

      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: 0.25,
        ease: 'none',
        onUpdate: () => {
          const e = 1 - (1 - proxy.t) * (1 - proxy.t);
          flyCard.position.x = startPos.x + (endPos.x - startPos.x) * e;
          flyCard.position.y = startPos.y + (endPos.y - startPos.y) * e;
          flyCard.alpha = 1 - e;
        },
        onComplete: () => {
          if (flyCard.parent) flyCard.parent.removeChild(flyCard);
          resolve();
        },
      });
    });
  }
}
