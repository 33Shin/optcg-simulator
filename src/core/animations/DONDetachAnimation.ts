import { gsap } from 'gsap';

class DONDetachAnimation {
  static requires = ['players', 'zoneManager', 'game'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  async animate(pid) {
    const { players, zoneManager, game } = this.ctx;
    const player = players[pid];
    const duration = 0.5;
    const turnMods = game?.effectSystem?._turnPowerMods || [];

    const targets = [];

    // Collect field cards with DON
    for (let i = 0; i < 5; i++) {
      const card = player.field[i];
      if (!card || card.donAttached <= 0) continue;
      // Skip cards with turn power mods — restoreTurnPowerMods handles them
      if (turnMods.some(m => m.card === card)) continue;
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
          if (powerText && player.leader.donAttached > 0 && !turnMods.some(m => m.card === player.leader)) {
            targets.push({ powerText, card: player.leader });
          }
        }
      }
    }

    if (targets.length === 0) return;

    await new Promise((resolve) => {
      const _p = { p: 0 };
      gsap.to(_p, {
        p: 1,
        duration,
        ease: 'none',
        onUpdate: () => {
          const p = _p.p;

          for (const { powerText, card } of targets) {
            const basePower = card.power || 0;
            const currentPower = card.currentPower || card.power || 0;
            const displayPower = Math.round(currentPower + (basePower - currentPower) * p);
            powerText.text = String(displayPower);
            powerText.style.fill = lerpColor(0xffd700, 0xffffff, p);
          }
        },
        onComplete: resolve,
      });
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
