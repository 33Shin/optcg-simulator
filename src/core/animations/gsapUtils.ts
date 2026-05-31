import { gsap } from 'gsap';

// ---------------------------------------------------------------------------
// Easing aliases — mirror the hand-written easings so existing code can swap
// the string name without changing behaviour.
// ---------------------------------------------------------------------------

/** GSAP easing key map matching the hand-written easing names in utils.ts. */
export const GSAP_EASINGS: Record<string, string> = {
  linear: 'none',
  easeOutQuad: 'power2.out',
  easeOutCubic: 'power3.out',
  easeInOut: 'sine.inOut',
  easeOutBack: 'back.out(1.7)',
};

/** Resolve a legacy easing name to its GSAP equivalent. */
export function resolveEasing(name = 'easeOutQuad'): string {
  return GSAP_EASINGS[name] ?? GSAP_EASINGS.easeOutQuad;
}

// ---------------------------------------------------------------------------
// Core tween helpers — return Promise<void> so they drop into async/await.
// ---------------------------------------------------------------------------

/**
 * Tween a PIXI display object property and return a Promise that resolves
 * when the tween finishes.
 */
export function tween(
  target: object,
  props: Record<string, unknown>,
  duration: number,
  easing = 'easeOutQuad',
): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(target, {
      duration: duration / 1000,
      ease: resolveEasing(easing),
      onComplete: resolve,
      ...props,
    });
  });
}

/**
 * Tween from explicit start values (gsap.from equivalent with Promise).
 */
export function tweenFrom(
  target: object,
  props: Record<string, unknown>,
  duration: number,
  easing = 'easeOutQuad',
): Promise<void> {
  return new Promise((resolve) => {
    gsap.from(target, {
      duration: duration / 1000,
      ease: resolveEasing(easing),
      onComplete: resolve,
      ...props,
    });
  });
}

/**
 * Set properties immediately (no animation) and return a resolved promise
 * for API symmetry.
 */
export function tweenSet(target: object, props: Record<string, unknown>): Promise<void> {
  gsap.set(target, props);
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Timeline builder — multi-phase animations without manual rAF bookkeeping.
// ---------------------------------------------------------------------------

export interface TimelinePhase {
  /** Target object to animate. */
  target: object;
  /** Tween properties (x, y, scale, alpha, rotation, etc.). */
  props: Record<string, unknown>;
  /** Duration in ms. */
  duration: number;
  /** Position in timeline. Default `'+='` (append after previous). */
  position?: string;
  /** Easing name. Default `'easeOutQuad'`. */
  easing?: string;
  /** Optional callback fired when this phase completes. */
  onComplete?: () => void;
}

/**
 * Run a sequence of animation phases on a GSAP timeline.
 * Returns a Promise that resolves when the entire timeline finishes.
 */
export function timeline(
  phases: TimelinePhase[],
  { onStart, onComplete }: { onStart?: () => void; onComplete?: () => void } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({
      onStart,
      onComplete: () => {
        onComplete?.();
        resolve();
      },
    });

    for (const phase of phases) {
      tl.to(phase.target, {
        duration: phase.duration / 1000,
        ease: resolveEasing(phase.easing),
        onComplete: phase.onComplete,
        ...phase.props,
      }, phase.position);
    }
  });
}

// ---------------------------------------------------------------------------
// Stagger helpers — animate an array of targets with a delay between each.
// ---------------------------------------------------------------------------

export function stagger(
  targets: object[],
  props: Record<string, unknown>,
  duration: number,
  staggerMs: number,
  easing = 'easeOutQuad',
): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(targets, {
      duration: duration / 1000,
      stagger: staggerMs / 1000,
      ease: resolveEasing(easing),
      onComplete: resolve,
      ...props,
    });
  });
}

// ---------------------------------------------------------------------------
// Screen shake — temporarily offset app.stage.position with decay.
// ---------------------------------------------------------------------------

