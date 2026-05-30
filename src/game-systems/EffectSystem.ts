import { delay } from '../core/animations/utils';

// --- Shared helper methods for card manipulation ---

const Helpers = {
  drawCards(player, count) {
    for (let i = 0; i < count && player.deck.cards.length > 0; i++) {
      const drawn = player.deck.draw();
      if (drawn) player.hand.push(drawn);
    }
  },

  trashFromHand(player, count) {
    for (let i = 0; i < count && player.hand.length > 0; i++) {
      const trashed = player.hand.pop();
      if (trashed) player.trash.push(trashed);
    }
  },

  returnToBottomDeck(player, count) {
    for (let i = 0; i < count && player.hand.length > 0; i++) {
      const returned = player.hand.pop();
      if (returned) player.deck.cards.unshift(returned);
    }
  },

  restOpponentCharacter(opponent, maxCost = Infinity) {
    const activeChars = opponent.field.filter(c => c && !c.rested && c.cost <= maxCost);
    if (activeChars.length > 0) {
      activeChars[0].rested = true;
    }
  },

  shuffleOpponentHand(opponent) {
    while (opponent.hand.length > 0) {
      const card = opponent.hand.pop();
      opponent.deck.cards.push(card);
    }
    opponent.deck.shuffle();
    Helpers.drawCards(opponent, 5);
  },

  addToLife(player, source = 'deck') {
    if (source === 'deck' && player.deck.cards.length > 0) {
      const card = player.deck.draw();
      if (card) player.life.unshift(card);
    } else if (source === 'hand' && player.hand.length > 0) {
      const card = player.hand.pop();
      if (card) player.life.unshift(card);
    }
  },

  removeFromLife(opponent, owner) {
    if (opponent.life.length === 0) return null;
    const card = opponent.life.shift();
    if (card) {
      const cardOwner = card._originalOwner || owner;
      cardOwner.hand.push(card);
    }
    return card;
  },

  returnOpponentCharacter(opponent) {
    const valid = opponent.field.filter(c => c);
    if (valid.length > 0) {
      const returned = valid[0];
      const idx = opponent.field.indexOf(returned);
      if (idx !== -1) opponent.field[idx] = null;
      returned._originalOwner = opponent;
      opponent.hand.push(returned);
    }
  },

  returnOpponentCharacterMaxCost(opponent, maxCost = Infinity) {
    const valid = opponent.field.filter(c => c && c.cost <= maxCost);
    if (valid.length > 0) {
      const returned = valid[0];
      const idx = opponent.field.indexOf(returned);
      if (idx !== -1) opponent.field[idx] = null;
      returned._originalOwner = opponent;
      opponent.hand.push(returned);
    }
  },
};

const EFFECT_HANDLERS = {
  draw: (ctx, params) => Helpers.drawCards(ctx.player, params.count || 1),

  trashFromHand: (ctx, params) => Helpers.trashFromHand(ctx.player, params.count || 1),

  addDON: (ctx, params) => {
    const player = ctx.player;
    if (player.donDeck.length > 0) {
      const don = player.donDeck.pop();
      if (don) {
        don.active = true;
        don.rested = false;
        player.costArea.push(don);
        for (const [pid, p] of Object.entries(ctx.players)) {
          if (p === player) {
            ctx.eventBus.emit('effect:addDON', { playerId: parseInt(pid), don });
            break;
          }
        }
      }
    }
  },

  returnToBottomDeck: (ctx, params) => Helpers.returnToBottomDeck(ctx.player, params.count || 1),

  restOpponent: (ctx, params) => {
    const opponent = ctx.getOpponent(ctx.player);
    if (opponent) Helpers.restOpponentCharacter(opponent, params.maxCost ?? Infinity);
  },

  shuffleOpponentHand: (ctx) => {
    const opponent = ctx.getOpponent(ctx.player);
    if (opponent) Helpers.shuffleOpponentHand(opponent);
  },

  addToLife: (ctx, params) => Helpers.addToLife(ctx.player, params.source || 'deck'),

  removeFromLife: (ctx) => {
    const opponent = ctx.getOpponent(ctx.player);
    if (opponent) Helpers.removeFromLife(opponent, ctx.player);
  },

  giveDONToLeader: (ctx) => {
    const player = ctx.player;
    const restedDon = player.costArea.find(d => d.rested);
    if (restedDon) {
      restedDon.attachedTo = player.leader;
      player.costArea = player.costArea.filter(d => d !== restedDon);
      player.leader.donAttached++;
    }
  },

  returnOpponentCharacter: (ctx, params) => {
    const opponent = ctx.getOpponent(ctx.player);
    if (opponent) Helpers.returnOpponentCharacterMaxCost(opponent, params.maxCost ?? Infinity);
  },
};

class EffectSystem {
  constructor(state, players, eventBus) {
    this.state = state;
    this.players = players;
    this.eventBus = eventBus;
    this.optTracker = {};
  }

  processOnPlay(card, player) {
    if (!card.effects || !Array.isArray(card.effects)) return;
    this.eventBus.emit('effect:onPlay', { card, player });
    for (const eff of card.effects) {
      if (eff.timing === 'onPlay') this._executeStructured(eff, card, player);
    }
  }

  processOnKO(card, player) {
    if (!card.effects || !Array.isArray(card.effects)) return;
    this.eventBus.emit('effect:onKO', { card, player });
    for (const eff of card.effects) {
      if (eff.timing === 'onKO') this._executeStructured(eff, card, player);
    }
  }

