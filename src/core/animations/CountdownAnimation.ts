import { gsap } from 'gsap';

export default class CountdownAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  run() {
    const { app } = this.ctx;
    const { width, height } = app.screen;

    // Dark semi-transparent overlay
    const countdownOverlay = new PIXI.Graphics();
    countdownOverlay.name = 'countdownOverlay';
    countdownOverlay.rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.85 });
    app.stage.addChild(countdownOverlay);

    // Ready text
    const countdownText = new PIXI.Text({ text: 'Ready!', style: {
      fontSize: 80,
      fill: 0xffffff,
      fontFamily: 'Russo One',
      dropShadow: true,
      dropShadowColor: 0x000000,
      dropShadowBlur: 20,
    }});
    countdownText.name = 'countdownReadyText';
    countdownText.anchor.set(0.5);
    countdownText.x = width / 2;
    countdownText.y = height / 2;
    countdownText.scale.set(0.5);
    app.stage.addChild(countdownText);

    return new Promise((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          app.stage.removeChild(countdownOverlay);
          app.stage.removeChild(countdownText);
          resolve();
        },
      });

      // Scale in
      tl.to(countdownText.scale, { x: 1, y: 1, duration: 0.3, ease: 'none' });
      // Hold
      tl.to({}, { duration: 1.2 });
      // Fade out + scale up
      tl.to(countdownOverlay, { alpha: 0, duration: 0.6, ease: 'none' });
      tl.to(countdownText, { alpha: 0, duration: 0.6, ease: 'none' }, '<');
      tl.to(countdownText.scale, { x: 1.5, y: 1.5, duration: 0.6, ease: 'none' }, '<');
    });
  }
}