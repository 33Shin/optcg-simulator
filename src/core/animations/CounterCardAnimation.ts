import { Animator } from '../Animator';

class CounterCardAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Counter card burst VFX: expanding card image, screen shake, golden flash.
   * @param {PIXI.Container} targetZone - The zone containing the target card sprite
   * @param {object} counterCard - The counter card data (with imgPath)
   * @param {number} duration - Animation duration in ms
   * @returns {Promise<void>}
   */
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

    return Animator.animate({
      duration,
      easing: 'easeOutQuad',
      onUpdate: (t) => {
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
      },
    }).toPromise();
  }
}

export default CounterCardAnimation;