  processWhenAttacking(card, player) {

    if (!card.effects || !Array.isArray(card.effects)) return false;
    this.eventBus.emit('effect:whenAttacking', { card, player });
    let executed = false;
    for (const eff of card.effects) {
      if (eff.timing === 'whenAttacking') {
        this._executeStructured(eff, card, player);
        executed = true;
      }
    }
    return executed;
  }

  checkTrigger(drawnCard, player) {
    if (!drawnCard.effects || !Array.isArray(drawnCard.effects)) {
      // Fallback: check raw trigger property (string like '[Trigger] ...')
      if (drawnCard.trigger && drawnCard.trigger.toLowerCase().includes('[trigger]')) {
        this.eventBus.emit('effect:trigger', { card: drawnCard, player });
        return true;
      }
      return false;
    }
    const triggers = drawnCard.effects.filter(e => e.timing === 'trigger');
    if (triggers.length > 0) {
      this.eventBus.emit('effect:trigger', { card: drawnCard, player, triggers });
      return true;
    }
    // Also check raw trigger string as fallback
    if (drawnCard.trigger && drawnCard.trigger.toLowerCase().includes('[trigger]')) {
      this.eventBus.emit('effect:trigger', { card: drawnCard, player });
      return true;
    }
    return false;
  }

  resolveTrigger(card, player) {
    if (!card.effects || !Array.isArray(card.effects)) {
      // Fallback: try to parse trigger string and execute matching effects
      this._executeFallbackTrigger(card, player);
      return;
    }
    for (const eff of card.effects) {
      if (eff.timing === 'trigger') this._executeStructured(eff, card, player);
    }
  }

  /** Execute trigger effect by parsing raw trigger text. */
  _executeFallbackTrigger(card, player) {
    const txt = (card.trigger || '').toLowerCase();
    // Add DON!!
    if (txt.includes('add') && txt.includes('don')) {
      EFFECT_HANDLERS.addDON({ player, players: this.players, eventBus: this.eventBus }, {});
    }
    // Draw cards
    const drawMatch = txt.match(/draw\s*(\d+)/i);
    if (drawMatch) {
      Helpers.drawCards(player, parseInt(drawMatch[1]));
    } else if (txt.includes('draw')) {
      Helpers.drawCards(player, 1);
    }
  }

  checkCounter(card) {
    // Character with counter power value (not null/undefined)
    if (card.counter !== null && card.counter !== undefined) return true;
    // Event with [Counter] timing
    if (card.effects && Array.isArray(card.effects)) {
      if (card.effects.some(e => e.timing === 'counter')) return true;
    }
    // Fallback: check raw effect text for [Counter] keyword
    if (card.effect && card.effect.toLowerCase().includes('[counter]')) return true;
    return false;
  }

  oncePerTurnCheck(cardId) {
    const key = `${this.state.currentPlayer}_${cardId}_${this.state.turnCount}`;
    if (this.optTracker[key]) return false;
    this.optTracker[key] = true;
    return true;
  }

  // --- Structured effect execution ---

  _executeStructured(eff, card, player) {
    if (eff.condition && !this._checkCondition(eff.condition, player)) return;
    const handler = EFFECT_HANDLERS[eff.type];
    if (!handler) return;
    handler({
      player,
      players: this.players,
      eventBus: this.eventBus,
      getOpponent: (p) => this._getOpponent(p),
    }, eff.params || {});
  }

  _checkCondition(cond, player) {
    if (cond.lifeMax !== undefined && player.life.length > cond.lifeMax) return false;
    if (cond.lifeMin !== undefined && player.life.length < cond.lifeMin) return false;
    return true;
  }

  _getOpponent(player) {
    for (const [pid, p] of Object.entries(this.players)) {
      if (p !== player) return p;
    }
    return null;
  }

  // --- Complex Card Effects (Async/UI dependent) ---

  /**
   * Route card-specific effects. Call this instead of processOnPlay for cards
   * that need special handling (Otama, Nami, etc.). Falls through to processOnPlay.
   */
  async processCardSpecificEffects(card, pid, player, animManager, handRenderer, zoneRenderer, turnManager) {
    if (card.cardId === 'OP13-043') {
      await this.processOtamaEffect(pid, player, animManager, handRenderer, zoneRenderer, turnManager);
    } else if (card.cardId === 'OP11-054') {
      await this.processNamiEffect(pid, player, animManager, handRenderer, zoneRenderer, turnManager);
    } else {
      this.processOnPlay(card, player);
    }
  }

  async processOtamaEffect(pid, player, animManager, handRenderer, zoneRenderer, turnManager) {
    await animManager.multipleDraw.drawCards(pid, player, 2, true);
    await delay(200);
    const selected = await animManager.cardPick.animate(pid, player, 'Choose 1 card to trash');
    if (selected) {
      // Logic for trashing the selected card would go here or be handled by animManager/Game
    }
  }

  async processNamiEffect(pid, player, animManager, handRenderer, zoneRenderer, turnManager) {
    const leaderColor = (player.leader.color || '').toLowerCase();
    if (!leaderColor.includes('/')) return;
    await animManager.multipleDraw.drawCards(pid, player, 3, true);
    await delay(200);
    await animManager.cardPick.animateNami(pid, player);
  }
}

export default EffectSystem;
