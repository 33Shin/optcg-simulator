import Card from './Card';

class CharacterCard extends Card {
  constructor(data) {
    super(data);
    this.cost = data.cost;
    this.power = data.power;
    this.counter = data.counter;
    this.rested = false;
    this.donAttached = 0;
    this._donBonusActive = true;
    this.isBlocker = this._parseBlocker();
    this.blockerUsed = false;
    this.playedThisTurn = false;
    this.effectsUsed = {};
    this.effects = data.effects || [];
  }

  get currentPower() {
    // DON bonus only applies during owner's turn
    const donBonus = (this._donBonusActive && this.donAttached > 0) ? this.donAttached * 1000 : 0;
    return this.power + donBonus;
  }

  _parseBlocker() {
    if (!this.effect) return false;
    return this.effect.toLowerCase().includes('blocker');
  }
}

export default CharacterCard;
