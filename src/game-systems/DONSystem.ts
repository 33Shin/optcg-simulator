class DONSystem {
  constructor(players, eventBus) {
    this.players = players;
    this.eventBus = eventBus;
    this.MAX_DON = 10;
  }

  init(playerId) {
    this.players[playerId].donDeck = [];
    for (let i = 0; i < this.MAX_DON; i++) {
      this.players[playerId].donDeck.push({ active: true, rested: false });
    }
    this.players[playerId].costArea = [];
  }

  drawDON(playerId, count = 2) {
    const player = this.players[playerId];
    const drawn = [];
    for (let i = 0; i < count && player.donDeck.length > 0; i++) {
      const don = player.donDeck.pop();
      don.active = true;
      don.rested = false;
      player.costArea.push(don);
      drawn.push(don);
    }
    this.eventBus.emit('don:drawn', { playerId, count: drawn.length });
    return drawn;
  }

  restDON(playerId, count) {
    const player = this.players[playerId];
    const rested = [];
    let remaining = count;
    for (const don of player.costArea) {
      if (don.active && !don.rested && remaining > 0) {
        don.rested = true;
        don.active = false;
        rested.push(don);
        remaining--;
      }
    }
    return rested.length >= count;
  }

  attachDON(playerId, target) {
    const player = this.players[playerId];
    for (const don of player.costArea) {
      if (don.active && !don.rested) {
        don.attachedTo = target;
        player.costArea = player.costArea.filter(d => d !== don);
        target.donAttached++;
        return don;
      }
    }
    return null;
  }

  /**
   * Return attached DONs from a single target to cost area as rested.
   */
  returnDONs(pid, target) {
    const player = this.players[pid];
    while (target.donAttached > 0) {
      player.costArea.push({ active: false, rested: true });
      target.donAttached--;
    }
  }

  /**
   * Return all attached DONs from leader + field to cost area as rested.
   */
  returnAllDON(playerId) {
    const player = this.players[playerId];
    for (const char of player.field) {
      if (char) this.returnDONs(playerId, char);
    }
    if (player.leader) this.returnDONs(playerId, player.leader);
    for (const don of player.costArea) {
      if (don.attachedTo) {
        don.attachedTo = null;
        don.rested = true;
        don.active = false;
      }
    }
  }

  /**
   * Save DON-attached counts before end-phase animation.
   */
  saveDONState(pid) {
    const p = this.players[pid];
    const state = { field: [], leader: 0 };
    for (let i = 0; i < p.field.length; i++) {
      state.field[i] = p.field[i] ? p.field[i].donAttached : 0;
    }
    state.leader = p.leader.donAttached;
    return state;
  }

  /**
   * Restore saved DON counts as rested tokens in cost area during refresh.
   */
  restoreDONToCostArea(pid, saved) {
    const p = this.players[pid];
    for (let i = 0; i < p.field.length; i++) {
      for (let j = 0; j < (saved.field[i] || 0); j++) {
        p.costArea.push({ active: false, rested: true });
      }
    }
    for (let j = 0; j < (saved.leader || 0); j++) {
      p.costArea.push({ active: false, rested: true });
    }
  }

  countDON(playerId, location) {
    const player = this.players[playerId];
    if (location === 'donDeck') return player.donDeck.length;
    if (location === 'costArea') return player.costArea.length;
    return 0;
  }
}

export default DONSystem;
