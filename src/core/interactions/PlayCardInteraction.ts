class PlayCardInteraction {
  constructor(game) {
    this.game = game;
  }

  onHandCardDrag(pointerEvent, playerId, card, handIdx) {
    if (this.game._animating) return;
    const { turnManager, ui } = this.game;
    if (!turnManager.canAct || playerId !== 1) {
      ui.showCardInfo(card, playerId);
      return;
    }
    if (card.category !== 'character') {
      ui.showCardInfoWithPlay(card, playerId, () => this.game._playCard(card, playerId));
      return;
    }

    const { handRenderer, zoneManager } = this.game;
    const handZone = zoneManager.getZone(playerId, 'hand');
    const layout = handRenderer.computeLayout(handZone, this.game.players[playerId].hand.length);
    const snapPosition = layout ? layout.positions[handIdx] : { x: 600, y: 700 };
    const ghostPosition = handZone.toGlobal(
      new PIXI.Point(snapPosition.x + (layout?.cardW ?? 100) / 2, snapPosition.y + (layout?.cardH ?? 140) / 2)
    );

    this.game.dragManager.beginDragHandCard(
      playerId, card, handIdx, ghostPosition, pointerEvent,
      (_pid, _card, _handIdx, _slotIdx) => this.commitPlayToField(_pid, _card, _slotIdx),
      (_pid, _card, _handIdx) => this.snapBackToHand(_pid, _card, _handIdx),
      () => {
        const sprite = handRenderer.handSprites[playerId]?.[handIdx];
        if (sprite) sprite.visible = false;
        handRenderer.clearAllReadyGlow(playerId);
      },
      false // not in counter phase
    );

    pointerEvent.data.eventMode = 'grabbed';
  }

  snapBackToHand(pid, card, handIdx) {
    if (!card) return;
    const { handRenderer, turnManager } = this.game;
    const sprite = handRenderer.handSprites[pid]?.[handIdx];
    if (sprite) sprite.visible = true;
    handRenderer.renderWithInteraction(pid, (...args) => this.onHandCardDrag(...args), turnManager.canPlayerAct);
  }

  async commitPlayToField(pid, card, slotIdx) {
    if (slotIdx == null) return false;
    const { cardPlayManager, donSystem, players, zoneManager, handRenderer, fieldRenderer, zoneRenderer, effectSystem, animManager, ui, renderBatcher } = this.game;
    const player = players[pid];
    // Cannot trash a character if empty slots are available — must play into an empty slot first
    const hasEmptySlot = player.field.some(c => c === null);
    if (hasEmptySlot && player.field[slotIdx] !== null) return false;
    const cost = card.cost || 0;
    if (!cardPlayManager.canPay(pid, cost)) return false;
    this.game._animating = true;
    try {
      await this._doCommitPlayToField(pid, card, slotIdx);
    } catch (_err) {
    } finally {
      this.game._animating = false;
    }
  }

  async _doCommitPlayToField(pid, card, slotIdx) {
    const { donSystem, players, zoneManager, handRenderer, fieldRenderer, zoneRenderer, effectSystem, animManager, ui, renderBatcher, turnManager } = this.game;
    const player = players[pid];

    const fieldSlot = zoneManager.getZone(pid, `field_slot_${slotIdx}`);

    // Pay DON cost — capture DON indices BEFORE resting for animation
    const cost = card.cost || 0;

    const restIndices = [];
    let remaining = cost;
    for (let i = 0; i < player.costArea.length && remaining > 0; i++) {
      if (player.costArea[i].active && !player.costArea[i].rested) {
        restIndices.push(i);
        remaining--;
      }
    }

    donSystem.restDON(pid, cost);

    // Start DON rest animation (will run in parallel with slam)
    let donRestAnim = Promise.resolve();
    if (cost > 0 && restIndices.length > 0 && animManager) {
      donRestAnim = animManager.animateDONRest(pid, cost, restIndices);
    }

    // Remove from hand
    const handIdx = player.hand.indexOf(card);
    if (handIdx !== -1) player.hand.splice(handIdx, 1);

    // If slot occupied, KO old card and animate to trash
    const oldCard = player.field[slotIdx];
    let trashAnim = Promise.resolve();
    if (oldCard) {
      const donCount = oldCard.donAttached || 0;
      donSystem.returnDONs(pid, oldCard);
      effectSystem.processOnKO(oldCard, player);
      player.trash.push(oldCard);
      player.field[slotIdx] = null;
      if (donCount > 0 && animManager) {
        await animManager.animateDONReturnOnKO(pid, fieldSlot, donCount);
      }
      if (animManager.flyToTrash) {
        trashAnim = animManager.flyToTrash.animate(pid, oldCard, fieldSlot).then(() => {
          this.game.scheduleRender(() => {
            fieldRenderer.renderField(pid);
            zoneRenderer.renderAll();
          });
        });
      }
    }

    handRenderer.renderCardRemoved(pid, handIdx, (...args) => this.onHandCardDrag(...args));
    zoneRenderer.renderCostTokens(pid);

    // Slam animation (parallel with DON rest and trash)
    let slamAnim = Promise.resolve();
    if (animManager.slam && fieldSlot) {
      slamAnim = animManager.slam.animate(pid, card, fieldSlot);
    }
    await Promise.all([donRestAnim, trashAnim, slamAnim]);

    // Place new card on field
    player.field[slotIdx] = card;
    card.rested = false;
    card.playedThisTurn = true;

    fieldRenderer.renderFieldWithInteraction(pid, (...args) => this.game.attackInteraction.onFieldCardDrag(...args));
    zoneRenderer.renderAll();

    // Play ability activation animation only if card has on-play effects
    const hasOnPlayStructured = card.effects && Array.isArray(card.effects) && card.effects.some(e => e.timing === 'onPlay');
    const hasOnPlayRaw = card.effect && typeof card.effect === 'string' && /\[on\s*play\]/i.test(card.effect);
    if (hasOnPlayStructured || hasOnPlayRaw) {
      await animManager.abilityActivate.animate(pid, card, fieldSlot);
    }

    fieldRenderer.renderFieldWithInteraction(pid, (...args) => this.game.attackInteraction.onFieldCardDrag(...args));
    zoneRenderer.renderAll();

    // Process on-play effects (card-specific or generic)
    await effectSystem.processCardSpecificEffects(
      card, pid, player,
      animManager, handRenderer, zoneRenderer, turnManager
    );

    // Re-render zones after effects may have modified trash/deck/life
    zoneRenderer.renderAll();

    // Re-bind all interactions after play completes
    this.game._renderDONTokens();
    this.game._bindHandInteraction(pid);
    ui.showCardInfo(card, pid);
    renderBatcher.flushSync();
  }
}

export default PlayCardInteraction;
