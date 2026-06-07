import BaseDragHandler from './BaseDragHandler';
import { isPointInZone } from '../animations/utils';

class EventCardDragHandler extends BaseDragHandler {
  get dragType() { return 'eventCard'; }

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
    const { pid } = this._source;
    const droppedInHand = this._isDropInsideHandZone(e, pid);
    return { target: null, valid: !droppedInHand };
  }

  _isDropInsideHandZone(e, pid) {
    const handZone = this.ctx.gameBoard.getZone(pid, 'hand');
    return handZone ? isPointInZone(handZone, e.global) : false;
  }

  createHighlight() {
    this._highlight = new PIXI.Graphics();
    this._highlight.name = 'eventDropHighlight';
    this._highlight.rect(0, 0, this.ctx.app.renderer.width, this.ctx.app.renderer.height)
                  .fill({ color: 0x00ff88, alpha: 0.15 });
    this._highlight.eventMode = 'none';
    this._highlight.alpha = 0;
    this.ctx.app.stage.addChildAt(this._highlight, 0);
    this._animateAlpha(this._highlight, 1, 120);
  }

  resolveDrop(source, target, dropPos) {
    const res = this._onCommit(source.pid, source.card, source.handIdx, dropPos);

    if (res === false) return false;

    if (res && typeof res.then === 'function') {
      return res.then((r) => {
        if (r === false) return false;
        this._commitSucceeded = true;
        return true;
      });
    }

    this._commitSucceeded = true;
    return true;
  }

  isDropCancelled(source, e) {
    return this._isDropInsideHandZone(e, source.pid);
  }
}

export default EventCardDragHandler;
