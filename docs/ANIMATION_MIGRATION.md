# GSAP Migration Reference

> Lessons learned from migrating 6 animation files (Slam, AIPlay, AbilityActivate, AICounter, CommitLife, FlyToBottomDeck) from `requestAnimationFrame` to GSAP.

## Recommended Pattern: Single-Proxy Single-Tween

**Always use this structure** for multi-phase animations:

```ts
const phase1Dur = 180;
const holdDur = 250;
const slamDur = 90;
const impactDur = 40;
const bounceDur = 350;
const total = phase1Dur + holdDur + slamDur + impactDur + bounceDur;

const proxy = { t: 0 };
gsap.to(proxy, {
  t: 1,
  duration: total / 1000,
  ease: 'none',
  onUpdate: () => {
    const t = proxy.t;

    if (t < phase1Dur / total) {
      const p = t / (phase1Dur / total);       // local progress [0, 1]
      const e = easingFormula(p);               // manual easing on local progress
      // ... apply to PIXI objects
    }
    else if (t < (phase1Dur + holdDur) / total) {
      // hold phase — just set final state
    }
    else if (t < (phase1Dur + holdDur + slamDur) / total) {
      const p = (t - phase1Dur / total - holdDur / total) / (slamDur / total);
      // ... etc
    }
  },
  onComplete: () => {
    // cleanup: reset state, remove objects, resolve promise
  },
});
```

---

## Bug Catalog

### 1. Empty-Target Tweens Are Skipped

**Symptom:** Hold/impact phases complete instantly (0ms).

```ts
// ❌ BROKEN — GSAP 3.15 skips this entirely
tl.to({}, { duration: 0.25 });

// ❌ ALSO BROKEN — no animatable property changes
tl.to(proxy, { duration: 0.25 });
```

**Fix:** Use single-proxy pattern (all phases in one `onUpdate`). If you must use dummy tweens, the target MUST have a property that actually changes:

```ts
// ✅ Works (but still fragile — prefer single-proxy)
const _dummy = { v: 0 };
tl.to(_dummy, { v: 1, duration: 0.25 });
```

### 2. Dummy Tween Same Start/End Value Is Skipped

**Symptom:** Phase never fires, no `onUpdate`, no `onComplete`.

```ts
const _dummy = { v: 0 };
tl.to(_dummy, { v: 0, duration: 0.04 });  // ❌ start === end → skipped
```

**Fix:** Ensure the target property actually changes:

```ts
const _dummy = { v: 0 };
tl.to(_dummy, { v: 1, duration: 0.04 });  // ✅
tl.to(_dummy, { v: 0, duration: 0.04 });  // ✅ (now 1 → 0)
```

### 3. Double-Easing

**Symptom:** Animation feels too slow at start and end — easing is applied twice, compounding the curve.

```ts
// ❌ BROKEN — GSAP applies sine.inOut to proxy.t, then onUpdate applies easeInOut again
tl.to(proxy, {
  t: 1,
  ease: 'sine.inOut',
  onUpdate: () => {
    const e = easeInOut(proxy.t);  // double-eased!
  },
});
```

**Fix:** Always use `ease: 'none'` and compute easing manually in `onUpdate`:

```ts
// ✅ CORRECT
tl.to(proxy, {
  t: 1,
  ease: 'none',
  onUpdate: () => {
    const p = proxy.t;
    const e = easeInOut(p);  // single easing, matches original
  },
});
```

### 4. Raw Progress vs Eased Progress

**Symptom:** Alpha fades too fast/slow, flash timing is wrong.

When GSAP eases `proxy.t`, the raw linear progress is lost. Some calculations (like `alpha = Math.min(p / 0.1, 1)`) need raw progress, while others (like position/scale) need eased progress.

```ts
// ❌ BROKEN — proxy.t is already eased, alpha reaches 1 way too fast
tl.to(proxy, {
  t: 1,
  ease: 'power3.out',
  onUpdate: () => {
    const e = proxy.t;           // already eased
    ghost.alpha = Math.min(e / 0.1, 1);  // wrong — should use raw p
  },
});
```

**Fix:** Use `ease: 'none'` and compute both raw and eased values:

```ts
// ✅ CORRECT
tl.to(proxy, {
  t: 1,
  ease: 'none',
  onUpdate: () => {
    const p = proxy.t;           // raw linear progress
    const e = power3Out(p);       // eased progress for position/scale
    ghost.alpha = Math.min(p / 0.1, 1);  // raw for alpha
    ghost.x = startX + (endX - startX) * e;  // eased for position
  },
});
```

### 5. Multi-Phase Timeline with Proxy Resets Is Unreliable

**Symptom:** Animation jumps, phases skip, or proxy.t doesn't reset properly.

```ts
// ❌ UNRELIABLE — proxy reset in onStart may not fire before first onUpdate
const tl = gsap.timeline();
tl.to(proxy, { t: 1, duration: 0.18 });
tl.to(proxy, {
  t: 1,
  duration: 0.09,
  onStart: () => { proxy.t = 0; },  // may not reset in time
});
```

**Fix:** Use single-proxy pattern. One tween, one `onUpdate`, all phases as `if/else` branches.

