class CounterPhaseOverlay {
  constructor(app, gameBoard, zoneManager, renderer, players, animManager, ui, handRenderer) {
    this.app = app;
    this.gameBoard = gameBoard;
    this.zoneManager = zoneManager;
    this.renderer = renderer;
    this.players = players;
    this.animManager = animManager;
    this.ui = ui;
    this.handRenderer = handRenderer;

    this.container = null;
    this.counterSprites = [];
    this._ghost = null;
    this._draggingIdx = -1;
    this._dragStartPos = null;
    this._appliedCounters = [];
    this._usedCardIds = new Set();
  }

  async show(defenderPid, attacker, target, onPlayCounter) {
    this.defenderPid = defenderPid;
    this._attacker = attacker;
    this._target = target;
    const defender = this.players[this.defenderPid];
    if (!defender || !defender.hand) return { appliedCounters: [] };

    this._appliedCounters = [];
    this._usedCardIds = new Set();

    const counterCards = defender.hand.filter(card => {
      if (this._usedCardIds.has(card.cardId)) return false;
      return this.isCounterCard(card);
    });

    if (counterCards.length === 0) {
      return { appliedCounters: [] };
    }

    this._setupOverlay();
    this._renderCounterCards(counterCards, defender);
    this._setupActionButton(onPlayCounter);

    return new Promise((resolve) => {
      this._resolve = () => {
        if (this._timeoutId) clearTimeout(this._timeoutId);
        this._destroy();
        resolve({ appliedCounters: [...this._appliedCounters] });
      };
      this._onPlayCounterCallback = onPlayCounter;
      // Auto-resolve after 15s timeout so game doesn't hang
      this._startTimeout(15000);
    });
  }

  /** Check if a card can be used in counter step. */
  isCounterCard(card) {
    // Character with counter power value (not null/undefined)
    if (card.counter !== null && card.counter !== undefined) return true;
    // Event with [Counter] timing
    if (card.effects && Array.isArray(card.effects)) {
      if (card.effects.some(e => e.timing === 'counter')) return true;
    }
    // Fallback: check raw effect text for [Counter] keyword
    if (card.effect && card.effect.toLowerCase().includes('[counter]')) return true;
    return false;
  }


  resetTimeout(ms = 15000) {
    if (this._timeoutId) clearTimeout(this._timeoutId);
    this._startTimeout(ms);
  }

  _startTimeout(ms) {
    this._timeoutId = setTimeout(() => {
      if (this._resolve) this._resolve();
    }, ms);
  }

  _setupOverlay() {
    this.container = new PIXI.Container();
    this.container.name = 'counterPhaseOverlay';
    this.container.eventMode = 'passive';
    this.app.stage.addChild(this.container);
  }

  _renderCounterCards(counterCards, defender) {
    const handZone = this.zoneManager.getZone(this.defenderPid, 'hand');
    if (!handZone || counterCards.length === 0) return;

    // Convert zone position to stage-local (screen-space) coordinates
    const globalPos = handZone.toGlobal(new PIXI.Point(0, 0));
    const stagePos = this.app.stage.toLocal(globalPos);

    const scale = 0.95;
    const cardW = 100 * scale;
    const cardH = 140 * scale;
    const gap = 8;
    const zoneW = handZone.width - 20;
    const numCards = defender.hand.length;

    let spacing;
    if (numCards <= 1) {
      spacing = cardW + gap;
    } else if (numCards * cardW + (numCards - 1) * gap <= zoneW) {
      spacing = cardW + gap;
    } else {
      spacing = (zoneW - cardW) / (numCards - 1);
      spacing = Math.max(spacing, cardW * 0.3);
    }

    const actualTotalW = (numCards - 1) * spacing + cardW;
    const startX = (handZone.width - actualTotalW) / 2;
    const yOff = (handZone.height - cardH) / 2;

    for (let i = 0; i < defender.hand.length; i++) {
      const card = defender.hand[i];
      const isCounter = counterCards.includes(card);

      const sprite = this.renderer.render(card, false, scale);
      sprite.name = `counterHandCard_${i}`;
      sprite.position.set(stagePos.x + startX + i * spacing, stagePos.y + yOff);
      sprite.cardRef = card;
      sprite._handIdx = i;
      sprite.eventMode = isCounter ? 'static' : 'none';
      if (isCounter) sprite.cursor = 'grab';

      if (!isCounter) {
        sprite.alpha = 0.35;
      } else {
        const glow = new PIXI.filters.GlowFilter({
          distance: 16,
          outerStrength: 2.5,
          innerStrength: 0,
          color: 0xff4400,
          quality: 0.15,
        });
        sprite.filters = [glow];

        // Character counter: show counter value badge (FREE to trash)
        // Event counter: show cost badge (must pay DON!! cost)
        const isCharacterCounter = card.counter !== null && card.counter !== undefined;
        if (isCharacterCounter) {
          this.renderer.setCounterBadge(sprite, card.counter);
        } else {
          this.renderer.setCostBadge(sprite, card.cost || 0);
        }

        sprite._counterType = isCharacterCounter ? 'character' : 'event';

        sprite.on('pointerdown', (e) => {
          e.stopPropagation();
          this._onCounterCardDragStart(e, i, card, stagePos.x + startX + i * spacing, stagePos.y + yOff);
        });
      }

      this.container.addChild(sprite);
      this.counterSprites.push(sprite);
    }
  }

