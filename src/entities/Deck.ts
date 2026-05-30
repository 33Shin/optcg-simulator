import LeaderCard from './LeaderCard';
import CharacterCard from './CharacterCard';
import EventCard from './EventCard';

class Deck {
  constructor(deckDefinition, cardDatabase) {
    this.name = deckDefinition.name;
    this.colors = deckDefinition.colors;
    this.cards = [];
    this.leader = this._buildLeader(deckDefinition.leader, cardDatabase);
    this._buildCards(deckDefinition, cardDatabase);
  }

  _buildLeader(leaderDef, db) {
    const data = db.get(leaderDef.cardId);
    return new LeaderCard(data);
  }

  _buildCards(def, db) {
    const all = [...(def.characters || []), ...(def.events || [])];
    for (const entry of all) {
      for (let i = 0; i < entry.count; i++) {
        const data = db.get(entry.cardId);
        if (data.category === 'character') {
          this.cards.push(new CharacterCard(data));
        } else {
          this.cards.push(new EventCard(data));
        }
      }
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  /**
   * Shuffle deck so the next `count` draws all have trigger abilities.
   * Remaining cards are shuffled normally.
   */
  shuffleWithTriggerLife(count) {
    const triggerCards = [];
    const otherCards = [];

    for (const card of this.cards) {
      if (this._hasTrigger(card)) {
        triggerCards.push(card);
      } else {
        otherCards.push(card);
      }
    }

    // Shuffle both pools
    this._fisherYates(triggerCards);
    this._fisherYates(otherCards);

    // Take `count` trigger cards for life draws, rest go back
    const lifeTriggers = triggerCards.splice(0, Math.min(count, triggerCards.length));

    // Fill remaining life slots with random cards if not enough triggers
    const remainingNeeded = count - lifeTriggers.length;
    if (remainingNeeded > 0) {
      lifeTriggers.push(...otherCards.splice(0, remainingNeeded));
    }

    // Shuffle non-life pool
    const rest = [...otherCards, ...triggerCards];
    this._fisherYates(rest);

    // cards = rest (bottom) + lifeTriggers (top, drawn first)
    this.cards = [...rest, ...lifeTriggers];
  }

  _hasTrigger(card) {
    if (card.effects && Array.isArray(card.effects)) {
      if (card.effects.some(e => e.timing === 'trigger')) return true;
    }
    if (card.trigger && card.trigger.toLowerCase().includes('[trigger]')) return true;
    return false;
  }

  _fisherYates(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  draw() {
    return this.cards.pop();
  }

  isEmpty() {
    return this.cards.length === 0;
  }

  size() {
    return this.cards.length;
  }
}

export default Deck;
