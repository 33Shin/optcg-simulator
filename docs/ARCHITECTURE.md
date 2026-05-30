# OPTCG - Code Architecture & Structure

## File Structure

```
optcg/
├── index.html                    # Shell: loads CSS + JS modules
├── package.json                  # Vite + TypeScript deps
├── vite.config.ts                # Vite config (esnext target for top-level await)
├── tsconfig.json                 # TypeScript config (noEmit, Vite handles transpilation)
├── src/                          # TypeScript source
│   ├── main.ts                   # Entry point: boot PixiJS, load assets, init Game
│   ├── types/                    # Type declarations
│   │   └── pixi-cdn.d.ts         # Ambient declarations for global PIXI namespace
│   ├── core/                     # 7 files — central engine + managers
│   │   ├── Game.ts               # Central engine: holds GameState, runs ticker loop
│   │   ├── EventBus.ts           # Pub/sub for decoupled system communication
│   │   ├── AnimationManager.ts   # Orchestrates all animations (16 animation classes)
│   │   ├── BattleManager.ts      # Attack flow, power calc, KO resolution
│   │   ├── DragManager.ts        # PixiJS drag: hand→field, DON→card, field→opponent, leader attack
│   │   ├── CardPlayManager.ts    # Play character/event/stage, DON cost, validation
│   │   ├── Animator.ts           # Shared animation utilities
│   │   ├── RenderBatcher.ts      # Coalesces render calls per frame
│   │   ├── animations/           # 16 animation classes + utils
│   │   │   ├── CountdownAnimation.ts
│   │   │   ├── InitialDrawAnimation.ts
│   │   │   ├── DONDrawAnimation.ts
│   │   │   ├── DONDetachAnimation.ts
│   │   │   ├── AttackAnimation.ts
│   │   │   ├── SlamAnimation.ts
│   │   │   ├── FlyToTrashAnimation.ts
│   │   │   ├── FlyToBottomDeckAnimation.ts
│   │   │   ├── ShuffleAnimation.ts
│   │   │   ├── CommitLifeAnimation.ts
│   │   │   ├── AIPlayAnimation.ts
│   │   │   └── utils.ts
│   │   └── interactions/         # Delegated interaction handlers
│   │       ├── PlayCardInteraction.ts
│   │       ├── AttachDONInteraction.ts
│   │       └── AttackInteraction.ts
│   ├── game-systems/             # 4 files — game logic
│   │   ├── TurnManager.ts        # 5-phase state machine + first-turn rules
│   │   ├── DONSystem.ts          # DON!! deck, cost area, attach/detach
│   │   ├── CombatSystem.ts       # Attack declare, power calc, battle resolve
│   │   └── EffectSystem.ts       # Ability execution, trigger detection, timing
│   ├── entities/                 # 5 files — card data models
│   │   ├── Card.ts               # Base: id, name, cost, power, color, category, effect
│   │   ├── LeaderCard.ts         # Extends Card: adds life stat
│   │   ├── CharacterCard.ts      # Extends Card: adds counter, trigger, blocker
│   │   ├── EventCard.ts          # Extends Card: adds timing (Main, Counter)
│   │   └── Deck.ts               # 50-card deck: shuffle, draw, isEmpty
│   ├── ui/                       # 14 files — rendering and UI components
│   │   ├── GameBoard.ts          # PixiJS stage: zones, backgrounds, layout
│   │   ├── ZoneManager.ts        # Hand, Field, Leader, DON!!, Life, Trash containers
│   │   ├── CardRenderer.ts       # Sprite factory: build card visual from Card obj
│   │   ├── HandRenderer.ts       # Render cards in hand zone with fanning layout
│   │   ├── FieldRenderer.ts      # Render characters + leader on field slots
│   │   ├── ZoneRenderer.ts       # Render deck, DON!!, cost tokens, life, trash zones
│   │   ├── UIComponents.ts       # Phase indicator, info panel, turn counter, buttons
│   │   ├── PhaseBar.ts           # Visual phase progress bar
│   │   ├── CardInfoPanel.ts      # Hover/click card details with play button
│   │   ├── KeywordHighlighter.ts # Color-coded keyword detection in effect text
│   │   ├── ActionButton.ts       # PixiJS half-circle PASS button
│   │   ├── CombatZone.ts         # Battle overlay with attacker/defender info
│   │   ├── CounterPhaseOverlay.ts # Counter phase UI
│   │   └── SelectionOverlay.ts   # HTML overlays: mulligan, trigger, pick-card dialogs
│   ├── ai-behaviour/             # 5 files — AI opponent system
│   │   ├── AI.ts                 # Orchestrates AI turn flow
│   │   ├── AIBehaviour.ts        # Base class with shared utilities
│   │   ├── PlayCharacterAI.ts    # Plays highest-power character from hand
│   │   ├── AttachDONAI.ts        # Attaches DON to all available targets
│   │   └── AttackAI.ts           # Attacks weakest target with strongest attacker
│   └── data/                     # Card database and deck definitions
│       ├── cardDatabase.ts       # Central lookup: card_id → full card data
│       └── decks/                # One TS file per deck definition + index barrel
│           ├── allCardData.ts
│           └── index.ts
├── public/                       # Static assets (auto-copied to dist/ by Vite)
│   ├── assets/
│   │   └── imgs/                 # Card images, back.webp, don.png, don_back.png
│   └── css/
│       └── style.css             # All styles (canvas, layout, body reset)
├── docs/                         # Architecture docs, planning, instruction files
└── Resources/
```

