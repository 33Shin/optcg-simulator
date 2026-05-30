import { easeOutQuad } from './utils';

export default class DONRestAnimation {
  static requires = ['app', 'zoneManager', 'players'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate DON tokens resting (rotating and dimming) when cost is paid.
   * Mirrors ActiveAnimation structure: query sprites from zone, animate in-place,
   * no post-animation re-render (scheduled render will finalize state).
   * @param {number} pid - Player ID
   * @param {number} count - Number of DON tokens to rest
   * @param {number[]} indices - Indices of DON tokens to rest (captured before restDON runs)
   * @returns {Promise<void>}
   */
  async animate(pid, count, indices) {
    const { app, zoneManager, players } = this.ctx;
    const player = players[pid];
    const costZone = zoneManager.getZone(pid, 'cost');
    if (!costZone) {
      return;
    }

    const existingTokens = costZone.children.filter(c => c.isCostToken);
    if (existingTokens.length === 0) {
      return;
    }

    // Build target list by cross-referencing indices with data state
    const targets = [];
    for (const idx of (indices || [])) {
      if (idx >= existingTokens.length || idx >= player.costArea.length) {
        continue;
      }
      targets.push({ sprite: existingTokens[idx], type: 'don' });
    }

    if (targets.length === 0) {
      return;
    }

    const dur = 250;
    const t0 = performance.now();

    await new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - t0;
        const t = Math.min(elapsed / dur, 1);
        const e = easeOutQuad(t);

        for (const { sprite } of targets) {
          if (!sprite.parent) continue;

          // Rotate from 0 to PI/2 (90 degrees)
          sprite.rotation = (Math.PI / 2) * e;
          // Tint from white (0xffffff) to gray (0x666666)
          const r = Math.round(255 - 159 * e);
          const g = Math.round(255 - 159 * e);
          const b = Math.round(255 - 159 * e);
          sprite.tint = (r << 16) | (g << 8) | b;
        }

        if (t >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
