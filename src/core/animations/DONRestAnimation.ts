import { gsap } from 'gsap';

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

    const dur = 0.25;

    await new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: dur,
        ease: 'power2.out',
        onUpdate: function () {
          const e = proxy.t;

          for (const { sprite } of targets) {
            if (!sprite.parent) continue;

            // Rotate from 0 to PI/2 (90 degrees)
            sprite.rotation = (Math.PI / 2) * e;
            // Tint from white to gray
            const v = Math.round(255 - 159 * e);
            sprite.tint = `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`;
          }
        },
        onComplete: resolve,
      });
    });
  }
}