export function screenShake(
  stage: PIXI.Container,
  intensity: number,
  durationMs: number,
  decayExponent = 2,
): Promise<void> {
  const origX = stage.position.x;
  const origY = stage.position.y;

  return new Promise((resolve) => {
    const shakeObj = { v: 0 };
    gsap.to(shakeObj, {
      v: 1,
      duration: durationMs / 1000,
      ease: 'none',
      onUpdate: () => {
        const decay = Math.pow(1 - shakeObj.v, decayExponent);
        const amt = intensity * decay;
        stage.position.x = origX + (Math.random() - 0.5) * amt;
        stage.position.y = origY + (Math.random() - 0.5) * amt;
      },
      onComplete: () => {
        stage.position.x = origX;
        stage.position.y = origY;
        resolve();
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Flash overlay — full-screen color flash with configurable duration.
// ---------------------------------------------------------------------------

export function flashOverlay(
  app: PIXI.Application,
  color: number,
  maxAlpha: number,
  durationMs: number,
): Promise<PIXI.Graphics> {
  const { screen, stage } = app;

  const flash = new PIXI.Graphics();
  flash.name = 'gsapFlash';
  flash.eventMode = 'none';
  flash.alpha = 0;
  flash.rect(0, 0, screen.width, screen.height).fill({ color, alpha: maxAlpha });
  stage.addChildAt(flash, 0);

  return new Promise((resolve) => {
    gsap.to(flash, {
      alpha: 0,
      duration: durationMs / 1000,
      ease: 'power2.out',
      onComplete: () => {
        flash.clear();
        if (flash.parent) flash.parent.removeChild(flash);
        resolve(flash);
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Dark overlay — semi-transparent black overlay for dramatic pauses.
// ---------------------------------------------------------------------------

export function darkOverlay(
  app: PIXI.Application,
  alpha: number,
  fadeDurationMs = 300,
): Promise<PIXI.Graphics> {
  const { screen, stage } = app;

  const overlay = new PIXI.Graphics();
  overlay.name = 'gsapDarkOverlay';
  overlay.eventMode = 'none';
  overlay.alpha = 0;
  overlay.rect(0, 0, screen.width, screen.height).fill({ color: 0x000000, alpha });
  stage.addChild(overlay);

  return new Promise((resolve) => {
    gsap.to(overlay, {
      alpha: 1,
      duration: fadeDurationMs / 1000,
      ease: 'power2.out',
      onComplete: () => resolve(overlay),
    });
  });
}

/** Fade out and remove a dark overlay. */
export function removeDarkOverlay(
  overlay: PIXI.Graphics,
  fadeDurationMs = 200,
): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(overlay, {
      alpha: 0,
      duration: fadeDurationMs / 1000,
      ease: 'power2.out',
      onComplete: () => {
        overlay.clear();
        if (overlay.parent) overlay.parent.removeChild(overlay);
        resolve();
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Fly-to helpers — card ghost flies from A to B with arc and scale.
// ---------------------------------------------------------------------------

export interface FlyToOptions {
  /** Arc height (peak Y offset during flight). */
  arcHeight?: number;
  /** Starting scale. */
  startScale?: number;
  /** Peak scale at mid-flight. */
  peakScale?: number;
  /** Ending scale. */
  endScale?: number;
  /** Starting alpha. */
  startAlpha?: number;
  /** Easing name. */
  easing?: string;
}

/**
 * Animate a display object flying from its current position to (toX, toY)
 * with an arc and scale interpolation.  Returns the Promise from the timeline.
 */
export function flyTo(
  obj: PIXI.DisplayObject,
  toX: number,
  toY: number,
  durationMs: number,
  opts: FlyToOptions = {},
): Promise<void> {
  const {
    arcHeight = 0,
    startScale = 1,
    peakScale = 1,
    endScale = 1,
    startAlpha = 1,
    easing = 'easeInOut',
  } = opts;

  const fromX = obj.x;
  const fromY = obj.y;
  const midT = 0.5;

  return timeline([
    {
      target: obj,
      props: {
        x: fromX + (toX - fromX) * midT,
        y: fromY + (toY - fromY) * midT - arcHeight,
        alpha: 1,
      },
      duration: durationMs * midT,
      easing,
    },
    {
      target: obj,
      props: { x: toX, y: toY },
      duration: durationMs * (1 - midT),
      easing,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Scale bounce — slam-style bounce with decaying oscillation.
// ---------------------------------------------------------------------------

export function scaleBounce(
  obj: PIXI.DisplayObject,
  baseScale: number,
  durationMs: number,
  bounceCount = 3,
  amplitude = 0.08,
): Promise<void> {
  const proxy = { t: 0 };
  return new Promise((resolve) => {
    gsap.to(proxy, {
      t: 1,
      duration: durationMs / 1000,
      ease: 'none',
      onUpdate: () => {
        const decay = Math.pow(1 - proxy.t, 2);
        const angle = proxy.t * Math.PI * bounceCount * 2;
        const s = baseScale * (1 + Math.sin(angle) * decay * amplitude);
        obj.scale.set(s, s);
      },
      onComplete: () => {
        obj.scale.set(baseScale, baseScale);
        resolve();
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Color interpolation helpers.
// ---------------------------------------------------------------------------

/** Interpolate between two hex colors over [0, 1]. */
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const b2 = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | b2;
}

/** Animate a PIXI.Text fill color from one hex to another. */
export function tweenTextColor(
  text: PIXI.Text,
  fromColor: number,
  toColor: number,
  durationMs: number,
  easing = 'easeOutQuad',
): Promise<void> {
  const proxy = { t: 0 };
  return new Promise((resolve) => {
    gsap.to(proxy, {
      t: 1,
      duration: durationMs / 1000,
      ease: resolveEasing(easing),
      onUpdate: () => {
        text.style = {
          ...text.style,
          fill: lerpColor(fromColor, toColor, proxy.t),
        };
      },
      onComplete: () => {
        text.style = { ...text.style, fill: toColor };
        resolve();
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Cleanup helpers.
// ---------------------------------------------------------------------------

/** Remove a display object from its parent safely. */
export function removeSafe(obj: PIXI.DisplayObject): void {
  if (obj.parent) obj.parent.removeChild(obj);
}

/** Clear a Graphics object and remove it from its parent. */
export function clearAndRemove(obj: PIXI.Graphics): void {
  obj.clear();
  removeSafe(obj);
}

/** Remove a list of display objects from their parents. */
export function removeAll(objs: PIXI.DisplayObject[]): void {
  for (const o of objs) removeSafe(o);
}

/**
 * Kill all GSAP tweens affecting a target (useful for cancel logic).
 */
export function killTweensOf(target: object): void {
  gsap.killTweensOf(target);
}

// ---------------------------------------------------------------------------
// Utility: wait / delay (GSAP-backed, cancellable).
// ---------------------------------------------------------------------------

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    gsap.delayedCall(ms / 1000, resolve);
  });
}

// ---------------------------------------------------------------------------
// Utility: parallel and sequence — mirror Animator.static API.
// ---------------------------------------------------------------------------

/** Run multiple animation promises in parallel. */
export function parallel(promises: Promise<void>[]): Promise<void> {
  return Promise.all(promises).then(() => {});
}

/** Run animation promises one after another. */
export function sequence(promises: Promise<void>[]): Promise<void> {
  let chain = Promise.resolve();
  for (const p of promises) {
    chain = chain.then(() => p);
  }
  return chain;
}

// ---------------------------------------------------------------------------
// GSAP global config — set once at module load.
// ---------------------------------------------------------------------------

gsap.defaults({ overwrite: false });
