import { delay } from '../core/animations/utils';

const PHASES = ['refresh', 'draw', 'don', 'main', 'end'];

class TurnManager {
  constructor(state, eventBus, players, donSystem, effectSystem, player1DrawFirst, onDraw, onDrawDON, onRefresh) {
    this.state = state;
    this.eventBus = eventBus;
    this.players = players;
    this.donSystem = donSystem;
    this.effectSystem = effectSystem;
    this.firstTurn = true;
    this.player1DrawFirst = player1DrawFirst;
    this.onDraw = onDraw;
    this.onDrawDON = onDrawDON;
    this.onRefresh = onRefresh;
    this.phaseLocked = false;
    this.mainPhaseReady = false;
  }

  startTurn() {
    this.state.currentPlayer = this.player1DrawFirst ? 1 : 2;
    this.state.currentPhase = this.firstTurn ? 'don' : 'refresh';
    this._runPhases();
  }

  async _runPhases() {
    this.phaseLocked = true;
    this.state.phaseLocked = true;
    this.mainPhaseReady = false;

    let phase = this.state.currentPhase;

    while (PHASES.indexOf(phase) < PHASES.length - 1) {
      if (this.state.gameOver) break;
      this.state.currentPhase = phase;
      this.eventBus.emit('phase:change', { phase, player: this.state.currentPlayer });

      if (phase === 'refresh') {
        await this._refresh();
      } else if (phase === 'draw') {
        await this._draw();
      } else if (phase === 'don') {
        await this._donPhase();
      } else if (phase === 'main') {
        this.phaseLocked = false;
        this.state.phaseLocked = false;
        this.mainPhaseReady = true;
        this.eventBus.emit('main:ready', this.state);
        return;
      }

      const idx = PHASES.indexOf(phase);
      phase = PHASES[idx + 1];
    }
  }

  async _refresh() {
    await delay(400);
    const pid = this.state.currentPlayer;
    const player = this.players[pid];

    // Animate rested cards and DON tokens standing up (before clearing rested state)
    if (this.onRefresh) {
      await this.onRefresh(pid);
    }

    // Stand up rested characters
    for (const card of player.field) {
      if (card) {
        card.rested = false;
        card.playedThisTurn = false;
      }
    }
    // Reset leader
    player.leader.rested = false;

    // Return DON!! from attached characters to cost area as rested
    this.donSystem.returnAllDON(pid);

    // Stand up all DON tokens in cost area
    for (const don of player.costArea) {
      don.active = true;
      don.rested = false;
    }

    this.eventBus.emit('refresh:complete', { player: pid });
  }

  async _draw() {
    const pid = this.state.currentPlayer;
    const player = this.players[pid];

    if (player.deck.isEmpty()) {
      this.eventBus.emit('deck:empty', { player: pid });
      return;
    }

    const card = player.deck.draw();
    if (!card) return;

    // Check for trigger
    const hasTrigger = this.effectSystem.checkTrigger(card, player);

    if (hasTrigger) {
      this.effectSystem.resolveTrigger(card, player);
      this.eventBus.emit('trigger:show', { card, player: pid });
      await delay(800);
    }

    const handIdx = Math.floor(player.hand.length / 2);
    if (this.onDraw) {
      await this.onDraw(pid, card, handIdx);
    } else {
      player.hand.splice(handIdx, 0, card);
    }
    this.eventBus.emit('draw:complete', { card, player: pid });
  }

  async _donPhase() {
    await delay(400);
    const pid = this.state.currentPlayer;

    // Signal DON phase start so Game can reset animation state
    this.eventBus.emit('don:phaseStart', { player: pid });

    let count = 2;
    if (this.firstTurn) {
      count = 1;
    }

    for (let i = 0; i < count && this.players[pid].donDeck.length > 0; i++) {
      this.donSystem.drawDON(pid, 1);
      if (this.onDrawDON) {
        await this.onDrawDON(pid);
      }
    }
    this.eventBus.emit('don:complete', { player: pid, count });

    if (this.firstTurn) {
      this.firstTurn = false;
    }
  }

  async endTurn() {
    if (this.phaseLocked) return;
    this.phaseLocked = true;
    this.state.phaseLocked = true;
    this.mainPhaseReady = false;

    // Show "End" phase briefly on the phase bar before transitioning
    this.state.currentPhase = 'end';
    this.eventBus.emit('phase:change', { phase: 'end', player: this.state.currentPlayer });
    await delay(500);

    this.state.currentPlayer = this.state.currentPlayer === 1 ? 2 : 1;
    this.state.currentPhase = 'refresh';
    this.state.turnCount++;

    this.eventBus.emit('phase:change', { phase: 'refresh', player: this.state.currentPlayer });
    this._runPhases();
  }

  get canAct() {
    return !this.state.gameOver && !this.phaseLocked && this.mainPhaseReady && this.state.currentPhase === 'main';
  }

  get canPlayerAct() {
    return this.canAct && this.state.currentPlayer === 1;
  }

  get canOpponentAct() {
    return this.canAct && this.state.currentPlayer === 2;
  }

}

export default TurnManager;
