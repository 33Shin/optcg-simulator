import EffectRegistry from '../effects/registry';

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

  addDON: async (ctx, params) => {
    const player = ctx.player;
    if (player.donDeck.length > 0) {
      const don = player.donDeck.pop();
      if (don) {
        don.active = true;
        don.rested = false;
        player.costArea.push(don);
        for (const [pid, p] of Object.entries(ctx.players)) {
          if (p === player) {
            await ctx.eventBus.emitAsync('effect:addDON', { playerId: parseInt(pid), don });
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
  constructor(state, players, eventBus, animManager) {
    this.state = state;
    this.players = players;
    this.eventBus = eventBus;
    this.animManager = animManager;
    this.registry = new EffectRegistry();
    this.optTracker = {};
    this._turnPowerMods = [];
  }

  /**
   * Build an EffectContext object from current state.
   */
   _buildContext(card, pid, player, timing) {
    const ctx = {
      card,
      pid,
      player,
      timing,
      effectSystem: this,
      players: this.players,
      eventBus: this.eventBus,
      animManager: this.animManager,
      getOpponent: (p) => this._getOpponent(p),
      drawCards: (count) => Helpers.drawCards(player, count),
      trashFromHand: (count) => Helpers.trashFromHand(player, count),
      addDON: async () => {
        await EFFECT_HANDLERS.addDON(ctx, {});
      },
      restOpponent: (maxCost) => {
        const opp = this._getOpponent(player);
        if (opp) Helpers.restOpponentCharacter(opp, maxCost ?? Infinity);
      },
      returnOpponentCharacter: (maxCost) => {
        const opp = this._getOpponent(player);
        if (opp) Helpers.returnOpponentCharacterMaxCost(opp, maxCost ?? Infinity);
      },
      shuffleOpponentHand: () => {
        const opp = this._getOpponent(player);
        if (opp) Helpers.shuffleOpponentHand(opp);
      },
      addToLife: (source) => Helpers.addToLife(player, source || 'deck'),
      removeFromLife: () => {
        const opp = this._getOpponent(player);
        if (opp) Helpers.removeFromLife(opp, player);
      },
      giveDONToLeader: () => {
        const restedDon = player.costArea.find(d => d.rested);
        if (restedDon) {
          restedDon.attachedTo = player.leader;
          player.costArea = player.costArea.filter(d => d !== restedDon);
          player.leader.donAttached++;
        }
      },
      returnToBottomDeck: (count) => Helpers.returnToBottomDeck(player, count),
    };
    return ctx;
  }

  // --- Timing entry points ---

  async processOnPlay(card, player) {
    // Check registry first
    if (this.registry.hasTiming(card.cardId, 'onPlay')) {
      const cls = this.registry.get(card.cardId);
      const pid = this._findPid(player);
      const ctx = this._buildContext(card, pid, player, 'onPlay');
      this.eventBus.emit('effect:onPlay', { card, player });
      await new cls().execute(ctx);
      return;
    }
    // Fall back to structured effects array
    if (!card.effects || !Array.isArray(card.effects)) return;
    this.eventBus.emit('effect:onPlay', { card, player });
    for (const eff of card.effects) {
      if (eff.timing === 'onPlay') await this._executeStructured(eff, card, player);
    }
  }

  async processOnKO(card, player) {
    // Check registry first
    if (this.registry.hasTiming(card.cardId, 'onKO')) {
      const cls = this.registry.get(card.cardId);
      const pid = this._findPid(player);
      const ctx = this._buildContext(card, pid, player, 'onKO');
      this.eventBus.emit('effect:onKO', { card, player });
      await new cls().execute(ctx);
      return;
    }
    // Fall back to structured effects array
    if (!card.effects || !Array.isArray(card.effects)) return;
    this.eventBus.emit('effect:onKO', { card, player });
    for (const eff of card.effects) {
      if (eff.timing === 'onKO') await this._executeStructured(eff, card, player);
    }
  }

  async processWhenAttacking(card, player) {
    // Check registry first
    const hasRegistryEffect = this.registry.hasTiming(card.cardId, 'whenAttacking');
    if (hasRegistryEffect) {
      const cls = this.registry.get(card.cardId);
      const pid = this._findPid(player);
      const ctx = this._buildContext(card, pid, player, 'whenAttacking');
      this.eventBus.emit('effect:whenAttacking', { card, player });
      await new cls().execute(ctx);
      return true;
    }
    // Fall back to structured effects array
    if (!card.effects || !Array.isArray(card.effects)) return false;
    this.eventBus.emit('effect:whenAttacking', { card, player });
    let executed = false;
    for (const eff of card.effects) {
      if (eff.timing === 'whenAttacking') {
        await this._executeStructured(eff, card, player);
        executed = true;
      }
    }
    return executed;
  }

  checkTrigger(drawnCard, player) {
    // Check registry
    if (this.registry.hasTiming(drawnCard.cardId, 'trigger')) {
      this.eventBus.emit('effect:trigger', { card: drawnCard, player });
      return true;
    }
    // Check structured effects
    if (drawnCard.effects && Array.isArray(drawnCard.effects)) {
      const triggers = drawnCard.effects.filter(e => e.timing === 'trigger');
      if (triggers.length > 0) {
        this.eventBus.emit('effect:trigger', { card: drawnCard, player, triggers });
        return true;
      }
    }
    // Fallback: check raw trigger property
    if (drawnCard.trigger && drawnCard.trigger.toLowerCase().includes('[trigger]')) {
      this.eventBus.emit('effect:trigger', { card: drawnCard, player });
      return true;
    }
    return false;
  }

  async resolveTrigger(card, player) {
    // Check registry first
    if (this.registry.hasTiming(card.cardId, 'trigger')) {
      const cls = this.registry.get(card.cardId);
      const pid = this._findPid(player);
      const ctx = this._buildContext(card, pid, player, 'trigger');
      await new cls().execute(ctx);
      return;
    }
    // Fall back to structured effects
    if (card.effects && Array.isArray(card.effects)) {
      for (const eff of card.effects) {
        if (eff.timing === 'trigger') await this._executeStructured(eff, card, player);
      }
      return;
    }
    // Fallback: parse raw trigger text
    await this._executeFallbackTrigger(card, player);
  }

  /** Execute trigger effect by parsing raw trigger text. */
  async _executeFallbackTrigger(card, player) {
    const txt = (card.trigger || '').toLowerCase();
    if (txt.includes('add') && txt.includes('don')) {
      await EFFECT_HANDLERS.addDON({ player, players: this.players, eventBus: this.eventBus }, {});
    }
    const drawMatch = txt.match(/draw\s*(\d+)/i);
    if (drawMatch) {
      Helpers.drawCards(player, parseInt(drawMatch[1]));
    } else if (txt.includes('draw')) {
      Helpers.drawCards(player, 1);
    }
  }

  checkCounter(card) {
    if (card.counter !== null && card.counter !== undefined) return true;
    if (card.effects && Array.isArray(card.effects)) {
      if (card.effects.some(e => e.timing === 'counter')) return true;
    }
    if (card.effect && card.effect.toLowerCase().includes('[counter]')) return true;
    return false;
  }

  oncePerTurnCheck(cardId) {
    const key = `${this.state.currentPlayer}_${cardId}_${this.state.turnCount}`;
    if (this.optTracker[key]) return false;
    this.optTracker[key] = true;
    return true;
  }

  // --- Legacy: processCardSpecificEffects (kept for compatibility) ---

  /**
   * Route card-specific effects. Checks registry, then structured effects.
   */
  async processCardSpecificEffects(card, pid, player, animManager, handRenderer, zoneRenderer, turnManager) {
    await this.processOnPlay(card, player);
  }

  // --- Structured effect execution ---

  async _executeStructured(eff, card, player) {
    if (eff.condition && !this._checkCondition(eff.condition, player)) return;
    const handler = EFFECT_HANDLERS[eff.type];
    if (!handler) return;
    await handler({
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

  _findPid(playerObj) {
    for (const [pid, p] of Object.entries(this.players)) {
      if (p === playerObj) return parseInt(pid);
    }
    return null;
  }

  /**
   * Register a turn-limited power modification.
   * The original power is restored at end of turn with count-down animation.
   */
  registerTurnPowerMod(card, originalPower, pid) {
    this._turnPowerMods.push({ card, originalPower, pid });
  }

  /**
   * Restore all turn-limited power modifications at end of turn.
   * Animates power count-down for each modified card.
   */
  async restoreTurnPowerMods() {
    if (this._turnPowerMods.length === 0) return;

    const mods = [...this._turnPowerMods];
    this._turnPowerMods = [];

    for (const mod of mods) {
      const { card, originalPower, pid } = mod;
      // DON bonus may still be displayed on screen (DON detach skips turn-mod cards)
      const donBonus = card.donAttached > 0 ? card.donAttached * 1000 : 0;
      const animFrom = (card.power || 0) + donBonus;
      const animTo = originalPower;
      if (animFrom === animTo) {
        continue;
      }

      // Find power text on field sprite
      const powerText = this._findPowerText(pid, card);
      if (powerText) {
        const hasDon = card.donAttached > 0;
        const fromColor = hasDon ? 0xffd700 : 0xffffff;
        await this.animManager.animatePowerCount(
          powerText, animFrom, animTo, 600,
          fromColor, fromColor, true
        );
      }

      card.power = originalPower;
    }
  }

  _findPowerText(pid, card) {
    const player = this.players[pid];
    if (!player) return null;

    // Check field slots
    const fieldIdx = player.field.indexOf(card);
    if (fieldIdx >= 0) {
      const zoneManager = this.animManager.ctx.zoneManager;
      const zone = zoneManager.getZone(pid, `field_slot_${fieldIdx}`);
      if (zone) {
        const sprite = zone.children.find(c => c.isFieldSprite);
        if (sprite) return sprite.children.find(c => c.isPowerText);
      }
    }

    // Check leader
    if (player.leader === card) {
      const zoneManager = this.animManager.ctx.zoneManager;
      const zone = zoneManager.getZone(pid, 'leader');
      if (zone) {
        const sprite = zone.children.find(c => c.isLeaderSprite);
        if (sprite) return sprite.children.find(c => c.isPowerText);
      }
    }

    return null;
  }
}

export default EffectSystem;
