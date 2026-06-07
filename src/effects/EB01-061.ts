import { EffectBase, EffectContext, TIMING } from './base';

class EB01_061 extends EffectBase {
  public static cardId = 'EB01-061';
  public static timings = [TIMING.ON_PLAY, TIMING.WHEN_ATTACKING];

  async execute(ctx: EffectContext) {
    if (ctx.timing === 'onPlay') {
      await this._onPlay(ctx);
    } else if (ctx.timing === 'whenAttacking') {
      await this._whenAttacking(ctx);
    }
  }

  async _onPlay(ctx: EffectContext) {
    await ctx.addDON();
  }

  async _whenAttacking(ctx: EffectContext) {
    const opponent = ctx.getOpponent(ctx.player);
    if (!opponent) return;

    const opponentChars = opponent.field.filter((c) => c != null);
    if (opponentChars.length === 0) return;

    const selectionOverlay = ctx.animManager.ctx.game.selectionOverlay;
    const selected = await selectionOverlay.showOpponentCharacterPick(
      opponentChars,
      'Select an opponent Character to copy power'
    );

    if (selected) {
      const originalPower = ctx.card.power;
      const animFrom = ctx.card.currentPower || originalPower;
      const newPower = selected.power;
      ctx.effectSystem.registerTurnPowerMod(ctx.card, originalPower, ctx.pid);
      ctx.card.power = newPower;
      const animTo = ctx.card.currentPower || newPower;

      // Animate power count-up — use currentPower so DON bonus is included
      const powerText = ctx.effectSystem._findPowerText(ctx.pid, ctx.card);
      if (powerText) {
        const hasDon = ctx.card.donAttached > 0;
        const targetColor = hasDon ? 0xffd700 : 0xffffff;
        await ctx.animManager.animatePowerCount(
          powerText, animFrom, animTo, 600,
          0xffffff, targetColor
        );
      }
      // Delay before attack animation begins
      await new Promise(r => setTimeout(r, 250));
    }
  }
}

export default EB01_061;
