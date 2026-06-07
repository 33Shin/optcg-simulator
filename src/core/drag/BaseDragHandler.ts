import { gsap } from 'gsap';
import SnapBackAnimation from '../animations/SnapBackAnimation';
import FadeOutGhostAnimation from '../animations/FadeOutGhostAnimation';

/**
 * Shared drag lifecycle: threshold → ghost → position → target detection → highlight → resolve/cleanup.
 * Each drag type extends this class and overrides the abstract hooks.
 */
class BaseDragHandler {
  constructor(ctx) {
    this.ctx = ctx;
    this._snapBackAnim = new SnapBackAnimation({ app: ctx.app });
    this._fadeOutGhostAnim = new FadeOutGhostAnimation({});

    // Internal state
    this._dragging = false;
    this._source = null;
    this._ghost = null;
    this._highlight = null;
    this._highlightTarget = null;
    this._snapBackPos = null;
    this._dragStartPos = null;
    this._dragMoveBound = null;
    this._dragUpBound = null;
    this._onCommit = null;
    this._onCancel = null;
    this._onDragStarted = null;
    this._dragMoved = false;
    this._sourceTarget = null;
    this._target = null;
    this._targetValid = false;
    this._commitSucceeded = false;
    this._cancelCalled = false;
    this._options = {};
  }

  // --- Abstract hooks (each subclass implements) ---

  get dragType() { return ''; }
  createGhost() { return null; }
  getGhostScale() { return 0.95; }
  computeSnapBackPos(source) { return null; }
  detectTarget(e) { return { target: null, valid: false }; }
  createHighlight(target) {}
  removeHighlight() {
    if (this._highlight && this._highlight.parent) {
      this._highlight.parent.removeChild(this._highlight);
    }
    this._highlight = null;
  }
  getDropTargetGlobal() { return null; }
  shouldAnimateDrop() { return false; }
  resolveDrop(source, target) { return true; }
  isDropCancelled(source, e) { return false; }
  needsSlotBorders() { return false; }
  createSlotBorders() {}
  removeSlotBorders() {
    for (const border of (this._slotBorders || [])) {
      if (border.parent) border.parent.removeChild(border);
    }
    this._slotBorders = [];
  }
  _slotBorders = [];

  // Overridable cleanup (e.g. DON handler adds extra cleanup)
  _cleanupDrag() {
    if (this._ghost && this._ghost.parent) {
      this._ghost.parent.removeChild(this._ghost);
    }
    this._ghost = null;

    if (this._sourceTarget && !this._commitSucceeded) {
      this._sourceTarget.visible = true;
    }

    this.removeHighlight();
    this._highlight = null;
    this.removeSlotBorders();
    this._highlightTarget = null;
    this._dragging = false;
    this._commitSucceeded = false;
    this._cancelCalled = false;
    this._dragMoved = false;
    this._deferCleanup = false;
  }

  // --- Public entry ---

  beginDrag(source, e, onCommit, onCancel, onDragStarted, options = {}) {
    if (this._dragging) {
      this._cleanupDrag();
    }

    if (this.ctx.isAnimating() && !options?.inCounterPhase) return;

    this._source = source;
    this._dragStartPos = e.global.clone();
    this._dragging = true;
    this._onCommit = onCommit;
    this._onCancel = onCancel;
    this._onDragStarted = onDragStarted || null;
    this._target = null;
    this._targetValid = false;
    this._commitSucceeded = false;
    this._cancelCalled = false;
    this._dragMoved = false;
    this._sourceTarget = e.target;
    this._options = options || {};

    this._snapBackPos = this.computeSnapBackPos(source);

    this._dragMoveBound = (evt) => {
      evt.stopPropagation();
      this._onPointerMove(evt);
    };
    this._dragUpBound = (evt) => {
      evt.stopPropagation();
      this._onPointerUp(evt);
    };

    this.ctx.app.stage.eventMode = 'static';
    this.ctx.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.ctx.app.renderer.width, this.ctx.app.renderer.height);
    this.ctx.app.stage.on('pointermove', this._dragMoveBound);
    this.ctx.app.stage.on('pointerup', this._dragUpBound);
    this.ctx.app.stage.on('pointerupoutside', this._dragUpBound);

