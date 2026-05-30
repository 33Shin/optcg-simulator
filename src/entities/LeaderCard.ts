import Card from './Card';

class LeaderCard extends Card {
  constructor(data) {
    super(data);
    this.life = data.life;
    this.power = data.power;
    this.isLeader = true;
    this.rested = false;
    this.donAttached = 0;
  }

  get currentPower() {
    return this.power + this.donAttached * 1000;
  }
}

export default LeaderCard;
