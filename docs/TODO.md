# OPTCG Simulation Game - Task Checklist

## PHASE 1: Board, Zones, Overlay, Card Info ✅ COMPLETE

### Game Board & Zones
- [x] PixiJS v8 loaded, canvas initialized at 1200x800
- [x] Card images loaded from assets/imgs/ (31 unique)
- [x] P1 zones: Hand, Field (5 slots), Leader, DON!! Deck, Cost, Life, Trash
- [x] P2 zones: Same layout mirrored at top
- [x] Zone boundaries marked with rounded rects and labels
- [x] Responsive layout for 1200x800 resolution

### UI Overlay (`#game-overlay`)
- [x] Card info panel (`#card-info-panel`): scrollable top section
- [x] Confirm dialog (`#confirm-dialog`): Yes/No buttons at bottom
- [x] Phase bar: 5 phases (Refresh → Draw → DON!! → Main → End) with color coding
- [x] Turn counter display
- [x] Action Button: PixiJS half-circle PASS button with hover glow effect

### Card Info Display
- [x] Card image (300x420) or placeholder
- [x] Card name, attributes, stats
- [x] Effect block: background #f3f2de, black text, 14px Inter
- [x] Trigger block: background #0f0400, white text, 14px Inter
- [x] Keyword highlighting with colored backgrounds (see KEYWORD_COLOR.md)
- [x] Non-keyword cost text (before `:`) is bolded; keywords inside cost are NOT bolded
- [x] Font: Inter (card info), 14px body, 13px attributes

### Card Interaction
- [x] Hover on hand cards shows card info (no auto-hide)
- [x] Hover on leader cards shows card info
- [x] Click on hand card shows card info
- [x] Face-down hand cards for P2

