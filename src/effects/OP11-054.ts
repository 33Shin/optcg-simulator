import { EffectBase, EffectContext, TIMING } from './base';
import { delay } from '../core/animations/utils';

class OP11_054 extends EffectBase {
  public static cardId = 'OP11-054';
  public static timings = [TIMING.ON_PLAY];

  async execute(ctx: EffectContext) {
    const leaderColor = (ctx.player.leader.color || '').toLowerCase();
    if (!leaderColor.includes('/')) return;

    // Draw 3 cards
    await ctx.animManager.multipleDraw.drawCards(ctx.pid, ctx.player, 3, true);
    await delay(200);

    // Pick 2 cards to place at top/bottom of deck
    await ctx.animManager.cardPick.animateNami(ctx.pid, ctx.player);
  }
}

export default OP11_054;
