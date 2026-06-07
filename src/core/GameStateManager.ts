import type { GameState } from '../types/game';
import type Game from './Game';

class GameStateManager {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** Initialize game state object. */
  initState(): GameState {
    return {
      turnCount: 0,
      currentPlayer: 1,
      currentPhase: null,
      phaseLocked: false,
      gameOver: false,
      winner: null,
      battle: null,
      leaderDamage: { 1: 0, 2: 0 },
    };
  }

  /** Setup ready glow ticker for hand rendering. */
  setupReadyGlowTicker() {
    this.game._readyGlowTicker = () => this.game.handRenderer.updateReadyGlow(1);
    this.game.app.ticker.add(this.game._readyGlowTicker);
  }

  /** Find player ID from player object reference. */
  findPid(playerObj: any): number | null {
    if (!playerObj) return null;
    for (const [pid, p] of Object.entries(this.game.players)) {
      if (p === playerObj) return parseInt(pid);
    }
    return null;
  }

  /** Trigger game-over flow: set state, cleanup, cancel animations, show overlay. */
  triggerGameOver(winnerPid: number) {
    this.game.state.gameOver = true;
    this.game.state.winner = winnerPid;
    this.game.ui.updatePhase();
    this._cleanup();
    this.game.animManager.cancelBlockerActivate();
    this.game.animManager.cancelBlockerRest();
    this.game.dragManager.cancel();
    this.game.renderBatcher.cancel();
    this.game.combatZone.hide();
    this.game.gameOverOverlay.show(winnerPid);
  }

  /** Check win condition: if damage > 0, trigger game over for opponent. */
  checkWinCondition(damagedPid: number) {
    const damage = this.game.state.leaderDamage[damagedPid] || 0;
    if (damage > 0) {
      this.triggerGameOver(damagedPid === 1 ? 2 : 1);
    }
  }

  /** Clean up game resources: tickers, animations. */
  _cleanup() {
    if (this.game._readyGlowTicker) {
      this.game.app.ticker.remove(this.game._readyGlowTicker);
      this.game._readyGlowTicker = null;
    }
    if (this.game.ui?.phaseZone?._phaseTicker) {
      this.game.app.ticker.remove(this.game.ui.phaseZone._phaseTicker);
    }
    if (this.game.ui?.actionButton?._actionTicker) {
      this.game.app.ticker.remove(this.game.ui.actionButton._actionTicker);
    }
    this.game.animManager.attack?._stopFloatAnimation?.();
  }
}

export default GameStateManager;
