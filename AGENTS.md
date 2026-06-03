# OPTCG Simulator — Agent Brief

## Stack
- **Vite + TypeScript** (no bundler before). Source in `src/`, Vite transpiles and bundles.
- **PixiJS** from CDN (`pixi.js@8`). Global `PIXI` is available, types via `src/types/pixi-cdn.d.ts`.
- Single `css/style.css` handles all styling. No lint, no test runner.

## Running the game
```bat
server.bat          # npx vite (dev server with HMR, port 8000)
preview.bat         # npm run build && npm run preview (production build + preview)
```
Open `http://localhost:8000`.

## Entry point & architecture
- **`src/main.ts`** — boots PixiJS app, loads card images via `PIXI.Assets.load()`, creates `Game` instance.
- **`src/core/Game.ts`** — owns all game state, wires every system/renderer, runs the ticker loop. The single file that ties everything together.
- **`src/core/EventBus.ts`** — pub/sub. All cross-system communication flows through events, not direct calls. Key events: `phase:change`, `main:ready`, `draw:complete`, `effect:onPlay`, `effect:onKO`, `card:KO`, `leader:damage`.

### Folders
| Folder | Contents |
|---|---|
| `src/core/` | `Game.ts`, `EventBus.ts`, `AnimationManager.ts`, `BattleManager.ts`, `DragManager.ts`, `CardPlayManager.ts` |
| `src/game-systems/` | `TurnManager.ts` (5-phase state machine), `DONSystem.ts`, `CombatSystem.ts`, `EffectSystem.ts` |
| `src/entities/` | `Card.ts` (base), `LeaderCard.ts`, `CharacterCard.ts`, `EventCard.ts`, `Deck.ts` |
| `src/ui/` | `GameBoard.ts`, `CardRenderer.ts`, `ZoneManager.ts`, `UIComponents.ts`, `HandRenderer.ts`, `FieldRenderer.ts`, `ZoneRenderer.ts`, `PhaseBar.ts`, `CardInfoPanel.ts`, `KeywordHighlighter.ts`, `ActionButton.ts`, `CombatZone.ts`, `CounterPhaseOverlay.ts`, `SelectionOverlay.ts` |
| `src/data/` | `cardDatabase.ts` (central lookup), `decks/` (one TS file per deck definition) |
| `src/types/` | `pixi-cdn.d.ts` (ambient type declarations for global PIXI namespace) |
| `public/assets/imgs/` | Card image files + `back.webp`, `don.png`, `don_back.png` |
| `public/css/` | `style.css` |
| `docs/games/` | Rules, mechanics doc, implementation status, animation reference |
| `docs/` | Architecture docs, AI planning, instruction files, PixiJS skill references |

### Dependency graph (wired inside `Game.js`)
```
Game
 ├── GameBoard → ZoneManager       (board layout)
 ├── UIComponents                  (phase bar, turn counter, info panel)
 ├── HandRenderer, FieldRenderer, ZoneRenderer  (render cards in zones)
 ├── AnimationManager              (draw, shuffle, mulligan, DON anims)
 ├── BattleManager                 (attack flow, power calc, KO)
 ├── DragManager                   (PixiJS drag for hand→field, DON→card, field→opponent)
 ├── CardPlayManager               (play character/event, DON cost, validation)
 └── TurnManager                   (phase transitions, auto-phase timing)
```

### State shape (inside Game.js)
```js
{
  turnCount: 0,
  currentPlayer: 1 | 2,
  currentPhase: 'refresh' | 'draw' | 'don' | 'main' | 'end',
  phaseLocked: false,
  gameOver: false,
  winner: null,
  battle: null,
  leaderDamage: { 1: 0, 2: 0 },
}
```

## Adding a new deck
1. Create `src/data/decks/MyDeck.ts` exporting `{ name, colors, leader, characters, events }`.
2. Add new card entries to `src/data/cardDatabase.ts`.
3. Place images in `public/assets/imgs/`.
4. Import and register in `src/main.ts` (or use the existing `index.ts` barrel in `decks/`).
**Do not touch** core, systems, or UI code.

## Turn phases
`REFRESH → DRAW → DON!! → MAIN → END` — first three are auto-executed, `MAIN` waits for input, `END` is manual (button or AI).

## P1-only interactions
All drag/click interactions are bound for P1 only. P2 (`_aiTurn()`) uses AI behavior classes.

## Action button behavior
The action button (PASS) has three states: `endTurn`, `disabled`, `gameOver`. During battle animations, `_inBattle` is set to `true` — the ticker and `updateActionButton` respect this and do not override the battle flow's button state. The button handler has a fallback: if `_currentStateKey` doesn't match but `_onEndTurn` exists, it calls the callback anyway (guarded by `turnManager.canAct`).

## Counter phase hand interaction
Hand card drags are blocked during battle animation via `game._animating` guard in `PlayCardInteraction.onHandCardDrag`. Counter phase re-renders the defender's hand with its own drag handler. After counter phase ends, hand is re-rendered without drag handler so battle resolution cannot trigger counter drops.

## Console warnings are live state dumps
Files like `Game.js` contain `console.warn` with field/array snapshots for debugging. These are intentional and useful during development.

## Key files for reference
- `docs/games/MECHANIC.md` — implementation status table (what works, what doesn't)
- `docs/games/RULE.md` — one-piece card game rules
- `docs/ARCHITECTURE.md` — full architecture doc (kept in sync)
- `docs/games/ANIMATION.md` — animation sequence reference

## INSTRUCTION
- **Before starting work:** Every time you receive a new request and are about to work on it, you MUST first present a todo checklist outlining the steps you plan to take based on the request.
- **Run build after code changes:** If you modified any source files, you MUST run `build.bat` before the summary block to verify the build succeeds.
- **After finishing work:** Every time you finish a response or task, you MUST end with a summary block formatted exactly as follows:

```

---
📋 **Request:** `<brief description of what was asked>`
✅ **Result:** `<completed / fixed / status summary>`
### WAITING FOR NEXT REQUEST!!!
```

- **No browser automation:** Do NOT use Playwright or any browser automation tools to test or verify changes unless explicitly asked by the user. Trust the code is correct; let the user test in their own browser.

- **NEVER use git commands:** Do NOT run `git commit`, `git push`, `git add`, `git revert`, or any other git command — unless the user explicitly asks you to. Let the user handle version control themselves.
- **NEVER discard code:** Do NOT use `git reset --hard`, `git clean`, `rm -rf`, or any command that permanently deletes working tree changes, untracked files, or committed history — unless the user explicitly asks you to. Use `git stash` for temporary changes, branches for experiments, and always ask before modifying git history.