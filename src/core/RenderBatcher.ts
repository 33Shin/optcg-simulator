class RenderBatcher {
  constructor(isBusy) {
    this._pending = false;
    this._rafId = null;
    this._callbacks = [];
    this._isBusy = isBusy || (() => false);
  }

  schedule(cb) {
    this._callbacks.push(cb);
    if (!this._pending) {
      this._pending = true;
      this._rafId = requestAnimationFrame(() => this._flush());
    }
  }

  _flush() {
    // Guard: skip all renders while drag is active OR commit animation is in progress.
    // Without this, a render can fire between pointer-up (_dragging=false) and the
    // commit callback setting _animating=true, replacing the source sprite before
    // _cleanupDrag runs, causing the dragged object to disappear.
    if (this._isBusy()) {
      this._pending = false;
      this._rafId = requestAnimationFrame(() => this._flush());
      return;
    }
    const cbs = [...this._callbacks];
    this._callbacks.length = 0;
    this._pending = false;
    for (const cb of cbs) {
      try { cb(); } catch (e) { /* swallow render errors */ }
    }
  }

  cancel() {
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._callbacks.length = 0;
    this._pending = false;
  }

  flushSync() {
    if (this._pending) this._flush();
  }
}

export default RenderBatcher;
