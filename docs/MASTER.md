# OPTCG Simulation Game - Master Directive

## Project Overview
Build a browser-based One Piece Card Game (OPTCG) simulation using PixiJS v8 with Vite + TypeScript. The game allows a player to test the **Blue/Purple Luffy deck** against the **Blue/Yellow Nami deck**.

## Core Technologies
- **PixiJS v8** (CDN) for 2D rendering and card display
- **GSAP** (CDN) for smooth, tweenable animations (22 animation classes)
- **Vite + TypeScript** — Source in `src/`, Vite transpiles and bundles
- **Modular architecture** — Entry point `src/main.ts`, core systems in `src/core/`, game systems in `src/game-systems/`
- **Local assets** — All card images stored in `public/assets/imgs/` (64 unique cards)

## Architecture Principles
1. **Read AI/ files first** - All design decisions, game rules, mechanics, and phase plans live in the AI/ and GAME/ folders
2. **Follow GAME/MECHANIC.md** for all game logic implementation
3. **Follow GAME/RULE.md** for official One Piece TCG rule compliance
4. **Reference GAME/BLUE_PURPLE_LUFFY.md and GAME/BLUE_YELLOW_NAMI.md** for deck composition and card data
5. **Follow AI/PHASE.md** - Complete each phase sequentially before moving to the next
6. **Phase 0 is mandatory** - Verify PixiJS rendering pipeline works before building game logic

## File Structure
```
optcg/
├── index.html              # Entry HTML (PixiJS CDN, loads src/main.ts)
├── package.json            # Vite + TypeScript deps
├── vite.config.ts          # Vite config (esnext target for top-level await)
├── tsconfig.json           # TypeScript config (noEmit, Vite handles transpilation)
├── src/                    # TypeScript source
│   ├── main.ts             # Entry point: boots PixiJS app, loads assets, creates Game
│   ├── types/              # Type declarations
│   │   └── pixi-cdn.d.ts   # Ambient declarations for global PIXI namespace
│   ├── core/               # Core game systems
│   │   ├── Game.ts         # Central orchestrator, owns all state
│   │   ├── EventBus.ts     # Pub/sub for cross-system communication
│   │   ├── AnimationManager.ts  # Wraps all animation classes (22, GSAP-powered)
│   │   ├── BattleManager.ts     # Battle flow orchestration
│   │   ├── DragManager.ts       # PixiJS drag-and-drop
│   │   ├── CardPlayManager.ts   # Card play validation/execution
│   │   ├── Animator.ts          # GSAP-powered shared animation utilities
│   │   ├── RenderBatcher.ts     # Coalesces render calls per frame
│   │   ├── animations/          # 22 animation classes
│   │   └── interactions/        # PlayCard, DON, Attack, LeaderAttack interactions
│   ├── game-systems/       # Game logic systems
│   │   ├── TurnManager.ts      # 5-phase state machine
│   │   ├── DONSystem.ts        # DON!! resource management
│   │   ├── CombatSystem.ts     # KO, damage, power calculation
│   │   └── EffectSystem.ts     # Card effect execution
│   ├── entities/           # Card data classes
│   │   ├── Card.ts, LeaderCard.ts, CharacterCard.ts, EventCard.ts, Deck.ts
│   ├── ui/                 # Rendering and UI
│   │   ├── GameBoard.ts, ZoneManager.ts, ZoneRenderer.ts
│   │   ├── CardRenderer.ts, HandRenderer.ts, FieldRenderer.ts
│   │   ├── UIComponents.ts, PhaseBar.ts, CardInfoPanel.ts
│   │   ├── ActionButton.ts, CombatZone.ts, CounterPhaseOverlay.ts
│   │   ├── SelectionOverlay.ts, KeywordHighlighter.ts
│   ├── ai-behaviour/       # AI opponent
│   │   ├── AI.ts, PlayCharacterAI.ts, AttachDONAI.ts, AttackAI.ts
│   └── data/               # Card database and deck definitions
│       ├── cardDatabase.ts (64 cards), decks/
├── public/                 # Static assets (auto-copied to dist/ by Vite)
│   ├── assets/
│   │   └── imgs/           # Card images (downloaded from API)
│   └── css/
│       └── style.css       # All game styling
├── docs/                   # Project directives, game data, rules, and mechanics
│   ├── ARCHITECTURE.md     # Full architecture doc
│   ├── games/              # Game data, rules, and mechanics
│   │   ├── MECHANIC.md     # Mechanics and implementation status
│   │   ├── RULE.md         # Official rules summary
│   │   ├── ANIMATION.md    # Animation system documentation
│   │   └── ...
└── Resources/              # Source decklists and API info
```

## Development Workflow
1. Read relevant AI/ and GAME/ files before coding
2. Implement one phase at a time per AI/PHASE.md
3. Test thoroughly within browser before proceeding
4. Update AI/TODO.md to mark completed tasks
5. Never skip phases or combine phases

## Win Condition for Project
A fully playable OPTCG duel screen where:
- Both decks load with correct card data and images
- All 5 phases work: Refresh → Draw → DON!! → Main → End
- Characters can be played, attacked, and have effects resolved
- DON!! system tracks resources correctly
- Battle resolution follows official rules
- Life cards are managed per leader Life stat
- The game ends when a player's Life cards reach zero

## API Reference
- **Card Data**: `https://onepiece.limitlesstcg.com/api/cards/{SET_ID}-{CARD_NUMBER}`
- **Card Image**: `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/{SET_ID}/{SET_ID}-{CARD_NUMBER}_EN.webp`
