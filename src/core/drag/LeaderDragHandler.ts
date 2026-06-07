import FieldCardDragHandler from './FieldCardDragHandler';

class LeaderDragHandler extends FieldCardDragHandler {
  get dragType() { return 'leader'; }

  getGhostScale() { return 1.3; }

  createGhost() {
    const leader = this._source?.leader;
    this._ghost = this.ctx.renderer.createDragGhost(leader, this.getGhostScale());
    this._ghost.name = `${this.dragType}DragGhost`;
    this.ctx.app.stage.addChild(this._ghost);
    if (this._sourceTarget) {
      this._sourceTarget.visible = false;
    }
  }

  resolveDrop(source, target) {
    const leaderTarget = target.type === 'leader'
      ? this.ctx.players[target.pid].leader
      : target.card;
    this._onCommit(source.pid, source.leader, leaderTarget, target.pid);
    return true;
  }
}

export default LeaderDragHandler;