## Design Principles

### 1. No Global State
All game state lives inside `Game.js`. Systems receive references, not globals.

### 2. EventBus for Communication
Systems communicate via published events, not direct calls:
```javascript
// Game.js publishes
eventBus.emit('phase:change', { phase: 'main', player: 1 });

// CombatSystem.js subscribes
eventBus.on('phase:change', (e) => { if (e.phase === 'main') this.enableAttacks(); });
```

### 3. Deck Data is Plugged In
Adding a new deck requires only:
1. Create `src/data/decks/NewDeck.ts` with card list
2. Add new cards to `src/data/cardDatabase.ts`
3. Add new image files to `public/assets/imgs/`
4. Register in `src/main.ts` deck selector

**No touching** core, systems, or UI code.

### 4. Card Entity Hierarchy
```
Card (abstract)
├── LeaderCard      # has: life, unique per player
├── CharacterCard   # has: counter, trigger, isBlocker, max copies = 4
└── EventCard       # has: timing (Main | Counter | Trigger), trashed after use
```

Each `Card` has a `cardId` string (e.g., `"OP11-040"`). All rendering and logic references use this ID.

### 5. Asset Loading Pipeline (main.js)
```javascript
// Step 1: Load all card data from cardDatabase.js
const DB = new CardDatabase();

// Step 2: Build deck from deck definition
const luffyDeck = new Deck(BluePurpleLuffyDefinition, DB);
const namiDeck = new Deck(BlueYellowNamiDefinition, DB);

// Step 3: Collect all unique image paths
const imagePaths = DB.getAllImagePaths();

// Step 4: Batch-load all textures via PixiJS Assets
const textures = await PIXI.Assets.load(imagePaths);

// Step 5: Init game
const game = new Game({ deck1: luffyDeck, deck2: namiDeck, textures });
```

### 6. Zone Container Layout (GameBoard.js)
Each player has their own `ZoneManager` instance. Zones are PixiJS Containers at fixed positions.

| Zone | P1 (y) | P2 (y) | Purpose |
|---|---|---|---|
| Hand | 610 | 20 | Cards in hand |
| Cost | 530 | 100 | DON!! for paying costs |
| Field | 470 | 160 | Leader + 5 character slots |
| Extras | 580 | 70 | DON!! deck, Life, Trash |

CardRenderer creates sprites at a standard size of 100x140px, scalable.

