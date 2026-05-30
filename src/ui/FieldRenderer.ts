class FieldRenderer {
  constructor(zoneManager, renderer, ui, players) {
    this.zoneManager = zoneManager;
    this.renderer = renderer;
    this.ui = ui;
    this.players = players;
  }

  renderField(pid, _onFieldCardClick) {
    this._renderFieldSlots(pid, _onFieldCardClick);
  }

  renderFieldWithInteraction(pid, onFieldCardDrag) {
    this._renderFieldSlots(pid, onFieldCardDrag);
  }

  _renderFieldSlots(pid, onFieldCardDrag) {
    const p = this.players[pid];

    for (let i = 0; i < 5; i++) {
      const slot = this.zoneManager.getZone(pid, `field_slot_${i}`);
      if (!slot) continue;
      const old = slot.children.find(c => c.isFieldSprite);
      if (old) slot.removeChild(old);
    }

    for (let i = 0; i < 5; i++) {
      const card = p.field[i];
      if (!card) continue;

      const slot = this.zoneManager.getZone(pid, `field_slot_${i}`);
      if (!slot) continue;

      const fieldCardSprite = this.renderer.render(card, false, 1.0);
      fieldCardSprite.name = `fieldCard_${pid}_${i}`;
      fieldCardSprite.isFieldSprite = true;
      fieldCardSprite.cardRef = card;
      fieldCardSprite.pivot.set(this.renderer.CARD_WIDTH / 2, this.renderer.CARD_HEIGHT / 2);
      fieldCardSprite.position.set(slot.width / 2, slot.height / 2);

      if (card.rested) this.renderer.markRested(fieldCardSprite);
      if (card.donAttached > 0) {
        const donBadge = this._makeDONBadge(card.donAttached);
        donBadge.name = `donBadge_${pid}_${i}`;
        fieldCardSprite.addChild(donBadge);
      }

      if (card.power != null) {
        const powerText = this.renderer.setPowerBadge(fieldCardSprite, card.currentPower || card.power, card.donAttached > 0);
        powerText.name = `powerText_${pid}_${i}`;
        powerText.isPowerText = true;
      }

      fieldCardSprite.on('pointerover', () => this.ui.showCardInfo(card, pid));

      if (pid === 1 && onFieldCardDrag) {
        const slotIndex = i;
        fieldCardSprite.on('pointerdown', (e) => onFieldCardDrag(e, pid, card, slotIndex));
      }

      slot.addChild(fieldCardSprite);
    }
  }

  renderLeaders() {
    for (const pid of [1, 2]) {
      this._renderLeader(pid);
    }
  }

  _renderLeader(pid) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'leader');
    if (!zone) return;

    const existingSprites = zone.children.filter(c => c.isLeaderSprite);
    existingSprites.forEach(c => zone.removeChild(c));

    const leaderCardSprite = this.renderer.render(p.leader, false, 1.5);
    leaderCardSprite.name = `leaderSprite_${pid}`;
    leaderCardSprite.isLeaderSprite = true;
    leaderCardSprite.cardRef = p.leader;
    leaderCardSprite.pivot.set(this.renderer.CARD_WIDTH / 2, this.renderer.CARD_HEIGHT / 2);
    leaderCardSprite.position.set(zone.width / 2, zone.height / 2);

    if (p.leader.rested) this.renderer.markRested(leaderCardSprite);
    else this.renderer.markActive(leaderCardSprite);

    if (p.leader.power != null) {
      const powerText = this.renderer.setPowerBadge(leaderCardSprite, p.leader.currentPower || p.leader.power, p.leader.donAttached > 0);
      powerText.name = `powerText_leader_${pid}`;
      powerText.isPowerText = true;
    }

    leaderCardSprite.on('pointerover', () => this.ui.showCardInfo(p.leader, pid));

    zone.addChild(leaderCardSprite);
  }



  bindLeaderInteraction(pid, onDragStart, onHover) {
    const leaderSprite = this.getLeaderSprite(pid);
    if (!leaderSprite) return;

    const existingListeners = leaderSprite.eventListeners || {};

    // Remove old listeners if re-binding
    if (existingListeners.dragStart) {
      leaderSprite.off('pointerdown', existingListeners.dragStart);
    }
    if (existingListeners.hover) {
      leaderSprite.off('pointerover', existingListeners.hover);
    }

    if (onDragStart && pid === 1) {
      leaderSprite.on('pointerdown', onDragStart);
      leaderSprite.eventListeners = leaderSprite.eventListeners || {};
      leaderSprite.eventListeners.dragStart = onDragStart;
    }
    if (onHover) {
      leaderSprite.on('pointerover', onHover);
      leaderSprite.eventListeners = leaderSprite.eventListeners || {};
      leaderSprite.eventListeners.hover = onHover;
    }
  }

  getLeaderSprite(pid) {
    const zone = this.zoneManager.getZone(pid, 'leader');
    if (!zone) return null;
    return zone.children.find(c => c.isLeaderSprite);
  }

  _makeDONBadge(count) {
    return new PIXI.Text({ text: String(count), style: {
      fontSize: 10,
      fill: 0xffd700,
      fontWeight: 'bold',
    }});
  }

}

export default FieldRenderer;
