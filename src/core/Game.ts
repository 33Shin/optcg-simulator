import GameBoard from '../ui/GameBoard';
import UIComponents from '../ui/UIComponents';
import ZoneManager from '../ui/ZoneManager';
import CardRenderer from '../ui/CardRenderer';
import HandRenderer from '../ui/HandRenderer';
import FieldRenderer from '../ui/FieldRenderer';
import ZoneRenderer from '../ui/ZoneRenderer';
import AnimationManager from '../core/AnimationManager';
import BattleManager from '../core/BattleManager';
import DragManager from '../core/DragManager';
import CardPlayManager from '../core/CardPlayManager';
import DONSystem from '../game-systems/DONSystem';
import TurnManager from '../game-systems/TurnManager';
import EffectSystem from '../game-systems/EffectSystem';
import CombatSystem from '../game-systems/CombatSystem';
import AI from '../ai-behaviour/AI';
import SelectionOverlay from '../ui/SelectionOverlay';
import RenderBatcher from '../core/RenderBatcher';
import PlayCardInteraction from '../core/interactions/PlayCardInteraction';
import AttachDONInteraction from '../core/interactions/AttachDONInteraction';
import AttackInteraction from '../core/interactions/AttackInteraction';
import CounterPhaseOverlay from '../ui/CounterPhaseOverlay';
import CombatZone from '../ui/CombatZone';
import GameOverOverlay from '../ui/GameOverOverlay';

class Game {
  constructor({ app, eventBus, p1Deck, p2Deck }) {
    this.app = app;
    this.eventBus = eventBus;

    this.state = {
      turnCount: 0,
      currentPlayer: 1,
      currentPhase: null,
      phaseLocked: false,
      gameOver: false,
      winner: null,
      battle: null,
      leaderDamage: { 1: 0, 2: 0 },
    };

    this.players = {
      1: this._createPlayer(p1Deck),
      2: this._createPlayer(p2Deck),
    };

    // Game board & zones
    this.gameBoard = new GameBoard(app);
    this.zoneManager = new ZoneManager(app, this.gameBoard);

    // UI
    this.ui = new UIComponents(app, this.state, this);

    // Renderers
    this.renderer = new CardRenderer();
    this.handRenderer = new HandRenderer(this.zoneManager, this.renderer, this.ui, this.players);
    this.fieldRenderer = new FieldRenderer(this.zoneManager, this.renderer, this.ui, this.players);
    this.zoneRenderer = new ZoneRenderer(this.zoneManager, this.renderer, this.players, this.ui);

    // Selection overlay
    this.selectionOverlay = new SelectionOverlay(app, this.renderer);

    // Counter phase overlay (initialized after animManager)
    this.counterPhaseOverlay = null;

    // Render batching — coalesces multiple render calls into one frame
    // (initialized after dragManager so we can pass isBusy guard)

    // Game systems
    this.donSystem = new DONSystem(this.players, eventBus);
    this.effectSystem = new EffectSystem(this.state, this.players, eventBus);
    this.combatSystem = new CombatSystem(this.state, this.players, eventBus);

    // AI (created before animManager so it's available in animation context)
    this.ai = new AI(this);

    // Managers
    this.animManager = new AnimationManager(
      app, this.gameBoard, this.zoneManager, this.renderer, this.players,
      this.handRenderer, this.zoneRenderer, this.donSystem, this.ui, this.ai, this
    );

    // Counter phase overlay (needs animManager, handRenderer)
    this.counterPhaseOverlay = new CounterPhaseOverlay(
      app, this.gameBoard, this.zoneManager, this.renderer, this.players, this.animManager, this.ui, this.handRenderer
    );

    // Combat zone overlay
    this.combatZone = new CombatZone(app);

    // Game over overlay
    this.gameOverOverlay = new GameOverOverlay(app, this.renderer, this.players, this.zoneManager);
    this.battleManager = new BattleManager(
      this.players, this.donSystem, this.combatSystem,
      this.effectSystem, this.ui, this.fieldRenderer,
      this.zoneManager, this.zoneRenderer, this.animManager
    );
    this.dragManager = new DragManager(
      app, this.gameBoard, this.gameBoard.board,
      this.renderer, this.players, this.zoneManager, this.animManager,
      () => this._animating
    );
    // Render batching after dragManager so we can guard against both states
    this.renderBatcher = new RenderBatcher(
      () => this._animating || this.dragManager.isDragging()
    );
    this.cardPlayManager = new CardPlayManager(
      this.players, this.donSystem, this.effectSystem,
      this.zoneRenderer, this.handRenderer, this.fieldRenderer, this.ui, this.battleManager
    );
    this.turnManager = new TurnManager(
      this.state, eventBus, this.players,
      this.donSystem, this.effectSystem, true,
      (pid, card, handIdx) => this.animManager.animateDrawCard(pid, card, handIdx),
      (...args) => this._onTurnDrawDON(...args),
      async (pid) => { this._animating = true; await this.animManager.animateActive(pid); this._animating = false; },
    );

    // Interaction handlers (delegated from Game)
    this.playCardInteraction = new PlayCardInteraction(this);
    this.attachDONInteraction = new AttachDONInteraction(this);
    this.attackInteraction = new AttackInteraction(this);

    // Interaction state
    this.actionState = 'idle';
    this._animating = false;
    this._donVisibleCount = { 1: 0, 2: 0 };
    this._savedDONStates = {};
    this._playerAIEnabled = false;
  }

