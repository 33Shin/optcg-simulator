class AttachDONInteraction {
  constructor(game) {
    this.game = game;
  }

  onDONTokenDrag(e, pid, donIdx, sprite) {
    const { turnManager, players, zoneRenderer, dragManager } = this.game;
    if (!turnManager.canAct || pid !== 1) return;

    const don = players[pid].costArea[donIdx];
    if (!don || !don.active || don.rested) return;

    zoneRenderer.beginDragDON(pid, donIdx);

    const onDragStarted = () => {
      if (sprite) sprite.alpha = 0;
    };

    dragManager.beginDragDON(
      pid, donIdx, e, null, onDragStarted,
      (_pid, _donIdx, _targetCard, _dropPos) => this.commitDONAttach(_pid, _targetCard),
      () => {
        zoneRenderer.endDragDON();
        if (sprite && sprite.parent) sprite.alpha = 1;
      }
    );

    e.data.eventMode = 'grabbed';
  }

  async commitDONAttach(pid, targetCard) {
    this.game._animating = true;
    try {
      await this._doCommitDONAttach(pid, targetCard);
    } finally {
      this.game._animating = false;
    }
  }

  async _doCommitDONAttach(pid, targetCard) {
    const { zoneRenderer, donSystem, animManager, ui, renderBatcher } = this.game;
    zoneRenderer.endDragDON();
    if (!targetCard) return;

    const oldPower = targetCard.currentPower || targetCard.power || 0;
    const newPower = oldPower + 1000;

    const targetZone = this.game.zoneManager.findZoneForCard(this.game.players, targetCard);
    const sprite = targetZone?.children?.find(c => c.isFieldSprite || c.isLeaderSprite);
    const powerText = sprite?.children?.find(c => c.isPowerText);
    const isAlreadyGold = powerText?.style?.fill === 0xffd700;

    donSystem.attachDON(pid, targetCard);

    // Re-render cost tokens so position animation starts in parallel with burst
    this.game._renderDONTokens();

    await Promise.all([
      animManager.animateDONBurst(targetZone),
      animManager.animatePowerCount(
        powerText, oldPower, newPower, 700,
        isAlreadyGold ? 0xffd700 : 0xffffff,
        0xffd700
      ),
    ]);

    ui.showCardInfo(targetCard, pid);
    renderBatcher.flushSync();
    this.game._renderAll();
  }
}

export default AttachDONInteraction;
