import AIBehaviour from './AIBehaviour';

class AttackAI extends AIBehaviour {
  async execute() {
    if (!this.canAct()) return false;
    if (this.ai.state.turnCount < 2) return false;

    let anyAttacked = false;

    while (this.canAct()) {
      // Collect all valid attackers: field characters + leader
      const fieldAttackers = this.player.field
        .filter((c) => c && !c.rested && !c.playedThisTurn);

      const leader = this.player.leader;
      const allAttackers = leader && !leader.rested
        ? [...fieldAttackers, leader]
        : fieldAttackers;

      if (allAttackers.length === 0) break;

      // Target: rested opponent characters only + opponent leader
      const charTargets = this.opponent.field.filter((c) => c !== null && c.rested);
      const targets = [...charTargets, this.opponent.leader].filter(Boolean);
      if (targets.length === 0) break;

      // Sort targets weakest-first so we prioritize easy KOs
      targets.sort((a, b) => (a.currentPower || 0) - (b.currentPower || 0));

      // Find any attacker-target pair where attacker can win
      let found = false;
      for (const target of targets) {
        const targetPower = target.currentPower || 0;
        // Find the weakest attacker that can still win (save stronger attackers)
        const viableAttackers = allAttackers
          .filter((c) => (c.currentPower || 0) >= targetPower)
          .sort((a, b) => (a.currentPower || 0) - (b.currentPower || 0));

        if (viableAttackers.length > 0) {
          await this.ai._resolveBattle(this.pid, viableAttackers[0], target, this.opponent);
          await this.sleep(this.delayMs);
          anyAttacked = true;
          found = true;
          break;
        }
      }

      if (!found) break;
    }

    return anyAttacked;
  }
}

export default AttackAI;