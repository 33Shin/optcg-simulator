import Card from './Card';

class LeaderCard extends Card {
  constructor(data) {
    super(data);
    this.life = data.life;
    this.power = data.power;
    this.isLeader = true;
    this.rested = false;
    this.donAttached = 0;
    this._donBonusActive = true;
  }

  get currentPower() {
    // DON bonus only applies during owner's turn
    const donBonus = (this._donBonusActive && this.donAttached > 0) ? this.donAttached * 1000 : 0;
    return this.power + donBonus;
  }
}

export default LeaderCard;
