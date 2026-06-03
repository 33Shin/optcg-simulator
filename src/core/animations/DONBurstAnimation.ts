import { Animator } from '../Animator';

class DONBurstAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * DON attachment burst VFX: expanding DON sprite, screen shake, golden flash.
   * @param {PIXI.Container} targetZone - The zone containing the target card sprite
   * @param {number} duration - Animation duration in ms
   * @returns {Promise<void>}
   */
  animate(targetZone, duration = 400) {
    if (!targetZone) return Promise.resolve();
    const { app } = this.ctx;

    const targetCardSprite = targetZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
    const cardScale = targetCardSprite ? targetCardSprite.scale.x : 1;

    const donBurstSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donBurstSprite.name = 'donBurstSprite';
    donBurstSprite.anchor.set(0.5);
    donBurstSprite.position.set(50, 70);
    donBurstSprite.alpha = 0.5;
    donBurstSprite.eventMode = 'none';
    const targetW = 30 * cardScale;
    donBurstSprite.width = targetW;
    const baseScale = donBurstSprite.scale.x;
    donBurstSprite.scale.set(baseScale);
    if (targetCardSprite) {
      const powerText = targetCardSprite.children.find(c => c.isPowerText);
      const powerIndex = targetCardSprite.children.indexOf(powerText);
      if (powerIndex > -1) {
        targetCardSprite.addChildAt(donBurstSprite, powerIndex);
      } else {
        targetCardSprite.addChild(donBurstSprite);
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
        donBurstSprite.scale.set(baseScale * (2 + 6 * t));
        donBurstSprite.alpha = Math.max(0, 0.8 * (1 - t));

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
        donBurstSprite.alpha = 0;
        screenFlashGraphics.clear();
        if (donBurstSprite.parent) donBurstSprite.parent.removeChild(donBurstSprite);
        if (screenFlashGraphics.parent) screenFlashGraphics.parent.removeChild(screenFlashGraphics);
      },
    }).toPromise();
  }
}

export default DONBurstAnimation;
