// Game state shape (mirrors Game.state)
export interface GameState {
  turnCount: number;
  currentPlayer: 1 | 2;
  currentPhase: 'refresh' | 'draw' | 'don' | 'main' | 'end' | null;
  phaseLocked: boolean;
  gameOver: boolean;
  winner: number | null;
  battle: any | null;
  leaderDamage: { 1: number; 2: number };
}

// Player data structure (mirrors _createPlayer output)
export interface PlayerState {
  deck: any;        // Deck instance
  hand: any[];     // Card instances
  field: (any | null)[];  // 5 slots, CharacterCard or null
  leader: any;     // LeaderCard instance
  life: any[];     // Card instances
  trash: any[];    // Card instances
  donDeck: any[];  // DON token objects
  costArea: any[]; // DON token objects
}

// Animation guard state — consolidates scattered _animating flags
export interface AnimationGuardState {
  animating: boolean;
  animatingDONDraw: boolean;
  pendingSlams: number;
  donVisibleCount: { 1: number; 2: number };
}

// Constructor parameters passed from main.ts
export interface GameConstructorParams {
  app: any;      // PIXI.Application
  eventBus: any; // EventBus instance
  p1Deck: any;   // Deck instance
  p2Deck: any;   // Deck instance
}

// Constants extracted from Game.ts
export const HAND_SIZE = 5;
export const FIELD_SLOTS = 5;
export const DON_FIRST_TURN = 4;
export const DON_NORMAL = 6;
