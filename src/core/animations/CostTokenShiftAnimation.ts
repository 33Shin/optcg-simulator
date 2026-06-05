import { gsap } from 'gsap';

class CostTokenShiftAnimation {
  static requires = ['players'];

  constructor(ctx) {
    this.ctx = ctx;
    this._tween = null;
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

    return new Promise((resolve) => {
      const _p = { t: 0 };
      this._tween = gsap.to(_p, {
        t: 1,
        duration: 0.5,
        ease: 'power3.out',
        onUpdate: () => {
          const ease = _p.t;
          const tokens = zone.children.filter(c => c.isCostToken && c.alpha > 0.5);
          if (tokens.length === 0) {
            this._tween.kill();
            this._tween = null;
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
        },
        onComplete: () => {
          const tokens = zone.children.filter(c => c.isCostToken && c.alpha > 0.5);
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
          this._tween = null;
          resolve();
        },
      });
    });
  }

  cancel() {
    if (this._tween) {
      this._tween.kill();
      this._tween = null;
    }
  }
}

export default CostTokenShiftAnimation;
