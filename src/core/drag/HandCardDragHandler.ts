import BaseDragHandler from './BaseDragHandler';
import { isPointInZone } from '../animations/utils';

class HandCardDragHandler extends BaseDragHandler {
  get dragType() { return 'handCard'; }

  _counterPhaseActive = false;

  beginDrag(source, e, onCommit, onCancel, onDragStarted, options = {}) {
    this._counterPhaseActive = !!options?.inCounterPhase;
    super.beginDrag(source, e, onCommit, onCancel, onDragStarted, options);
  }

  computeSnapBackPos(source) {
    if (source?.ghostPos) {
      return this.ctx.app.stage.toLocal(new PIXI.Point(source.ghostPos.x, source.ghostPos.y));
    }
    return null;
  }

  createGhost() {
    const card = this._source?.card;
    this._ghost = this.ctx.renderer.createDragGhost(card, this.getGhostScale());
    this._ghost.name = `${this.dragType}DragGhost`;
    this.ctx.app.stage.addChild(this._ghost);
    if (this._sourceTarget) {
      this._sourceTarget.visible = false;
    }
  }

  getGhostScale() { return 0.95; }

  detectTarget(e) {
    if (this._counterPhaseActive) {
      return { target: null, valid: false };
    }

    const global = e.global;
    const { pid } = this._source;
    const player = this.ctx.players[pid];
    const hasEmptySlot = player.field.some(c => c === null);

    for (let i = 0; i < 5; i++) {
      const zone = this.ctx.gameBoard.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;

      if (isPointInZone(zone, global)) {
        if (hasEmptySlot && player.field[i] !== null) {
          return { target: i, valid: false };
        }
        return { target: i, valid: true };
      }
    }
    return { target: null, valid: false };
  }

  createHighlight(target) {
    const { pid } = this._source;
    const zone = this.ctx.gameBoard.getZone(pid, `field_slot_${target}`);
    if (!zone) return;

    this._highlight = this.ctx.renderer.createDropHighlight(zone.width, zone.height, 0x4CAF50);
    this._highlight.name = 'fieldSlotHighlight';
    this._highlight.alpha = 0;
    zone.addChild(this._highlight);
    this._animateAlpha(this._highlight, 1, 120);
  }

  needsSlotBorders() { return !this._counterPhaseActive; }

  createSlotBorders() {
    this.removeSlotBorders();
    const { pid } = this._source;
    const player = this.ctx.players[pid];
    const hasEmptySlot = player.field.some(c => c === null);

    for (let i = 0; i < 5; i++) {
      const zone = this.ctx.gameBoard.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;
      if (hasEmptySlot && player.field[i] !== null) continue;

      const border = this.ctx.renderer.createSlotBorder(zone.width, zone.height, 0x4CAF50);
      border.name = `slotBorder_${pid}_${i}`;
      zone.addChild(border);
      this._slotBorders.push(border);
    }
  }

  resolveDrop(source, target) {
    const res = this._onCommit(source.pid, source.card, source.handIdx, target);

    // Sync failure
    if (res === false) return false;

    // Async — handle in base class _handleAsyncResolve
    if (res && typeof res.then === 'function') {
      return res.then((r) => {
        if (r === false) return false;
        this._commitSucceeded = true;
        return true;
      });
    }

    // Sync success
    if (res !== undefined) {
      this._commitSucceeded = true;
    }
    return true;
  }

  isDropCancelled(source, e) {
    if (!this._counterPhaseActive) return false;
    const handZone = this.ctx.gameBoard.getZone(source.pid, 'hand');
    return handZone ? isPointInZone(handZone, e.global) : false;
  }

  resetCounterPhase() {
    this._counterPhaseActive = false;
    if (this._dragging) {
      this._cleanupDrag();
    }
  }
}

export default HandCardDragHandler;
