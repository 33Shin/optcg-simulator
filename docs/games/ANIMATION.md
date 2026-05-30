# Animation System Documentation

## Architecture

All animations are managed through `AnimationManager.ts`, which receives a shared context object (`ctx`) containing references to `app`, `zoneManager`, `renderer`, `players`, `handRenderer`, `zoneRenderer`, and `donSystem`. Each animation is an individual class that receives `ctx` in its constructor.

### Shared Helpers (`core/animations/utils.ts`)

| Function | Purpose |
|---|---|-|
| `easeInOut(t)` | Standard ease-in-out: `t < 0.5 ? 2t² : 1 - (-2t+2)²/2` |
| `makeFlyCard(texture, card, cardW, cardH)` | Simple card sprite container (no flip). Falls back to dark bg + name text if texture missing. Pivot at center. |
| `createFlipCard(frontTexture, card, cardW, cardH)` | Flip-capable container with front sprite + back sprite (`assets/imgs/back.webp`). `showFront()`/`showBack()` toggles visibility. Starts face-down. Pivot at center. |
| `getDisplayTexture(pid, card)` | Returns card back for P2, front texture (`card.imgPath`) for P1. |

### Coordinate Convention

All fly-cards are **direct stage children**. All coordinates must be stage-level:
- Zone local → stage: `app.stage.toLocal(zone.toGlobal(new PIXI.Point(x, y)))`
- Screen center → stage: `app.stage.toLocal(new PIXI.Point(600, 400))`

> Screen center is `(600, 400)` on the 1200×800 canvas — dramatic pause anchor for all fly animations.

### Three-Phase Pattern (all fly-to-center animations)

| Phase | Duration | Description |
|---|---|-|
| 1 | 450ms | Source → screen center, scale 1.0→1.5x. Includes card flip for draws/mulligan. |
| 2 | 200ms | Hold at center at 1.5x (dramatic pause). |
| 3 | 250-350ms | Center → destination, scale 1.5x→1.0x. Includes card flip for hand-to-deck. |

---

## Game Init Sequence

### Countdown (`CountdownAnimation.js`)

**Trigger**: `Game.init()` — first thing, before any other animation.

```
Game.init() → animManager.countdown.run() → Promise
```

| Detail | Value |
|---|---|-|
| Duration | 1500ms show + 300ms scale-in + 600ms fade = ~2400ms |
| Visuals | Black overlay (alpha 0.85), "Ready!" text (Russo One 80px, white, drop shadow), scales in from 0.5→1.0 over 300ms, holds, then fades out while scaling to 1.5x |

---

### Initial Draw (`InitialDrawAnimation.js`)

**Trigger**: Resolves after countdown animation.

```
countdown.run().then(() => animManager.animateInitialDraw(initialCards))
```

| Detail | Value |
|---|---|-|
| Entry | `animateInitialDraw({1: [cards], 2: [cards]})` |
| Per player | 5 cards |
| P1 path | `createFlipCard` — cards flip from back → front during Phase 1 |
| P2 path | `_makeSimpleCard` — cards stay face-down (back only) |

**Per-card flow**:
1. All 5 cards are spliced into `player.hand` at midpoint (before animation starts).
2. Layout computed from `p.hand.length`.
3. Each card flies from deck center → dramatic center → hand slot (3-phase).
4. `handRenderer.render(pid)` called after all cards done — creates persistent hand sprites.

---

### Mulligan Animation Sequence

**Trigger**: P1 clicks "Mulligan" button in `#mulligan-panel`.

```
AnimateMulligan(1)
  ├─ (a) Hide all hand sprites (visible = false)
  ├─ (b) animateCardsToDeck(1, handCards)     → FlyToTopDeckAnimation
  ├─ (c) player.hand cleared, handRenderer rendered empty
  ├─ (d) animateShuffle(1)                    → ShuffleAnimation
  ├─ (e) 5 new cards drawn
  ├─ (f) animateRedrawCards(1, newCards)      → RedrawAnimation
  ├─ (g) handRenderer + zoneRenderer re-rendered
  └─ (h) _onKeepHand() → _commitLifeAndStart() → turnManager.startTurn()
```

**Step (b) — FlyToTopDeckAnimation**:
- Source positions computed from `handRenderer.computeLayout(handZone, cards.length)`.
- Each position converted to stage coords via `zone.toGlobal()` → `app.stage.toLocal()`.
- Cards start face-up, fly to center, flip face-down at midpoint of Phase 3, land at deck.
- Phase 3 duration: 350ms.