  _setupActionButton(onPlayCounter) {
    const btnObj = this.ui?.actionButton;
    if (!btnObj) return;

    btnObj._tickerPaused = true;
    const bg = btnObj.actionBg;
    const textEl = btnObj.actionText;

    bg.clear();
    bg.roundRect(0, 0, 200, 40, 10)
      .fill({ color: 0xcc3300, alpha: 0.9 })
      .stroke({ width: 2, color: 0xff6644, alpha: 0.7 });

    textEl.text = 'PASS';
    textEl.style.fill = 0xffffff;
    textEl.dirty = true;

    btnObj.eventMode = 'static';
    btnObj.cursor = 'pointer';

    btnObj.actionBg.off('pointerdown');
    btnObj.actionBg.on('pointerdown', () => {
      if (this._resolve) this._resolve();
    });
  }

  // --- Drag handling for counter cards ---

  _onCounterCardDragStart(e, handIdx, card, spriteX, spriteY) {
    if (this._ghost) return;

    this._draggingIdx = handIdx;
    this._dragStartPos = e.global.clone();
    this._dragCard = card;
    this._dragSpriteOrigX = spriteX;
    this._dragSpriteOrigY = spriteY;

    // Remove original sprite from view during drag (like DragManager)
    const sprite = this.counterSprites[handIdx];
    if (sprite && sprite.parent) {
      this._dragSourceSprite = sprite;
      sprite.parent.removeChild(sprite);
    }

    // Hide the corresponding hand renderer sprite to prevent duplicate display
    if (this.handRenderer && this.handRenderer.handSprites[this.defenderPid]) {
      const handSprite = this.handRenderer.handSprites[this.defenderPid][handIdx];
      if (handSprite) {
        this._hiddenHandSprite = handSprite;
        handSprite.visible = false;
      }
    }

    this._ghost = this.renderer.render(card, false, 0.95);
    this._ghost.name = 'counterDragGhost';
    this._ghost.eventMode = 'none';
    const lp = this.app.stage.toLocal(e.global);
    this._ghost.position.set(lp.x - 47, lp.y - 66);
    this.container.addChildAt(this._ghost, 1);

    this._dragMoveBound = (evt) => { evt.stopPropagation(); this._onDragMove(evt); };
    this._dragUpBound = (evt) => { evt.stopPropagation(); this._onDragEnd(evt); };

    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = new PIXI.Rectangle(0, 0, this.app.renderer.width, this.app.renderer.height);
    this.app.stage.on('pointermove', this._dragMoveBound);
    this.app.stage.on('pointerup', this._dragUpBound);
    this.app.stage.on('pointerupoutside', this._dragUpBound);

    e.stopPropagation();
    e.preventDefault();
  }

  _onDragMove(e) {
    if (!this._ghost) return;
    const lp = this.app.stage.toLocal(e.global);
    this._ghost.position.set(lp.x - 47, lp.y - 66);
  }

  async _onDragEnd(e) {
    if (!this._ghost || this._draggingIdx < 0) return;

    this.app.stage.off('pointermove', this._dragMoveBound);
    this.app.stage.off('pointerup', this._dragUpBound);
    this.app.stage.off('pointerupoutside', this._dragUpBound);
    this.app.stage.eventMode = 'passive';
    this.app.stage.hitArea = null;

    const dx = e.global.x - this._dragStartPos.x;
    const dy = e.global.y - this._dragStartPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 15) {
      this._cancelDrag();
      return;
    }

    const handZone = this.zoneManager.getZone(this.defenderPid, 'hand');
    let droppedInHand = false;
    if (handZone) {
      const lp = handZone.toLocal(e.global);
      droppedInHand = lp.x >= 0 && lp.x <= handZone.width && lp.y >= 0 && lp.y <= handZone.height;
    }

    if (!droppedInHand && this._onPlayCounterCallback) {
      const card = this._dragCard;
      const handIdx = this._draggingIdx;
      this._ghost.alpha = 0;

      try {
        const result = await this._onPlayCounterCallback(card, handIdx);
        if (result && result.ok) {
          this._usedCardIds.add(card.cardId);
          this._appliedCounters.push({ card, powerBoost: result.powerBoost || 0 });

          // Sprite already removed during drag start, just clean up ghost and source ref
          this._dragSourceSprite = null;
          if (this._hiddenHandSprite) {
            this._hiddenHandSprite.visible = true;
            this._hiddenHandSprite = null;
          }
          if (this._ghost && this._ghost.parent) {
            this._ghost.parent.removeChild(this._ghost);
          }
          this._ghost = null;
          this._draggingIdx = -1;

          if (this._resolve) {
            const remaining = this.players[this.defenderPid].hand.filter(c =>
              this.isCounterCard(c)
            );
            if (remaining.length === 0) {
              this._resolve();
            }
          }
          return;
        }
      } catch (_) { /* ignore */ }

      this._cancelDrag();
      return;
    }

    this._cancelDrag();
  }

  _cancelDrag() {
    // Restore original sprite if it was removed
    if (this._dragSourceSprite && !this._dragSourceSprite.parent) {
      this.container.addChild(this._dragSourceSprite);
      this._dragSourceSprite.alpha = 1;
      this._dragSourceSprite = null;
    } else if (this._draggingIdx >= 0) {
      const sprite = this.counterSprites[this._draggingIdx];
      if (sprite) sprite.alpha = 1;
    }

    // Restore hand renderer sprite visibility
    if (this._hiddenHandSprite) {
      this._hiddenHandSprite.visible = true;
      this._hiddenHandSprite = null;
    }

    if (this._ghost && this._ghost.parent) {
      this._ghost.parent.removeChild(this._ghost);
    }
    this._ghost = null;
    this._draggingIdx = -1;
  }

  _destroy() {
    if (!this.container) return;

    // Restore action button to normal state
    if (this.ui) {
      this.ui.restoreActionButton();
    }

    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container = null;
    this.counterSprites = [];
    this._ghost = null;
  }
}

export default CounterPhaseOverlay;
