class DONDetachAnimation {
  static requires = ['players', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  async animate(pid) {
    const { players, zoneManager } = this.ctx;
    const player = players[pid];
    const duration = 500;
    const t0 = performance.now();

    const targets = [];

    // Collect field cards with DON
    for (let i = 0; i < 5; i++) {
      const card = player.field[i];
      if (!card || card.donAttached <= 0) continue;
      const zone = zoneManager.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;
      const sprite = zone.children.find(c => c.isFieldSprite);
      if (!sprite) continue;
      const powerText = sprite.children.find(c => c.isPowerText);
      if (!powerText) continue;
      targets.push({ powerText, card });
    }

    // Collect leader if it has DON
    {
      const zone = zoneManager.getZone(pid, 'leader');
      if (zone) {
        const sprite = zone.children.find(c => c.isLeaderSprite);
        if (sprite) {
          const powerText = sprite.children.find(c => c.isPowerText);
          if (powerText && player.leader.donAttached > 0) {
            targets.push({ powerText, card: player.leader });
          }
        }
      }
    }

    if (targets.length === 0) return;

    await new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - t0;
        const p = Math.min(elapsed / duration, 1);

        for (const { powerText, card } of targets) {
          const basePower = card.power || 0;
          const currentPower = card.currentPower || card.power || 0;
          const displayPower = Math.round(currentPower + (basePower - currentPower) * p);
          powerText.text = String(displayPower);
          powerText.style.fill = lerpColor(0xffd700, 0xffffff, p);
        }

        if (p >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}

function lerpColor(a, b, t) {
  const r = Math.round(((a >> 16) & 0xff) + (((b >> 16) & 0xff) - ((a >> 16) & 0xff)) * t);
  const g = Math.round(((a >> 8) & 0xff) + (((b >> 8) & 0xff) - ((a >> 8) & 0xff)) * t);
  const b2 = Math.round((a & 0xff) + ((b & 0xff) - (a & 0xff)) * t);
  return (r << 16) | (g << 8) | b2;
}

export default DONDetachAnimation;