### 7. Turn Flow (TurnManager.js)
```
REFRESH → DRAW → DON!! → MAIN → END → (next player)
  auto     auto   auto     manual  manual
```
- Refresh, Draw, DON!! are auto-executed with a short delay
- Main waits for player input (or AI execution for P2)
- End is triggered by "Next Phase" button or AI auto-end

### 8. State Shape (GameState inside Game.js)

`this.state` holds turn/phase flags. `this.players` is a separate direct property on the `Game` instance.

```javascript
// this.state
{
  turnCount: 1,
  currentPlayer: 1,            // 1 or 2
  currentPhase: 'refresh',     // refresh | draw | don | main | end
  phaseLocked: false,          // blocks input during auto-phases
  gameOver: false,
  winner: null,
  battle: null,               // set during active battle
}

// this.players (direct property on Game instance)
{
  1: {
    deck: Deck,               // Deck instance
    hand: [],                 // Card[] in hand
    field: [null, ...],       // CharacterCard[] or null, max 5 slots
    leader: LeaderCard,       // Leader card data
    life: [],                 // Life cards (face-down from deck)
    trash: [],                // Trashed cards
    donDeck: [],              // DON!! remaining in DON deck
    costArea: [],             // DON!! tokens in cost area
  },
  2: { ... },                 // Same structure for opponent
}
```

### 9. Scaling to More Decks
The `main.js` deck selector loads any deck:
```javascript
import { BluePurpleLuffy } from './data/decks/BluePurpleLuffy.js';
import { BlueYellowNami } from './data/decks/BlueYellowNami.js';
// import { NewDeck } from './data/decks/NewDeck.js'; // just add this line
```
Each deck file exports a consistent shape:
```javascript
export default {
  name: 'Blue/Purple Luffy',
  colors: ['blue', 'purple'],
  leader: { cardId: 'OP11-040', count: 1 },
  characters: [ { cardId: 'OP13-043', count: 4 }, ... ],
  events:      [ { cardId: 'OP09-078', count: 4 }, ... ],
};
```

### 10. Module System
Uses Vite + TypeScript. Source files in `src/` are transpiled by Vite. No manual bundling needed.

```html
<script type="module" src="/src/main.ts"></script>
```

### 11. Build & Dev Commands
```bash
npm run dev       # Vite dev server with HMR on port 8000
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

`server.bat` runs dev server. `preview.bat` builds then previews.

## System Dependencies (DAG)

```
main.js
 ├── Game.js (central orchestrator)
 │    ├── this.state          # GameState plain object
 │    ├── this.players        # Player data (deck, hand, field, life, trash, DON)
 │    ├── EventBus            # Pub/sub for cross-system communication
 │    │
 │    ├── Managers            # Instantiated in Game.js constructor
 │    │   ├── AnimationManager     → 16 animation classes via shared ctx
 │    │   ├── BattleManager        → attack flow, power calc, KO resolution
 │    │   ├── DragManager          → hand→field, DON→card, field→opponent, leader drag
 │    │   └── CardPlayManager      → play character/event/stage, cost validation
 │    │
 │    ├── Systems             # Receive state references + EventBus
 │    │   ├── TurnManager        → phase transitions, auto-phase execution
 │    │   ├── DONSystem          → DON!! deck, cost area, attach/detach
 │    │   ├── CombatSystem       → attack declare, power calc, battle resolve
 │    │   └── EffectSystem       → ability text parsing, trigger detection
 │    │
 │    ├── Renderers           # Receive zoneManager + player data references
 │    │   ├── CardRenderer       → sprite factory from texture + card data
 │    │   ├── HandRenderer       → fanning layout in hand zone
 │    │   ├── FieldRenderer      → characters + leader on field slots
 │    │   └── ZoneRenderer       → deck, DON!!, cost tokens, life, trash zones
 │    │
 │    └── UI                  # PixiJS stage + HTML overlays
 │        ├── GameBoard          → stage setup, backgrounds, zone layout
 │        ├── ZoneManager        → container creation per zone per player
 │        ├── UIComponents       → phase bar, info panel, turn counter, buttons
 │        ├── PhaseBar           → visual phase progress indicator
 │        ├── CardInfoPanel      → hover/click card details with play button
 │        ├── KeywordHighlighter → color-coded keyword detection in effect text
 │        └── SelectionOverlay   → HTML overlays: mulligan, trigger, pick-card
 │
 └── AI (P2 only)
      ├── AI.js                → orchestrates AI turn flow
      └── AIBehaviour[]        → PlayCharacterAI, AttachDONAI, AttackAI
