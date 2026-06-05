import { gsap } from 'gsap';

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

    // GSAP: power2.out matches easeOutQuad (1 - (1-t)^2)
    return new Promise((resolve) => {
      gsap.to(ghost, {
        alpha: 0,
        duration: 0.25,
        ease: 'power2.out',
        onComplete: () => {
          ghost.alpha = 0;
          resolve();
        },
      });
    });
  }
}

export default FadeOutGhostAnimation;
