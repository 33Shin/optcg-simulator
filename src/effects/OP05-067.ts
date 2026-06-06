import { EffectBase, EffectContext, TIMING } from './base';

class OP05_067 extends EffectBase {
  public static cardId = 'OP05-067';
  public static timings = [TIMING.WHEN_ATTACKING];

  async execute(ctx: EffectContext) {
    if (ctx.player.life.length <= 3) {
      await ctx.addDON();
    }
  }
}

export default OP05_067;