**Step (d) — ShuffleAnimation**:
- All existing card-back sprites in deck zone are cleared.
- New back sprite per card placed at deck center.
- Each sprite flies outward to a random radius with a 150-225ms ease-out animation + 0-500ms staggered start.
- Each card fades out after its animation completes.
- Actual `player.deck.shuffle()` called after all visual cards return.

**Step (f) — RedrawAnimation**:
- Cards fly from deck center → scattered positions at dramatic center → hand slots.
- Scattered positions: `centerPos.x + offset * centerSpacing` where `centerSpacing = cardW * 1.5 + 5 ≈ 155px`.
- Cards flip from back → front during Phase 1.
- Phase 3 duration: 250ms.

> **Bug fixed 2026-05-14**: Both `FlyToTopDeckAnimation` and `FlyToBottomDeckAnimation` had a coordinate transform bug on line 55/61 respectively. `fromX` (local hand-zone coordinate) was interpolated with `centerPos.x` (stage coordinate). Replaced with `fromPos.x` (stage coord) for consistent coordinate space.

---

## Turn Sequence Animations

### DON!! Draw (`DONDrawAnimation.js`)

**Trigger**: `animManager.animateDONDraw(pid)` during DON!! Phase.

| Detail | Value |
|---|---|-|
| Duration | 250ms fade-out + 300ms fade-in = ~550ms max |
| DON deck | Top tile fades alpha 1→0 over 250ms |
| Cost area | New DON sprite fades in alpha 0→1 over 300ms |
| After | `zoneRenderer.renderCostTokens(pid)` + full re-render |

### Draw Card (`MultipleDrawAnimation.js`)

**Trigger**: `animManager.animateDrawCard(pid, card, handIdx)` during Draw Phase.

| Detail | Value |
|---|---|-|
| Total duration | ~1000ms (450 + 300 + 250) |
| P1 path | Flip card from back → front |
| P2 path | Back face only, no flip |

**Per-card flow for P1**:
1. Phase 1 (450ms): Deck → center, flip up from back to front at midpoint, scale 1.0→1.5x.
2. Phase 2 (300ms): Hold at center at 1.5x.
3. Phase 3 (250ms): Center → hand slot, scale 1.5→1.0x. Existing hand sprites simultaneously reposition to make room.

### Refresh Phase

No dedicated animation class. `TurnManager._refresh()` runs a 400ms `_delay()`. Data updates (stand up rested, return DON!!) happen synchronously. `refresh:complete` event emitted → `Game._renderAll()`.

---

## DON!! Attach Animation (`AnimationManager.js`)

**Trigger**: `animManager.animateDONBurst(targetZone)` during Main Phase when attaching DON to a character/leader.

| Detail | Value |
|---|---|-|
| Duration | Configurable (default 400ms) |
| Return | Promise |
| Sprite placement | Added as child of target sprite (field card) |

**Visuals**:
- DON!! sprite created at bottom-left of target card, alpha 0.5.
- Scales from target size up to 8x with ease-out fade (alpha 0.8→0).
- Gold screen flash overlay (alpha 0.3, decays with animation progress).
- Screen shake: 10px amplitude, decays to 0 at 50% of animation.
- Sprite removed from target card and flash removed from stage on completion.

**Power count-up**: `animManager.animatePowerCount(textObject, oldPower, newPower)` runs after DON burst.
- Power text animates from old value to new value over 700ms.
- Scale peaks at 1.35x at midpoint (sin arc).
- Color transitions from white (`0xffffff`) to gold (`0xffd700`).

---

## Commit Life Animation (`CommitLifeAnimation.js`)

**Trigger**: `animManager.animateCommitLife(pid, player, cards)` during game initialization.

| Detail | Value |
|---|---|-|
| Duration | ~1000ms per card (staggered) |
| Return | Promise |
| Sprite placement | Added as child of stage |

**Visuals**:
- Each life card flies from deck position → dramatic center → life zone slot.
- Cards remain face-down (back texture only).
- Staggered start: each card begins 150ms after the previous.
- After all cards land, `zoneRenderer._renderLife(pid)` called to create persistent life sprites.

---

## Play-to-Field (`SlamAnimation.js`)

