import { gsap } from 'gsap';

class CounterCardAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animate(targetZone, counterCard, duration = 400) {
    if (!targetZone) return Promise.resolve();
    const { app } = this.ctx;

    const targetCardSprite = targetZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
    const cardScale = targetCardSprite ? targetCardSprite.scale.x : 1;

    const texture = counterCard.imgPath ? PIXI.Texture.from(counterCard.imgPath) : null;
    let burstSprite;
    if (texture) {
      burstSprite = new PIXI.Sprite(texture);
      burstSprite.width = 30 * cardScale;
      burstSprite.height = 42 * cardScale;
    } else {
      burstSprite = new PIXI.Graphics();
      burstSprite.circle(0, 0, 15 * cardScale).fill({ color: 0xffd700 });
    }
    burstSprite.name = 'counterBurstSprite';
    burstSprite.anchor.set(0.5);
    burstSprite.position.set(50, 70);
    burstSprite.alpha = 0.5;
    burstSprite.eventMode = 'none';
    const baseScale = burstSprite.scale.x || 1;
    if (targetCardSprite) {
      const powerText = targetCardSprite.children.find(c => c.isPowerText);
      const powerIndex = targetCardSprite.children.indexOf(powerText);
      if (powerIndex > -1) {
        targetCardSprite.addChildAt(burstSprite, powerIndex);
      } else {
        targetCardSprite.addChild(burstSprite);
      }
    }

    const screenFlashGraphics = new PIXI.Graphics();
    screenFlashGraphics.name = 'screenFlash';
    screenFlashGraphics.eventMode = 'none';
    screenFlashGraphics.alpha = 0;
    app.stage.addChildAt(screenFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    return new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: duration / 1000,
        ease: 'power2.out',
        onUpdate: () => {
          const t = proxy.t;
          burstSprite.scale.set(baseScale * (2 + 6 * t));
          burstSprite.alpha = Math.max(0, 0.8 * (1 - t));

          const shakeAmt = 10 * Math.max(0, 1 - t * 2);
          app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeAmt;
          app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeAmt;

          screenFlashGraphics.clear();
          const flashAlpha = 0.3 * Math.max(0, 1 - t * 2);
          if (flashAlpha > 0) {
            screenFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
                .fill({ color: 0xffd700, alpha: flashAlpha });
          }
        },
        onComplete: () => {
          app.stage.position.x = origStageX;
          app.stage.position.y = origStageY;
          burstSprite.alpha = 0;
          screenFlashGraphics.clear();
          if (burstSprite.parent) burstSprite.parent.removeChild(burstSprite);
          if (screenFlashGraphics.parent) screenFlashGraphics.parent.removeChild(screenFlashGraphics);
          resolve();
        },
      });
    });
  }
}

export default CounterCardAnimation;
