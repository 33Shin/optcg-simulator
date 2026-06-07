import BaseDragHandler from './BaseDragHandler';
import { isPointInZone } from '../animations/utils';

class DONTokenDragHandler extends BaseDragHandler {
  get dragType() { return 'donToken'; }

  computeSnapBackPos(source) {
    const costZone = this.ctx.gameBoard.getZone(source.pid, 'cost');
    if (!costZone) return null;

    const tokenW = 36, gap = 10;
    const numTokens = Math.max(this.ctx.players[source.pid].costArea.length, 10);
    const totalW = numTokens * tokenW + (numTokens - 1) * gap;
    const startX = (costZone.width - totalW) / 2;
    const yOff = (40 - tokenW) / 2;
    const localX = startX + source.donIdx * (tokenW + gap) + tokenW / 2;
    const localY = yOff + tokenW / 2;
    const globalPos = costZone.toGlobal(new PIXI.Point(localX, localY));
    return this.ctx.app.stage.toLocal(globalPos);
  }

  createGhost() {
    this._ghost = this.ctx.renderer.createDONGhost();
    this._ghost.name = 'donTokenDragGhost';
    this.ctx.app.stage.addChild(this._ghost);
    if (this._source?.sprite && this._source.sprite.visible) {
      this._source.sprite.visible = false;
    }
  }

  getGhostScale() { return 1; }

  detectTarget(e) {
    const global = e.global;
    const { pid } = this._source;

    // Check own field characters
    for (let i = 0; i < 5; i++) {
      const zone = this.ctx.gameBoard.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;
      const card = this.ctx.players[pid].field[i];
      if (!card) continue;

      if (isPointInZone(zone, global)) {
        return { target: card, valid: true };
      }
    }

    // Check own leader
    {
      const zone = this.ctx.gameBoard.getZone(pid, 'leader');
      if (zone && isPointInZone(zone, global)) {
        return { target: this.ctx.players[pid].leader, valid: true };
      }
    }

    return { target: null, valid: false };
  }

  createHighlight(target) {
    const zone = this.ctx.zoneManager.findZoneForCard(this.ctx.players, target);
    if (!zone) return;

    this._highlight = this.ctx.renderer.createDropHighlight(zone.width, zone.height, 0x4CAF50);
    this._highlight.name = 'targetCardHighlight';
    this._highlight.alpha = 0;
    zone.addChild(this._highlight);
    this._animateAlpha(this._highlight, 1, 120);
  }

  resolveDrop(source, target) {
    // DON: immediate commit, no animation
    this._onCommit(source.pid, source.donIdx, target, null);
    this._commitSucceeded = true;
    // Remove ghost immediately (base class won't animate)
    if (this._ghost && this._ghost.parent) {
      this._ghost.parent.removeChild(this._ghost);
    }
    return true;
  }

  _cleanupDrag() {
    super._cleanupDrag();
    // Restore DON sprite on cancel (commit already removed ghost on success)
    if (this._source?.sprite && !this._commitSucceeded) {
      this._source.sprite.visible = true;
    }
  }
}

export default DONTokenDragHandler;