**Trigger**: `animManager.slam.animate(pid, card, targetZone)` (used when playing character from hand to field).

> Note: `PlayToFieldAnimation.js` exists but is **not wired** into `AnimationManager`. The actual play-to-field animation uses `SlamAnimation.js`.

| Detail | Value |
|---|---|-|
| Duration | ~400ms |
| Return | Promise |
| Sprite placement | Added as child of stage |

**Visuals**:
- Card sprite created at hand zone position, alpha 0.
- Fades in then flies toward field slot target with scale animation.
- On arrival: brief squash/stretch impact effect.
- Sprite removed from stage after animation completes.

---

## Drag & Drop (not an animation class)

`DragManager` handles card drag during Main Phase:
- `beginDrag()` creates subscriptions to `pointermove`/`pointerup`.
- `_showGhost()` renders card sprite at stage level.
- Ghost follows pointer in real-time via `_moveGhost()`.
- `_updateHighlight()` highlights target field slot under cursor.
- On release: ghost kept for 360ms to allow visual settling, then `cleanup()` removes listeners + sprites.

---

## Fly-to-Deck Animations

### Top Deck (`FlyToTopDeckAnimation.js`)

**Entry**: `animManager.animateCardsToDeck(pid, cards)` (used in mulligan).
**Phases**: 450ms + 300ms + 350ms.
**Behavior**: Cards fly hand → center → deck, flip face-down at Phase 3 midpoint.
**After**: `zoneRenderer._renderDeck(pid)` called.

### Bottom Deck (`FlyToBottomDeckAnimation.js`)

**Entry**: `animManager.animateCardsToBottomDeck(pid, cards)` (used by events like Gum-Gum Red Roc).
**Phases**: 450ms + 300ms + 350ms + 300ms lift + 300ms lower.
**Behavior**: Existing deck stack lifts up (`cards.length × 2` px). Cards fly hand → center → deck. Stack lowers back. Flip face-down at Phase 3 midpoint.
**After**: `zoneRenderer._renderDeck(pid)` called.

---

## Card Dimensions in Animation Context

| Context | Width | Height | Scale |
|---|---|---|-|---|-|
| Hand zone rendering | 100 × 0.95 = 95px | 140 × 0.95 = 133px | 0.95 |
| Fly animation cards | 100px | 140px | 1.0 (animated up to 1.5x) |
| Field slot rendering | 100 × 0.7 = 70px | 140 × 0.7 = 98px | 0.7 |
| Stage slot rendering | 100 × 0.7 = 70px | 140 × 0.7 = 98px | 0.7 |

---

## EventBus Integration (Animation-Related)

| Event | Emitter | Consumer | Animation Trigger |
|---|---|---|---|-|
| `phase:change` | TurnManager | Game | Phase bar UI update |
| `refresh:complete` | TurnManager | Game._renderAll() | Re-render all zones |
| `draw:complete` | TurnManager | Game | Re-render hand + zones |
| `main:ready` | TurnManager | Game | Hand/field interactive rendering, AI turn |
| `don:complete` | TurnManager | — | DON phase complete |
| `effect:onPlay` | EffectSystem | Game._renderAll() | Re-render after card play |
| `effect:onKO` | EffectSystem | Game | Re-render field + zones |
| `effect:trigger` | EffectSystem | Game._renderAll() | Re-render after Trigger |
| `leader:damage` | BattleManager | Game._checkWinCondition() | Win check |
| `card:KO` | — | Game | Re-render field + zones |

---

## Attack Animation (`AttackAnimation.js`)

**Trigger**: `animManager.animateAttack(pid, attacker, attackerZone, target, targetZone)` during battle resolution.

| Detail | Value |
|---|---|-|
| Total duration | ~1980ms (350+200+120+80+500+200+700+ return overlap) |
| Return | Promise |
| Sprite | Added as child of stage (NOT zone) |

### Attack Angle System

Rotation is computed per-case so the attacker card's **top edge faces the target center** during lunge. Each case delegates to `lungeRotation(dx, dy)` which returns `atan2(dy, dx) + π/2` — the exact angle to point the card upward toward the target.

