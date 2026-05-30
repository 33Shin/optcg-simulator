import { easeOutQuad, easeOutCubic, easeInOut, easeOutBack, delay } from './animations/utils';

const EASINGS = {
  linear: t => t,
  easeOutQuad,
  easeOutCubic,
  easeInOut,
  easeOutBack,
};

export class Animator {
  constructor({ onUpdate, onComplete, duration, easing = 'easeOutQuad', startNow = performance.now() }) {
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.duration = duration;
    this.easingFn = EASINGS[easing] || EASINGS.easeOutQuad;
    this.startNow = startNow;
    this._rafId = null;
    this._cancelled = false;
  }

  start() {
    const tick = (now) => {
      if (this._cancelled) return;
      const elapsed = now - this.startNow;
      const raw = Math.min(elapsed / this.duration, 1);
      const t = this.easingFn(raw);

      if (this.onUpdate) this.onUpdate(t, raw, elapsed);

      if (raw < 1) {
        this._rafId = requestAnimationFrame(tick);
      } else {
        this._finish();
      }
    };
    this._rafId = requestAnimationFrame(tick);
    return this;
  }

  cancel() {
    this._cancelled = true;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _finish() {
    this._rafId = null;
    if (this.onComplete) this.onComplete();
  }

  toPromise() {
    return new Promise((resolve, reject) => {
      const originalOnComplete = this.onComplete;
      this.start();
      this.onComplete = () => {
        if (this._cancelled) {
          reject(new Error('Animation cancelled'));
        } else {
          if (originalOnComplete) originalOnComplete();
          resolve();
        }
      };
    });
  }

  static animate(opts) {
    return new Animator(opts);
  }

  static parallel(anims) {
    return Promise.all(anims.map(a => a.toPromise()));
  }

  static sequence(anims) {
    let p = Promise.resolve();
    for (const a of anims) {
      p = p.then(() => a.toPromise());
    }
    return p;
  }

  static delay(ms) {
    return delay(ms);
  }
}
