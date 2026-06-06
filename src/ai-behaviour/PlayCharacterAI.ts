import AIBehaviour from './AIBehaviour';

class PlayCharacterAI extends AIBehaviour {
  async execute() {
    if (!this.canAct()) return false;

    const player = this.player;
    let anyPlayed = false;

    while (this.canAct()) {
      const playable = player.hand
        .map((c, i) => ({ card: c, idx: i }))
        .filter(({ card }) => card.category === 'character')
        .filter(({ card }) => this.ai.cardPlayManager.canPay(this.pid, card.cost || 0))
        .filter(() => player.field.filter(c => c !== null).length < 5);

      if (playable.length === 0) break;

      // Score each card: prioritize high attack power, deprioritize cards better kept in hand for counter
      for (const { card } of playable) {
        const pwr = card.power || 0;
        const ctr = card.counter || 0;
        // Cards with 0 attack power and high counter are pure defense — keep in hand
        // Cards with high counter relative to power are also better as counter cards
        card._aiPlayScore = pwr - Math.max(0, ctr - pwr) * 0.5;
      }
      playable.sort((a, b) => (b.card._aiPlayScore || 0) - (a.card._aiPlayScore || 0));

      // Don't play cards that score negative (better kept in hand)
      const pick = playable.find(({ card }) => (card._aiPlayScore || 0) > 0);
      if (!pick) break;

      const cost = pick.card.cost || 0;

      // Capture DON indices before resting for animation
      const restIndices = [];
      let remaining = cost;
      for (let i = 0; i < player.costArea.length && remaining > 0; i++) {
        if (player.costArea[i].active && !player.costArea[i].rested) {
          restIndices.push(i);
          remaining--;
        }
      }
      this.ai.donSystem.restDON(this.pid, cost);

      // Start DON rest animation (will run in parallel with play animation)
      let donRestAnim = Promise.resolve();
      if (cost > 0 && restIndices.length > 0 && this.ai.animManager) {
        donRestAnim = this.ai.animManager.animateDONRest(this.pid, cost, restIndices);
      }

      const handIdx = player.hand.indexOf(pick.card);
      if (handIdx === -1) break;
      player.hand.splice(handIdx, 1);

      this.renderAll();

      const slotIdx = player.field.indexOf(null);
      if (slotIdx === -1) break;

      const fieldSlot = this.ai.zoneManager.getZone(this.pid, `field_slot_${slotIdx}`);
      let aiPlayAnim = Promise.resolve();
      if (this.ai.animManager && this.ai.animManager.aiPlay) {
        aiPlayAnim = this.ai.animManager.aiPlay.animate(this.pid, pick.card, fieldSlot);
      }
      await Promise.all([donRestAnim, aiPlayAnim]);
      player.field[slotIdx] = pick.card;
      pick.card.rested = false;
      pick.card.playedThisTurn = true;

      // Render field with the new card before animation
      this.ai.fieldRenderer.renderField(this.pid);
      this.ai.zoneRenderer.renderAll();

      // Play ability activation animation only if card has on-play effects
      const aiHasOnPlayS = pick.card.effects && Array.isArray(pick.card.effects) && pick.card.effects.some(e => e.timing === 'onPlay');
      const aiHasOnPlayR = pick.card.effect && typeof pick.card.effect === 'string' && /\[on\s*play\]/i.test(pick.card.effect);
      if ((aiHasOnPlayS || aiHasOnPlayR) && this.ai.animManager && this.ai.animManager.abilityActivate) {
        await this.ai.animManager.abilityActivate.animate(this.pid, pick.card, fieldSlot);
      }

      // Re-render field after animation
      this.ai.fieldRenderer.renderField(this.pid);
      this.ai.zoneRenderer.renderAll();

      // Process on-play effects
      if (this.ai.effectSystem) {
        await this.ai.effectSystem.processOnPlay(pick.card, player);
      }

      anyPlayed = true;
      this.renderAll();
      await this.sleep(this.delayMs);
    }

    return anyPlayed;
  }
}

export default PlayCharacterAI;