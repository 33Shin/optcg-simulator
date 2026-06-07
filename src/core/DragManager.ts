import HandCardDragHandler from './drag/HandCardDragHandler';
import EventCardDragHandler from './drag/EventCardDragHandler';
import DONTokenDragHandler from './drag/DONTokenDragHandler';
import FieldCardDragHandler from './drag/FieldCardDragHandler';
import LeaderDragHandler from './drag/LeaderDragHandler';

/**
 * Slim orchestrator that routes drag requests to specialized handler classes.
 * Public API is identical to the original DragManager for zero-breaking changes.
 */
class DragManager {
  constructor(app, gameBoard, board, renderer, players, zoneManager, animManager, isAnimating) {
    this._ctx = {
      app,
      gameBoard,
      renderer,
      players,
      zoneManager,
      animManager,
      isAnimating: isAnimating || (() => false),
    };

    this._handCard = new HandCardDragHandler(this._ctx);
    this._eventCard = new EventCardDragHandler(this._ctx);
    this._donToken = new DONTokenDragHandler(this._ctx);
    this._fieldCard = new FieldCardDragHandler(this._ctx);
    this._leader = new LeaderDragHandler(this._ctx);

    this._handlers = [
      this._handCard, this._eventCard, this._donToken,
      this._fieldCard, this._leader,
    ];
  }

  // --- Public entry points (same signatures as original) ---

  beginDragHandCard(pid, card, handIdx, ghostPos, e, onCommit, onCancel, onDragStarted, inCounterPhase = false) {
    this._handCard.beginDrag(
      { pid, card, handIdx, ghostPos }, e, onCommit, onCancel, onDragStarted,
      { inCounterPhase }
    );
  }

  beginDragDON(pid, donIdx, e, sprite, onDragStarted, onCommit, onCancel) {
    this._donToken.beginDrag(
      { pid, donIdx, sprite }, e, onCommit, onCancel, onDragStarted
    );
  }

  beginDragFieldCard(pid, card, slotIdx, e, onCommit, onCancel) {
    this._fieldCard.beginDrag(
      { pid, card, slotIdx }, e, onCommit, onCancel
    );
  }

  beginDragLeader(pid, leader, e, onCommit, onCancel) {
    this._leader.beginDrag(
      { pid, leader }, e, onCommit, onCancel
    );
  }

  beginDragEventCard(pid, card, handIdx, ghostPos, e, onCommit, onCancel, onDragStarted) {
    this._eventCard.beginDrag(
      { pid, card, handIdx, ghostPos }, e, onCommit, onCancel, onDragStarted
    );
  }

  // --- Public helpers ---

  isDragging() {
    return this._handlers.some(h => h.isDragging());
  }

  getDragType() {
    for (const h of this._handlers) {
      if (h.isDragging()) return h.getDragType();
    }
    return null;
  }

  cancel() {
    for (const h of this._handlers) {
      h.cancel();
    }
  }

  resetCounterPhase() {
    this._handCard.resetCounterPhase();
  }
}

export default DragManager;
