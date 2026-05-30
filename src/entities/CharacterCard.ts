import Card from './Card';

class CharacterCard extends Card {
  constructor(data) {
    super(data);
    this.cost = data.cost;
    this.power = data.power;
    this.counter = data.counter;
    this.rested = false;
    this.donAttached = 0;
    this.isBlocker = this._parseBlocker();
    this.blockerUsed = false;
    this.playedThisTurn = false;
    this.effectsUsed = {};
    this.effects = data.effects || [];
  }

  get currentPower() {
    return this.power + this.donAttached * 1000;
  }

  _parseBlocker() {
    if (!this.effect) return false;
    return this.effect.toLowerCase().includes('blocker');
  }
}

export default CharacterCard;