  _pendingSlams = 0;

  /** Create a fresh player object from deck definition. */
  _createPlayer(deck) {
    return {
      deck,
      hand: [],
      field: new Array(5).fill(null),
      leader: deck.leader,
      life: [],
      trash: [],
      donDeck: [],
      costArea: [],
    };
  }

  init() {
    this.gameBoard.init();
    this.zoneManager.init();
    this.ui.init();
    this._setupEndTurnButton();
    this._setupGameForSetup();
    this._setupEventListeners();
    this._aiTurn = this._aiTurn.bind(this);
    this.ui.updatePhase();
    this.ui.updateTurn();
    this.fieldRenderer.renderLeaders();
    this.zoneRenderer.renderAll();
    this._setupReadyGlowTicker();
    this.animManager.countdown.run().then(() => this._startMulliganFlow());
  }

  _setupGameForSetup() {
    for (const pid of [1, 2]) {
      this.players[pid].deck.shuffle();
      this._initialCards = this._initialCards || {};
      this._initialCards[pid] = [];
      for (let i = 0; i < 5; i++) {
        const card = this.players[pid].deck.draw();
        if (card) this._initialCards[pid].push(card);
      }
      // Re-shuffle remaining deck so life draws all have trigger
      this.players[pid].deck.shuffleWithTriggerLife(this.players[pid].leader.life);
      this.donSystem.init(pid);
    }
  }

  async _commitLifeAndStart() {
    for (const pid of [1, 2]) {
      const p = this.players[pid];
      const lifeCards = [];
      for (let i = 0; i < p.leader.life; i++) {
        const card = p.deck.draw();
        if (card) lifeCards.push(card);
      }
      await this.animManager.animateCommitLife(pid, p, lifeCards);
    }
    this._renderAll();
    this._showSampleCard();
    setTimeout(() => this.turnManager.startTurn(), 300);
  }

  async _startMulliganFlow() {
    const pid = 1;

    // P2 draws first (face-down, will mulligan later)
    const p2Cards = this._initialCards[2];
    if (p2Cards && p2Cards.length) {
      await this.animManager.initialDraw.animateInitialDrawToHand(2, p2Cards);
    }

    // P1 cards: load into hand
    const p1Cards = this._initialCards[pid];
    if (p1Cards && p1Cards.length) {
      for (const card of p1Cards) {
        this.players[pid].hand.push(card);
      }
    }

    const player = this.players[pid];
    let kept;
    if (this._playerAIEnabled) {
      // AI-controlled P1: auto-decide mulligan
      kept = !this.ai.shouldMulligan(player.hand);
      if (!kept) {
        await this.animManager.initialDraw.animateAIMulligan(pid, this.animManager.shuffle);
      }
    } else {
      kept = await this.animManager.multipleDraw.animateMulligan(pid, player, true);
      if (!kept) await this._doMulliganRedraw(pid);
    }

    // P2 AI mulligan (after P1 mulligan completes)
    await this._doAIMulligan(2);

    await this._commitLifeAndStart();
  }