| Function | Attacker | Target | Notes |
|---|---|---|---|
| `p1LeaderToP2Leader` | P1 leader (bottom-left) | P2 leader (top-left) | Mostly upward, slight right tilt |
| `p1LeaderToP2Char` | P1 leader (bottom-left) | P2 char slot (top-center) | Strong diagonal rightward tilt |
| `p1CharToP2Leader` | P1 char (bottom-center) | P2 leader (top-left) | Diagonal leftward tilt |
| `p1CharToP2Char` | P1 char (bottom-center) | P2 char slot (top-center) | Mostly upward |

`computeAttackRotation()` dispatches based on `pid`, `isAtkLeader`, `isTgtLeader`. P2 (AI) attackers use the generic formula.

### Seven-phase sequence

| Phase | Duration | Description |
|---|---|-|
| 1 | 350ms | Attacker lifts 120px, scales 1→1.4x, rotates to lunge angle |
| 2 | 200ms | Pulls back 100px away from target along direction vector (wind-up) |
| 3 | 120ms | Fast slam into target impact point (ease-in quadratic). Impact point is offset from target center by half target card height along direction vector. |
| 4 | 80ms | Impact frame: squash/stretch, white screen flash (0.85 alpha), shake 22px, central burst (yellow core + white inner) |
| 5 | 500ms | After-impact: 5 staggered shockwave rings (expand to 280px), 24 orbit particles, 60 fire sparks with gravity, 6 lightning bolts, expanding glow aura. Attacker bounces back 180px. Shake decays 14px→0. |
| 6 | 200ms | Overlap with shockwave tail — attacker continues settling |
| 7 | 700ms | Fly back to attacker zone. **Rotation interpolates from lunge angle to PI/2 (rest angle)**. Scale 1.1→1.0. Alpha fades 1→0 during last 30%. |

**Effects created per attack**:
- 1 attacker fly-card sprite
- 1 full-screen flash Graphics
- 1 central burst Graphics
- 5 staggered shockwave ring Graphics
- 24 orbit particle Graphics
- 60 spark/ember Graphics (with gravity, varying speed/size/color)
- 6 lightning bolt Graphics
- 1 glow aura Graphics
- Screen shake via `app.stage.position` offset
- Original field sprite hidden during animation, restored at end

**After animation resolves**: `BattleManager.resolveBattle()` computes power, applies KO/damage, then calls `onAfterResolve()` to re-render.

---

## Animation Class Reference

| Class | File | Entry Method | Return | Purpose |
|---|---|---|---|---|
| CountdownAnimation | `animations/CountdownAnimation.ts` | `.run()` | Promise | "Ready!" splash screen |
| InitialDrawAnimation | `animations/InitialDrawAnimation.ts` | `.animateInitialDrawToHand(pid, cards)` | Promise | Initial 5-card draw for both players + mulligan flow |
| MultipleDrawAnimation | `animations/MultipleDrawAnimation.ts` | `.drawOne(pid, player, card, handIdx)` / `.drawCards(pid, player, count, animated)` | Promise | Draw 1+ cards during draw phase or effects |
| DONDrawAnimation | `animations/DONDrawAnimation.ts` | `.animateDONDraw(pid)` | Promise | Draw DON!! token to cost area |
| DONSlamAnimation | `animations/DONSlamAnimation.ts` | `.animate(pid, visibleCount)` | Promise | DON!! slam effect onto cost area |
| DONDetachAnimation | `animations/DONDetachAnimation.ts` | `.animate(pid)` | Promise | Power count-down animation when DON detaches at end phase |
| SlamAnimation | `animations/SlamAnimation.ts` | `.animate(pid, card, targetZone)` | Promise | Card slam effect on play-to-field |
| FlyToTrashAnimation | `animations/FlyToTrashAnimation.ts` | `.animate(pid, card, zone)` | Promise | KO → trash fly animation |
| FlyToTopDeckAnimation | `animations/FlyToTopDeckAnimation.ts` | `.animate(pid, cards)` | Promise | Cards fly hand → center → deck (mulligan) |
| FlyToBottomDeckAnimation | `animations/FlyToBottomDeckAnimation.ts` | `.animate(pid, cards)` | Promise | Cards fly hand → center → deck bottom (events) |
| FlyToHandAnimation | `animations/FlyToHandAnimation.ts` | `.animate(pid, card, handIdx)` | Promise | Card flies from center to hand slot |
| ShuffleAnimation | `animations/ShuffleAnimation.ts` | `.animateShuffle(pid)` | Promise | Deck shuffle with visual scatter-return |
| CommitLifeAnimation | `animations/CommitLifeAnimation.ts` | `.animate(pid, player, cards)` | Promise | Life card commit fly animation at game start |
| AIPlayAnimation | `animations/AIPlayAnimation.ts` | `.animate(...)` | Promise | Visual feedback for AI opponent actions |
| AICounterAnimation | `animations/AICounterAnimation.ts` | `.animateFlyToCenter(pid, card)` / `.animateFadeOut(flyCard)` | Promise | AI counter card fly-to-center + fade-out |
| AbilityActivateAnimation | `animations/AbilityActivateAnimation.ts` | `.animate(pid, card, zone)` | Promise | Glow/pulse VFX when card ability activates |
| CardPickAnimation | `animations/CardPickAnimation.ts` | `.animate(pid, player, prompt)` / `.animateNami(pid, player)` | Promise | Card selection overlay for multi-card effects |
| DamageTriggerAnimation | `animations/DamageTriggerAnimation.ts` | `.animate(pid, player, card, hasTrigger, source)` / `.animateAI(...)` | Promise | Damage trigger fly-to-center with Trigger/Pass buttons |
| AttackAnimation | `animations/AttackAnimation.ts` | `.animateLiftAndRotate(pid, attacker, attackerZone, target, targetZone)` + `.continueAttackFromHeldState()` | Promise | 7-phase attack: lift, pullback, slam, impact, shockwave, bounce, return |

