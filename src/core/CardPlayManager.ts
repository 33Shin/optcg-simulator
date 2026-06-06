class CardPlayManager {
  constructor(players, donSystem, effectSystem, zoneRenderer, handRenderer, fieldRenderer, ui, battleManager) {
    this.players = players;
    this.donSystem = donSystem;
    this.effectSystem = effectSystem;
    this.zoneRenderer = zoneRenderer;
    this.handRenderer = handRenderer;
    this.fieldRenderer = fieldRenderer;
    this.ui = ui;
    this.battleManager = battleManager;
  }

  canPay(pid, cost) {
    const player = this.players[pid];
    return player.costArea.filter(d => d.active && !d.rested).length >= cost;
  }

  canPlay(pid, card) {
    const player = this.players[pid];
    if (card.category === 'character') {
      const fieldCount = player.field.filter(c => c !== null).length;
      if (fieldCount >= 5) return { ok: false, msg: 'Field is full (max 5)!' };
      const cost = card.cost || 0;
      if (!this.canPay(pid, cost)) return { ok: false, msg: `Need ${cost} DON!! to play this card!` };
    }
    if (card.category === 'event') {
      if (card.timing && card.timing.length === 1 && card.timing[0] === 'counter') {
        return { ok: false, msg: 'Counter events can only be played during opponent\'s attack!' };
      }
      const cost = card.cost || 0;
      if (!this.canPay(pid, cost)) return { ok: false, msg: `Need ${cost} DON!! to play this event!` };
    }
    if (card.category === 'stage') {
      const cost = card.cost || 0;
      if (!this.canPay(pid, cost)) return { ok: false, msg: `Need ${cost} DON!! to play this stage!` };
    }
    return { ok: true };
  }

  removeFromHand(player, card) {
    const idx = player.hand.indexOf(card);
    if (idx !== -1) player.hand.splice(idx, 1);
  }

  payDONCost(pid, cost) {
    this.donSystem.restDON(pid, cost || 0);
  }

  async play(card, pid) {
    const player = this.players[pid];
    if (card.category === 'character') await this._playCharacter(card, player, pid);
    else if (card.category === 'event') await this._playEvent(card, player, pid);
    else if (card.category === 'stage') await this._playStage(card, player, pid);
  }

  async _playCharacter(card, player, pid) {
    const slotIdx = player.field.indexOf(null);
    if (slotIdx === -1) {
      return;
    }

    this.payDONCost(pid, card.cost);
    this.removeFromHand(player, card);

    player.field[slotIdx] = card;
    card.rested = false;

    this.handRenderer.render(pid);
    this.fieldRenderer.renderField(pid);
    this.zoneRenderer.renderCostTokens(pid);
    await this.effectSystem.processOnPlay(card, player);
  }

  async _playEvent(card, player, pid) {
    this.payDONCost(pid, card.cost);
    this.removeFromHand(player, card);
    player.trash.push(card);

    this.handRenderer.render(pid);
    this.zoneRenderer.renderAll();
    this.zoneRenderer.renderCostTokens(pid);
    this.ui.showCardInfo(card, pid);
    await this.effectSystem.processOnPlay(card, player);
  }

  async _playStage(card, player, pid) {
    this.payDONCost(pid, card.cost);
    this.removeFromHand(player, card);

    if (player.stage) player.trash.push(player.stage);
    player.stage = card;

    this.zoneRenderer.renderStage(pid, card);
    this.handRenderer.render(pid);
    this.zoneRenderer.renderCostTokens(pid);
    this.zoneRenderer.renderAll();
    await this.effectSystem.processOnPlay(card, player);
    this.ui.showCardInfo(card, pid);
  }
}

export default CardPlayManager;