  async _doAIMulligan(pid) {
    const player = this.players[pid];
    if (this.ai.shouldMulligan(player.hand)) {
      await this.animManager.initialDraw.animateAIMulligan(pid, this.animManager.shuffle);
    }
  }

  async _doMulliganRedraw(pid) {
    const player = this.players[pid];
    const oldHand = [...player.hand];
    player.hand.length = 0;
    this.handRenderer.render(pid);

    player.deck.cards.push(...oldHand);
    await this.animManager.animateShuffle(pid);

    const newCards = [];
    for (let i = 0; i < 5; i++) {
      const card = player.deck.draw();
      if (card) newCards.push(card);
    }
    await this.animManager.initialDraw._drawCardsForPlayer(pid, newCards, true);
  }

  // --- DON draw callback (called from TurnManager) ---

  async _onTurnDrawDON(pid) {
    try {
      if (!this._animatingDONDraw) {
        this._animatingDONDraw = true;
        await this.animManager.animateDONDraw(pid);
      }
      // Wait for all pending slam animations to finish before continuing phase
      await new Promise(resolve => {
        const checkSlam = () => {
          if (this._pendingSlams === 0) resolve();
          else requestAnimationFrame(checkSlam);
        };
        requestAnimationFrame(checkSlam);
      });
      // Sync visible DON count to actual cost area length after all animations
      // complete, preventing drift from effects or animation guard skips
      this._donVisibleCount[pid] = this.players[pid].costArea.length;
    } finally {
      this._animatingDONDraw = false;
    }
  }

  // --- Event listeners ---

