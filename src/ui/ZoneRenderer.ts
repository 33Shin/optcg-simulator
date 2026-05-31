const DON_TOKEN_SIZE = 36; // cost zone height (40) minus padding

class ZoneRenderer {
  constructor(zoneManager, renderer, players, ui) {
    this.zoneManager = zoneManager;
    this.renderer = renderer;
    this.players = players;
    this.ui = ui || null;
    /** @type {{pid: number, donIdx: number}|null} */
    this._draggingDON = null;
  }

  beginDragDON(pid, donIdx) {
    this.cancelCostAnimation(pid);
    this._draggingDON = { pid, donIdx };
  }

  endDragDON() {
    this._draggingDON = null;
  }

  renderAll() {
    for (const pid of [1, 2]) {
      this._renderDeck(pid);
      this._renderDONDeck(pid);
      this._renderTrash(pid);
    }
  }

  renderCostTokensInteractive(pid, canAct, onDONTokenPointerDown) {
    this.renderCostTokens(pid, canAct, onDONTokenPointerDown);
  }

  renderCostTokens(pid, canAct = false, onDONTokenPointerDown = null, visibleCount) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'cost');
    if (!zone) return;

    // Skip the slot of a DON currently being dragged to avoid duplicate sprites
    const skipIdx = this._draggingDON && this._draggingDON.pid === pid ? this._draggingDON.donIdx : -1;

    // Limit rendering to visibleCount during DON phase animation
    const count = visibleCount !== undefined ? Math.min(visibleCount, p.costArea.length) : p.costArea.length;

    // Capture old positions for animation (skip hidden drag ghosts)
    const existing = zone.children.filter(c => c.isCostToken && c.alpha > 0.5);
    const oldPositions = existing.map(s => ({ x: s.position.x, y: s.position.y }));

    // Cancel any in-flight animation
    if (this._costAnimTimers && this._costAnimTimers[pid]) {
      cancelAnimationFrame(this._costAnimTimers[pid]);
      delete this._costAnimTimers[pid];
    }
    if (this._costAnimState) {
      delete this._costAnimState[pid];
    }

    // Clear ALL cost tokens (including hidden ones from active drag) to prevent orphans
    zone.children.filter(c => c.isCostToken).forEach(s => zone.removeChild(s));

    const tokenW = DON_TOKEN_SIZE;
    const gap = 10;
    const numTokens = Math.max(p.costArea.length, 10);
    const totalW = numTokens * tokenW + (numTokens - 1) * gap;
    const startX = (zone.width - totalW) / 2;
    const yOff = (40 - DON_TOKEN_SIZE) / 2; // cost zone height is 40

    let posChanged = false;
    for (let i = 0; i < count; i++) {
      if (i === skipIdx) continue;

      const don = p.costArea[i];
      const isActive = don ? don.active && !don.rested : false;

      // Reuse existing sprite if available, otherwise create new
      let costTokenSprite = existing[i];
      if (!costTokenSprite) {
        costTokenSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
        costTokenSprite.name = `costToken_${pid}_${i}`;
        costTokenSprite.width = tokenW;
        costTokenSprite.height = tokenW;
        costTokenSprite.anchor.set(0.5);
      }

      const targetX = startX + i * (tokenW + gap) + tokenW / 2;
      const targetY = yOff + tokenW / 2;

      if (!isActive) {
        costTokenSprite.rotation = Math.PI / 2;
         costTokenSprite.tint = '#666666';
      } else {
        costTokenSprite.rotation = 0;
         costTokenSprite.tint = '#ffffff';
      }
      costTokenSprite.alpha = 1;
      costTokenSprite.isCostToken = true;

      if (isActive && pid === 1 && canAct && onDONTokenPointerDown) {
        costTokenSprite.eventMode = 'static';
        costTokenSprite.cursor = 'pointer';
        costTokenSprite.removeAllListeners('pointerdown');
        const idx = i;
        costTokenSprite.on('pointerdown', (e) => onDONTokenPointerDown(e, pid, idx, costTokenSprite));
      } else {
        costTokenSprite.eventMode = 'none';
        costTokenSprite.cursor = 'default';
      }

      // Start from old position if animating, otherwise target
      if (oldPositions[i]) {
        costTokenSprite.position.set(oldPositions[i].x, oldPositions[i].y);
        if (Math.abs(oldPositions[i].x - targetX) > 0.5 || Math.abs(oldPositions[i].y - targetY) > 0.5) {
          posChanged = true;
        }
      } else {
        costTokenSprite.position.set(targetX, targetY);
      }

      zone.addChild(costTokenSprite);
    }

    // Animate to new positions if count changed or any token position shifted
    const renderCount = skipIdx >= 0 ? p.costArea.length - 1 : p.costArea.length;
    const countChanged = existing.length !== renderCount;
    if (countChanged || posChanged) {
      this._animateCostTokensTo(zone, oldPositions, renderCount, startX, tokenW, gap, yOff, pid, canAct, onDONTokenPointerDown);
    }
  }

  cancelCostAnimation(pid) {
    if (this._costAnimTimers && this._costAnimTimers[pid]) {
      cancelAnimationFrame(this._costAnimTimers[pid]);
      delete this._costAnimTimers[pid];
    }
    if (this._costAnimState) {
      delete this._costAnimState[pid];
    }
  }

  _animateCostTokensTo(zone, oldPositions, count, startX, tokenW, gap, yOff, pid, canAct, onDONTokenPointerDown) {
    this._costAnimTimers = this._costAnimTimers || {};
    this._costAnimState = this._costAnimState || {};
    this._costAnimState[pid] = { oldPositions, count, startX, tokenW, gap, yOff, canAct, onDONTokenPointerDown };

    const t0 = performance.now();
    const duration = 500;

    const tick = (now) => {
      const rawT = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - rawT, 3); // ease-out cubic

      // Look up tokens fresh each frame to handle re-renders
      const tokens = zone.children.filter(c => c.isCostToken && c.alpha > 0.5);
      if (tokens.length === 0) {
        if (this._costAnimTimers && this._costAnimTimers[pid]) delete this._costAnimTimers[pid];
        if (this._costAnimState) delete this._costAnimState[pid];
        return;
      }

      for (let i = 0; i < tokens.length && i < count; i++) {
        const targetX = startX + i * (tokenW + gap) + tokenW / 2;
        const targetY = yOff + tokenW / 2;
        const ox = oldPositions[i] ? oldPositions[i].x : targetX;
        const oy = oldPositions[i] ? oldPositions[i].y : targetY;
        tokens[i].position.x = ox + (targetX - ox) * ease;
        tokens[i].position.y = oy + (targetY - oy) * ease;
      }

      if (rawT >= 1) {
        for (let i = 0; i < tokens.length && i < count; i++) {
          tokens[i].position.set(
            startX + i * (tokenW + gap) + tokenW / 2,
            yOff + tokenW / 2
          );
        }
        if (canAct && onDONTokenPointerDown) {
          for (let i = 0; i < tokens.length && i < count; i++) {
            const don = this.players[pid].costArea[i];
            if (don && don.active && !don.rested && pid === 1) {
              tokens[i].eventMode = 'static';
              tokens[i].cursor = 'pointer';
              tokens[i].removeAllListeners('pointerdown');
              const idx = i;
              tokens[i].on('pointerdown', (e) => onDONTokenPointerDown(e, pid, idx, tokens[i]));
            }
          }
        }
        if (this._costAnimTimers && this._costAnimTimers[pid]) {
          delete this._costAnimTimers[pid];
        }
        if (this._costAnimState) {
          delete this._costAnimState[pid];
        }
        return;
      }
      this._costAnimTimers[pid] = requestAnimationFrame(tick);
    };
    this._costAnimTimers[pid] = requestAnimationFrame(tick);
  }

  _renderDeck(pid) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'deck');
    if (!zone) return;
    this._renderCardStack(zone, p.deck.cards.length);
  }

  _renderDONDeck(pid) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'dondeck');
    if (!zone) return;
    const existing = zone.children.filter(c => c.isDONTile);
    existing.forEach(c => zone.removeChild(c));
    const count = p.donDeck.length;
    if (count <= 0) return;

    const texture = PIXI.Texture.from('assets/imgs/don_back.png');
    const tileW = DON_TOKEN_SIZE;
    const stackGap = 14;
    const startX = 4;
    const yOff = (40 - DON_TOKEN_SIZE) / 2; // don deck zone height is 40

    for (let i = 0; i < count; i++) {
      const donTileSprite = new PIXI.Sprite(texture);
      donTileSprite.name = `donTile_${pid}_${i}`;
      donTileSprite.width = tileW;
      donTileSprite.height = tileW;
      donTileSprite.isDONTile = true;
      donTileSprite.position.set(startX + i * stackGap, yOff);
      zone.addChild(donTileSprite);
    }
  }

  _renderTrash(pid) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'trash');
    if (!zone) return;
    const existing = zone.children.filter(c => c.isCardBack);
    existing.forEach(c => zone.removeChild(c));
    if (p.trash.length <= 0) return;

    const showCount = Math.min(p.trash.length, 3);
    const cardH = zone.height - 20;
    const cardW = cardH * (5 / 7);
    const lastCards = p.trash.slice(-showCount);

    for (let i = 0; i < lastCards.length; i++) {
      const card = lastCards[i];
      const trashCardSprite = this.renderer.render(card, false, cardW / 100);
      trashCardSprite.name = `trashCard_${pid}_${i}`;
      trashCardSprite.isCardBack = true;
      trashCardSprite.position.set(
        (zone.width - trashCardSprite.width) / 2 + (i - Math.floor(lastCards.length / 2)) * 2,
        (zone.height - trashCardSprite.height) / 2 + (i - Math.floor(lastCards.length / 2)) * 2
      );
      zone.addChild(trashCardSprite);

      // Show card info on hover for top trash card (last in array)
      if (i === lastCards.length - 1 && this.ui) {
        trashCardSprite.eventMode = 'static';
        trashCardSprite.cursor = 'pointer';
        trashCardSprite.on('pointerover', () => this.ui.showCardInfo(card, pid));
        trashCardSprite.on('pointerout', () => {
          const panel = document.getElementById('card-info-panel');
          if (panel) panel.innerHTML = '';
        });
      }
    }
  }

  _renderCardStack(zone, count) {
    const existing = zone.children.filter(c => c.isCardBack);
    existing.forEach(c => zone.removeChild(c));
    if (count <= 0) return;

    const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
    const cardH = Math.max(zone.height - 20, 100);
    const cardW = cardH * (5 / 7);
    const showCount = Math.min(count, 5);

    for (let i = 0; i < showCount; i++) {
      const deckCardSprite = new PIXI.Sprite(backTexture);
      deckCardSprite.name = `deckCard_${i}`;
      deckCardSprite.width = cardW;
      deckCardSprite.height = cardH;
      deckCardSprite.isCardBack = true;
      deckCardSprite.position.set(
        (zone.width - cardW) / 2 + (i - Math.floor(showCount / 2)) * 3,
        (zone.height - cardH) / 2 + (i - Math.floor(showCount / 2)) * 2
      );
      zone.addChild(deckCardSprite);
    }
  }

  renderLifeIndicatorsBoth() {
    for (const pid of [1, 2]) {
      this._syncLifeSprites(pid);
    }
  }

  _syncLifeSprites(pid) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'life');
    if (!zone) return;

    const existing = zone.children.filter(c => c.isLifeCard);
    if (zone.zoneLabel) {
      zone.zoneLabel.style.text = `Life: ${p.life.length}`;
      zone.zoneLabel.dirty = true;
    }

    const targetCount = p.life.length;
    const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
    const cardH = zone.height - 20;
    const cardW = cardH * (5 / 7);
    const step = Math.min((zone.width - cardW) / Math.max(targetCount, 1), 24);
    const toY = (zone.height - cardH) / 2;

    if (existing.length < targetCount) {
      for (let i = existing.length; i < targetCount; i++) {
        const lifeCardSprite = new PIXI.Sprite(backTexture);
        lifeCardSprite.name = `lifeCard_${pid}_${i}`;
        lifeCardSprite.width = cardW;
        lifeCardSprite.height = cardH;
        lifeCardSprite.isLifeCard = true;
        lifeCardSprite.x = 16 + i * step;
        lifeCardSprite.y = toY;
        zone.addChild(lifeCardSprite);
      }
    }

    if (existing.length > targetCount) {
      for (let i = existing.length - 1; i >= targetCount; i--) {
        if (existing[i]) zone.removeChild(existing[i]);
      }
    }

    const finalSprites = zone.children.filter(c => c.isLifeCard);
    for (let i = 0; i < finalSprites.length; i++) {
      finalSprites[i].x = 16 + i * step;
      finalSprites[i].y = toY;
    }
  }

  addLifeCardAt(pid, index) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'life');
    if (!zone) return;

    const targetCount = p.life.length;
    const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
    const cardH = zone.height - 20;
    const cardW = cardH * (5 / 7);
    const step = Math.min((zone.width - cardW) / Math.max(targetCount, 1), 24);
    const toY = (zone.height - cardH) / 2;

    const lifeCardSprite = new PIXI.Sprite(backTexture);
    lifeCardSprite.name = `lifeCard_${pid}_${index}`;
    lifeCardSprite.width = cardW;
    lifeCardSprite.height = cardH;
    lifeCardSprite.isLifeCard = true;
    lifeCardSprite.x = 16 + index * step;
    lifeCardSprite.y = toY;
    zone.addChild(lifeCardSprite);

    const all = zone.children.filter(c => c.isLifeCard);
    for (let i = 0; i < all.length; i++) {
      all[i].x = 16 + i * step;
      all[i].y = toY;
    }

    if (zone.zoneLabel) {
      zone.zoneLabel.style.text = `Life: ${p.life.length}`;
      zone.zoneLabel.dirty = true;
    }
  }

  renderLifeFor(pid) {
    const p = this.players[pid];
    const zone = this.zoneManager.getZone(pid, 'life');
    if (!zone) return;
    const oldCards = zone.children.filter(c => c.isLifeCard);
    while (oldCards.length > p.life.length) {
      const removed = oldCards.pop();
      zone.removeChild(removed);
    }
    if (zone.zoneLabel) {
      zone.zoneLabel.style.text = `Life: ${p.life.length}`;
      zone.zoneLabel.dirty = true;
    }
  }

  renderStage(pid, card) {
    const stageSlot = this.zoneManager.getZone(pid, 'stage');
    if (!stageSlot) return;
    const old = stageSlot.children.find(c => c.isStageSprite);
    if (old) stageSlot.removeChild(old);
    if (!card) return;

    const sprite = this.renderer.render(card, false, 0.7);
    sprite.name = `stageSprite_${pid}`;
    sprite.isStageSprite = true;
    sprite.cardRef = card;
    sprite.position.set(
      (stageSlot.width - sprite.width) / 2,
      (stageSlot.height - sprite.height) / 2
    );
    stageSlot.addChild(sprite);
  }
}

export default ZoneRenderer;
