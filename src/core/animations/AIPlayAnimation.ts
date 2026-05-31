import { gsap } from 'gsap';
import { createFlipCard } from './utils';

const yLift = 30;
const slamOvershoot = 35;
const bounceCount = 3;

export default class AIPlayAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animate(pid, card, fieldSlot) {
    return new Promise((resolve) => {
      const { app } = this.ctx;
      if (!fieldSlot) { resolve(); return; }

      const cardW = 100, cardH = 140;
      const fieldScale = 1.0;
      const handZone = this.ctx.zoneManager.getZone(pid, 'hand');

      const displayTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
      const flyCard = createFlipCard(displayTexture, card, cardW, cardH);

      const slotCenterX = fieldSlot.width / 2;
      const slotCenterY = fieldSlot.height / 2;
      const slotStagePos = app.stage.toLocal(
        fieldSlot.toGlobal(new PIXI.Point(slotCenterX, slotCenterY))
      );

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
      flyCard.scale.set(fieldScale, fieldScale);
      flyCard.showBack();
      app.stage.addChild(flyCard);

      const flash = new PIXI.Graphics();
      flash.name = 'aiPlayFlash';
      flash.rect(0, 0, app.screen.width, app.screen.height)
            .fill({ color: 0xffffff, alpha: 0 });
      flash.eventMode = 'none';
      app.stage.addChildAt(flash, 0);

      const origStageX = app.stage.position.x;
      const origStageY = app.stage.position.y;

      const flyDur = 400;
      const holdDur = 250;
      const slamDur = 200;
      const impactDur = 40;
      const bounceDur = 350;
      const shakeIntensity = 10;
      const total = flyDur + holdDur + slamDur + impactDur + bounceDur;

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

            const baseScale = 1 + (fieldScale - 1) * e;
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
          }
          else if (t < (flyDur + holdDur) / total) {
            flyCard.x = centerPos.x;
            flyCard.y = centerPos.y;
            flyCard.showFront();
            flyCard.scale.set(fieldScale * 1.6, fieldScale * 1.6);
          }
          else if (t < (flyDur + holdDur + slamDur) / total) {
            const p = (t - flyDur / total - holdDur / total) / (slamDur / total);
            const e = p * p * p;

            flyCard.x = centerPos.x + (slotStagePos.x - centerPos.x) * e;
            flyCard.y = centerPos.y - yLift * (1 - e) + (yLift + slamOvershoot) * e;
            flyCard.scale.set(
              fieldScale * 1.6 - e * 0.6,
              fieldScale * 1.6 - e * 0.6
            );
            flash.alpha = Math.max(0, (p - 0.6) / 0.4);
          }
          else if (t < (flyDur + holdDur + slamDur + impactDur) / total) {
            flyCard.x = slotStagePos.x;
            flyCard.scale.set(fieldScale * 1.15, fieldScale * 0.85);
            flyCard.y = slotStagePos.y + slamOvershoot * 0.1;
            flash.alpha = 1;
            app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeIntensity * 2.5;
            app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeIntensity * 2.5;
          }
          else {
            const p = (t - (flyDur + holdDur + slamDur + impactDur) / total) / (bounceDur / total);
            const decay = Math.pow(1 - p, 2);

            const angle = p * Math.PI * bounceCount * 2;
            const scaleBounce = (1 + Math.sin(angle) * decay * 0.08);
            flyCard.x = slotStagePos.x;
            flyCard.y = slotStagePos.y;
            flyCard.scale.set(fieldScale * scaleBounce, fieldScale * scaleBounce);

            const shakeDecay = Math.pow(1 - Math.min(p, 1), 1.5) * (300 / bounceDur);
            const effectiveShake = shakeIntensity * Math.max(0, shakeDecay);
            app.stage.position.x = origStageX + (Math.random() - 0.5) * effectiveShake;
            app.stage.position.y = origStageY + (Math.random() - 0.5) * effectiveShake;

            flash.alpha = Math.max(0, 1 - p * 4);
          }
        },
        onComplete: () => {
          app.stage.position.x = origStageX;
          app.stage.position.y = origStageY;
          flyCard.y = slotStagePos.y;
          flyCard.scale.set(fieldScale, fieldScale);
          flash.alpha = 0;
          if (flyCard.parent) flyCard.parent.removeChild(flyCard);
          if (flash.parent) flash.parent.removeChild(flash);
          resolve();
        },
      });
    });
  }
}
