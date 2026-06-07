import EventBus from './EventBus';
import type Game from './Game';

class EventOrchestrator {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  setup() {
    this._setupPhaseListeners();
    this._setupRefreshListeners();
    this._setupMainReadyListeners();
    this._setupDrawListeners();
    this._setupDeckEmptyListeners();
    this._setupDONListeners();
    this._setupEffectListeners();
    this._setupBattleListeners();
    this._setupKOListeners();
  }

  _setupPhaseListeners() {
    this.game.eventBus.on('phase:change', async (data: any) => {
      if (data.phase) this.game.state.currentPhase = data.phase;
      this.game.ui.updatePhase();
      this.game.ui.updateTurn();
      if (data.phase !== 'main') this.game.ui.setEndTurnBtn(false);

      if (data.phase === 'end') await this._onPhaseEnd(data.player);
      if (data.phase === 'refresh') this._onPhaseRefresh(data.player);

      this.game.scheduleRender(() => {
        if (data.phase !== 'refresh') {
          this.game.renderCoordinator.renderDONTokens();
        }
        if (data.phase === 'end') {
          this.game.handRenderer.render(1);
          this.game.handRenderer.render(2);
        }
      });
    });
  }

  _setupRefreshListeners() {
    this.game.eventBus.on('refresh:complete', () => {
      this.game.scheduleRender(() => {
        if (this.game._playerAIEnabled) {
          this.game.fieldRenderer.renderField(1);
        } else {
          this.game.renderCoordinator.bindFieldInteraction(1);
        }
        this.game.fieldRenderer.renderField(2);
        this.game.fieldRenderer.renderLeaders();
        if (!this.game._playerAIEnabled) {
          this.game.renderCoordinator.bindLeaderInteraction(1);
        }
        this.game.renderCoordinator.renderDONTokens();
        this.game.zoneRenderer.renderAll();
        this.game.zoneRenderer.renderLifeIndicatorsBoth();
      });
    });
  }

  _setupMainReadyListeners() {
    this.game.eventBus.on('main:ready', () => {
      if (this.game.state.gameOver) return;

      const pid = this.game.state.currentPlayer;
      const p = this.game.players[pid];
      for (const card of p.field) {
        if (card) card._donBonusActive = true;
      }
      if (p.leader) p.leader._donBonusActive = true;

      if (!this.game._playerAIEnabled) {
        this.game.renderCoordinator.bindHandInteraction(1);
        this.game.renderCoordinator.bindFieldInteraction(1);
        this.game.ui.setEndTurnBtn(this.game.state.currentPlayer === 1);
      }

      this.game.scheduleRender(() => {
        if (pid === 1 && !this.game._playerAIEnabled) {
          this.game.renderCoordinator.bindFieldInteraction(pid);
        } else {
          this.game.fieldRenderer.renderField(pid);
        }
        this.game.fieldRenderer.renderLeaders();
        if (!this.game._playerAIEnabled) {
          this.game.renderCoordinator.bindLeaderInteraction(1);
        }
        this.game.renderCoordinator.renderDONTokens();
      });

      if (this.game.state.currentPlayer === 2 || this.game._playerAIEnabled) {
        this.game._aiTurn();
      }
    });
  }

  _setupDrawListeners() {
    this.game.eventBus.on('draw:complete', () => {
      this.game.scheduleRender(() => {
        this.game.handRenderer.render(this.game.state.currentPlayer);
        this.game.zoneRenderer.renderAll();
      });
    });
  }

  _setupDeckEmptyListeners() {
    this.game.eventBus.on('deck:empty', (data: any) => {
      this.game.gameStateManager.triggerGameOver(data.player === 1 ? 2 : 1);
    });
  }

  _setupDONListeners() {
    this.game.eventBus.on('don:phaseStart', (data: any) => {
      const pid = data.player;
      this.game.guards.resetDONVisibleCount(pid, this.game.players[pid].costArea.length);
    });

    this.game.eventBus.on('don:drawn', async (data: any) => {
      await this._animateDONSlam(data.playerId);
    });
  }

