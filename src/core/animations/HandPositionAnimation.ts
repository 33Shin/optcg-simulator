import { gsap } from 'gsap';

class HandPositionAnimation {
  static requires = [];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate hand cards shifting to new positions after add/remove.
   * @param {PIXI.Container[]} sprites - Array of hand card sprites
   * @param {object[]} fromPositions - Array of {x, y} starting positions
   * @param {object[]} toPositions - Array of {x, y} target positions
   * @returns {Promise<void>}
   */
  animate(sprites, fromPositions, toPositions) {
    if (!sprites || sprites.length === 0) return Promise.resolve();

    const promises = [];
    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      const fx = fromPositions[i] ? fromPositions[i].x : toPositions[i].x;
      const fy = fromPositions[i] ? fromPositions[i].y : toPositions[i].y;
      const tx = toPositions[i].x;
      const ty = toPositions[i].y;

      if (Math.abs(fx - tx) < 1 && Math.abs(fy - ty) < 1) {
        sp.position.set(tx, ty);
        continue;
      }

      sp.position.set(fx, fy);

      const dx = tx - fx;
      const dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Math.min(Math.max(dist * 1.4, 100), 300);

      // GSAP: power2.out matches easeOutQuad
      promises.push(new Promise((resolve) => {
        const _p = { t: 0 };
        gsap.to(_p, {
          t: 1,
          duration: duration / 1000,
          ease: 'power2.out',
          onUpdate: () => {
            const t = _p.t;
            sp.position.x = fx + dx * t;
            sp.position.y = fy + dy * t;
          },
          onComplete: () => {
            sp.position.x = tx;
            sp.position.y = ty;
            sp._basePosX = tx;
            sp._basePosY = ty;
            resolve();
          },
        });
      }));
    }

    return Promise.all(promises);
  }
}

export default HandPositionAnimation;
