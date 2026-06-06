# One Piece Card Game - Game Mechanics

## Core Concepts

### Card Zones
1. **Deck** - 50-card main deck, face-down. Draw from top.
2. **Hand** - Cards drawn from deck. Max visible to owner only.
3. **Field** - Active Characters up to 5 slots and Leader card
4. **DON!! Deck** - Separate 10-card resource deck
5. **Cost Area** - DON!! cards available to pay costs (face-up)
6. **Life** - Face-down cards from deck. Number = Leader Life stat
7. **Trash** - Discarded cards (Events, KO'd Characters, etc.). Cards are displayed face-up. Hovering shows card info.

### DON!! System (Resources)
- DON!! is NOT in the main deck; it's a separate 10-card deck
- Each turn during DON!! Phase, draw 2 DON!! to Cost Area (1 on first turn)
- To play a card, REST DON!! equal to the card's cost
- To attach DON!! to a Character/Leader, take ACTIVE (not rested) DON!! from Cost Area
- Each DON!! attached gives +1000 power
- During Refresh Phase, all attached DON!! return to Cost Area as rested
- DON!! given to Characters during play stay with them until KO'd or Refresh

### Turn Structure (5 Phases)
1. **Refresh Phase**
   - Move all DON!! attached to Leader/Characters back to Cost Area as rested
   - Stand up all rested cards (Leader, Characters)

2. **Draw Phase**
   - Draw 1 card from deck
   - Check for Trigger: if drawn card has Trigger ability, you may activate it
   - First player skips Draw on turn 1

3. **DON!! Phase**
   - Draw 2 DON!! cards to Cost Area active
   - First player draws only 1 DON!! on turn 1

4. **Main Phase**
   - Play cards from hand (Characters, Events, Stages)
   - Attach DON!! to Leader or Characters
   - Activate card effects
   - Declare attacks

5. **End Phase**
   - Unplayed effects expire
   - Turn passes to opponent

### Playing Cards
- **Characters**: Pay cost (rest DON!!) → place active in Field. Max 5 Characters.
- **Events**: Pay cost → execute effect → trash immediately
- **Stages**: Pay cost → place in Stage area. Max 1 per player. Replace by trashing old.

### Cost System
- Cost = number of DON!! to rest from Cost Area
- DON!! must be active (not already rested) to rest for cost
- Paying cost is NOT optional once you commit to playing

### Combat System
1. **Declare Attack**: Rest attacking Character/Leader, choose target
   - Target: opponent's Leader or opponent's rested Character
2. **DON!! Attachment**: Attach active DON!! from Cost to attacker for + power
3. **Power Comparison**: Total power = Base + DON!! count * 1000 + modifiers
4. **Battle Result**:
    - Attacker never goes to trash from losing combat
    - Defender power < attacker power: defender is KO'd → trashed (or Leader takes damage)
    - Defender power = attacker power (tie): defender is KO'd → trashed; attacker just rests
    - Defender power > attacker power: nothing is KO'd; attacker just rests
5. After battle: resting DON!! attached to KO'd Character move to Trash

### Trigger System
- When drawing a card with a Trigger ability, you may activate it
- Trigger activates before placing card in hand
- Some Triggers play card directly, draw cards, etc.
- After Trigger resolves, remaining card goes to hand normally

### Blocker System
- During opponent's attack, after target is declared
- May rest a Character with Blocker to redirect attack to yourself
- Only 1 Blocker can be used per attack
- Blocker Character must be active (not rested/knocked out)

### Counter System (Counter Step)
During battle, after the attack target is declared and before power comparison, the **defending player** may counter by trashing cards from hand to boost the attacked card's power for that battle only:

1. **Character with Counter Power**: Any Character whose `counter` value is not null can be trashed from hand for **FREE** (no DON!! cost). The attacked target gains power equal to the trashed character's `counter` value.
2. **Event with [Counter] timing**: Event cards with a `[Counter]` effect can be played, but the player **must pay their normal DON!! cost**. The event resolves immediately, then goes to Trash.

The defender may counter multiple times in one battle (any number of characters and/or events). All counter power boosts expire after this single battle — the target's power returns to its non-counter value afterward.

### Key Ability Timings
- **[On Play]**: Triggers when Character enters field and resolves
- **[On K.O.]**: Triggers when Character is KO'd and sent to trash
- **[When Attacking]**: Triggers during battle, after attack declared
- **[Main]**: Activatable during Main Phase only
- **[Your Turn]**: Activatable anytime during your turn
- **[Opponent's Turn]**: Activatable during opponent's turn
- **[Activate: Main]**: One-time use effect during Main Phase
- **[DON!! xN]**: Requires N DON!! attached to use ability
- **[DON!! -N]**: Must return N DON!! to DON!! deck to activate
- **[Once Per Turn]**: Can only activate once per turn
- **[Counter]**: Playable during opponent's attack step
- **[Blocker]**: Rest to redirect incoming attack

### Power Modifiers
- Base power on card
- Each DON!! attached: +1000
- Effect boosts: temporary until end of turn/battle
- Counter effects: apply during battle only
- Counter/Slash bonuses: some cards have fixed counter values

### Life System
- Life cards are face-down cards from deck, equal to Leader Life stat
- Attacking Leader when opponent has Life cards: no damage
- Attacking Leader when opponent has 0 Life cards: opponent takes damage
- When a Character attacks Leader, it doesn't matter, only when Life is depleted
- Damage = 1 card from Life per hit, once Life is empty

### Win Conditions
- **Primary**: Attack opponent's Leader when they have 0 Life cards
- **Secondary**: Opponent's deck runs out of cards (they lose immediately)

### Win Flow (Detailed)
1. Attack opponent's Leader
2. If opponent has Life cards → opponent trashes 1 from Life to bottom of Life pile
3. If opponent has 0 Life cards → opponent takes 1 damage
4. Leader damage = Leader Life (default 4) → 4 hits to empty Life + 1 more hit to deal damage = 5 total hits
5. Leader Life stat determines initial Life cards only, Leader can absorb damage after Life is exhausted

### Color Restrictions
- All cards in deck must match at least one color of the Leader
- Blue/Purple Leader: may play Blue, Purple, or Blue/Purple cards
- Yellow/Blue Leader: may play Yellow, Blue, or Yellow/Blue cards

### Special Rules
- First player: 1 DON!!, no draw on turn 1
- Cards returned to deck are shuffled unless specified
- "Place at top/bottom" means in chosen order
- "Return to owner's deck" applies to any player's card
- Trash pile is shared and visible

---

## Implementation Status (as of 2026-06-06)

### Implemented
| Feature | Status | Notes |
|---|---|-|
| Card zones (deck, hand, field, life, DON!!, cost, trash, leader, stage) | ✅ | All zones rendered via `ZoneRenderer.ts` |
| Turn phases (Refresh → Draw → DON!! → Main → End) | ✅ | Phase bar updates visually via `PhaseBar.ts` with animated fill |
| DON!! system (draw, rest, attach, return on refresh) | ✅ | Data-level + cost token rendering + attach animation + cost token shift animation |
| Card play (characters to field) | ✅ | Drag-to-field + click-to-play via info panel + `SlamAnimation` |
| Battle resolution (attacker vs defender power comparison) | ✅ | Target selection UI, KO logic, win condition, leader damage tracking |
| Battle attack animation | ✅ | 7-phase: lift, pullback, slam, impact, shockwave, bounce, rest-angle return (see ANIMATION.md) |
| Mulligan (P1 only) | ✅ | Full animation via `SelectionOverlay` + mulligan flow in `InitialDrawAnimation` (see ANIMATION.md) |
| Card info panel with keyword highlighting | ✅ | Play button, enable/disable logic via `CardInfoPanel` + `KeywordHighlighter` |
| P2 AI opponent | ✅ | 4 AI classes (`AI.ts`, `PlayCharacterAI`, `AttachDONAI`, `AttackAI`) — plays characters, attaches DON, attacks by power, evaluates damage triggers |
| Life-card commit animation | ✅ | Animated via `CommitLifeAnimation` with fly-to-life-zone sequence |
| DON!! attach animation | ✅ | Gold burst + screen shake + power count-up via `DONBurstAnimation` + `PowerCountAnimation` |
| Slam animation (play to field) | ✅ | Card slam effect via `SlamAnimation` |
| Fly-to-trash animation | ✅ | Used when replacing characters on play via `FlyToTrashAnimation` |
| AI play animation | ✅ | Visual feedback for AI actions via `AIPlayAnimation` |
| AI counter animation | ✅ | AI counter card fly-to-center + fade-out via `AICounterAnimation` |
| Refresh phase animation | ✅ | Stand up rested cards/DON with activation glow via `ActiveAnimation` |
| Blocker system | ✅ | `CharacterCard._parseBlocker()` detects keyword. `_checkBlockerPhase()` intercepts battle flow. P1 gets SelectionOverlay UI. P2 uses `_aiChooseBlocker()`. Blocker VFX via `BlockerActivateAnimation` + `BlockerRestAnimation`. |
| Counter Phase | ✅ | `AttackInteraction._counterPhase()` + `CounterPhaseOverlay` UI for defender. DON cost charged, power boost applied. Combat Zone overlay with countdown timer. 15s auto-resolve timeout. Hand re-rendered after counter phase. |
| Damage Phase Trigger | ✅ | `DamageTriggerAnimation` (human + AI variants). Top deck card flies from deck to center with flip animation. Trigger/Pass buttons. AI evaluates via `AI.shouldPlayDamageTrigger()`. |
| [On Play] effects | ✅ | Wired into character/event play flow via `EffectSystem.processOnPlay()` |
| [On K.O.] effects | ✅ | Called from `BattleManager._resolveBattleOutcome()` |
| [When Attacking] effects | ✅ | Called from `AttackInteraction.resolveBattle()` with `AbilityActivateAnimation` VFX |
| Event play animation | ✅ | Event card fly-to-center, cyan VFX, fly-to-trash via `EventPlayAnimation` |
| Card pick animation | ✅ | Card selection overlay for multi-card effects via `CardPickAnimation`. Nami-specific 2-card pick with top/bottom deck placement. |
| Action Button hover/press effects | ✅ | GlowFilter hover effect, text scale 1.15x, callback fires on `pointerup` with fallback for state race |
| Combat Zone overlay | ✅ | PixiJS overlay showing attacker/defender info, phase label, countdown timer |
| Action Button state management | ✅ | 3 states (endTurn/disabled/gameOver). During battle, `_inBattle` guard prevents state override. Ticker respects battle-managed button state. |
| Hand interaction guards | ✅ | `PlayCardInteraction.onHandCardDrag` checks `game._animating` to reject drags during battle animations |
| GSAP-powered animations | ✅ | All 22 animation classes use GSAP. Shared utilities in `Animator.ts` (lerp, lerpColor, animateText, parallel, sequence, safe cleanup) |
| Render batching | ✅ | `RenderBatcher.ts` coalesces render calls per frame |

### Not Yet Implemented
| Feature | Status | Notes |
|---|---|-|
| Full strategic AI opponent | ❌ | Current AI is basic: plays highest-power character, attaches DON to all targets, attacks weakest with strongest. No card evaluation or resource management strategy. |
| KO animation during battle | ❌ | `FlyToTrashAnimation` exists but not wired into `BattleManager._resolveBattleOutcome()` — characters removed silently on combat KO |
| Battle clash/power-reveal animation | ❌ | Instant resolution after attack animation |
| Event card playback (full) | ⚠️ | `_playEvent()` trashes card, effect execution via structured effects + regex fallback. Recognized patterns: draw, trash from hand, add DON, rest opponent, shuffle hand, life manipulation. Fragile — breaks on wording variations. |
| Stage card playback | ⚠️ | Renders to stage zone but no stage-specific game logic or interaction |
| P2 mulligan UI | ❌ | Only P1 gets mulligan overlay via `SelectionOverlay.showMulligan()`. P2 initial draw is animated face-down with no choice. |
| Trigger activation UI (Draw Phase) | ⚠️ | `EffectSystem.checkTrigger()` fires and adds delay, but no player confirmation dialog. `SelectionOverlay.showTrigger()` exists but never called from turn flow. |
| P2 leader attack interaction | ❌ | `LeaderAttackInteraction` only binds for P1. AI handles its own attacks internally. |
| Deck-out loss condition | ❌ | `TurnManager._draw()` emits `deck:empty` event when deck runs out, but nothing in `Game.ts` listens to trigger a loss. |
| [Main] activatable effects | ❌ | No confirm dialog or activation flow |
| [Your Turn] / [Opponent's Turn] timing | ❌ | No enforcement |
| [DON!! xN] requirement checking | ❌ | Not implemented |
| [DON!! -N] cost handling | ❌ | Not implemented |
