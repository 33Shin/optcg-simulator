import { gsap } from 'gsap';
import SnapBackAnimation from './animations/SnapBackAnimation';
import FadeOutGhostAnimation from './animations/FadeOutGhostAnimation';
import { isPointInZone } from './animations/utils';

class DragManager {
  constructor(app, gameBoard, board, renderer, players, zoneManager, animManager, isAnimating) {
    this.app = app;
    this.gameBoard = gameBoard;
    this.board = board;
    this.renderer = renderer;
    this.players = players;
    this.zoneManager = zoneManager;
    this.animManager = animManager;
    this._isAnimating = isAnimating || (() => false);
    this._snapBackAnim = new SnapBackAnimation({ app });
    this._fadeOutGhostAnim = new FadeOutGhostAnimation({});

    // Internal state
    this._dragging = false;
    this._dragType = null;       // 'handCard', 'donToken', 'fieldCard', 'leader'
    this._dragSource = null;     // source data depends on drag type
    this._ghost = null;
    this._highlight = null;
    this._highlightTarget = null; // cached target key for reuse
    this._slotBorders = [];      // border highlights on all available slots
    this._dragStartPos = null;
    this._snapBackPos = null;    // stage-local pos to animate ghost back to hand
    this._dragMoveBound = null;
    this._dragUpBound = null;

    // Callbacks
    this._onCommit = null;
    this._onCancel = null;
  }

  // --- Public entry points ---

  /**
   * Begin dragging a character card from hand to field slots.
   * @param {number} pid - Player ID
   * @param {object} card - Card object
   * @param {number} handIdx - Index in hand
    * @param {object} ghostPos - Global position in hand for snap-back animation
    * @param {object} e - Pixi pointer event
    * @param {function} onCommit - Called on successful drop with (pid, card, handIdx, slotIdx)
    * @param {function} onCancel - Called on cancel with (pid, card, handIdx)
    * @param {function} onDragStarted - Called once drag threshold is passed (card removed from hand)
    */
  beginDragHandCard(pid, card, handIdx, ghostPos, e, onCommit, onCancel, onDragStarted, inCounterPhase = false) {
    this._startDrag('handCard', { pid, card, handIdx }, e, onCommit, onCancel, inCounterPhase);
    this._snapBackPos = this.app.stage.toLocal(new PIXI.Point(ghostPos.x, ghostPos.y));
    this._onDragStarted = onDragStarted || null;
  }

   /**
    * Begin dragging a DON token to attach to a character/leader.
    * @param {number} pid - Player ID (cost area owner)
    * @param {number} donIdx - Index in cost area
    * @param {object} e - Pixi pointer event
    * @param {object} sprite - Source DON sprite
    * @param {function} onDragStarted - Called once drag threshold is passed (DON removed from costArea)
    * @param {function} onCommit - Called with (pid, donIdx, targetCard, targetZone)
    * @param {function} onCancel - Called with (pid, donIdx)
    */
   beginDragDON(pid, donIdx, e, sprite, onDragStarted, onCommit, onCancel) {
    this._startDrag('donToken', { pid, donIdx, sprite }, e, onCommit, onCancel, false);
    this._onDragStarted = onDragStarted || null;
    const costZone = this.gameBoard.getZone(pid, 'cost');
    if (costZone) {
      const tokenW = 36, gap = 10;
      const numTokens = Math.max(this.players[pid].costArea.length, 10);
      const totalW = numTokens * tokenW + (numTokens - 1) * gap;
      const startX = (costZone.width - totalW) / 2;
      const yOff = (40 - tokenW) / 2;
      const localX = startX + donIdx * (tokenW + gap) + tokenW / 2;
      const localY = yOff + tokenW / 2;
      const globalPos = costZone.toGlobal(new PIXI.Point(localX, localY));
      this._snapBackPos = this.app.stage.toLocal(globalPos);
    }
  }

