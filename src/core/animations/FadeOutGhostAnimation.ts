class FadeOutGhostAnimation {
  static requires = [];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Fade out the ghost sprite over a short duration.
   * @param {PIXI.Container} ghost - The ghost sprite
   * @returns {Promise<void>}
   */
  animate(ghost) {
    if (!ghost) return Promise.resolve();

    const fadeDur = 250;
    const t0 = performance.now();
    const startAlpha = ghost.alpha;

    return new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min((now - t0) / fadeDur, 1);
        const e = 1 - (1 - t) * (1 - t);
        ghost.alpha = startAlpha * (1 - e);
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          ghost.alpha = 0;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}

export default FadeOutGhostAnimation;