```

## What Each File Does

| File | Responsibility |
|---|---|
| `main.ts` | Boot: load assets, build decks, create Game instance |
| `Game.ts` | Owns GameState + players, runs ticker, wires all systems together |
| `EventBus.ts` | Pub/sub: `emit(event, data)`, `on(event, handler)`, `off()`, `once()` |
| `AnimationManager.ts` | Orchestrates 16 animation classes via shared context object |
| `BattleManager.ts` | Attack flow, power calculation, KO resolution, win condition checks |
| `DragManager.ts` | PixiJS drag: hand→field, DON→card, field→opponent, leader attack |
| `CardPlayManager.ts` | Play character/event/stage, DON cost payment, play validation |
| `TurnManager.ts` | Phase transitions, auto-phase execution, input gating |
| `DONSystem.ts` | DON!! deck (10), cost area, attach/detach, count in zone |
| `CombatSystem.ts` | Attack declare, power comparison, KO, damage to Leader |
| `EffectSystem.ts` | Regex-based ability text parsing, trigger detection, timing windows |
| `Card.ts` | Base entity with id, name, cost, power, color, category, effect |
| `LeaderCard.ts` | Extends Card + life stat |
| `CharacterCard.ts` | Extends Card + counter, trigger, blocker flags |
| `EventCard.ts` | Extends Card + timing metadata (Main, Counter, Trigger) |
| `Deck.ts` | 50-card array, shuffle(), draw(), isEmpty(), count() |
| `GameBoard.ts` | PixiJS stage setup, backgrounds, zone layout |
| `ZoneManager.ts` | Container creation per zone per player |
| `CardRenderer.ts` | Sprite factory from texture + card data overlay |
| `HandRenderer.ts` | Render cards in hand zone with fanning layout |
| `FieldRenderer.ts` | Render characters + leader on field slots |
| `ZoneRenderer.ts` | Render deck, DON!!, cost tokens, life, trash zones |
| `UIComponents.ts` | Phase label, info panel, turn counter, buttons |
| `PhaseBar.ts` | Visual phase progress indicator |
| `ActionButton.ts` | PixiJS half-circle PASS button with hover glow, 3 states (endTurn/disabled/gameOver) |
| `CombatZone.ts` | Battle overlay with attacker/defender info, phase label, countdown timer |
| `CounterPhaseOverlay.ts` | Counter phase UI with drag-to-play |
| `CardInfoPanel.ts` | Hover/click card details with play button |
| `KeywordHighlighter.ts` | Color-coded keyword detection in effect text |
| `SelectionOverlay.ts` | HTML overlays: mulligan, trigger, pick-card dialogs |
| `PlayCardInteraction.ts` | Hand card drag handler for playing characters/events |
| `AttachDONInteraction.ts` | DON token drag handler for attaching DON |
| `AttackInteraction.ts` | Field/leader drag handler for declaring attacks, counter phase flow |
| `AI.ts` | Orchestrates AI turn flow for P2 opponent |
| `AIBehaviour.ts` | Base class with shared utilities (`canAct`, `renderAll`, `sleep`) |
| `PlayCharacterAI.ts` | Plays highest-power character from hand |
| `AttachDONAI.ts` | Attaches DON to all available targets |
| `AttackAI.ts` | Attacks weakest target with strongest attacker |
| `cardDatabase.ts` | Static lookup table: all card data keyed by cardId |
| `decks/*.ts` | Deck definitions: cardId + count arrays |
