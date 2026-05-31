import { gsap } from 'gsap';

export default class ActiveAnimation {
  static requires = ['app', 'zoneManager', 'players'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate all rested cards and DON tokens standing up during refresh phase.
   * Cards rotate from 90 degrees back to 0 with a brief activation glow,
   * DON tokens rotate from 90 to 0 and regain white tint.
   * @param {number} pid - Player ID
   * @returns {Promise<void>}
   */
  async animate(pid) {
    const { app, zoneManager, players } = this.ctx;
    const player = players[pid];

    const targets = [];

    // Collect field cards that are rested
    for (let i = 0; i < 5; i++) {
      const card = player.field[i];
      if (!card || !card.rested) continue;
      const zone = zoneManager.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;
      const sprite = zone.children.find(c => c.isFieldSprite);
      if (!sprite) continue;
      targets.push({ sprite, type: 'card' });
    }

    // Collect leader if rested
    {
      const zone = zoneManager.getZone(pid, 'leader');
      if (zone) {
        const sprite = zone.children.find(c => c.isLeaderSprite);
        if (sprite && player.leader.rested) {
          targets.push({ sprite, type: 'leader' });
        }
      }
    }

    // Collect rested DON tokens
    {
      const costZone = zoneManager.getZone(pid, 'cost');
      if (costZone) {
        const existingTokens = costZone.children.filter(c => c.isCostToken);
        for (let i = 0; i < existingTokens.length && i < player.costArea.length; i++) {
          if (player.costArea[i].rested) {
            targets.push({ sprite: existingTokens[i], type: 'don' });
          }
        }
      }
    }

    if (targets.length === 0) return;

    const dur = 0.25;

    // Create activation glow overlay
    const glowGraphics = new PIXI.Graphics();
    glowGraphics.name = 'refreshGlow';
    glowGraphics.eventMode = 'none';
    app.stage.addChildAt(glowGraphics, 0);

    await new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: dur,
        ease: 'power2.out',
        onUpdate: function () {
          const t = proxy.t;
          const e = t;

          // Activation glow: peaks at 40% then fades
          const glowIntensity = t < 0.4 ? t / 0.4 : 1 - (t - 0.4) / 0.6;
          const glowAlpha = Math.max(0, glowIntensity * 0.15);

          for (const { sprite, type } of targets) {
            if (!sprite.parent) continue;

            sprite.rotation = (Math.PI / 2) * (1 - e);
          }

          // Draw glow overlay
          glowGraphics.clear();
          if (glowAlpha > 0) {
            glowGraphics.rect(0, 0, app.screen.width, app.screen.height)
                .fill({ color: 0xffd700, alpha: glowAlpha });
          }
        },
        onComplete: () => {
          glowGraphics.clear();
          if (glowGraphics.parent) glowGraphics.parent.removeChild(glowGraphics);
          resolve();
        },
      });
    });
  }
}
