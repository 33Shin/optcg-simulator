import { easeInOut } from './utils';

export default class FlyToHandAnimation {
  static requires = [];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate fly cards back to hand positions.
   *
   * @param {number} pid - Player ID (unused here, kept for consistency)
   * @param {Array<{flyCard: PIXI.Container, toPos: {x: number, y: number}>}>} returnTargets - Fly cards and their target stage-local positions
   * @param {object} [options] - Optional settings
   * @param {number} [options.duration] - Animation duration in ms (default 700)
   * @param {number} [options.startDelay] - Fraction of duration to delay start (0-1, default 0)
   * @returns {Promise<void>}
   */
  animate(pid, returnTargets, options = {}) {
    const duration = options.duration || 700;
    const startDelay = options.startDelay ?? 0;

    if (!returnTargets.length) return Promise.resolve();

    return new Promise((resolve) => {
      const start = performance.now();

      requestAnimationFrame(function tick(now) {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);

        let retT = 0;
        if (t > startDelay) {
          retT = easeInOut(Math.min((t - startDelay) / (1 - startDelay), 1));
        }

        for (const rt of returnTargets) {
          const sp = rt.flyCard;
          sp.x = sp._targetX + (rt.toPos.x - sp._targetX) * retT;
          sp.y = sp._targetY + (rt.toPos.y - sp._targetY) * retT;
          sp.scale.set(sp._targetScale - retT * (sp._targetScale - 0.95));
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      });
    });
  }
}
