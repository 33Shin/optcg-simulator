import PlayCharacterAI from './PlayCharacterAI';
import AttachDONAI from './AttachDONAI';
import AttackAI from './AttackAI';
import { delay } from '../core/animations/utils';

class AI {
  constructor(game) {
    this.game = game;
    this.delayMs = 700;
  }

  async runTurn(pid) {
    const behaviours = [
      new PlayCharacterAI(pid, this.delayMs, this.game),
      new AttachDONAI(pid, this.delayMs, this.game),
      new AttackAI(pid, this.delayMs, this.game),
    ];

    for (const behaviour of behaviours) {
      if (!this.game.turnManager.canAct) break;
      await behaviour.execute();
    }

    await delay(this.delayMs);

    if (this.game.turnManager.canAct) {
      this.game.turnManager.endTurn();
    }
  }

  /**
   * Decide whether to block an incoming attack and which character to use.
   */
  async chooseBlocker(blockers, attackerPower) {
    await delay(500);

    // Find a blocker that can win the fight
    for (const blocker of blockers) {
      if (blocker.currentPower >= attackerPower) {
        return blocker;
      }
    }

    // If no blocker can win, use the highest-power blocker to at least try
    blockers.sort((a, b) => b.currentPower - a.currentPower);
    if (blockers[0].currentPower > attackerPower * 0.5) {
      return blockers[0];
    }

    // Not worth blocking
    return null;
  }

  /**
   * Decide which counter cards to play during the counter phase.
   * Only plays counters if they are sufficient to make the defender win.
   */
  async chooseCounters(defender, attacker, target) {
    await delay(500);

    const atkPower = attacker.currentPower || attacker.power || 0;
    let defPower = target.currentPower || target.power || 0;

    // Find all counter cards in hand (not already used)
    const counterCards = defender.hand.map((card, idx) => ({ card, idx })).filter(({ card }) => {
      if (card.counter !== null && card.counter !== undefined) return true;
      if (card.effects && Array.isArray(card.effects)) {
        if (card.effects.some(e => e.timing === 'counter')) return true;
      }
      if (card.effect && card.effect.toLowerCase().includes('[counter]')) return true;
      return false;
    });

    if (counterCards.length === 0) return [];

    const activeDon = defender.costArea.filter(d => d.active && !d.rested).length;

    // Separate character counters (free) and event counters (cost DON)
    const charCounters = counterCards
      .filter(({ card }) => card.counter !== null && card.counter !== undefined)
      .sort((a, b) => b.card.counter - a.card.counter);

    const eventCounters = counterCards
      .filter(({ card }) => card.counter === null || card.counter === undefined)
      .filter(({ card }) => {
        const cost = card.cost || 0;
        return activeDon >= cost;
      });

    // Calculate power boost from each event counter
    for (const { card } of eventCounters) {
      let boost = 0;
      if (card.effects) {
        for (const eff of card.effects.filter(e => e.timing === 'counter')) {
          if (eff.type === 'powerBoost') boost += eff.params?.value || 0;
        }
      }
      if (boost === 0 && card.effect) {
        const match = card.effect.match(/\+(\d+)\s*power/i);
        if (match) boost = parseInt(match[1]);
      }
      card._aiCounterBoost = boost;
    }
    eventCounters.sort((a, b) => (b.card._aiCounterBoost || 0) - (a.card._aiCounterBoost || 0));

    // Greedily apply counters until defender wins or no more useful counters
    const toPlay = [];
    let usedDon = 0;

    // First try free character counters
    for (const { card, idx } of charCounters) {
      if (defPower > atkPower) break;
      const boost = card.counter || 0;
      if (boost <= 0) continue;
      defPower += boost;
      toPlay.push({ card, idx });
    }

    // Then try event counters if still needed
    if (defPower <= atkPower) {
      for (const { card, idx } of eventCounters) {
        if (defPower > atkPower) break;
        const cost = card.cost || 0;
        if (usedDon + cost > activeDon) continue;
        defPower += card._aiCounterBoost || 0;
        usedDon += cost;
        toPlay.push({ card, idx });
      }
    }

    // Only play counters if they make the defender win
    if (defPower <= atkPower) {
      return [];
    }

    return toPlay;
  }

  /**
   * Decide whether the AI should mulligan its opening hand.
   * Always mulligans for now.
   */
  shouldMulligan() {
    return true;
  }

  /**
   * Decide whether the AI should play a Trigger ability when taking damage.
   * Evaluates if the trigger effects are net-beneficial for the damaged player.
   */
  shouldPlayDamageTrigger(card, player) {
    // Cards with structured effects: evaluate by type
    if (card.effects && Array.isArray(card.effects)) {
      const triggers = card.effects.filter(e => e.timing === 'trigger');
      if (triggers.length === 0) return true;

      const goodTypes = new Set(['draw', 'addDON', 'restOpponent', 'shuffleOpponentHand',
        'addToLife', 'giveDONToLeader', 'returnOpponentCharacter']);
      const badTypes = new Set(['trashFromHand', 'returnToBottomDeck', 'removeFromLife']);

      let score = 0;
      for (const eff of triggers) {
        if (goodTypes.has(eff.type)) score += 2;
        else if (badTypes.has(eff.type)) score -= 3;
        else score += 1;
      }
      return score > 0;
    }

    // Cards with only trigger string: default to playing (most triggers are beneficial)
    return true;
  }
}

export default AI;