  /**
   * Begin dragging a field character to attack.
   * @param {number} pid - Player ID (attacker)
   * @param {object} card - Character card object
   * @param {number} slotIdx - Index on field
   * @param {object} e - Pixi pointer event
   * @param {function} onCommit - Called with (pid, attackerCard, slotIdx, targetCard, targetPid)
   * @param {function} onCancel - Called with (pid, card, slotIdx)
   */
  beginDragFieldCard(pid, card, slotIdx, e, onCommit, onCancel) {
    this._startDrag('fieldCard', { pid, card, slotIdx }, e, onCommit, onCancel, false);
  }

  /**
   * Begin dragging the leader to attack.
   * @param {number} pid - Player ID (attacker)
   * @param {object} leader - Leader card object
   * @param {object} e - Pixi pointer event
   * @param {function} onCommit - Called with (pid, leader, targetCard, targetPid)
   * @param {function} onCancel - Called with (pid, leader)
   */
  beginDragLeader(pid, leader, e, onCommit, onCancel) {
    this._startDrag('leader', { pid, leader }, e, onCommit, onCancel, false);
  }

  // --- Core drag loop ---

  _startDrag(type, source, e, onCommit, onCancel, inCounterPhase = false) {
    if (this._dragging) {
      // Force cleanup of stale state (e.g. counter phase ended while drag was in progress)
      this._cleanupDrag();
    }

    // Block drag start while an animation is playing to prevent sprite destruction on re-render
    // Exception: counter phase must allow drag during battle animations
    if (this._isAnimating() && !inCounterPhase) return;

    this._dragType = type;
    this._dragSource = source;
    this._dragStartPos = e.global.clone();
    this._dragging = true;
    this._onCommit = onCommit;
    this._onCancel = onCancel;
    this._targetZone = null;
    this._targetValid = false;
    this._commitSucceeded = false;
    // During counter phase, any handCard drop should call commit (not just field slot drops)
    this._counterPhaseActive = type === 'handCard' && !!inCounterPhase;
    this._dragMoved = false;
    this._sourceTarget = e.target;

    this._dragMoveBound = (evt) => {
      evt.stopPropagation();
      this._onPointerMove(evt);
    };
    this._dragUpBound = (evt) => {
      evt.stopPropagation();
      this._onPointerUp(evt);
    };

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.renderer.width, this.app.renderer.height);
    this.app.stage.on('pointermove', this._dragMoveBound);
    this.app.stage.on('pointerup', this._dragUpBound);
    this.app.stage.on('pointerupoutside', this._dragUpBound);