  _setupEventListeners() {
    this.eventBus.on('phase:change', async (data) => {
      if (data.phase) this.state.currentPhase = data.phase;
      this.ui.updatePhase();
      this.ui.updateTurn();
      if (data.phase !== 'main') this.ui.setEndTurnBtn(false);

      if (data.phase === 'end') await this._onPhaseEnd(data.player);
      if (data.phase === 'refresh') this._onPhaseRefresh(data.player);

      this.scheduleRender(() => {
        if (data.phase !== 'refresh') {
          this._renderDONTokens();
        }
        if (data.phase === 'end') {
          this.handRenderer.render(1);
          this.handRenderer.render(2);
        }
      });
    });

    this.eventBus.on('refresh:complete', () => {
      this.scheduleRender(() => {
        if (this._playerAIEnabled) {
          this.fieldRenderer.renderField(1);
        } else {
          this.fieldRenderer.renderFieldWithInteraction(1, (...args) => this.attackInteraction.onFieldCardDrag(...args));
          this._bindLeaderInteraction(1);
        }
        this.fieldRenderer.renderField(2);
        this.fieldRenderer.renderLeaders();
        this._renderDONTokens();
        this.zoneRenderer.renderAll();
        this.zoneRenderer.renderLifeIndicatorsBoth();
      });
    });

    this.eventBus.on('main:ready', () => {
      // Enable DON bonus for current player's cards at start of main phase
      const pid = this.state.currentPlayer;
      const p = this.players[pid];
      for (const card of p.field) {
        if (card) card._donBonusActive = true;
      }
      if (p.leader) p.leader._donBonusActive = true;
      // Re-render to show updated power with DON bonus
      this.scheduleRender(() => {
        if (pid === 1 && !this._playerAIEnabled) {
          this.fieldRenderer.renderFieldWithInteraction(pid, (...args) => this.attackInteraction.onFieldCardDrag(...args));
        } else {
          this.fieldRenderer.renderField(pid);
        }
        this.fieldRenderer.renderLeaders();
        if (pid === 1 && !this._playerAIEnabled) {
          this._bindLeaderInteraction(pid);
        }
      });
    });

    this.eventBus.on('draw:complete', () => {
      this.scheduleRender(() => {
        this.handRenderer.render(this.state.currentPlayer);
        this.zoneRenderer.renderAll();
      });
    });

    this.eventBus.on('deck:empty', (data) => {
      const pid = data.player;
      this.state.gameOver = true;
      this.state.winner = pid === 1 ? 2 : 1;
      this.ui.updatePhase();
      this.cleanup();
      this.animManager.cancelBlockerActivate();
      this.animManager.cancelBlockerRest();
      this.dragManager.cancel();
      this.renderBatcher.cancel();
      this.combatZone.hide();
      this.gameOverOverlay.show(this.state.winner);
    });

    this.eventBus.on('main:ready', () => {
      if (this.state.gameOver) return;
      if (!this._playerAIEnabled) {
        this._bindHandInteraction(1);
        this._bindFieldInteraction(1);
        this._bindLeaderInteraction(1);
        this.ui.setEndTurnBtn(this.state.currentPlayer === 1);
      }
      this.scheduleRender(() => this._renderDONTokens());
      if (this.state.currentPlayer === 2 || this._playerAIEnabled) this._aiTurn();
    });

    this.eventBus.on('don:phaseStart', (data) => {
      const pid = data.player;
      this._donVisibleCount[pid] = this.players[pid].costArea.length;
    });

    this.eventBus.on('don:drawn', async (data) => {
      await this._animateDONSlam(data.playerId);
    });

    this.eventBus.on('effect:addDON', async (data) => {
      await this._animateDONSlam(data.playerId);
    });

    this.eventBus.on('effect:onPlay', () => {
      this.scheduleRender(() => this._renderAll());
    });
    this.eventBus.on('effect:onKO', () => {
      this.scheduleRender(() => this._renderFieldsAndZones());
    });
    this.eventBus.on('effect:trigger', () => {
      this.scheduleRender(() => this._renderAll());
    });

    this.eventBus.on('leader:damage', async (data) => {
      const pid = this._findPid(data.player);
      if (!pid) return;
      const player = this.players[pid];
      const damageCard = data.damageCard;
      const sourceZoneId = data.source || 'deck';

      // Block user input during damage trigger animation to prevent
      // the action button (End Turn/PASS) from firing mid-animation
      // and corrupting game state (phase change, player switch, DON detach)
      this._animating = true;
      if (this.ui?.actionButton) {
        this.ui.actionButton._inBattle = true;
      }

      // Remove life card sprite immediately when damage starts
      if (sourceZoneId === 'life') {
        this.zoneRenderer.renderLifeFor(pid);
      }

      // Trigger phase: check if card has Trigger ability
      const hasTrigger = damageCard && this.effectSystem.checkTrigger(damageCard, player);

      let playedTrigger = false;

      if (hasTrigger) {
        if (pid === 1 && !this._playerAIEnabled) {
          // Human: animated fly-to-center + buttons + fly-to-hand on pass
          const result = await this.animManager.damageTrigger.animate(pid, player, damageCard, true, sourceZoneId);
          playedTrigger = result.played;
          if (playedTrigger) {
            // Execute trigger effect for free, send card to trash
            this.effectSystem.resolveTrigger(damageCard, player);
            player.trash.push(damageCard);
            // Render trash immediately — batcher is blocked by _animating during battle
            this.zoneRenderer._renderTrash(pid);
            this.scheduleRender(() => this._renderAll());
          } else {
            // Pass: animation already inserted card and re-rendered hand
          }
        } else {
          // AI: auto-decide, then play non-interactive animation
          playedTrigger = this.ai.shouldPlayDamageTrigger(damageCard, player);
          if (playedTrigger) {
            this.effectSystem.resolveTrigger(damageCard, player);
          }
          await this.animManager.damageTrigger.animateAI(pid, player, damageCard, true, playedTrigger, sourceZoneId);
          // Don't schedule render here — outer battle flow handles rendering via _afterBattleResolve()
        }
      } else if (damageCard) {
        // No trigger: animate fly-to-center then fly to hand
        if (pid === 1 && !this._playerAIEnabled) {
          await this.animManager.damageTrigger.animate(pid, player, damageCard, false, sourceZoneId);
        } else {
          await this.animManager.damageTrigger.animateAI(pid, player, damageCard, false, false, sourceZoneId);
          // Don't schedule render here — outer battle flow handles rendering via _afterBattleResolve()
        }
      } else {
        // Deck empty, no damage card to animate
      }

      // Apply damage and check win condition
      // Only count damage when there are no Life cards left (source === 'deck').
      // Losing the last Life card does NOT make you lose — only taking damage
      // with 0 Life cards remaining counts.
      this.state.leaderDamage = this.state.leaderDamage || {};
      if (sourceZoneId === 'deck') {
        this.state.leaderDamage[pid] = (this.state.leaderDamage[pid] || 0) + 1;
      }
      this._checkWinCondition(pid);
      // NOTE: do NOT reset _animating / _inBattle here — this handler fires from
      // within the outer battle flow (AttackInteraction.resolveBattle) which owns
      // those flags. Clearing them early creates a window where the action button
      // becomes clickable and can fire endTurn() mid-battle.
    });

    this.eventBus.on('card:KO', () => {
      this.scheduleRender(() => this._renderFieldsAndZones());
    });
  }