    e.stopPropagation();
    e.preventDefault();
    this._sourceTarget.eventMode = 'static';
    this._sourceTarget.cursor = 'grab';
  }

  // --- Shared drag loop ---

  _onPointerMove(e) {
    if (!this._dragging) return;

    if (!this._dragMoved) {
      const dx = e.global.x - this._dragStartPos.x;
      const dy = e.global.y - this._dragStartPos.y;
      if (Math.sqrt(dx * dx + dy * dy) < 12) return;
      this._dragMoved = true;
      if (this._onDragStarted) {
        this._onDragStarted();
        this._onDragStarted = null;
      }
      this.createGhost();
      if (this.needsSlotBorders()) {
        this.createSlotBorders();
      }
    }

    this._positionGhost(e.global);
    this._detectDropTarget(e);
  }

  _onPointerUp(e) {
    if (!this._dragging) return;

    const wasDrag = this._dragMoved;
    this._dragging = false;

    this.ctx.app.stage.off('pointermove', this._dragMoveBound);
    this.ctx.app.stage.off('pointerup', this._dragUpBound);
    this.ctx.app.stage.off('pointerupoutside', this._dragUpBound);
    this.ctx.app.stage.eventMode = 'passive';
    this.ctx.app.stage.hitArea = null;

    const dragSource = this._source;
    const target = this._target;
    const targetValid = this._targetValid;

    if (wasDrag && targetValid && target != null) {
      const cleanupDeferred = this._animateDropAndResolve(dragSource, target, e);
      if (cleanupDeferred) return;
    } else if (wasDrag && this.isDropCancelled(dragSource, e)) {
      this._animateSnapBack();
      this._deferCleanup = true;
      return;
    } else if (wasDrag && this._snapBackPos && this._ghost) {
      this._animateSnapBack();
      this._deferCleanup = true;
      return;
    } else if (!wasDrag && this._onCancel && dragSource) {
      this._onCancel(dragSource);
    }
    this._cleanupDrag();
  }

  // --- Ghost ---

  _positionGhost(globalPos) {
    if (!this._ghost) return;
    const lp = this.ctx.app.stage.toLocal(globalPos);
    this._ghost.position.set(
      lp.x - this._ghost.dragW / 2,
      lp.y - this._ghost.dragH / 2
    );
  }

  _getGhostDropPosition() {
    if (!this._ghost) return null;
    const center = new PIXI.Point(
      this._ghost.position.x + this._ghost.dragW / 2,
      this._ghost.position.y + this._ghost.dragH / 2
    );
    return this.ctx.app.stage.toGlobal(center);
  }

  // --- Target detection & highlight ---

  _detectDropTarget(e) {
    const { target, valid } = this.detectTarget(e);
    this._target = target;
    this._targetValid = valid;
    this._updateHighlight(valid, target);
  }

  _updateHighlight(valid, target) {
    if (!this._ghost) return;

    const newKey = this._targetKey(target);

    if (newKey !== this._highlightTarget || valid !== this._targetValid) {
      this.removeHighlight();
      this._highlightTarget = newKey;

      if (valid && newKey) {
        this.createHighlight(target);
      }
    } else if (valid && this._highlight) {
      if (this._highlight.alpha < 0.95) {
        this._highlight.alpha = 1;
      }
    }
  }

  _targetKey(target) {
    return this.dragType + '_' + (target ? JSON.stringify(target) : 'null');
  }

  // --- Drop resolution ---

  _animateDropAndResolve(dragSource, target, e) {
    // For attack drags: GSAP drop animation → resolve → cleanup (deferred)
    if (this.shouldAnimateDrop()) {
      this._animateDropThenResolve(dragSource, target);
      return true; // cleanup deferred inside animation
    }

    const dropPos = this._getGhostDropPosition();
    const success = this.resolveDrop(dragSource, target, dropPos);

    // Async — defer cleanup until promise settles
    if (success && typeof success.then === 'function') {
      this._handleAsyncResolve(success);
      return true; // cleanup deferred inside promise handler
    }

    if (!success) {
      this._animateSnapBack();
      this._deferCleanup = true;
      return true; // cleanup deferred inside snap-back
    }

    // Sync success — remove ghost, cleanup from caller
    if (this._ghost && this._ghost.parent) {
      this._ghost.parent.removeChild(this._ghost);
    }
    return false;
  }

  _animateDropThenResolve(dragSource, target) {
    const endGlobal = this.getDropTargetGlobal();
    if (!endGlobal || !this._ghost) {
      this.resolveDrop(dragSource, target, null);
      return;
    }

    const endLocal = this.ctx.app.stage.toLocal(endGlobal);
    const endPos = new PIXI.Point(
      endLocal.x - this._ghost.dragW / 2,
      endLocal.y - this._ghost.dragH / 2
    );

    const _p = { t: 0 };
    gsap.to(_p, {
      t: 1,
      duration: 0.28,
      ease: 'power2.out',
      onUpdate: () => {
        const t = _p.t;
        this._ghost.position.x += (endPos.x - this._ghost.position.x) * t * 0.3;
        this._ghost.position.y += (endPos.y - this._ghost.position.y) * t * 0.3;
        this._ghost.alpha = 1 - t * 0.3;
      },
      onComplete: () => {
        this.resolveDrop(dragSource, target, null);
        this._cleanupDrag();
      },
    });
  }

  _handleAsyncResolve(promise) {
    if (this._ghost) this._ghost.alpha = 0;
    promise.then((res) => {
      if (res === false) {
        if (this._ghost) this._ghost.alpha = 1;
        this._deferCleanup = false;
        this._animateSnapBack();
        return; // snap-back handles cleanup
      }
      this._commitSucceeded = true;
      this._cleanupDrag();
    }).catch(() => {
      if (this._ghost) this._ghost.alpha = 1;
      this._deferCleanup = false;
      this._animateSnapBack();
    });
  }

  // --- Snap-back & fade ---

  _animateSnapBack() {
    const ghost = this._ghost;
    if (!ghost || !this._snapBackPos) {
      if (this._onCancel && this._source && !this._cancelCalled) {
        this._onCancel(this._source);
        this._cancelCalled = true;
      }
      if (this._deferCleanup) {
        this._cleanupDrag();
      }
      return;
    }

    this._snapBackAnim.animate(ghost, this._snapBackPos).then(() => {
      if (this._onCancel && this._source) {
        this._onCancel(this._source);
        this._cancelCalled = true;
      }
      this._cleanupDrag();
    });
  }

  _animateAlpha(obj, to, duration) {
    const from = obj.alpha;
    if (Math.abs(from - to) < 0.01) {
      obj.alpha = to;
      return;
    }
    const _p = { t: 0 };
    gsap.to(_p, {
      t: 1,
      duration: duration / 1000,
      ease: 'power2.out',
      onUpdate: () => {
        obj.alpha = from + (to - from) * _p.t;
      },
      onComplete: () => {
        obj.alpha = to;
      },
    });
  }

  // --- Public helpers ---

  isDragging() {
    return this._dragging;
  }

  getDragType() {
    return this.dragType;
  }

  cancel() {
    if (!this._dragging) return;
    this._dragging = false;
    this.ctx.app.stage.off('pointermove', this._dragMoveBound);
    this.ctx.app.stage.off('pointerup', this._dragUpBound);
    this.ctx.app.stage.off('pointerupoutside', this._dragUpBound);
    this.ctx.app.stage.eventMode = 'passive';
    this.ctx.app.stage.hitArea = null;
    this._cleanupDrag();
  }
}

export default BaseDragHandler;
