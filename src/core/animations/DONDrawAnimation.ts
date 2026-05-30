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
        await this._fadeOutTile(donTiles[donTiles.length - 1], 250);
      }
    }

    // Re-render DON deck (cost tokens are rendered by slam animation onComplete)
    zoneRenderer._renderDONDeck(pid);
  }

  _fadeOutTile(sprite, duration) {
    return new Promise((resolve) => {
      sprite.alpha = 1;
      const startFade = performance.now();
      const tick = (now) => {
        const t = Math.min((now - startFade) / duration, 1);
        sprite.alpha = 1 - t;
        if (t >= 1) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
