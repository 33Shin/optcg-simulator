# OPTCG Simulation Game - Phase Breakdown

## PHASE 0: PixiJS Rendering Test ✅ COMPLETE
**Goal**: Verify PixiJS can load and display card images.
- [x] Create basic HTML with PixiJS v8 CDN import
- [x] Initialize PixiJS Application (1200x800 canvas) via `app.init()`
- [x] Load card images from assets/imgs/ using `PIXI.Assets.load()`
- [x] Display the image centered on screen
- [x] Add a simple text label showing card name
- [x] Verify no CORS or loading errors
- [x] **Deliverable**: A working HTML that shows one card sprite

## PHASE 1: Game Board Layout ✅ COMPLETE
**Goal**: Build the complete game board with all zones.
- [x] Design board container layout for standard screen size
- [x] Create zone containers: Hand, Field, Leader, DON!! Deck, Cost, Life, Trash
- [x] Implement zone labels and boundaries
- [x] Add P1 (bottom) and P2 (top) zones
- [x] Create phase indicator display at top
- [x] Create card info panel on right side
- [x] **Deliverable**: Empty game board with all zones visible

## PHASE 2: Card Data System ✅ COMPLETE
**Goal**: Load all card data and build both decks.
- [x] Create Card data classes from GAME/ deck files
- [x] Parse BLUE_PURPLE_LUFFY.md into card objects
- [x] Parse BLUE_YELLOW_NAMI.md into card objects
- [x] Build Deck class with 50 cards
- [x] Implement deck shuffling (Fisher-Yates)
- [x] Implement draw function
- [x] Display card sprites in hand zones from GAME/ data
- [x] **Deliverable**: Both decks load with correct cards visible in hand

## PHASE 3: Turn and Phase System ✅ COMPLETE
**Goal**: Implement the 5-phase turn structure.
- [x] Create TurnManager with Refresh → Draw → DON!! → Main → End phases
- [x] Auto-execute Refresh Phase (stand up cards, reset DON!! to cost, `ActiveAnimation` VFX)
- [x] Auto-execute Draw Phase (draw 1 card from deck, show trigger)
- [x] Auto-execute DON!! Phase (draw 2 DON!! to cost area, `DONSlamAnimation` + `CostTokenShiftAnimation`)
- [x] Main Phase activates (player input enabled)
- [x] End Phase button to pass turn
- [x] First turn rules (1 DON!!, no draw)
- [x] **Deliverable**: Turn flow works with phase transitions and counter display

## PHASE 4: Card Play Mechanics ✅ COMPLETE
**Goal**: Player can play Characters and Events from hand.
- [x] Click hand card → show in info panel with effect text
- [x] Play Character: check DON!! cost → rest DON!! → place on field
- [x] Play Event: check DON!! cost → rest DON!! → execute effect → trash
- [x] Max 5 characters on field limit
- [x] Character placement animation
- [x] Card discard to trash animation
- [x] **Deliverable**: Characters and Events playable from hand to field

## PHASE 5: DON!! System ✅ COMPLETE
**Goal**: Full DON!! resource management.
- [x] DON!! deck tracking (10 cards total)
- [x] Cost area: rest/stand DON!! for payments
- [x] Attach DON!! to Leader/Characters for +1000 power
- [x] DON!! attached during attack give power boost
- [x] Return attached DON!! to deck during Refresh
- [x] Visual indicators for active vs rested DON!!
- [x] **Deliverable**: DON!! system fully tracks and manages resources

## PHASE 6: Attack and Battle ⚠️ PARTIAL
**Goal**: Implement combat system.
- [x] Select active character → declare attack target (P2 Leader or rested character)
- [ ] Attach DON!! to attacker before battle (during battle flow)
- [x] Rest attacking character
- [x] Compare power (base + DON!! + modifiers)
- [x] Attacker wins: defender KO'd, moved to trash
- [x] Defender wins: nothing KO'd, attacker rests
- [x] Tie: defender loses (same as attacker wins)
- [x] Damage to Leader: move Life card to Life pile
- [x] Blocker effect: opponent may rest Blocker character to redirect (VFX via `BlockerActivateAnimation` + `BlockerRestAnimation`)
- [x] Counter Phase: defender plays counter cards from hand (via `CounterPhaseOverlay`)
- [x] Damage Phase Trigger: top deck card with Trigger/Pass buttons (human + AI variants via `DamageTriggerAnimation`)
- [x] AI counter animation (fly-to-center + fade-out via `AICounterAnimation`)
- [ ] KO animation during battle — `FlyToTrashAnimation` not wired into `BattleManager`
- [ ] **Deliverable**: Full battle resolution with attack mechanics (missing DON attachment + KO animation during battle)

## PHASE 7: Effects and Triggers ⚠️ PARTIAL
**Goal**: Implement card abilities.
- [x] On Play effects resolve when character enters field
- [x] On K.O. effects resolve when character is defeated
- [x] When Attacking effects trigger during battle (VFX via `AbilityActivateAnimation`)
- [x] Counter effects trigger during opponent's attack
- [x] Blocker effects redirect attacks — fully implemented with P1 UI + P2 AI
- [x] Once Per Turn tracking
- [x] Event play animation (fly-to-center, cyan VFX, fly-to-trash via `EventPlayAnimation`)
- [x] Card pick animation for multi-card effects (Nami-specific 2-card pick via `CardPickAnimation`)
- [ ] Trigger check on draw (show trigger card, resolve effect) — `checkTrigger()` fires but no UI confirmation
- [ ] [Main] activatable effects with confirm dialog
- [ ] [Your Turn] / [Opponent's Turn] timing enforcement
- [ ] [DON!! xN] requirement checking
- [ ] [DON!! -N] cost handling
- [ ] **Deliverable**: All card effects functional for both decks

## PHASE 8: AI Opponent ✅ COMPLETE (Basic)
**Goal**: Nami deck plays automatically.
- [x] AI turn: auto-execute all phases
- [x] AI plays characters based on available resources (`PlayCharacterAI`)
- [x] AI attaches DON!! strategically (`AttachDONAI`)
- [x] AI declares attacks by power comparison (`AttackAI`)
- [x] AI blockers trigger automatically
- [x] AI counter phase: evaluates and plays counters (via `AICounterAnimation`)
- [x] AI damage trigger evaluation (`AI.shouldPlayDamageTrigger()`)
- [ ] AI uses events at appropriate timing
- [ ] AI responds to triggers on Draw Phase
- [x] **Deliverable**: Player can fight a basic automated Nami opponent

## PHASE 9: Polish and End Game ⚠️ PARTIAL
**Goal**: Final touches and game completion.
- [x] Win condition: opponent has 0 Life cards
- [ ] Lose condition: deck runs out of cards — `deck:empty` event fires but no listener in `Game.ts`
- [ ] Game over screen with result
- [ ] Restart button
- [x] Card hover effects and tooltips
- [x] Smooth animations for all card movements (22 GSAP-powered animation classes)
- [x] Refresh phase animation (stand up cards with activation glow)
- [x] DON cost token shift animation
- [x] Ghost snap-back animation on invalid drop
- [ ] KO animation during battle — `FlyToTrashAnimation` exists but not wired into `BattleManager._resolveBattleOutcome()`
- [ ] Battle clash/power-reveal animation
- [ ] Sound effects (optional)
- [ ] **Deliverable**: Complete, polished game ready for playtesting
