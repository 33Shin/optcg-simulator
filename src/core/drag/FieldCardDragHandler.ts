import BaseDragHandler from './BaseDragHandler';
import { isPointInZone } from '../animations/utils';

class FieldCardDragHandler extends BaseDragHandler {
  get dragType() { return 'fieldCard'; }

  createGhost() {
    const card = this._source?.card;
    this._ghost = this.ctx.renderer.createDragGhost(card, this.getGhostScale());
    this._ghost.name = `${this.dragType}DragGhost`;
    this.ctx.app.stage.addChild(this._ghost);
    if (this._sourceTarget) {
      this._sourceTarget.visible = false;
    }
  }

  getGhostScale() { return 0.8; }
  shouldAnimateDrop() { return true; }

  detectTarget(e) {
    const global = e.global;
    const { pid } = this._source;
    const opponentId = pid === 1 ? 2 : 1;

    // Check opponent field characters (rested)
    for (let i = 0; i < 5; i++) {
      const zone = this.ctx.gameBoard.getZone(opponentId, `field_slot_${i}`);
      if (!zone) continue;
      const card = this.ctx.players[opponentId].field[i];
      if (!card) continue;

      if (isPointInZone(zone, global)) {
        return { target: { type: 'field', card, slotIdx: i, pid: opponentId }, valid: card.rested };
      }
    }

    // Check opponent leader
    {
      const zone = this.ctx.gameBoard.getZone(opponentId, 'leader');
      if (zone && isPointInZone(zone, global)) {
        return { target: { type: 'leader', pid: opponentId }, valid: true };
      }
    }

    return { target: null, valid: false };
  }

  createHighlight(target) {
    let zone = null;
    if (target.type === 'field') {
      zone = this.ctx.gameBoard.getZone(target.pid, `field_slot_${target.slotIdx}`);
    } else if (target.type === 'leader') {
      zone = this.ctx.gameBoard.getZone(target.pid, 'leader');
    }

    if (!zone) return;
    this._highlight = this.ctx.renderer.createDropHighlight(zone.width, zone.height, 0xf44336);
    this._highlight.name = 'attackTargetHighlight';
    this._highlight.alpha = 0;
    zone.addChild(this._highlight);
    this._animateAlpha(this._highlight, 1, 120);
  }

  getDropTargetGlobal() {
    const target = this._target;
    if (!target) return null;

    let zone = null;
    if (target.type === 'field') {
      zone = this.ctx.gameBoard.getZone(target.pid, `field_slot_${target.slotIdx}`);
    } else if (target.type === 'leader') {
      zone = this.ctx.gameBoard.getZone(target.pid, 'leader');
    }

    if (!zone) return null;
    const center = new PIXI.Point(zone.x + zone.width / 2, zone.y + zone.height / 2);
    return this.ctx.app.stage.toGlobal(center);
  }

  resolveDrop(source, target) {
    const fieldTarget = target.type === 'leader'
      ? this.ctx.players[target.pid].leader
      : target.card;
    this._onCommit(source.pid, source.card, source.slotIdx, fieldTarget, target.pid);
    return true;
  }
}

export default FieldCardDragHandler;
