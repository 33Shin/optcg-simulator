import type Game from './Game';

class RenderCoordinator {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** Schedule a render callback, coalesced by RenderBatcher. */
  scheduleRender(cb: () => void) {
    this.game.renderBatcher.schedule(cb);
  }

  /** Render both field slots and zone counts. */
  renderFieldsAndZones() {
    this.game.fieldRenderer.renderField(1);
    this.game.fieldRenderer.renderField(2);
    this.game.zoneRenderer.renderAll();
  }

  /** Render everything: hands, fields, leaders, DON tokens, zones, life indicators. */
  renderAll() {
    this.bindHandInteraction(1);
    this.game.handRenderer.render(2);
    this.bindFieldInteraction(1);
    this.game.fieldRenderer.renderField(2);
    this.game.fieldRenderer.renderLeaders();
    this.renderDONTokens();
    this.game.zoneRenderer.renderAll();
    this.game.zoneRenderer.renderLifeIndicatorsBoth();
    this.bindLeaderInteraction(1);
  }

  /** Render DON cost tokens for both players. */
  renderDONTokens() {
    this.game.zoneRenderer.renderCostTokensInteractive(
      1, this.game.turnManager.canPlayerAct,
      (...args: any[]) => this.game.attachDONInteraction.onDONTokenDrag(...args)
    );
    this.game.zoneRenderer.renderCostTokens(2);
  }

  // --- Interaction binding ---

  /** Bind hand card drag interaction for a player. */
  bindHandInteraction(playerId: number) {
    this.game.handRenderer.renderWithInteraction(
      playerId,
      (...args: any[]) => this.game.playCardInteraction.onHandCardDrag(...args),
      this.game.turnManager.canPlayerAct
    );
  }

  /** Bind field card drag interaction for a player. */
  bindFieldInteraction(pid: number) {
    this.game.fieldRenderer.renderFieldWithInteraction(
      pid,
      (...args: any[]) => this.game.attackInteraction.onFieldCardDrag(...args)
    );
  }

  /** Bind leader drag interaction for a player. */
  bindLeaderInteraction(pid: number) {
    this.game.fieldRenderer.bindLeaderInteraction(
      pid,
      (e: any) => this.game.attackInteraction.onLeaderDrag(e, pid),
      () => this.game.ui.showCardInfo(this.game.players[pid].leader, pid)
    );
  }
}

export default RenderCoordinator;