  _setupEffectListeners() {
    this.game.eventBus.on('effect:addDON', async (data: any) => {
      await this.game.animManager.animateDONDraw(data.playerId);
      await this._animateDONSlam(data.playerId);
    });

    this.game.eventBus.on('effect:onPlay', () => {
      this.game.scheduleRender(() => this.game.renderCoordinator.renderAll());
    });

    this.game.eventBus.on('effect:onKO', () => {
      this.game.scheduleRender(() => this.game.renderCoordinator.renderFieldsAndZones());
    });

    this.game.eventBus.on('effect:trigger', () => {
      this.game.scheduleRender(() => this.game.renderCoordinator.renderAll());
    });
  }

  _setupBattleListeners() {
    this.game.eventBus.on('leader:damage', async (data: any) => {
      const pid = this.game.gameStateManager.findPid(data.player);
      if (!pid) return;
      const player = this.game.players[pid];
      const damageCard = data.damageCard;
      const sourceZoneId = data.source || 'deck';

      this.game._animating = true;
      if (this.game.ui?.actionButton) {
        this.game.ui.actionButton._inBattle = true;
      }

      if (sourceZoneId === 'life') {
        this.game.zoneRenderer.renderLifeFor(pid);
      }

      const hasTrigger = damageCard && this.game.effectSystem.checkTrigger(damageCard, player);
      let playedTrigger = false;

      if (hasTrigger) {
        if (pid === 1 && !this.game._playerAIEnabled) {
          const result = await this.game.animManager.damageTrigger.animate(pid, player, damageCard, true, sourceZoneId);
          playedTrigger = result.played;
          if (playedTrigger) {
            await this.game.effectSystem.resolveTrigger(damageCard, player);
            player.trash.push(damageCard);
            this.game.zoneRenderer._renderTrash(pid);
            this.game.scheduleRender(() => this.game.renderCoordinator.renderAll());
          }
        } else {
          playedTrigger = this.game.ai.shouldPlayDamageTrigger(damageCard, player);
          if (playedTrigger) {
            await this.game.effectSystem.resolveTrigger(damageCard, player);
          }
          await this.game.animManager.damageTrigger.animateAI(pid, player, damageCard, true, playedTrigger, sourceZoneId);
        }
      } else if (damageCard) {
        if (pid === 1 && !this.game._playerAIEnabled) {
          await this.game.animManager.damageTrigger.animate(pid, player, damageCard, false, sourceZoneId);
        } else {
          await this.game.animManager.damageTrigger.animateAI(pid, player, damageCard, false, false, sourceZoneId);
        }
      }

      this.game.state.leaderDamage = this.game.state.leaderDamage || {};
      if (sourceZoneId === 'deck') {
        this.game.state.leaderDamage[pid] = (this.game.state.leaderDamage[pid] || 0) + 1;
      }
      this.game.gameStateManager.checkWinCondition(pid);
    });
  }

  _setupKOListeners() {
    this.game.eventBus.on('card:KO', () => {
      this.game.scheduleRender(() => this.game.renderCoordinator.renderFieldsAndZones());
    });
  }

  // --- DON animation coordination ---

  async _animateDONSlam(pid: number) {
    if (!this.game.guards.animatingDONDraw) {
      this.game.guards.incrementDONVisible(pid);
    }
    this.game.guards.incrementSlam();
    try {
      await this.game.animManager.animateDONSlam(pid, this.game.guards.getDONVisible(pid));
    } finally {
      this.game.guards.decrementSlam();
    }
  }

  async _onTurnDrawDON(pid: number) {
    try {
      if (!this.game.guards.animatingDONDraw) {
        this.game.guards.animatingDONDraw = true;
        await this.game.animManager.animateDONDraw(pid);
      }
      await this.game.guards.waitForPendingSlams();
      this.game.guards.resetDONVisibleCount(pid, this.game.players[pid].costArea.length);
    } finally {
      this.game.guards.animatingDONDraw = false;
    }
  }

  // --- Phase handlers ---

  async _onPhaseEnd(pid: number) {
    await this.game.animManager.animateDONDetach(pid);

    const p = this.game.players[pid];
    for (const card of p.field) {
      if (card) card._donBonusActive = false;
    }
    if (p.leader) p.leader._donBonusActive = false;

    await this.game.effectSystem.restoreTurnPowerMods();

    this.game.scheduleRender(() => {
      this.game.fieldRenderer.renderField(pid);
      this.game.fieldRenderer.renderLeaders();
    });
  }

  _onPhaseRefresh(_pid: number) {
    // DON return + stand-up handled by TurnManager.returnAllDON() + ActiveAnimation
  }
}

export default EventOrchestrator;
