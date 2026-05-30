import Card from './Card';

class EventCard extends Card {
  constructor(data) {
    super(data);
    this.cost = data.cost;
    this.timing = this._parseTiming();
    this.effects = data.effects || [];
  }

  _parseTiming() {
    const timings = [];
    if (!this.effect) return timings;
    const lower = this.effect.toLowerCase();
    if (lower.includes('[main]') || lower.includes('[activate: main]')) timings.push('main');
    if (lower.includes('[counter]')) timings.push('counter');
    if (this.trigger && this.trigger.toLowerCase().includes('[trigger]')) timings.push('trigger');
    return timings;
  }
}

export default EventCard;
