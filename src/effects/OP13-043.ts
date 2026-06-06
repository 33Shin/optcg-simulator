import { EffectBase, EffectContext, TIMING } from './base';
import { delay } from '../core/animations/utils';

class OP13_043 extends EffectBase {
  public static cardId = 'OP13-043';
  public static timings = [TIMING.ON_PLAY];

  async execute(ctx: EffectContext) {
    if (ctx.player.life.length > 3) return;

    // Draw 2 cards
    await ctx.animManager.multipleDraw.drawCards(ctx.pid, ctx.player, 2, true);
    await delay(200);

    // Pick 1 card to trash
    const selected = await ctx.animManager.cardPick.animate(
      ctx.pid,
      ctx.player,
      'Choose 1 card to trash'
    );
    if (selected) {
      const idx = ctx.player.hand.indexOf(selected);
      if (idx !== -1) {
        ctx.player.hand.splice(idx, 1);
        ctx.player.trash.push(selected);
      }
    }
  }
}

export default OP13_043;