  /** Find player ID from player object reference. */
  _findPid(playerObj) {
    if (!playerObj) return null;
    for (const [pid, p] of Object.entries(this.players)) {
      if (p === playerObj) return parseInt(pid);
    }
    return null;
  }

  /** Shared DON slam animation for both don:drawn and effect:addDON events. */
  async _animateDONSlam(pid) {
    // Only increment visible count when DON draw animation is not active;
    // during DON draw the count may drift but is synced after animations complete
    if (!this._animatingDONDraw) {
      this._donVisibleCount[pid] = (this._donVisibleCount[pid] || 0) + 1;
    }
    this._pendingSlams++;
    try {
      await this.animManager.animateDONSlam(pid, this._donVisibleCount[pid]);
    } finally {
      this._pendingSlams--;
    }
  }

  // --- Phase handlers ---

  async _onPhaseEnd(pid) {
    // DONs stay physically attached, only power bonus is lost
    // Run DON detach animation to show power going down
    await this.animManager.animateDONDetach(pid);

    // Disable DON bonus for this player's cards during opponent's turn
    const p = this.players[pid];
    for (const card of p.field) {
      if (card) card._donBonusActive = false;
    }
    if (p.leader) p.leader._donBonusActive = false;

    // Re-render field to update power text (DON bonus removed during opponent's turn)
    this.scheduleRender(() => {
      this.fieldRenderer.renderField(pid);
      this.fieldRenderer.renderLeaders();
    });
  }

  _onPhaseRefresh(pid) {
    // DONs are still attached to cards, returnAllDON() in TurnManager handles returning them
    // No need to restore from saved state anymore
  }

  // --- Render helpers ---

  scheduleRender(cb) {
    this.renderBatcher.schedule(cb);
  }

  /** Render both field slots and zone counts. */
  _renderFieldsAndZones() {
    this.fieldRenderer.renderField(1);
    this.fieldRenderer.renderField(2);
    this.zoneRenderer.renderAll();
  }

  _renderAll() {
    this.handRenderer.renderWithInteraction(1, (...args) => this.playCardInteraction.onHandCardDrag(...args), this.turnManager.canPlayerAct);
    this.handRenderer.render(2);
    this.fieldRenderer.renderFieldWithInteraction(1, (...args) => this.attackInteraction.onFieldCardDrag(...args));
    this.fieldRenderer.renderField(2);
    this.fieldRenderer.renderLeaders();
    this._renderDONTokens();
    this.zoneRenderer.renderAll();
    this.zoneRenderer.renderLifeIndicatorsBoth();
    this._bindLeaderInteraction(1);
  }

