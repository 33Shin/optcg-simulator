import { gsap } from 'gsap';
import { makeFlyCard, getDisplayTexture } from './utils';

const yLift = 30;
const slamOvershoot = 35;
const bounceCount = 3;

export default class SlamAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animate(pid, card, fieldSlot) {
    return new Promise((resolve) => {
      const { app } = this.ctx;
      if (!fieldSlot) { resolve(); return; }

      const cardW = 100, cardH = 140;
      const fieldScale = 1.0;
      const displayTexture = getDisplayTexture(pid, card);
      const slamFlyCard = makeFlyCard(displayTexture, card, cardW, cardH);
      slamFlyCard.name = 'slamFlyCard';

      const slotCenterX = fieldSlot.width / 2;
      const slotCenterY = fieldSlot.height / 2;
      const slotStagePos = app.stage.toLocal(
        fieldSlot.toGlobal(new PIXI.Point(slotCenterX, slotCenterY))
      );

      slamFlyCard.alpha = 0;
      slamFlyCard.x = slotStagePos.x;
      slamFlyCard.y = slotStagePos.y;
      app.stage.addChild(slamFlyCard);

      const slamFlashGraphics = new PIXI.Graphics();
      slamFlashGraphics.name = 'slamScreenFlash';
      slamFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
            .fill({ color: 0xffffff, alpha: 0 });
      slamFlashGraphics.eventMode = 'none';
      app.stage.addChildAt(slamFlashGraphics, 0);

      const origStageX = app.stage.position.x;
      const origStageY = app.stage.position.y;

      const phase1Dur = 180;
      const holdDur = 250;
      const slamDur = 90;
      const impactDur = 40;
      const bounceDur = 350;
      const shakeIntensity = 10;
      const total = phase1Dur + holdDur + slamDur + impactDur + bounceDur;

      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = proxy.t;

          slamFlyCard.x = slotStagePos.x;

          if (t < phase1Dur / total) {
            const p = (t) / (phase1Dur / total);
            const e = 1 - Math.pow(1 - p, 3);
            slamFlyCard.alpha = Math.min(p / 0.2, 1);
            const grow = 1 + e * 0.6;
            slamFlyCard.scale.set(fieldScale * grow, fieldScale * grow);
            slamFlyCard.y = slotStagePos.y - yLift * e;
          }
          else if (t < (phase1Dur + holdDur) / total) {
            slamFlyCard.alpha = 1;
            slamFlyCard.scale.set(fieldScale * 1.6, fieldScale * 1.6);
            slamFlyCard.y = slotStagePos.y - yLift;
          }
          else if (t < (phase1Dur + holdDur + slamDur) / total) {
            const p = (t - phase1Dur / total - holdDur / total) / (slamDur / total);
            const e = p * p * p;
            slamFlyCard.y = slotStagePos.y - yLift + (yLift + slamOvershoot) * e;
            slamFlyCard.scale.set(
              fieldScale * 1.6 - e * 0.6,
              fieldScale * 1.6 - e * 0.6
            );
            slamFlashGraphics.alpha = Math.max(0, (p - 0.6) / 0.4);
          }
          else if (t < (phase1Dur + holdDur + slamDur + impactDur) / total) {
            slamFlyCard.scale.set(fieldScale * 1.15, fieldScale * 0.85);
            slamFlyCard.y = slotStagePos.y + slamOvershoot * 0.1;
            slamFlashGraphics.alpha = 1;
            app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeIntensity * 2.5;
            app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeIntensity * 2.5;
          }
          else {
            const p = (t - (phase1Dur + holdDur + slamDur + impactDur) / total) / (bounceDur / total);
            const decay = Math.pow(1 - p, 2);

            const angle = p * Math.PI * bounceCount * 2;
            const scaleBounce = (1 + Math.sin(angle) * decay * 0.08);
            slamFlyCard.y = slotStagePos.y;
            slamFlyCard.scale.set(fieldScale * scaleBounce, fieldScale * scaleBounce);

            const shakeDecay = Math.pow(1 - Math.min(p, 1), 1.5) * (300 / bounceDur);
            const effectiveShake = shakeIntensity * Math.max(0, shakeDecay);
            app.stage.position.x = origStageX + (Math.random() - 0.5) * effectiveShake;
            app.stage.position.y = origStageY + (Math.random() - 0.5) * effectiveShake;

            slamFlashGraphics.alpha = Math.max(0, 1 - p * 4);
          }
        },
        onComplete: () => {
          app.stage.position.x = origStageX;
          app.stage.position.y = origStageY;
          slamFlyCard.y = slotStagePos.y;
          slamFlyCard.scale.set(fieldScale, fieldScale);
          slamFlashGraphics.alpha = 0;
          if (slamFlyCard.parent) slamFlyCard.parent.removeChild(slamFlyCard);
          if (slamFlashGraphics.parent) slamFlashGraphics.parent.removeChild(slamFlashGraphics);
          resolve();
        },
      });
    });
  }
}
