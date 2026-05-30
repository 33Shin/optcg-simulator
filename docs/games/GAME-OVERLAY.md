# Game Overlay Structure

## Container
- **ID**: `#game-overlay`
- **Layout**: Flex column, full height, flex:1
- **Background**: `#4a4440`
- **Position**: Right side of screen, alongside PixiJS canvas
- **Setup**: `_setupOverlay()` in `UIComponents.init()`, creates all sections dynamically via `innerHTML`

## Sections (in document order)

### 1. Card Info Panel (`#card-info-panel`)
- Style: `flex:1; overflow-y:auto; display:flex; flex-direction:column`
- Scrollable when content exceeds viewport
- Populated by `showCardInfo(card, pid)`, `showCardInfoWithPlay(card, pid, callback)`
- Cleared by `_clearInfoPanel()`

#### Contents (when showing card info)
| Section | Style | Description |
|---|---|---|
| Card Image | 300×420, object-fit contain, border-radius 10px | Card art from `card.imgPath`, or dark placeholder with card name |
| Card Name | White, 20px, weight 500 | Displayed as `<h2>` |
| Attributes | 13px, label:value pairs, blue labels (#88aaff) | Category, Set, Number, Color, Attribute, Rarity, Type |
| Stats | 13px, label:value pairs, colored labels | Cost (#88aaff), Power (#ffd700), Counter (#ff8844), Life (#44ff88) |
| Effect Block | bg `#f3f2de`, text black, 14px Inter | Keyword-highlighted effect text |
| Trigger Block | bg `#0f0400`, text white, 14px Inter | Keyword-highlighted trigger text |
| Play Button | green `#4CAF50`, full-width, 14px bold | Shows only for P1 characters/events/stages during Main Phase. Disabled text shows reason ("Phase Locked", "Not Main Phase", "Field Full", "Not Enough DON!!"). |

### 2. Confirm Dialog (`#confirm-dialog`)
- Hidden by default (`display:none`)
- Border top: 1px solid `#334466`
- Background: `rgba(10,10,30,0.95)`

#### Contents
| Element | Style | Action |
|---|---|---|
| Question (`#confirm-question`) | White, 14px Inter | Set by `showConfirm()` |
| Yes Button (`#confirm-yes`) | bg `#4CAF50`, white text, flex:1 | Calls `_onConfirm(true)` |
| No Button (`#confirm-no`) | bg `#f44336`, white text, flex:1 | Calls `_onConfirm(false)` |

## Phase Bar (PixiJS-rendered, NOT DOM)
The phase bar is rendered on the canvas as a PixiJS container — **not** inside the `#game-overlay`. See `UIComponents._createPhaseBar()` and `LAYOUT.md` for rendering details.

- Position: `{ x: 302, y: 360 }` on canvas, centered on divider line
- Buttons updated by `updatePhase()` on every `phase:change` event
- Turn label: `updateTurn()` — positioned at right side

## Action Button (PixiJS-rendered, NOT DOM)
The PASS/End Turn button is rendered on the canvas as a PixiJS half-circle button — **not** inside the `#game-overlay`. See `ActionButton.js` and `LAYOUT.md` for details.

- Positioned right of phase bar
- States: PASS (clickable), disabled (dimmed), RESTART (green)
- Hover: GlowFilter effect, text scale 1.15x
- Callback fires on `pointerup`

## Combat Zone (PixiJS-rendered, NOT DOM)
The battle overlay is rendered on the canvas — **not** inside the `#game-overlay`. See `CombatZone.js` and `LAYOUT.md` for details.

- Overlays phase bar during battle
- Shows attacker/defender info, phase label, countdown timer
- Auto-hides when battle resolves

## API Methods

| Method | Parameters | Description |
|---|---|---|
| `showCardInfo(card, pid)` | card object, pid | Renders card info into `#card-info-panel` |
| `showCardInfoWithPlay(card, pid, onPlay)` | card, pid, callback | Card info + Play button with enable/disable logic |
| `showConfirm(question, callback)` | string, function | Shows dialog, stores callback for Yes/No result |
| `hideConfirm()` | — | Hides dialog, clears stored callback |
| `updatePhase()` | — | Updates phase bar button colors/styles (PixiJS) |
| `updateTurn()` | — | Updates turn label text (PixiJS) |
| `setEndTurnBtn(enabled)` | boolean | Shows/hides end turn button |
| `restoreActionButton()` | — | Restores action button after battle |

## Initialization
Overlay is set up in `_setupOverlay()` called from `init()`. Confirms wired in `_setupConfirmDialog()`.
