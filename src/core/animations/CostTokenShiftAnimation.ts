class CostTokenShiftAnimation {
  static requires = ['players'];

  constructor(ctx) {
    this.ctx = ctx;
    this._rafId = null;
  }

  /**
   * Animate DON cost tokens to new positions when count changes.
   * @param {PIXI.Container} zone - The cost zone
   * @param {object[]} oldPositions - Previous token positions [{x, y}, ...]
   * @param {number} count - Number of tokens to animate
   * @param {number} startX - Starting X for layout
   * @param {number} tokenW - Token width
   * @param {number} gap - Gap between tokens
   * @param {number} yOff - Y offset
   * @param {number} pid - Player ID
   * @param {boolean} canAct - Whether player can act (for interaction binding)
   * @param {function} onDONTokenPointerDown - Pointer handler for DON tokens
   * @returns {Promise<void>}
   */
  animate(zone, oldPositions, count, startX, tokenW, gap, yOff, pid, canAct, onDONTokenPointerDown) {
    if (!zone) return Promise.resolve();

    const duration = 500;
    const t0 = performance.now();

    return new Promise((resolve) => {
      const tick = (now) => {
        const rawT = Math.min((now - t0) / duration, 1);
        const ease = 1 - Math.pow(1 - rawT, 3);

        const tokens = zone.children.filter(c => c.isCostToken && c.alpha > 0.5);
        if (tokens.length === 0) {
          this._rafId = null;
          resolve();
          return;
        }

        for (let i = 0; i < tokens.length && i < count; i++) {
          const targetX = startX + i * (tokenW + gap) + tokenW / 2;
          const targetY = yOff + tokenW / 2;
          const ox = oldPositions[i] ? oldPositions[i].x : targetX;
          const oy = oldPositions[i] ? oldPositions[i].y : targetY;
          tokens[i].position.x = ox + (targetX - ox) * ease;
          tokens[i].position.y = oy + (targetY - oy) * ease;
        }

        if (rawT >= 1) {
          for (let i = 0; i < tokens.length && i < count; i++) {
            tokens[i].position.set(
              startX + i * (tokenW + gap) + tokenW / 2,
              yOff + tokenW / 2
            );
          }
          if (canAct && onDONTokenPointerDown) {
            const { players } = this.ctx;
            for (let i = 0; i < tokens.length && i < count; i++) {
              const don = players[pid].costArea[i];
              if (don && don.active && !don.rested && pid === 1) {
                tokens[i].eventMode = 'static';
                tokens[i].cursor = 'pointer';
                tokens[i].removeAllListeners('pointerdown');
                const idx = i;
                tokens[i].on('pointerdown', (e) => onDONTokenPointerDown(e, pid, idx, tokens[i]));
              }
            }
          }
          this._rafId = null;
          resolve();
          return;
        }
        this._rafId = requestAnimationFrame(tick);
      };
      this._rafId = requestAnimationFrame(tick);
    });
  }

  cancel() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }
}

export default CostTokenShiftAnimation;