  _renderDONTokens() {
    this.zoneRenderer.renderCostTokensInteractive(
      1, this.turnManager.canPlayerAct,
      (...args) => this.attachDONInteraction.onDONTokenDrag(...args)
    );
    this.zoneRenderer.renderCostTokens(2);
  }

  // --- UI setup ---

  _setupEndTurnButton() {
    this.ui.setEndTurnCallback(() => {
      if (!this._animating && this.turnManager.canAct) this.turnManager.endTurn();
    });
  }

  _showSampleCard() {
    const p1Hand = this.players[1].hand;
    if (p1Hand.length > 0) this.ui.showCardInfo(p1Hand[0], 1);
    else if (this.players[1].leader) this.ui.showCardInfo(this.players[1].leader, 1);
  }

  // ============ DRAG INTERACTIONS (delegated) ============

  // --- 1. Hand card -> Field slot (Play Character) ---

  _bindHandInteraction(playerId) {
    this.handRenderer.renderWithInteraction(
      playerId,
      (...args) => this.playCardInteraction.onHandCardDrag(...args),
      this.turnManager.canPlayerAct
    );
  }

  // --- DON token -> Character/Leader (Attach DON) ---

  // --- 3. Field character -> Opponent (Attack) ---

  _bindFieldInteraction(pid) {
    this.fieldRenderer.renderFieldWithInteraction(
      pid,
      (...args) => this.attackInteraction.onFieldCardDrag(...args)
    );
  }

  // --- 4. Leader -> Opponent (Attack) ---

  _bindLeaderInteraction(pid) {
    this.fieldRenderer.bindLeaderInteraction(
      pid,
      (e) => this.attackInteraction.onLeaderDrag(e, pid),
      () => this.ui.showCardInfo(this.players[pid].leader, pid)
    );
  }

  // --- Battle resolution (delegated to AttackInteraction) ---

  async _resolveBattle(pid, attacker, target, targetPlayer) {
    await this.attackInteraction.resolveBattle(pid, attacker, target, targetPlayer);
  }

  // --- Play card via button (fallback) ---

  _playCard(card, pid) {
    if (!this.turnManager.canAct) {
      return;
    }
    const res = this.cardPlayManager.canPlay(pid, card);
    if (!res.ok) {
      return;
    }
    this.cardPlayManager.play(card, pid);
  }

  async _aiTurn() {
    await this.ai.runTurn(this.state.currentPlayer);
  }

  // --- Ready glow animation (delegated to HandRenderer) ---

  _setupReadyGlowTicker() {
    this._readyGlowTicker = () => this.handRenderer.updateReadyGlow(1);
    this.app.ticker.add(this._readyGlowTicker);
  }

  /** Clean up game resources. */
  cleanup() {
    if (this._readyGlowTicker) {
      this.app.ticker.remove(this._readyGlowTicker);
      this._readyGlowTicker = null;
    }
    if (this.ui?.phaseZone?._phaseTicker) {
      this.app.ticker.remove(this.ui.phaseZone._phaseTicker);
    }
    if (this.ui?.actionButton?._actionTicker) {
      this.app.ticker.remove(this.ui.actionButton._actionTicker);
    }
    this.animManager.attack._stopFloatAnimation();
  }

  // --- Win condition ---

  _checkWinCondition(damagedPid) {
    const damage = (this.state.leaderDamage || {})[damagedPid] || 0;
    if (damage > 0) {
      this.state.gameOver = true;
      this.state.winner = damagedPid === 1 ? 2 : 1;
      this.ui.updatePhase();
      this.cleanup();
      this.animManager.cancelBlockerActivate();
      this.animManager.cancelBlockerRest();
      this.dragManager.cancel();
      this.renderBatcher.cancel();
      this.combatZone.hide();
      this.gameOverOverlay.show(this.state.winner);
    }
  }
}

export default Game;
