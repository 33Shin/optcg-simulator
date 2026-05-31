import { gsap } from 'gsap';

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
    const duration = (options.duration || 700) / 1000;
    const startDelay = options.startDelay ?? 0;

    if (!returnTargets.length) return Promise.resolve();

    return new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration,
        delay: startDelay * duration,
        ease: 'sine.inOut',
        onUpdate: function () {
          const e = proxy.t;

          for (const rt of returnTargets) {
            const sp = rt.flyCard;
            sp.x = sp._targetX + (rt.toPos.x - sp._targetX) * e;
            sp.y = sp._targetY + (rt.toPos.y - sp._targetY) * e;
            sp.scale.set(sp._targetScale - e * (sp._targetScale - 0.95));
          }
        },
        onComplete: resolve,
      });
    });
  }
}