### 6. `tl.call()` Fires Once, Not Per-Frame

**Symptom:** Impact shake only happens once instead of every frame during the impact phase.

```ts
// ❌ BROKEN — fires once, original applies shake every frame for 40ms
tl.call(() => {
  app.stage.position.x = origX + (Math.random() - 0.5) * shakeAmt;
});
```

**Fix:** Use a tween with `onUpdate` for per-frame behavior:

```ts
// ✅ CORRECT
tl.to(_dummy, {
  v: 1,
  duration: 0.04,
  onUpdate: () => {
    app.stage.position.x = origX + (Math.random() - 0.5) * shakeAmt;
  },
});
```

Or better, use single-proxy pattern with an `if` branch.

### 7. Always Set `overwrite: false`

**Symptom:** Animation completes instantly or doesn't run at all.

GSAP's default `overwrite: 'auto'` mode may kill tweens on the same target if it detects a conflict. Even though each animation creates a unique `proxy` object, rapid sequential calls or parallel animations can trigger false positives.

```ts
// ❌ RISKY — GSAP may kill the tween
gsap.to(proxy, {
  t: 1,
  duration: duration / 1000,
  ease: 'none',
  onUpdate: () => { /* ... */ },
});

// ✅ SAFE
gsap.to(proxy, {
  t: 1,
  duration: duration / 1000,
  ease: 'none',
  overwrite: false,
  onUpdate: () => { /* ... */ },
});
```

### 8. Always Set Final State in `onComplete`

**Symptom:** Deck doesn't drop, objects remain in mid-animation state after animation "completes."

GSAP may not fire `onUpdate` at exactly `t=1` before calling `onComplete`. Relying on the last `onUpdate` frame to reach the final state is unreliable.

```ts
// ❌ RISKY — depends on onUpdate firing at t=1
gsap.to(proxy, {
  t: 1,
  onComplete: () => {
    resolve();  // final state may not be applied yet
  },
});

// ✅ SAFE — explicitly set final state
gsap.to(proxy, {
  t: 1,
  onComplete: () => {
    // Explicitly set final visual state
    deckSprites[i].y = origY;
    flyCard.alpha = 0;
    resolve();
  },
});
```

### 9. `scale.set()` Requires Two Arguments

**Symptom:** Scale y is `undefined`, card stretches vertically.

```ts
// ❌ BROKEN — ObservablePoint.set(x, y) needs both args
slamFlyCard.scale.set(fieldScale);

// ✅ CORRECT
slamFlyCard.scale.set(fieldScale, fieldScale);
```

---

## Easing Equivalence Reference

| Original Function | Formula | GSAP Equivalent |
|---|---|---|
| `easeOutQuad(t)` | `1 - (1-t)²` | `power2.out` |
| `easeOutCubic(t)` | `1 - (1-t)³` | `power3.out` |
| `easeInOut(t)` | `t < 0.5 ? 2t² : 1 - (-2t+2)²/2` | `sine.inOut` |
| `easeOutBack(t)` | cubic with overshoot | `back.out(1.7)` |

> **Rule:** Always use `ease: 'none'` on the proxy tween and compute easing manually in `onUpdate`. This guarantees the same behavior as the original rAF code.

---

## Migration Checklist

When migrating a new animation file:

- [ ] Use **single-proxy single-tween** pattern
- [ ] Set `ease: 'none'` on the proxy tween
- [ ] Compute local progress `p` per phase using `(t - phaseOffset) / phaseFraction`
- [ ] Apply easing formula manually to `p` for position/scale
- [ ] Use raw `p` for alpha/timing thresholds
- [ ] Verify all phase durations sum to `total`
- [ ] Verify `onComplete` resets all state (stage position, flash alpha, scale)
- [ ] Verify `onComplete` removes all temporary objects
- [ ] Remove unused constants (`liftDistance`, `bounceAmp`, etc.)
- [ ] Set `overwrite: false` on the tween
- [ ] Set explicit final state in `onComplete` (reset stage position, flash alpha, scale, hide temp objects)
- [ ] Run `npm run build` and verify no errors

---

## Files Migrated

| File | Status | Pattern |
|---|---|---|
| `SlamAnimation.ts` | ✅ | single-proxy, 5 phases |
| `AIPlayAnimation.ts` | ✅ | single-proxy, 5 phases |
| `AbilityActivateAnimation.ts` | ✅ | single-proxy, 3 phases |
| `AICounterAnimation.ts` | ✅ | single-proxy, 2 phases + fadeOut |
| `CommitLifeAnimation.ts` | ✅ | single-proxy per card |
| `FlyToBottomDeckAnimation.ts` | ✅ | single-proxy, 1 loop |

## Files Pending Migration

| File | Complexity | Notes |
|---|---|---|
| `AttackAnimation.ts` | Very High | 7 phases, 100+ VFX objects |
| `DamageTriggerAnimation.ts` | High | Multiple sub-animations with flip/fade |
| `CardPickAnimation.ts` | High | Bob animation, overlay, selection UI |
| `AnimationManager` inline methods | Medium | `animateDONBurst`, `animateCounterCard`, `animatePowerCount`, `animateBlockerActivate`, `animateBlockerRest`, `animateDONReturnOnKO` |
