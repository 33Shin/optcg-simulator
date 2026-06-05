# Animation Migration Documentation

## Overview
All animations are being migrated from manual `requestAnimationFrame` / `Animator` class to GSAP timelines.
GSAP is already installed (`gsap@^3.15.0`) and partially integrated via `src/core/animations/gsapUtils.ts`.

## Easing Mapping (before → GSAP after)

| Legacy Name | Hand-written formula | GSAP Equivalent | Notes |
|---|---|---|---|
| `linear` | `t => t` | `none` | No easing |
| `easeOutQuad` | `1 - (1-t)^2` | `power2.out` | Default ease |
| `easeOutCubic` | `1 - (1-t)^3` | `power3.out` | Sharper out |
| `easeInOut` | `t<0.5 ? 2t^2 : 1-(-2t+2)^2/2` | `sine.inOut` | Symmetric |
| `easeOutBack` | `c1=1.70158, c3=c1+1, ...` | `back.out(1.7)` | Overshoot |

## Animation Inventory

### Already GSAP-based (no migration needed)

| Animation | File | GSAP Pattern | Timing | Ease |
|---|---|---|---|---|
| ActiveAnimation | `ActiveAnimation.ts` | proxy tween + onUpdate | 250ms | `power2.out` |
| DONDrawAnimation | `DONDrawAnimation.ts` | direct gsap.to | 250ms | `none` |
| DONDetachAnimation | `DONDetachAnimation.ts` | proxy tween + onUpdate | 500ms | `none` (linear) |
| DONRestAnimation | `DONRestAnimation.ts` | proxy tween + onUpdate | 250ms | `power2.out` |
| InitialDrawAnimation | `InitialDrawAnimation.ts` | gsap.timeline + proxy | fly: 600ms, delay: 60ms | `sine.inOut` |
| MultipleDrawAnimation | `MultipleDrawAnimation.ts` | gsap.timeline + proxy | fly: 450ms, hold: 300ms, hand: 250ms | `sine.inOut` |
| ShuffleAnimation | `ShuffleAnimation.ts` | direct gsap.to per card | 150-225ms random, delay: 0-500ms | `power3.inOut` |
| CountdownAnimation | `CountdownAnimation.ts` | gsap.timeline | scale: 300ms, hold: 1200ms, fade: 600ms | `none` |
| CommitLifeAnimation | `CommitLifeAnimation.ts` | gsap.timeline + proxy | fly: 560ms, fadeIn: 40ms, stagger: 140ms | `none` (custom easeInOut in onUpdate) |
| FlyToTrashAnimation | `FlyToTrashAnimation.ts` | proxy tween | 400ms | `sine.inOut` |
| FlyToBottomDeckAnimation | `FlyToBottomDeckAnimation.ts` | gsap.timeline | slide: 650ms, flip: 195ms, restore: 325ms, fade: 130ms | `power2.inOut`, `power2.in`, `power2.out`, `power1.in` |
| FlyToHandAnimation | `FlyToHandAnimation.ts` | proxy tween | 700ms default | `sine.inOut` |
| AIPlayAnimation | `AIPlayAnimation.ts` | proxy tween | fly: 400ms, hold: 250ms, slam: 200ms, impact: 40ms, bounce: 350ms | `none` (custom easeInOut in onUpdate) |
| AICounterAnimation | `AICounterAnimation.ts` | proxy tween | fly: 450ms, hold: 300ms | `none` (custom easeInOut in onUpdate) |
| AbilityActivateAnimation | `AbilityActivateAnimation.ts` | proxy tween | flyIn: 500ms, vfx: 800ms, fadeOut: 200ms | `none` (custom easeOutCubic in onUpdate) |
| SlamAnimation | `SlamAnimation.ts` | proxy tween | phase1: 180ms, hold: 250ms, slam: 90ms, impact: 40ms, bounce: 350ms | `none` (custom easeOutCubic in onUpdate) |

### Migrated (were rAF/Animator, now GSAP)

| Animation | File | Was | Now GSAP | Timing | Ease |
|---|---|---|---|---|---|
| DONSlamAnimation | `DONSlamAnimation.ts` | Animator (linear) | gsap timeline | fadeIn: 150ms, shake: 200ms | `power2.out` |
| DONBurstAnimation | `DONBurstAnimation.ts` | Animator (easeOutQuad) | gsap proxy | 400ms default | `power2.out` |
| CounterCardAnimation | `CounterCardAnimation.ts` | Animator (easeOutQuad) | gsap proxy | 400ms default | `power2.out` |
| PowerCountAnimation | `PowerCountAnimation.ts` | Animator (easeOutQuad) | gsap proxy | 700ms | `power2.out` |
| DONReturnOnKOAnimation | `DONReturnOnKOAnimation.ts` | rAF (easeInOut) | gsap proxy | 350ms | `sine.inOut` |
| BlockerActivateAnimation | `BlockerActivateAnimation.ts` | rAF (easeOutCubic) | gsap timeline | flyIn: 500ms, vfx: 800ms, fadeOut: 200ms | `power3.out` |
| BlockerRestAnimation | `BlockerRestAnimation.ts` | rAF (easeOutCubic) | gsap proxy | lift: 350ms, slam: 90ms, impact: 40ms, bounce: 350ms | `power3.out` |
| HandPositionAnimation | `HandPositionAnimation.ts` | Animator (easeOutQuad) | gsap.to | distance-based 100-300ms | `power2.out` |
| SnapBackAnimation | `SnapBackAnimation.ts` | Animator (easeOutQuad) | gsap proxy | 200ms | `power2.out` |
| FadeOutGhostAnimation | `FadeOutGhostAnimation.ts` | rAF (easeOutQuad) | gsap.to | 250ms | `power2.out` |
| CardPickAnimation | `CardPickAnimation.ts` | rAF (easeInOut) | gsap proxy | flyToCenter: 400ms, result: 600ms | `sine.inOut` |
| DamageTriggerAnimation | `DamageTriggerAnimation.ts` | rAF (easeInOut) | gsap proxy/timeline | fly: 500ms, activate: 800ms, trash: 400ms, hand: 500ms | `sine.inOut` |
| CostTokenShiftAnimation | `CostTokenShiftAnimation.ts` | rAF (easeOutCubic) | gsap proxy | 500ms | `power3.out` |

