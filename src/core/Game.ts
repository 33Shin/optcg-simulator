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
import AnimationGuard from '../core/AnimationGuard';
import EventOrchestrator from '../core/EventOrchestrator';
import MulliganManager from '../core/MulliganManager';
import RenderCoordinator from '../core/RenderCoordinator';
import GameStateManager from '../core/GameStateManager';
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
import type { GameState, PlayerState, GameConstructorParams } from '../types/game';

class Game {
  // Core references
  app: any;
  eventBus: any;

  // Typed state
  state: GameState;
  players: { 1: PlayerState; 2: PlayerState };

  // Animation guard
  guards: AnimationGuard;

  // Backward-compatible accessor
  get _animating(): boolean {
    return this.guards.animating;
  }
  set _animating(value: boolean) {
    this.guards.animating = value;
  }

  // Board & UI
  gameBoard: any;
  zoneManager: any;
  ui: any;

  // Renderers
  renderer: any;
  handRenderer: any;
  fieldRenderer: any;
  zoneRenderer: any;

  // Overlays
  selectionOverlay: any;
  counterPhaseOverlay: any;
  combatZone: any;
  gameOverOverlay: any;

  // Game systems
  donSystem: any;
  combatSystem: any;
  effectSystem: any;

  // Managers
  animManager: any;
  battleManager: any;
  dragManager: any;
  renderBatcher: any;
  cardPlayManager: any;
  turnManager: any;

  // Delegated managers (SRP)
  eventOrchestrator: EventOrchestrator;
  mulliganManager: MulliganManager;
  renderCoordinator: RenderCoordinator;
  gameStateManager: GameStateManager;

  // Interactions
  playCardInteraction: any;
  attachDONInteraction: any;
  attackInteraction: any;

  // AI
  ai: any;

  // Interaction state
  actionState: string;
  _playerAIEnabled: boolean;

  // Ticker reference
  _readyGlowTicker: (() => void) | null;

  // Initial hand cards for mulligan
  _initialCards: Record<number, any[]>;

  constructor({ app, eventBus, p1Deck, p2Deck }: GameConstructorParams) {
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

    // Delegated SRP managers (created first so their methods are available during wiring)
    this.eventOrchestrator = new EventOrchestrator(this);
    this.mulliganManager = new MulliganManager(this);
    this.renderCoordinator = new RenderCoordinator(this);
    this.gameStateManager = new GameStateManager(this);

    this.players = {
      1: this.mulliganManager.createPlayer(p1Deck),
      2: this.mulliganManager.createPlayer(p2Deck),
    };

    // Core infrastructure
    this.guards = new AnimationGuard();
    this.gameBoard = new GameBoard(app);
    this.zoneManager = new ZoneManager(app, this.gameBoard);
    this.ui = new UIComponents(app, this.state, this);

    // Renderers
    this.renderer = new CardRenderer();
    this.handRenderer = new HandRenderer(this.zoneManager, this.renderer, this.ui, this.players);
    this.fieldRenderer = new FieldRenderer(this.zoneManager, this.renderer, this.ui, this.players);
    this.zoneRenderer = new ZoneRenderer(this.zoneManager, this.renderer, this.players, this.ui);

    // Overlays
    this.selectionOverlay = new SelectionOverlay(app, this.renderer, this);

    // Game systems
    this.donSystem = new DONSystem(this.players, eventBus);
    this.combatSystem = new CombatSystem(this.state, this.players, eventBus);

    // AI (created before animManager)
    this.ai = new AI(this);

    // Animation manager
    this.animManager = new AnimationManager(
      app, this.gameBoard, this.zoneManager, this.renderer, this.players,
      this.handRenderer, this.zoneRenderer, this.donSystem, this.ui, this.ai, this
    );

    // Effect system (needs animManager)
    this.effectSystem = new EffectSystem(this.state, this.players, eventBus, this.animManager);

    // Counter phase overlay (needs animManager)
    this.counterPhaseOverlay = new CounterPhaseOverlay(
      app, this.gameBoard, this.zoneManager, this.renderer, this.players, this.animManager, this.ui, this.handRenderer
    );

    // Combat overlays
    this.combatZone = new CombatZone(app);
    this.gameOverOverlay = new GameOverOverlay(app, this.renderer, this.players, this.zoneManager);

    // Managers
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
      (...args: any[]) => this.eventOrchestrator._onTurnDrawDON(...args),
      async (pid: number) => { this._animating = true; await this.animManager.animateActive(pid); this._animating = false; },
    );

    // Interaction handlers
    this.playCardInteraction = new PlayCardInteraction(this);
    this.attachDONInteraction = new AttachDONInteraction(this);
    this.attackInteraction = new AttackInteraction(this);

    // State
    this.actionState = 'idle';
    this._playerAIEnabled = false;
    this._readyGlowTicker = null;
    this._initialCards = {};
  }

  /** Initialize the game: board, zones, UI, event listeners, countdown then mulligan flow. */
  init() {
    this.gameBoard.init();
    this.zoneManager.init();
    this.ui.init();
    this._setupEndTurnButton();
    this.mulliganManager.prepareSetup();
    this.eventOrchestrator.setup();
    this.ui.updatePhase();
    this.ui.updateTurn();
    this.fieldRenderer.renderLeaders();
    this.zoneRenderer.renderAll();
    this._setupReadyGlowTicker();
    this.animManager.countdown.run().then(() => this.mulliganManager.startMulliganFlow());
  }

  _setupEndTurnButton() {
    this.ui.setEndTurnCallback(() => {
      if (!this._animating && this.turnManager.canAct) this.turnManager.endTurn();
    });
  }

  _setupReadyGlowTicker() {
    this._readyGlowTicker = () => this.handRenderer.updateReadyGlow(1);
    this.app.ticker.add(this._readyGlowTicker);
  }

  // --- Render helpers (delegated) ---

  scheduleRender(cb: () => void) {
    this.renderCoordinator.scheduleRender(cb);
  }

  // --- Battle resolution (delegated to AttackInteraction) ---

  async _resolveBattle(pid: number, attacker: any, target: any, targetPlayer: any) {
    await this.attackInteraction.resolveBattle(pid, attacker, target, targetPlayer);
  }

  // --- Play card via button (fallback) ---

  async _playCard(card: any, pid: number) {
    if (!this.turnManager.canAct) return;
    const res = this.cardPlayManager.canPlay(pid, card);
    if (!res.ok) return;
    await this.cardPlayManager.play(card, pid);
  }

  async _aiTurn() {
    await this.ai.runTurn(this.state.currentPlayer);
  }
}

export default Game;