> **Not wired**: `PlayToFieldAnimation.ts` exists in codebase but is not imported by `AnimationManager`. Replaced by `SlamAnimation.ts`.

---

## Known Issues / Planned Improvements

| Issue | Status |
|---|---|
| Fly-card cleanup not guaranteed if Promise never resolves | TODO |
| Attack animation creates many short-lived Graphics objects per frame (shockwaves, particles, lightning) | Consider object pooling for GPU memory |
| Three-phase pattern Phase 2 duration documented as 300ms but actual code uses 200ms | Minor discrepancy in `_animateSingleCardFly` |

### Resolved Issues

| Issue | Resolution Date | Notes |
|---|---|---|
| No combat/battle animation (battle resolved instantly) | 2026-05-14 | `AttackAnimation.ts` — full 7-phase implementation with particles, lightning, shockwaves |
| No life-card animation when committing life cards | 2026-05-14 | `CommitLifeAnimation.ts` wired into `_commitLifeAndStart()` |
| No DON!! attach animation | 2026-05-17 | `animateDONBurst()` + `animatePowerCount()` — gold burst, screen shake, power count-up |
| PlayToFieldAnimation not used | 2026-05-17 | Replaced by `SlamAnimation.ts` in AnimationManager |
| Coordinate transform bug in fly-to-deck animations | 2026-05-14 | Fixed: `fromX` (local hand-zone coord) replaced with `fromPos.x` (stage coord) for consistent coordinate space |
| RedrawAnimation computes layout with wrong hand length | 2026-05-14 | Resolved by splicing cards into hand before animation call |
| DONDetachAnimation color conversion error | 2026-05-28 | Fixed: `powerText.tint` → `powerText.style.fill` (PixiJS v8) |
| Counter boost double-counting in battle | 2026-05-28 | Fixed: `BattleManager` was adding both `counterBoosts` Map + `_counterBoost`, doubling defender boost |
| Action button callback on pointerdown | 2026-05-28 | Fixed: callback now fires on `pointerup` for better UX |
| Action button no hover feedback | 2026-05-28 | Fixed: added GlowFilter hover effect, text scale 1.15x |
| Action button not disabled on timer expiry | 2026-05-28 | Fixed: `disableActionButton()` called in counter/blocker phase timeout callbacks |
| **Migrated to Vite + TypeScript** | 2026-05-29 | All `.js` → `.ts`, `js/` → `src/`, `assets/` → `public/assets/`, `css/` → `public/css/` |
| **Action button state race condition** | 2026-05-29 | Fixed: `_actionBtnHandler` has fallback for `_onEndTurn` when `_currentStateKey` drifts to `'disabled'` |
| **Action button visuals during battle** | 2026-05-29 | Fixed: `updateActionButton` returns early when `_inBattle`, ticker respects battle-managed button state |
| **Counter card drops during battle resolution** | 2026-05-29 | Fixed: `PlayCardInteraction.onHandCardDrag` guards with `game._animating`, hand re-rendered after counter phase |
