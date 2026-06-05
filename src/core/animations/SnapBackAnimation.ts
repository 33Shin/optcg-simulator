import { gsap } from 'gsap';

class SnapBackAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate ghost card snapping back to original position on invalid drop.
   * @param {PIXI.Container} ghost - The ghost sprite
   * @param {object} snapBackPos - {x, y} global position to snap back to
   * @returns {Promise<void>}
   */
  animate(ghost, snapBackPos) {
    if (!ghost || !snapBackPos) return Promise.resolve();

    const endX = snapBackPos.x - ghost.dragW / 2;
    const endY = snapBackPos.y - ghost.dragH / 2;

    // GSAP: power2.out matches easeOutQuad
    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: 0.2,
        ease: 'power2.out',
        onUpdate: () => {
          const t = _p.t;
          ghost.position.x += (endX - ghost.position.x) * t * 0.3;
          ghost.position.y += (endY - ghost.position.y) * t * 0.3;
          ghost.alpha = 1 - t * 0.3;
        },
        onComplete: () => {
          ghost.alpha = 0;
          resolve();
        },
      });
    });
  }
}

export default SnapBackAnimation;
