import type { AnimationGuardState } from '../types/game';

class AnimationGuard {
  private _state: AnimationGuardState;

  constructor() {
    this._state = {
      animating: false,
      animatingDONDraw: false,
      pendingSlams: 0,
      donVisibleCount: { 1: 0, 2: 0 },
    };
  }

  get animating(): boolean {
    return this._state.animating;
  }

  set animating(value: boolean) {
    this._state.animating = value;
  }

  get animatingDONDraw(): boolean {
    return this._state.animatingDONDraw;
  }

  set animatingDONDraw(value: boolean) {
    this._state.animatingDONDraw = value;
  }

  get pendingSlams(): number {
    return this._state.pendingSlams;
  }

  get donVisibleCount(): { 1: number; 2: number } {
    return this._state.donVisibleCount;
  }

  incrementSlam() {
    this._state.pendingSlams++;
  }

  decrementSlam() {
    this._state.pendingSlams--;
  }

  async withDONDrawGuard<T>(fn: () => Promise<T>): Promise<T> {
    this._state.animatingDONDraw = true;
    try {
      return await fn();
    } finally {
      this._state.animatingDONDraw = false;
    }
  }

  async withAnimatingGuard<T>(fn: () => Promise<T>): Promise<T> {
    this._state.animating = true;
    try {
      return await fn();
    } finally {
      this._state.animating = false;
    }
  }

  resetDONVisibleCount(pid: 1 | 2, count: number) {
    this._state.donVisibleCount[pid] = count;
  }

  incrementDONVisible(pid: 1 | 2) {
    this._state.donVisibleCount[pid] = (this._state.donVisibleCount[pid] || 0) + 1;
  }

  getDONVisible(pid: 1 | 2): number {
    return this._state.donVisibleCount[pid];
  }

  waitForPendingSlams(): Promise<void> {
    return new Promise(resolve => {
      const check = () => {
        if (this._state.pendingSlams === 0) resolve();
        else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  }
}

export default AnimationGuard;