### All migrated ✓

All 14 previously rAF/Animator-based animations have been migrated to GSAP.

| Animation | File | Was | Now GSAP | Timing | Ease |
|---|---|---|---|---|---|
| AttackAnimation | `AttackAnimation.ts` | rAF 6-phase | gsap proxy + onUpdate | lift: 350ms, pullBack: 200ms, slam: 120ms, impact: 80ms, shock: 500ms, return: 700ms | `power3.out`, `sine.inOut`, `none` (custom in onUpdate) |

## Migration Comparison: Before vs After

### Pattern: Simple Property Tween
**Before (Animator):**
```ts
await Animator.animate({
  duration: 350,
  easing: 'easeOutCubic',
  onUpdate: (t) => { obj.x = fromX + (toX - fromX) * t; },
}).toPromise();
```
**After (GSAP):**
```ts
await new Promise(resolve => {
  gsap.to(obj, { x: toX, duration: 0.35, ease: 'power3.out', onComplete: resolve });
});
```
**Result:** Direct property tween, no manual interpolation. GSAP reads start value automatically.

### Pattern: Multi-phase Animation
**Before (rAF):**
```ts
const start = performance.now();
await new Promise(resolve => {
  const tick = (now) => {
    const elapsed = now - start;
    if (elapsed < phase1Dur) { /* phase 1 */ requestAnimationFrame(tick); return; }
    if (elapsed < phase1Dur + phase2Dur) { /* phase 2 */ requestAnimationFrame(tick); return; }
    // ... more phases
    resolve();
  };
  requestAnimationFrame(tick);
});
```
**After (GSAP timeline):**
```ts
const tl = gsap.timeline();
tl.to(obj, { /* phase 1 props */ duration: phase1Dur/1000, ease: 'power3.out' });
tl.to(obj, { /* phase 2 props */ duration: phase2Dur/1000, ease: 'power2.in' });
await new Promise(resolve => tl.call(resolve, [], ''));
```
**Result:** Cleaner phase sequencing, GSAP handles timing automatically.

### Pattern: Complex VFX with Particles
**Before (rAF):**
```ts
// Manual particle physics in onUpdate
for (const p of particles) {
  p.x += vx * dt;
  p.y += vy * dt + gravity * dt * dt;
  p.alpha = Math.max(0, 1 - elapsed / lifetime);
}
```
**After (GSAP proxy):**
```ts
const proxy = { t: 0 };
gsap.to(proxy, {
  t: 1, duration: total/1000, ease: 'none',
  onUpdate: () => {
    for (const p of particles) {
      const pt = proxy.t * (p._startDuration / total);
      p.x = startX + vx * pt;
      p.y = startY + vy * pt + gravity * pt * pt;
      p.alpha = Math.max(0, 1 - pt);
    }
  }
});
```
**Result:** GSAP drives the master clock; particles still compute physics but from normalized time.

## Key Design Decisions

1. **Proxy pattern retained for complex animations** - When animations need custom `onUpdate` logic (particles, VFX, screen shake), we use `gsap.to({t:0}, {t:1, ...})` to drive a normalized 0-1 progress value. This is the recommended GSAP pattern for non-DOM animation.

2. **Duration in milliseconds** - All animation files use ms for duration. GSAP uses seconds. The `gsapUtils.ts` helpers divide by 1000. Direct GSAP calls convert inline.

3. **Promise wrapping** - Every animation returns `Promise<void>` for async/await compatibility. GSAP tweens are wrapped in `new Promise(resolve => { gsap.to(..., {onComplete: resolve}) })`.

4. **Easing names** - The `GSAP_EASINGS` map in `gsapUtils.ts` translates legacy names. New code uses GSAP ease strings directly.

5. **Cleanup** - GSAP's `onComplete` handles cleanup, replacing the manual `if (raw >= 1)` check at the end of rAF loops.

6. **Cancellation** - Animations with cancel support use `gsap.killTweensOf(target)` or store the tween reference for manual kill.
