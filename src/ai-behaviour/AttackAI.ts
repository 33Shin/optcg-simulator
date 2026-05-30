import AIBehaviour from './AIBehaviour';

class AttackAI extends AIBehaviour {
  async execute() {
    if (!this.canAct()) return false;
    if (this.ai.state.turnCount < 2) return false;

    let anyAttacked = false;

    while (this.canAct()) {
      // Collect all valid attackers: field characters + leader
      const charAttackers = this.player.field
        .map((c, i) => ({ card: c, slot: i }))
        .filter(({ card }) => card && !card.rested && !card.playedThisTurn);

      if (charAttackers.length === 0) break;

      // Target: rested opponent characters only + opponent leader
      const charTargets = this.opponent.field.filter((c) => c !== null && c.rested);
      const targets = [...charTargets, this.opponent.leader];
      if (targets.length === 0) break;

      targets.sort((a, b) => (a.currentPower || 0) - (b.currentPower || 0));

      charAttackers.sort((a, b) => (b.card.currentPower || 0) - (a.card.currentPower || 0));

      const bestAtk = charAttackers.find((a) => (a.card.currentPower || 0) >= (targets[0].currentPower || 0)) || charAttackers[0];
      const target = targets[0];

      if (!bestAtk) break;

      await this.ai._resolveBattle(this.pid, bestAtk.card, target, this.opponent);
      await this.sleep(this.delayMs);

      anyAttacked = true;
    }

    return anyAttacked;
  }
}

export default AttackAI;