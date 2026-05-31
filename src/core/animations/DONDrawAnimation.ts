import { gsap } from 'gsap';

export default class DONDrawAnimation {
  static requires = ['zoneManager', 'zoneRenderer'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  async animateDONDraw(pid) {
    const { zoneManager, zoneRenderer } = this.ctx;
    const donZone = zoneManager.getZone(pid, 'dondeck');

    // Fade out last DON deck tile to show one was taken
    if (donZone) {
      const donTiles = donZone.children.filter(c => c.isDONTile);
      if (donTiles.length > 0) {
        await this._fadeOutTile(donTiles[donTiles.length - 1], 0.25);
      }
    }

    // Re-render DON deck (cost tokens are rendered by slam animation onComplete)
    zoneRenderer._renderDONDeck(pid);
  }

  _fadeOutTile(sprite, duration) {
    return new Promise((resolve) => {
      gsap.to(sprite, {
        alpha: 0,
        duration,
        ease: 'none',
        onComplete: resolve,
      });
    });
  }
}