### Confirm Dialog API
- [x] `showConfirm(question, callback)` — shows dialog with question and stores callback
- [x] `hideConfirm()` — hides dialog, clears callback
- [x] `_onConfirm(result)` — passes true/false to callback
- [x] Yes button (green #4CAF50), No button (red #f44336)

### Game State
- [x] Deck shuffle (Fisher-Yates), initial 5-card draw
- [x] Life cards drawn equal to Leader Life stat
- [x] DON!! deck initialized per player
- [x] Card database with all 64 unique cards
- [x] Luffy deck (50 cards) vs Nami deck (50 cards)
- [x] GSAP-powered animation system (22 animation classes)
- [x] Render batching via `RenderBatcher.ts`

---

## PHASE 2: Card Play Mechanics ✅ COMPLETE
- [x] Play button on card info panel when cost is met
- [x] DON!! cost deduction (rest active DON!!)
- [x] Character placed in next available field slot
- [x] Max 5 characters enforced, with validation
- [x] Event card executes effect then moves to trash (structured effects + regex fallback)
- [x] Stage card placement (max 1, trash old on replace)
- [x] Smooth placement animation (`SlamAnimation`)
- [x] Card rotation for rested state visualization
- [x] Cannot play during wrong phase
- [x] End Turn button to pass to opponent
- [x] Leader damage tracking and win condition

---

## PHASE 3: Turn Management ✅ COMPLETE
- [x] TurnManager state machine (5 phases with transitions)
- [x] Refresh Phase: stand up rested cards, return DON!! to cost as rested
- [x] Draw Phase: draw 1 card, check for Trigger
- [x] DON!! Phase: draw 2 DON!! to cost area (1 on first turn)
- [x] Main Phase: player can interact freely
- [x] End Phase: button to pass turn
- [x] Phase transitions automatic (except Main → End)
- [x] Phase bar indicator updates in real time
- [x] First turn special rules enforced (1 DON!!, no draw)
- [x] Once Per Turn tracking per card

---

## PHASE 4: Combat System ⚠️ PARTIAL
- [x] Attack declaration: drag active character/leader → highlight → choose target
- [x] Target: opponent Leader or opponent's rested Character
- [x] Blocker effect: P1 UI via SelectionOverlay, P2 AI via `_aiChooseBlocker()`
- [x] Blocker activation VFX (orange glow + rest animation via `BlockerActivateAnimation` + `BlockerRestAnimation`)
- [x] Counter Phase: defender plays counter cards from hand (drag-to-play UI via `CounterPhaseOverlay`)
- [x] Counter power boosts applied to defender
- [x] Power comparison (Base + DON!! × 1000 + effect modifiers + counter boosts)
- [x] KO resolution: defender trashed (attacker never KO'd)
- [x] Leader hit: trashed 1 Life card, or deal damage if Life depleted
- [x] Damage Phase Trigger: top deck card flies to center with Trigger/Pass buttons (human + AI variants)
- [x] Attack animation (7-phase: lift, pullback, slam, impact, shockwave, bounce, rest-angle return)
- [x] Combat Zone overlay with attacker/defender info, phase label, countdown timer
- [x] AI counter animation (fly-to-center + fade-out via `AICounterAnimation`)
- [ ] DON!! attachment to attacker during battle flow — not wired into attack sequence
- [ ] KO animation during battle — `FlyToTrashAnimation` exists but not wired into `BattleManager._resolveBattleOutcome()`

---

## PHASE 5: Effect System ⚠️ PARTIAL
- [x] [On Play] effect execution — wired into character/event play flow
- [x] [On K.O.] effect execution — called from BattleManager
- [x] [When Attacking] effect execution — called from AttackInteraction with `AbilityActivateAnimation` VFX
- [x] Structured effect handlers (draw, trashFromHand, addDON, returnToBottomDeck, restOpponent, shuffleOpponentHand, addToLife, removeFromLife, giveDONToLeader, returnOpponentCharacter)
- [x] Card-specific effects: Otama, Nami (2-card pick via `CardPickAnimation`)
- [x] Event play animation (fly-to-center, cyan VFX, fly-to-trash via `EventPlayAnimation`)
- [ ] [Main] activatable effects with confirm dialog
- [ ] [Your Turn] / [Opponent's Turn] timing enforcement
- [ ] [Activate: Main] one-time activation
- [ ] [DON!! xN] requirement checking
- [ ] [DON!! -N] cost handling
- [ ] Card effects: draw, trash, reveal, return to deck/hand, etc. (only specific patterns recognized, fragile regex)

---

## PHASE 6: Trigger System ⚠️ PARTIAL
- [x] Trigger detection on draw phase — `EffectSystem.checkTrigger()` fires
- [x] Damage Phase Trigger — `DamageTriggerAnimation` with Trigger/Pass buttons
- [ ] Trigger confirm dialog (activate or skip) on Draw Phase — `SelectionOverlay.showTrigger()` exists but never called from turn flow
- [ ] Trigger effect resolution before card goes to hand
- [ ] Visual indicator when card has Trigger

---

## PHASE 7: AI Opponent ✅ COMPLETE (Basic)
- [x] AI turn auto-execution with pacing delays (`_aiTurn()`)
- [x] AI plays characters when cost met (`PlayCharacterAI`)
- [x] AI attaches DON!! to attackers (`AttachDONAI`)
- [x] AI declares attacks on player's Leader / rested chars (`AttackAI` — attacks weakest with strongest)
- [x] AI blockers trigger automatically (`_aiChooseBlocker()`)
- [x] AI counter phase: evaluates and plays counters that can win (via `AICounterAnimation`)
- [x] AI damage trigger evaluation (`AI.shouldPlayDamageTrigger()`)
- [ ] AI uses events at optimal timing
- [ ] AI activates effects via confirm dialog
- [ ] AI trigger resolution on Draw Phase

---

## PHASE 8: Win/Lose & Polish ⚠️ PARTIAL
- [x] Win screen when opponent takes final damage (leader damage tracking works)
- [ ] Lose screen when player takes final damage
- [ ] Deck-out lose condition — `deck:empty` event fires but no listener in `Game.ts` to trigger loss
- [ ] Game over overlay with restart button
- [x] Card hover glow effects
- [x] Battle animations and transitions (7-phase attack animation)
- [x] Refresh phase animation (stand up cards with activation glow via `ActiveAnimation`)
- [x] DON cost token shift animation via `CostTokenShiftAnimation`
- [x] Ghost snap-back animation on invalid drop via `SnapBackAnimation`
- [ ] KO animation during battle — characters removed silently on KO
- [ ] Battle clash/power-reveal animation
- [ ] Console error-free production build

---

## KNOWN GAPS (from MECHANIC.md, 2026-06-06)

### High Priority
| Gap | Details |
|---|---|
| DON!! attachment during battle | Not wired into attack sequence — attacker can't boost power mid-battle |
| KO animation in battle | `FlyToTrashAnimation` exists but not called from `BattleManager._resolveBattleOutcome()` |
| Trigger activation UI | Detection works, no confirmation dialog or resolution flow on Draw Phase |
| Deck-out loss condition | Event fires, nothing in `Game.ts` listens to trigger game over |

### Medium Priority
| Gap | Details |
|---|---|
| Event card playback | Fragile regex-based parsing, breaks on wording variations |
| P2 leader attack interaction | `LeaderAttackInteraction` only binds for P1 |
| P2 mulligan UI | Only P1 gets mulligan overlay |
| Stage card game logic | Renders to stage zone but no stage-specific effects or interaction |

### Low Priority
| Gap | Details |
|---|---|
| Full strategic AI | Current AI is basic — no card evaluation or resource management strategy |
| Game over screen | No visual overlay with restart button |
| Sound effects | Not implemented |
