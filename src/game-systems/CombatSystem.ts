class CombatSystem {
  constructor(state, players, eventBus) {
    this.state = state;
    this.players = players;
    this.eventBus = eventBus;
  }

  _calcPower(card, modifiers) {
    let power = card.currentPower || 0;
    for (const mod of modifiers) {
      power += mod.value;
    }
    return power;
  }

  KO(card, player) {
    // Return attached DONs to cost area as rested
    if (card.donAttached > 0) {
      for (let i = 0; i < card.donAttached; i++) {
        player.costArea.push({ active: false, rested: true });
      }
      card.donAttached = 0;
    }

    const idx = player.field.indexOf(card);
    if (idx !== -1) {
      player.field[idx] = null;
      player.trash.push(card);
    }
    this.eventBus.emit('card:KO', { card, player });
  }

  async damageLeader(player) {
    let card, source;
    if (player.life.length > 0) {
      card = player.life.pop();
      source = 'life';
    } else {
      card = player.deck.cards.length > 0 ? player.deck.draw() : null;
      source = 'deck';
    }
    await this.eventBus.emitAsync('leader:damage', { player, damageCard: card, source });
  }
}

export default CombatSystem;
