export default class CountdownAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  run() {
    return new Promise((resolve) => {
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

      const showDuration = 1500;
      const fadeDuration = 600;
      const start = performance.now();

      requestAnimationFrame(function tick(now) {
        const elapsed = now - start;

        // Show and hold
        if (elapsed < showDuration) {
          const t = Math.min(elapsed / 300, 1);
          countdownText.scale.set(0.5 + 0.5 * t);
          requestAnimationFrame(tick);
          return;
        }

        // Fade out
        const t = Math.min((elapsed - showDuration) / fadeDuration, 1);
        countdownOverlay.alpha = 1 - t;
        countdownText.alpha = 1 - t;
        countdownText.scale.set(1 + t * 0.5);

        if (t >= 1) {
          app.stage.removeChild(countdownOverlay);
          app.stage.removeChild(countdownText);
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      });
    });
  }
}