    e.stopPropagation();
    e.preventDefault();
    this._sourceTarget.eventMode = 'static';
    this._sourceTarget.cursor = 'grab';
  }

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
      this._createGhost();
      if (this._dragType === 'handCard' && !this._counterPhaseActive) {
        this._createSlotBorders();
      }
    }

    this._positionGhost(e.global);
    this._detectDropTarget(e);
  }

  _onPointerUp(e) {
    if (!this._dragging) return;

    const wasDrag = this._dragMoved;
    this._dragging = false;

    this.app.stage.off('pointermove', this._dragMoveBound);
    this.app.stage.off('pointerup', this._dragUpBound);
    this.app.stage.off('pointerupoutside', this._dragUpBound);
    this.app.stage.eventMode = 'passive';
    this.app.stage.hitArea = null;

    // Capture state before any callbacks or animations can mutate it
    const dragSource = this._dragSource;
    const targetZone = this._targetZone;
    const targetValid = this._targetValid;
    const dragType = this._dragType;

    // Valid target detected — resolve drop regardless of counter phase flag
    if (wasDrag && targetValid && targetZone != null) {
      this._targetZone = targetZone;
      this._targetValid = targetValid;
      this._animateDropAndResolve(dragSource, dragType);
    } else if (this._counterPhaseActive && wasDrag && dragType === 'handCard') {
      // Counter phase: ANY drop OUTSIDE hand plays card as counter; dropping back in hand cancels
      const droppedInHand = this._isDropInsideHandZone(e, dragSource.pid);
      if (!droppedInHand) {
        const dropPos = this._ghost ? this.app.stage.toLocal(e.global) : null;
        const res = this._onCommit(dragSource.pid, dragSource.card, dragSource.handIdx, dropPos);
        if (res === false) {
          this._animateSnapBack();
        } else if (res && typeof res.then === 'function') {
          // Fade ghost immediately so hand fade-out animation is visible;
          // mark succeeded early so _cleanupDrag won't restore source sprite
          this._commitSucceeded = true;
          this._fadeOutGhostThenCleanup();
          res.then((r) => {
            if (r === false) {
              this._animateSnapBack();
            }
          }).catch(() => {
            this._animateSnapBack();
          });
        } else {
          this._commitSucceeded = true;
          this._cleanupDrag();
        }
      } else {
        // Dropped back in hand zone — cancel the drag
        this._animateSnapBack();
      }
    } else if (dragType === 'handCard' && this._snapBackPos && this._ghost) {
      this._animateSnapBack();
    } else if (wasDrag && dragType === 'donToken' && this._snapBackPos && this._ghost) {
      this._animateDONSnapBack(dragSource);
    } else {
      // Cancel without drag (click released below threshold)
      if (this._onCancel && dragSource) {
        this._onCancel(dragSource.pid, dragSource.card || dragSource.leader, dragSource.handIdx ?? dragSource.slotIdx);
      }
      this._cleanupDrag();
    }
  }

  // --- Ghost creation & positioning ---

  _createGhost() {
    switch (this._dragType) {
      case 'handCard':
      case 'fieldCard':
      case 'leader':
        this._ghost = this.renderer.createDragGhost(
          this._dragSource.card || this._dragSource.leader || this._dragSource,
          this._getGhostScale()
        );
        this._ghost.name = `${this._dragType}DragGhost`;
        this.app.stage.addChild(this._ghost);
        // Hide source sprite while dragging
        if (this._sourceTarget) {
          this._sourceTarget.visible = false;
        }
        break;
      case 'donToken':
        this._ghost = this.renderer.createDONGhost();
        this._ghost.name = 'donTokenDragGhost';
        this.app.stage.addChild(this._ghost);
        // Hide source sprite while dragging
        if (this._dragSource.sprite && this._dragSource.sprite.visible) {
          this._dragSource.sprite.visible = false;
        }
        break;
    }
  }

  _getGhostScale() {
    if (this._dragType === 'leader') return 1.3;
    if (this._dragType === 'fieldCard') return 0.8;
    return 0.95;
  }

  _positionGhost(globalPos) {
    if (!this._ghost) return;
    const lp = this.app.stage.toLocal(globalPos);
    this._ghost.position.set(
      lp.x - this._ghost.dragW / 2,
      lp.y - this._ghost.dragH / 2
    );
  }

  _getGhostSize() {
    if (!this._ghost) return { w: 0, h: 0 };
    return { w: this._ghost.dragW, h: this._ghost.dragH };
  }

  // --- Drop target detection ---

  _detectDropTarget(e) {
    let target = null;
    let valid = false;

    switch (this._dragType) {
      case 'handCard':
        ({ target, valid } = this._detectTarget_HandCard(e));
        break;
      case 'donToken':
        ({ target, valid } = this._detectTarget_DON(e));
        break;
      case 'fieldCard':
      case 'leader':
        ({ target, valid } = this._detectTarget_Attack(e));
        break;
    }

    this._targetZone = target;
    this._targetValid = valid;
    this._updateHighlight(valid, target);
  }

  _detectTarget_HandCard(e) {
    if (this._counterPhaseActive) {
      return { target: null, valid: false };
    }

    const global = e.global;
    const { pid } = this._dragSource;
    const player = this.players[pid];

    // Check if there are empty slots — if so, only empty slots are valid targets
    const hasEmptySlot = player.field.some(c => c === null);

    for (let i = 0; i < 5; i++) {
      const zone = this.gameBoard.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;

      if (isPointInZone(zone, global)) {
        // If empty slots exist, only allow dropping on empty ones
        if (hasEmptySlot && player.field[i] !== null) {
          return { target: i, valid: false };
        }
        return { target: i, valid: true };
      }
    }
    return { target: null, valid: false };
  }

  /** Check if a drop point is inside the player's hand zone. */
  _isDropInsideHandZone(e, pid) {
    const handZone = this.gameBoard.getZone(pid, 'hand');
    return handZone ? isPointInZone(handZone, e.global) : false;
  }

  _detectTarget_DON(e) {
    const global = e.global;
    const { pid } = this._dragSource;
    const opponentId = pid === 1 ? 2 : 1;

      // Check own field characters
      for (let i = 0; i < 5; i++) {
        const zone = this.gameBoard.getZone(pid, `field_slot_${i}`);
        if (!zone) continue;
        const card = this.players[pid].field[i];
        if (!card) continue;

        if (isPointInZone(zone, global)) {
          return { target: card, valid: true };
        }
      }

      // Check own leader
      {
        const zone = this.gameBoard.getZone(pid, 'leader');
        if (zone && isPointInZone(zone, global)) {
          return { target: this.players[pid].leader, valid: true };
        }
      }

      return { target: null, valid: false };
  }

  _detectTarget_Attack(e) {
    const global = e.global;
    const { pid } = this._dragSource;
    const opponentId = pid === 1 ? 2 : 1;

    // Check opponent field characters (rested)
    for (let i = 0; i < 5; i++) {
      const zone = this.gameBoard.getZone(opponentId, `field_slot_${i}`);
      if (!zone) continue;
      const card = this.players[opponentId].field[i];
      if (!card) continue;

      if (isPointInZone(zone, global)) {
        return { target: { type: 'field', card, slotIdx: i, pid: opponentId }, valid: card.rested };
      }
    }

    // Check opponent leader
    {
      const zone = this.gameBoard.getZone(opponentId, 'leader');
      if (zone && isPointInZone(zone, global)) {
        return { target: { type: 'leader', pid: opponentId }, valid: true };
      }
    }

    return { target: null, valid: false };
  }

  // --- Highlight management ---

  _targetKey() {
    if (this._dragType === 'handCard' && typeof this._targetZone === 'number') {
      return `${this._dragSource.pid}_slot_${this._targetZone}`;
    }
    if (this._dragType === 'donToken') {
      return this._targetZone ? `don_${this._targetZone.cardId || this._targetZone.name}` : null;
    }
    if (this._dragType === 'fieldCard' || this._dragType === 'leader') {
      if (!this._targetZone) return null;
      if (this._targetZone.type === 'leader') return `${this._targetZone.pid}_leader`;
      return `${this._targetZone.pid}_slot_${this._targetZone.slotIdx}`;
    }
    return null;
  }

  _updateHighlight(valid, target) {
    if (!this._ghost) return;

    const newKey = this._targetKey();

    // If target changed or validity toggled, recreate highlight
    if (newKey !== this._highlightTarget || valid !== this._targetValid) {
      this._removeHighlight();
      this._highlightTarget = newKey;

      if (valid && newKey) {
        this._createHighlightForTarget(target);
      }
    } else if (valid && this._highlight) {
      // Ensure highlight is fully visible even if fade-in was interrupted last frame
      if (this._highlight.alpha < 0.95) {
        this._highlight.alpha = 1;
      }
    }
  }

  _createHighlightForTarget(target) {
    switch (this._dragType) {
      case 'handCard':
        this._highlightFieldSlot(target);
        break;
      case 'donToken':
        this._highlightTargetCard(target);
        break;
      case 'fieldCard':
      case 'leader':
        this._highlightAttackTarget(target);
        break;
    }
  }

  _highlightFieldSlot(slotIdx) {
    const { pid } = this._dragSource;
    const zone = this.gameBoard.getZone(pid, `field_slot_${slotIdx}`);
    if (!zone) return;

    this._highlight = this.renderer.createDropHighlight(zone.width, zone.height, 0x4CAF50);
    this._highlight.name = 'fieldSlotHighlight';
    this._highlight.alpha = 0;
    zone.addChild(this._highlight);
    this._animateAlpha(this._highlight, 1, 120);
  }

  _highlightTargetCard(card) {
    const zone = this.zoneManager.findZoneForCard(this.players, card);
    if (!zone) return;

    this._highlight = this.renderer.createDropHighlight(zone.width, zone.height, 0x4CAF50);
    this._highlight.name = 'targetCardHighlight';
    this._highlight.alpha = 0;
    zone.addChild(this._highlight);
    this._animateAlpha(this._highlight, 1, 120);
  }

  _highlightAttackTarget(target) {
    let zone = null;
    if (target.type === 'field') {
      zone = this.gameBoard.getZone(target.pid, `field_slot_${target.slotIdx}`);
    } else if (target.type === 'leader') {
      zone = this.gameBoard.getZone(target.pid, 'leader');
    }

    if (!zone) return;
    this._highlight = this.renderer.createDropHighlight(zone.width, zone.height, 0xf44336);
    this._highlight.name = 'attackTargetHighlight';
    this._highlight.alpha = 0;
    zone.addChild(this._highlight);
    this._animateAlpha(this._highlight, 1, 120);
  }

  _removeHighlight() {
    const hl = this._highlight;
    this._highlight = null;
    if (hl && hl.parent) {
      hl.parent.removeChild(hl);
    }
  }

  _createSlotBorders() {
    this._removeSlotBorders();
    const { pid } = this._dragSource;
    const player = this.players[pid];
    const hasEmptySlot = player.field.some(c => c === null);

    for (let i = 0; i < 5; i++) {
      const zone = this.gameBoard.getZone(pid, `field_slot_${i}`);
      if (!zone) continue;
      // If empty slots exist, only highlight empty ones
      if (hasEmptySlot && player.field[i] !== null) continue;

      const slotBorderGraphics = this.renderer.createSlotBorder(zone.width, zone.height, 0x4CAF50);
      slotBorderGraphics.name = `slotBorder_${pid}_${i}`;
      zone.addChild(slotBorderGraphics);
      this._slotBorders.push(slotBorderGraphics);
    }
  }

  _removeSlotBorders() {
    for (const border of this._slotBorders) {
      if (border.parent) {
        border.parent.removeChild(border);
      }
    }
    this._slotBorders = [];
  }

  // --- Drop animation & resolution ---

  _animateDropAndResolve(dragSource, dragType) {
    if (dragType === 'donToken') {
      // Fire commit immediately — no drop animation for DON attach
      const targetZone = this._targetZone;
      const onCommit = this._onCommit;
      const result = onCommit(dragSource.pid, dragSource.donIdx, targetZone, null);

      if (this._ghost && this._ghost.parent) {
        this._ghost.parent.removeChild(this._ghost);
      }
      this._removeHighlight();
      if (result && typeof result.then === 'function') {
        result.then(() => this._cleanupDragDON()).catch(() => {
          if (dragSource.sprite) dragSource.sprite.visible = true;
          this._cleanupDragDON();
        });
      } else {
        this._cleanupDragDON();
      }
      return;
    }

    const targetGlobal = this._getTargetGlobal();
    if (!targetGlobal) {
      // For handCard (including counter phase), call commit with the detected slot index
      if (this._dragType === 'handCard') {
        const res = this._onCommit(dragSource.pid, dragSource.card, dragSource.handIdx, this._targetZone);
        if (res !== false && res !== undefined) {
          this._commitSucceeded = true;
        }
      } else {
        this._resolveImmediately();
      }
      this._cleanupDrag();
      return;
    }

    if (!this._ghost) {
      this._cleanupDrag();
      return;
    }

    const lp = this.app.stage.toLocal(targetGlobal);
    const endPos = new PIXI.Point(
      lp.x - this._ghost.dragW / 2,
      lp.y - this._ghost.dragH / 2
    );

    if (dragType === 'handCard') {
      const result = this._onCommit(dragSource.pid, dragSource.card, dragSource.handIdx, this._targetZone);
      // Sync failure — snap back immediately (ghost still alive)
      if (result === false) {
        this._animateSnapBack();
        return;
      }
      if (result && typeof result.then === 'function') {
        // Hide ghost so it doesn't overlap with slam animation,
        // but keep it alive in case we need snap-back on failure.
        // (_commitPlayToField is async, so sync `return false` wraps to Promise.resolve(false))
        if (this._ghost) this._ghost.alpha = 0;
        result.then((res) => {
          if (res === false) {
            // Restore visibility for snap-back animation
            if (this._ghost) this._ghost.alpha = 1;
            this._animateSnapBack();
          } else {
            this._commitSucceeded = true;
            if (this._ghost && this._ghost.parent) {
              this._ghost.parent.removeChild(this._ghost);
            }
            this._removeHighlight();
            this._highlightTarget = null;
            this._cleanupDrag();
          }
        }).catch(() => {
          if (this._ghost) this._ghost.alpha = 1;
          this._animateSnapBack();
        });
        return;
      }
      // Sync success — remove ghost before cleanup
      if (this._ghost && this._ghost.parent) {
        this._ghost.parent.removeChild(this._ghost);
      }
      this._removeHighlight();
      this._highlightTarget = null;
      this._cleanupDrag();
      return;
    }

    const duration = 280;

    const _p = { t: 0 };
    gsap.to(_p, {
      t: 1,
      duration: duration / 1000,
      ease: 'power2.out',
      onUpdate: () => {
        const t = _p.t;
        this._ghost.position.x += (endPos.x - this._ghost.position.x) * t * 0.3;
        this._ghost.position.y += (endPos.y - this._ghost.position.y) * t * 0.3;
        this._ghost.alpha = 1 - t * 0.3;
      },
      onComplete: () => {
        this._resolveImmediately();
        this._cleanupDrag();
      },
    });
  }


  _getTargetGlobal() {
    if (this._dragType === 'handCard' && typeof this._targetZone === 'number') {
      const { pid } = this._dragSource;
      const zone = this.gameBoard.getZone(pid, `field_slot_${this._targetZone}`);
      if (zone) {
        const center = new PIXI.Point(zone.x + zone.width / 2, zone.y + zone.height / 2);
        return this.app.stage.toGlobal(center);
      }
    }

    // For card targets
    if (this._targetZone && typeof this._targetZone === 'object') {
      // Check if it's a target card object (DON drop)
      if (this._dragType === 'donToken' && this._targetZone.name) {
        const zone = this.zoneManager.findZoneForCard(this.players, this._targetZone);
        if (zone) {
          const center = new PIXI.Point(zone.x + zone.width / 2, zone.y + zone.height / 2);
          return this.app.stage.toGlobal(center);
        }
      }

      // Check if it's a target object with type (attack drop)
      if (this._targetZone.type) {
        let zone = null;
        if (this._targetZone.type === 'field') {
          zone = this.gameBoard.getZone(this._targetZone.pid, `field_slot_${this._targetZone.slotIdx}`);
        } else if (this._targetZone.type === 'leader') {
          zone = this.gameBoard.getZone(this._targetZone.pid, 'leader');
        }
        if (zone) {
          const center = new PIXI.Point(zone.x + zone.width / 2, zone.y + zone.height / 2);
          return this.app.stage.toGlobal(center);
        }
      }
    }

    return null;
  }

  _resolveImmediately() {
    // Invoke the commit callback based on drag type
    if (!this._onCommit) return;

    switch (this._dragType) {
      case 'handCard':
        this._onCommit(this._dragSource.pid, this._dragSource.card, this._dragSource.handIdx, this._targetZone);
        break;
      case 'donToken':
        this._onCommit(this._dragSource.pid, this._dragSource.donIdx, this._targetZone);
        break;
      case 'fieldCard':
        const fieldTarget = this._targetZone.type === 'leader'
          ? this.players[this._targetZone.pid].leader
          : this._targetZone.card;
        this._onCommit(this._dragSource.pid, this._dragSource.card, this._dragSource.slotIdx,
          fieldTarget, this._targetZone.pid);
        break;
      case 'leader':
        const leaderTarget = this._targetZone.type === 'leader'
          ? this.players[this._targetZone.pid].leader
          : this._targetZone.card;
        this._onCommit(this._dragSource.pid, this._dragSource.leader, leaderTarget, this._targetZone.pid);
        break;
    }
  }

  _animateSnapBack() {
    const ghost = this._ghost;
    if (!ghost || !this._snapBackPos) {
      this._cleanupDrag();
      if (this._onCancel && this._dragSource) {
        this._onCancel(this._dragSource.pid, this._dragSource.card, this._dragSource.handIdx);
      }
      return;
    }

    this._snapBackAnim.animate(ghost, this._snapBackPos).then(() => {
      this._cleanupDrag();
      if (this._onCancel && this._dragSource) {
        this._onCancel(this._dragSource.pid, this._dragSource.card, this._dragSource.handIdx);
      }
    });
  }

  _animateDONSnapBack(dragSource) {
    const ghost = this._ghost;
    if (!ghost || !this._snapBackPos) {
      this._cleanupDrag();
      if (this._onCancel && dragSource) {
        this._onCancel(dragSource.pid, dragSource.donIdx);
      }
      return;
    }

    this._snapBackAnim.animate(ghost, this._snapBackPos).then(() => {
      this._cleanupDrag();
      if (this._onCancel && dragSource) {
        this._onCancel(dragSource.pid, dragSource.donIdx);
      }
    });
  }

  /** Fade out the ghost sprite over a short duration, then clean up. */
  _fadeOutGhostThenCleanup() {
    const ghost = this._ghost;
    if (!ghost) {
      this._cleanupDrag();
      return;
    }

    this._fadeOutGhostAnim.animate(ghost).then(() => {
      this._cleanupDrag();
    });
  }

  _cleanupDrag() {
    // Remove ghost
    if (this._ghost && this._ghost.parent) {
      this._ghost.parent.removeChild(this._ghost);
    }
    this._ghost = null;

    // Restore source sprite visibility on cancel (commit failed or no target)
    if (this._sourceTarget && !this._commitSucceeded) {
      this._sourceTarget.visible = true;
    }

    // Remove highlight
    this._removeHighlight();
    this._highlight = null;

    // Remove border highlights
    this._removeSlotBorders();

    // Reset cached target
    this._highlightTarget = null;

    // Show hidden DON sprite again (only on cancel — valid drop re-renders cost zone)
    if (this._dragType === 'donToken' && this._dragSource.sprite) {
      this._dragSource.sprite.visible = true;
    }

    // Reset drag state so subsequent drags can start fresh
    this._dragging = false;
    this._commitSucceeded = false;
    this._counterPhaseActive = false;
    this._dragMoved = false;
  }

  _cleanupDragDON() {
    // DON was already removed from costArea by commit callback.
    // Don't restore sprite visibility — the re-render handles it.
    if (!this._dragging) {
      this._highlightTarget = null;
      this._dragSource = null;
      this._onCommit = null;
      this._onCancel = null;
      this._dragType = null;
    } else {
      // A new drag has started — only clear stale DON-specific state
      this._highlightTarget = null;
    }
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

  // --- Public cleanup ---

  /** Force-reset counter phase state (called when battle/counter phase ends). */
  resetCounterPhase() {
    this._counterPhaseActive = false;
    if (this._dragging) {
      this._cleanupDrag();
    }
  }

  cancel() {
    if (!this._dragging) return;
    this._dragging = false;
    this.app.stage.off('pointermove', this._dragMoveBound);
    this.app.stage.off('pointerup', this._dragUpBound);
    this.app.stage.off('pointerupoutside', this._dragUpBound);
    this.app.stage.eventMode = 'passive';
    this.app.stage.hitArea = null;
    this._cleanupDrag();
  }

  isDragging() {
    return this._dragging;
  }

  getDragType() {
    return this._dragType;
  }
}

export default DragManager;
