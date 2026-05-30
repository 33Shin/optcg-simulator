# OPTCG Simulator — Glossary of Terms

> Reference for every term, concept, UI element, and mechanic used in the project.

---

## Table of Contents
- [Game Zones](#game-zones)
- [Card Types & Properties](#card-types--properties)
- [Turn Phases](#turn-phases)
- [DON!! System](#don-system)
- [Combat & Battle](#combat--battle)
- [Effects & Abilities](#effects--abilities)
- [UI Elements](#ui-elements)
- [Game State & Flow](#game-state--flow)
- [Animations](#animations)
- [AI System](#ai-system)
- [Internal Architecture Terms](#internal-architecture-terms)

---

## Game Zones

| Term | Description |
|---|---|
| **Deck** | The player's main 50-card draw pile. Cards are face-down and drawn from the top during the Draw Phase. When the deck reaches 0 cards, the player loses immediately. |
| **Hand** | Cards currently held by a player after drawing from the Deck. Only visible to the owner. There is no hard hand-size limit in this implementation. |
| **Field** | The active play area where Character cards are placed. A maximum of 5 Characters can occupy the field at once, each in its own slot (`field_slot_0` through `field_slot_4`). |
| **Leader Zone** | The designated area on the board where the player's Leader card is displayed face-up. One per player. |
| **DON!! Deck** | A separate 10-card resource deck used exclusively for DON!! tokens. Each player has their own DON!! deck. Exhaustion of this deck is NOT a win condition. |
| **Cost Area** | The zone where drawn DON!! tokens are placed face-up. Active (non-rested) DON!! in the Cost Area can be rested to pay card costs, or attached to Characters/Leader for power boosts. |
| **Life Zone** | Holds face-down Life cards equal to the Leader's Life stat at game start. Each successful attack on a depleted Leader removes one Life card. When all Life cards are gone, further hits deal damage to the opponent. |
| **Trash** | The discard pile where used Event cards, KO'd Characters, and spent Life cards go. The Trash is public (visible to both players). |

---

## Card Types & Properties

### Card Categories

| Term | Description |
|---|---|
| **Leader** | A unique card representing the player's commander. Stays in the Leader Zone throughout the game. Has Power, Life, Attribute, Color(s), and Effects. Determines deck color restrictions. Identified by `isLeader: true`. |
| **Character** | Cards played from Hand to Field during Main Phase. Have Cost (DON!! required to play), Power, Counter value, Attribute, Type, Color, and Effects. Max 5 on field at once. Can attack, be attacked, and have DON!! attached. |
| **Event** | One-shot effect cards played from Hand. Execute their effect immediately, then go to Trash. Have Cost and Timing (e.g., `[Main]`, `[Counter]`). |
| **Stage** | Location cards with ongoing effects. Max 1 per player at a time; playing a new Stage trashes the existing one. (Partially implemented.) |
| **DON!! Card** | Identical resource cards drawn from the DON!! Deck during the DON!! Phase. Not in the main deck. Tracked as objects with `active` and `rested` boolean properties. |

### Card Properties

| Term | Description |
|---|---|
| **Cost** | The number of active DON!! tokens that must be rested from the Cost Area to play a Character or Event card. |
| **Power** | The base combat strength of a Leader or Character card. Total power = Base Power + (DON!! attached × 1000) + effect modifiers. Expressed as `currentPower` getter in code. |
| **Counter** | A special value on Character cards used during the Counter Step. When trashed from hand, this value is added to the attacked target's power for that battle only. Free to use (no DON!! cost). |
| **Life** | The Life stat of a Leader card. Determines how many Life cards are placed at game start and how much damage it takes to defeat the opponent through this Leader. |
| **Attribute** | A classification tag on cards (e.g., "Pirate", "Marine", "None"). Used for effect targeting. |
| **Color** | One or more color tags (Blue, Red, Yellow, Green, Purple). All non-Leader cards in a deck must match at least one color of the Leader. |
| **Type** | A text description of what the card represents (e.g., "Straw Hat Pirates"). |
| **Rarity** | The collectible rarity of the physical card (C, UC, SC, SSS, etc.). Cosmetic only in gameplay. |
| **Set / Number** | Metadata identifying which expansion set and card number this entry belongs to (e.g., `OP01-001`). |

### Card States

| Term | Description |
|---|---|
| **Rested** | A state indicating a card has been used this turn. Rested cards cannot attack or have effects activated. Characters and DON!! tokens can be rested. Reset during Refresh Phase. |
| **Active (or Stood)** | The opposite of Rested. An active card can be used for attacks, effects, and paying costs. |
| **Played This Turn** | A flag (`playedThisTurn`) on Character cards to track summoning-sickness-like restrictions. |
| **DON!! Attached** | Count (`donAttached`) of DON!! tokens currently attached to a Character or Leader for power boost. Each adds +1000 Power. |

---

## Turn Phases

The game follows a 5-phase turn structure: `REFRESH → DRAW → DON!! → MAIN → END`. The first three phases auto-execute; Main waits for player input; End is manual (button click or AI).

| Term | Description |
|---|---|
| **Refresh Phase** | Auto-executed. Returns all attached DON!! to the Cost Area as rested. Stands up all rested Characters, Leader, and DON!! tokens. |
| **Draw Phase** | Auto-executed. The active player draws 1 card from their Deck. Trigger abilities on the drawn card are checked before it goes to hand. First player skips this phase on turn 1. |
| **DON!! Phase** | Auto-executed. The active player draws DON!! tokens (2 normally, 1 on first turn) and places them face-up in the Cost Area as active. |
| **Main Phase** | Player-controlled. The active player may play cards, attach DON!!, activate effects, and declare attacks in any order, any number of times. |
| **End Phase** | Manual (click PASS button or AI auto-ends). Ends the current turn, switches to the opponent, and begins their Refresh Phase. |

---

## DON!! System

| Term | Description |
|---|---|
| **DON!! Draw** | The action of drawing a DON!! token from the DON!! Deck during the DON!! Phase. Animated with a slam effect onto the Cost Area. |
| **DON!! Rest (for Cost)** | Resting active DON!! tokens in the Cost Area to pay for playing a card. The number rested must equal or exceed the card's Cost. |
| **DON!! Attach** | Taking an active DON!! token from the Cost Area and attaching it to a Character or Leader on the field, giving +1000 Power. Animated with a gold burst effect. |
| **DON!! Return (Refresh)** | During Refresh Phase, all attached DON!! return to the Cost Area as rested tokens. |
| **DON!! Token** | A visual representation of a DON!! card in the Cost Area. Small circular/rectangular sprite showing active or rested state. |

---

## Combat & Battle

### Attack Flow

| Term | Description |
|---|---|
| **Declare Attack** | The action of resting an attacking Character or Leader and choosing a target (opponent's Leader or a rested opponent Character). Initiated by dragging the card toward the target. |
| **Attack Animation** | A 7-phase visual sequence: lift, pullback, slam, impact, shockwave, bounce, rest-angle return. See `GAME/ANIMATION.md` for details. |
| **Power Comparison** | The core of battle resolution. Total power = Base Power + (DON!! attached × 1000) + effect modifiers + counter boosts. Higher power wins. |
| **Battle Result: Attacker Wins** | If attacking a Character, the defender is KO'd and trashed. If attacking the Leader, one Life card is removed (or damage dealt if no Life cards remain). |
| **Battle Result: Defender Wins** | Nothing is KO'd. The attacker simply rests. |
| **Battle Result: Tie** | Defender loses. Same as Attacker Wins — defender is KO'd (or Leader takes damage). Attacker simply rests. |

### Counter Step

| Term | Description |
|---|---|
| **Counter Step** | A sub-phase during battle, after target declaration but before power comparison. The defending player may trash cards from hand to boost the attacked card's power for that battle only. Multiple counters can be chained. |
| **Character Counter** | Trashing a Character with a `counter` value from hand for FREE (no DON!! cost). The attacked target gains power equal to the trashed character's counter value. |
| **Event Counter** | Playing an Event card with `[Counter]` timing during the opponent's attack. Must pay normal DON!! Cost. Resolves immediately, then goes to Trash. |
| **Counter Phase Overlay** | A full-screen UI overlay that dims everything except the attacker and target cards, showing available counter cards in hand with drag-to-trash interaction. Includes a "Process Battle" button to skip counting. |

### Blocker System

| Term | Description |
|---|---|
| **Blocker** | A keyword ability on certain Character cards. When an opponent declares an attack, the defending player may rest a Blocker character to redirect the attack to themselves instead of the original target. Only 1 Blocker per attack. Must be active (not rested). |
| **Blocker Selection Overlay** | A dialog that appears when the defender has available Blockers, showing each blocker's name and power with buttons to select or skip. |

### KO (Knock Out)

| Term | Description |
|---|---|
| **KO** | When a Character loses a battle (or is destroyed by an effect), it is "knocked out" — removed from the Field and sent to Trash. Any DON!! attached to the KO'd card returns to the Cost Area as rested. |

---

## Effects & Abilities

### Effect Timings

| Term | Description |
|---|---|
| **[On Play]** | Triggers when a Character enters the field during Main Phase. Processed by `EffectSystem.processOnPlay()`. |
| **[On K.O.]** | Triggers when a Character is KO'd and sent to Trash. Processed by `EffectSystem.processOnKO()`. |
| **[When Attacking]** | Triggers during battle, after the attack is declared but before power comparison. Processed by `EffectSystem.processWhenAttacking()`. |
| **[Main]** | Activatable only during Main Phase. |
| **[Counter]** | Playable during opponent's Counter Step. See Counter Step above. |
| **[Trigger]** | Activates when the card is drawn from the Deck, before it goes to hand. Checked by `EffectSystem.checkTrigger()`. |
| **[Blocker]** | Rest this Character to redirect an incoming attack. Parsed via `_parseBlocker()` in `CharacterCard`. |

### Effect Types (Structured)

| Term | Description |
|---|---|
| **draw** | Draw N cards from Deck to Hand. |
| **trashFromHand** | Trash N cards from Hand to Trash. |
| **addDON** | Add a DON!! token from DON!! Deck to Cost Area as active. |
| **returnToBottomDeck** | Return N cards from Hand to the bottom of the Deck. |
| **restOpponent** | Rest one of the opponent's active Characters (optionally filtered by max cost). |
| **shuffleOpponentHand** | Shuffle the opponent's hand back into their deck, then draw 5 new cards. |
| **addToLife** | Add a card to the Life Zone from Deck or Hand. |
| **removeFromLife** | Remove a card from the opponent's Life Zone and return it to the owner's Hand. |
| **giveDONToLeader** | Attach a rested DON!! token from Cost Area directly to the player's Leader. |
| **returnOpponentCharacter** | Return one of the opponent's Characters from Field back to their Hand (optionally filtered by max cost). |

---

## UI Elements

### Phase Bar

| Term | Description |
|---|---|
| **Phase Bar** | A horizontal progress bar displayed near the center-bottom of the screen. Shows all 5 phases (`REFRESH`, `DRAW`, `DON!!`, `MAIN`, `END`) with color-coded segments: passed (cyan), active (blue highlight), future (dimmed). Arrows between segments indicate progression direction. |

### Action Button

| Term | Description |
|---|---|
| **Action Button** | A half-circle PixiJS button positioned right of the Phase Bar. Changes appearance based on game state: shows `PASS` during Main Phase (clickable, red) to end turn; dimmed and non-clickable during auto-phases; shows `RESTART` after game over (green). Has hover glow effect (GlowFilter matching stroke color) and text scale 1.15x. Callback fires on `pointerup`. |

### Combat Zone

| Term | Description |
|---|---|
| **Combat Zone** | A PixiJS overlay that appears during battle, covering the phase bar. Shows attacker/defender names and power values, current battle phase label, and a countdown timer. Phases: ATTACK DECLARED → BLOCKER PHASE → COUNTER PHASE → BATTLE RESOLUTION. Auto-hides when battle resolves. |

### Card Info Panel

| Term | Description |
|---|---|
| **Card Info Panel** | An HTML overlay panel on the right side of the screen that displays detailed information about a selected card: image, name, category, set, number, color, attribute, rarity, type, cost, power, counter value, life, and effect text with keyword highlighting. May include a Play button for playable cards. |

### Overlays & Dialogs

| Term | Description |
|---|---|
| **Game Overlay** | The HTML overlay container (`#game-overlay`) that holds the Card Info Panel, Mulligan Panel, Battle Mode indicator, and Confirm Dialog. Positioned on the right side of the screen. |
| **Mulligan Panel** | A dialog shown at game start asking P1 whether to keep their initial 5-card hand or mulligan (redraw all 5). Contains "Keep Hand" (green) and "Mulligan" (orange) buttons. |
| **Confirm Dialog** | A generic yes/no confirmation dialog used for messages like win/loss notifications, error warnings, and restart prompts. |
| **Battle Mode Indicator** | A small status bar (`#battle-mode`) that shows the current battle selection state: "Select field card", "Leader selected", "Select a target", or "No selection". Color-coded (green/orange/red/blue). |

### Board Elements

| Term | Description |
|---|---|
| **Game Board** | The main PixiJS canvas area where all game visuals are rendered. Contains zones, cards, DON!! tokens, and animations. |
| **Zone Labels** | Text labels above each zone showing the current card count (e.g., "Deck: 45", "Hand: 6", "Trash: 3"). |
| **Life Indicators** | Visual markers in the Life Zone showing remaining Life cards as face-down card backs. |
| **Cost Tokens** | Small DON!! token sprites rendered in the Cost Area, showing active (bright) or rested (dimmed) state. Draggable during Main Phase to attach to Characters/Leader. |

---

## Game State & Flow

### Player Object

| Term | Description |
|---|---|
| **Player** | An internal object representing one side of the game, containing: `deck` (Deck instance), `hand` (card array), `field` (5-slot array), `leader` (LeaderCard), `life` (Life card array), `trash` (discarded cards), `donDeck` (DON!! tokens), `costArea` (active DON!! tokens). |

### Game State Properties

| Term | Description |
|---|---|
| **turnCount** | Counter tracking how many full turns have elapsed. Increments at the start of each new player's turn. |
| **currentPlayer** | ID (`1` or `2`) of the player whose turn it currently is. |
| **currentPhase** | String indicating the active phase: `'refresh'`, `'draw'`, `'don'`, `'main'`, or `'end'`. |
| **phaseLocked** | Boolean flag preventing player input during auto-executed phases (Refresh, Draw, DON!!). Unlocked only during Main Phase. |
| **gameOver** | Boolean flag set to `true` when a win condition is met. Stops all interactions. |
| **winner** | Player ID (`1` or `2`) of the winning player. Set when `gameOver` becomes true. |
| **leaderDamage** | Object tracking cumulative damage dealt to each player's Leader (e.g., `{ 1: 0, 2: 3 }`). Damage only matters after Life cards are depleted. |

### Game Flow Terms

| Term | Description |
|---|---|
| **Mulligan** | The option at game start for P1 to discard their initial 5-card hand and draw 5 new cards. Animated with cards flying back to deck, shuffle animation, then redraw. |
| **Life Commit** | At game setup, cards equal to the Leader's Life stat are drawn from the Deck and placed face-down in the Life Zone. Animated via `CommitLifeAnimation`. |
| **Win Condition** | Deal damage to the opponent's Leader when they have 0 Life cards remaining. Alternatively, if a player's deck reaches 0 cards (not yet implemented as loss trigger). |

---

## Animations

### Animation Names

| Term | Description |
|---|---|
| **Initial Draw** | Animated sequence of drawing the first 5 cards from Deck to Hand at game start. Cards fly one by one from the deck zone to hand positions. |
| **DON!! Slam** | Visual effect when a DON!! token is drawn during DON!! Phase. Token slams onto the Cost Area with impact animation. |
| **DON!! Burst** | Gold burst + screen shake + power count-up animation triggered when attaching DON!! to a Character or Leader, or when applying counter boosts. |
| **DON!! Detach** | Animation played at End Phase showing attached DON!! tokens detaching from Characters/Leader and returning toward the Cost Area. |
| **Shuffle** | Deck shuffle animation played during Mulligan. Cards visually shuffle in the deck zone. |
| **Slam** | Card slam effect when playing a Character to the field. The card slams down onto the target slot with impact. |
| **Fly To Trash** | Animation of a KO'd or replaced card flying from its current position to the Trash zone. |
| **Fly To Bottom Deck** | Animation of cards being returned to the bottom of the deck (used by effect resolution). |
| **Attack Animation** | Multi-phase combat animation: attacker lifts, pulls back, rotates toward target, slams into target, impact shockwave, bounce, then returns to rest angle. |
| **Ability Activate** | Visual glow/pulse effect on a card when its ability triggers (On Play, When Attacking, etc.). |
| **AI Play Animation** | Visual feedback showing that the AI opponent is performing an action (playing cards, attaching DON, attacking). |
| **Countdown** | Pre-game countdown animation before the mulligan prompt appears. |

---

## AI System

| Term | Description |
|---|---|
| **AI Opponent** | Player 2, controlled by the AI system. Currently uses a basic behavior tree that plays characters, attaches DON!!, and attacks in sequence during Main Phase, then auto-ends turn. |
| **PlayCharacterAI** | AI behavior module that evaluates hand for playable Characters and selects the highest-power card to play. |
| **AttachDONAI** | AI behavior module that attaches available DON!! tokens to field characters and leader. |
| **AttackAI** | AI behavior module that selects the strongest attacker and weakest target, then initiates battle. |
| **AI Blocker Choice** | When defending against an attack, the AI evaluates available Blockers and picks one that can win, or the highest-power blocker if none can guarantee a win. Skips blocking if no viable option exists. |

---

## Internal Architecture Terms

### Core Classes

| Term | Description |
|---|---|
| **Game** | The main orchestrator class (`js/core/Game.js`). Owns all game state, wires every system and renderer together, manages event listeners, handles render scheduling, and coordinates the turn flow. |
| **EventBus** | A pub/sub event system (`js/core/EventBus.js`) used for cross-system communication. Key events: `phase:change`, `main:ready`, `draw:complete`, `effect:onPlay`, `effect:onKO`, `card:KO`, `leader:damage`, `life:lost`, `don:drawn`, `refresh:complete`. |
| **TurnManager** | 5-phase state machine (`js/game-systems/TurnManager.js`). Manages phase transitions, auto-executes Refresh/Draw/DON phases, locks/unlocks player input. |
| **DONSystem** | Handles all DON!! token operations: drawing, resting for cost, attaching to cards, returning on refresh, and saving/restoring state across turn boundaries. |
| **CombatSystem** | Low-level combat logic (`js/game-systems/CombatSystem.js`). Calculates power, handles KO (removing card from field, sending to trash), and deals Leader damage via Life card removal. |
| **EffectSystem** | Processes card effects at various timings: On Play, On KO, When Attacking, Trigger, Counter. Includes structured effect handlers for common effect types. |
| **RenderBatcher** | Utility that coalesces multiple render calls into a single frame to prevent redundant re-renders. Used via `game.scheduleRender()`. |

### Managers

| Term | Description |
|---|---|
| **AnimationManager** | Central hub for all animations (`js/core/AnimationManager.js`). Wraps individual animation classes and provides unified API for triggering draw, DON, attack, slam, trash, shuffle, and ability activation animations. |
| **BattleManager** | Orchestrates the full battle flow: triggers When Attacking effects, runs attack animation, resolves power comparison, handles KO, shows battle result UI. |
| **DragManager** | Handles all PixiJS drag-and-drop interactions (`js/core/DragManager.js`). Supports four drag types: `handCard` (play character), `donToken` (attach DON), `fieldCard` (attack with character), and `leader` (attack with leader). Manages ghost sprites, drop target detection, highlights, snap-back animations. |
| **ZoneManager** | Abstraction for accessing named zones on the game board (`js/ui/ZoneManager.js`). Zone names: `deck`, `hand`, `trash`, `life`, `dondeck`, `cost`, `leader`, and `field_slot_0` through `field_slot_4`. |

### Interaction Classes

| Term | Description |
|---|---|
| **PlayCardInteraction** | Handles the drag-from-hand-to-field flow for playing Character cards. Validates cost, manages slot occupancy (KO's existing card), triggers slam animation and On Play effects. |
| **AttachDONInteraction** | Handles dragging DON!! tokens from Cost Area to Characters/Leader. Triggers DON burst animation and power count-up. |
| **AttackInteraction** | Handles the full attack flow: drag field card or leader toward target, Blocker phase, Counter Phase overlay, battle resolution, and post-battle re-rendering. |

### Renderers

| Term | Description |
|---|---|
| **CardRenderer** | Low-level renderer that creates PixiJS sprites for individual cards (`js/ui/CardRenderer.js`). Handles card image textures, power text overlays, counter badges, cost badges, and drag ghost creation. |
| **HandRenderer** | Renders all cards in a player's hand zone with proper layout, spacing, and interaction bindings. Includes ready-glow animation for playable cards. |
| **FieldRenderer** | Renders Characters on the field slots and Leaders in their zones. Handles rested/active visual states, DON!! attachment display, and attack interaction binding. |
| **ZoneRenderer** | Renders zone labels with card counts, DON!! cost tokens (with drag interaction), Life indicators, and stage cards. |

### Other Internal Terms

| Term | Description |
|---|---|
| **RenderBatcher** | Utility that coalesces multiple render calls into a single frame to prevent redundant re-renders. Used via `game.scheduleRender()`. |
| **SelectionOverlay** | Reusable overlay component for showing choice dialogs: Mulligan prompt, Blocker selection, and generic button-based prompts. |
| **CounterPhaseOverlay** | Specialized full-screen overlay for the Counter Step during battle. Dims non-relevant elements, highlights counter-able cards in hand, provides drag-to-trash interaction and "Process Battle" button. Has a 15-second auto-resolve timeout to prevent game hangs. |
| **KeywordHighlighter** | Utility that scans effect text for recognized keywords (e.g., `Draw`, `Trash`, `DON!!`, `Power`) and applies color highlighting in the Card Info Panel. |
