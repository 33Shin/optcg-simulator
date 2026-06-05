import { gsap } from 'gsap';

class DONReturnOnKOAnimation {
  static requires = ['app', 'zoneManager', 'players', 'zoneRenderer'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate DON tokens flying from a KO'd card back to the cost zone as rested.
   * DONs must already be added to player.costArea before calling this method
   * so the cost zone can render the real tokens when the ghost tokens fade out.
   * @param {number} pid - Player ID
   * @param {PIXI.Container} targetZone - The field slot or leader zone the card was in
   * @param {number} donCount - Number of DONs to animate
   * @returns {Promise<void>}
   */
  async animate(pid, targetZone, donCount) {
    if (!targetZone || donCount <= 0) return;
    const { app, zoneManager, players } = this.ctx;
    const costZone = zoneManager.getZone(pid, 'cost');
    if (!costZone) return;

    const donTexture = PIXI.Texture.from('assets/imgs/don.png');
    const startCenter = targetZone.toGlobal(new PIXI.Point(targetZone.width / 2, targetZone.height / 2));
    const startPos = costZone.toLocal(startCenter);

    const tokenW = 36;
    const gap = 10;
    const currentCount = players[pid].costArea.length;
    const numTokens = Math.max(currentCount, 10);
    const totalW = numTokens * tokenW + (numTokens - 1) * gap;
    const startX = (costZone.width - totalW) / 2;
    const yOff = (40 - tokenW) / 2;

    const endPositions = [];
    for (let i = 0; i < donCount; i++) {
      const slotIdx = currentCount - donCount + i;
      const targetX = startX + slotIdx * (tokenW + gap) + tokenW / 2;
      const targetY = yOff + tokenW / 2;
      endPositions.push({ x: targetX, y: targetY });
    }

    const tokens = [];
    for (let i = 0; i < donCount; i++) {
      const sp = new PIXI.Sprite(donTexture);
      sp.name = `donReturnToken_${i}`;
      sp.width = 36;
      sp.height = 36;
      sp.anchor.set(0.5);
      sp.position.set(startPos.x, startPos.y);
      sp.alpha = 1;
      sp.eventMode = 'none';
      sp._isGhostToken = true;
      sp.rotation = Math.PI / 2;
      sp.tint = '#666666';
      sp._endPos = endPositions[i];
      costZone.addChild(sp);
      tokens.push(sp);
    }

    // GSAP proxy: 350ms, sine.inOut (matches easeInOut)
    await new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: 0.35,
        ease: 'sine.inOut',
        onUpdate: () => {
          const e = proxy.t;
          for (const sp of tokens) {
            sp.x = startPos.x + (sp._endPos.x - startPos.x) * e;
            sp.y = startPos.y + (sp._endPos.y - startPos.y) * e;
            sp.rotation = Math.PI / 2;
          }
        },
        onComplete: () => {
          for (const sp of tokens) {
            if (sp.parent) sp.parent.removeChild(sp);
          }
          resolve();
        },
      });
    });
  }
}

export default DONReturnOnKOAnimation;
