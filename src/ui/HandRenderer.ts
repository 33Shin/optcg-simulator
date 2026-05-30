import CardRenderer from './CardRenderer';
import { Animator } from '../core/Animator';
import { easeOutQuad } from '../core/animations/utils';

class HandRenderer {
  constructor(zoneManager, renderer, ui, players) {
    this.zoneManager = zoneManager;
    this.renderer = renderer;
    this.ui = ui;
    this.players = players;
    this.handSprites = { 1: [], 2: [] };
    this._animatingShift = { 1: false, 2: false };
  }

  _animatePositions(pid, fromPositions, toPositions) {
    if (this._animatingShift[pid]) {
      this._animatingShift[pid] = false;
    }
    this._animatingShift[pid] = true;

    const sprites = this.handSprites[pid];
    if (!sprites || sprites.length === 0) {
      this._animatingShift[pid] = false;
      return;
    }

    let maxDur = 0;

    for (let i = 0; i < sprites.length; i++) {
      const sp = sprites[i];
      const fx = fromPositions[i] ? fromPositions[i].x : toPositions[i].x;
      const fy = fromPositions[i] ? fromPositions[i].y : toPositions[i].y;
      const tx = toPositions[i].x;
      const ty = toPositions[i].y;

      if (Math.abs(fx - tx) < 1 && Math.abs(fy - ty) < 1) {
        sp.position.set(tx, ty);
        continue;
      }

      sp.position.set(fx, fy);

      const dx = tx - fx;
      const dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const duration = Math.min(Math.max(dist * 1.4, 100), 300);
      maxDur = Math.max(maxDur, duration);

      Animator.animate({
        duration,
        easing: 'easeOutQuad',
        onUpdate: (t) => {
          sp.position.x = fx + dx * t;
          sp.position.y = fy + dy * t;
        },
        onComplete: () => {
          sp.position.x = tx;
          sp.position.y = ty;
          sp._basePosX = tx;
          sp._basePosY = ty;
        },
      }).toPromise();
    }

    setTimeout(() => { this._animatingShift[pid] = false; }, maxDur);
  }

/** Fade out a card sprite and animate remaining cards shifting to fill the gap. Returns a promise. */
  fadeOutAndRemoveCard(pid, removedIdx, onCardPointerDown, onComplete) {
    const p = this.players[pid];
    if (!p || !p.hand) return Promise.resolve();
    const handZone = this.zoneManager.getZone(pid, 'hand');
    if (!handZone) return Promise.resolve();

    const oldSprites = this.handSprites[pid] || [];
    if (oldSprites.length === 0) return Promise.resolve();
    const removedSprite = oldSprites[removedIdx];

    // Capture reference to the current sprites array — if it changes before animation ends,
    // a new render has replaced our hand and we should bail out silently.
    const spritesArrayRef = oldSprites;

    const layout = this.computeLayout(handZone, p.hand.length);
    if (!layout) return Promise.resolve();
    const { positions } = layout;

    // Fade out the removed card while shifting remaining cards to new positions
    return new Promise((resolve) => {
      const fadeDur = 400;
      const t0 = performance.now();

      // Capture current positions for shift animation (skip null sprites and removed index)
      const fromPositions = [];
      for (let i = 0; i < oldSprites.length; i++) {
        if (i === removedIdx) continue;
        const s = oldSprites[i];
        fromPositions.push(s && s.position ? { x: s.position.x, y: s.position.y } : null);
      }

      let shiftIdx = 0;
      const toPosList = [];
      for (let i = 0; i < oldSprites.length; i++) {
        if (i === removedIdx) continue;
        toPosList.push(positions[shiftIdx] || positions[positions.length - 1]);
        shiftIdx++;
      }

      const tick = (now) => {
        const t = Math.min((now - t0) / fadeDur, 1);
        const e = easeOutQuad(t);

        // Fade out removed sprite
        if (removedSprite) {
          removedSprite.alpha = 1 - e;
          removedSprite.scale.set(0.95 * (1 - 0.15 * e));
        }

        // Shift remaining sprites toward new positions
        shiftIdx = 0;
        for (let i = 0; i < oldSprites.length; i++) {
          if (i === removedIdx) continue;
          const sp = oldSprites[i];
          if (!sp || !sp.position) { shiftIdx++; continue; }
          const fp = fromPositions[shiftIdx];
          const tp = toPosList[shiftIdx];
          if (fp && tp) {
            sp.position.x = fp.x + (tp.x - fp.x) * e;
            sp.position.y = fp.y + (tp.y - fp.y) * e;
          }
          shiftIdx++;
        }

        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          // Guard: if hand was re-rendered, our sprites array is stale — bail out.
          if (this.handSprites[pid] !== spritesArrayRef) {
            resolve();
            return;
          }

          // Final: remove the faded sprite and finalize positions
          try {
            if (removedSprite && removedSprite.parent) {
              handZone.removeChild(removedSprite);
            }
            oldSprites.splice(removedIdx, 1);

            shiftIdx = 0;
            for (let i = 0; i < oldSprites.length; i++) {
              const sp = oldSprites[i];
              if (!sp) continue;
              const tp = toPosList[shiftIdx] || positions[positions.length - 1];
              if (tp && sp.position) {
                sp.position.set(tp.x, tp.y);
                sp._basePosX = tp.x;
                sp._basePosY = tp.y;
              }
              const card = p.hand[shiftIdx];
              try {
                sp.cardRef = card;
                sp.off('pointerover');
                sp.off('pointerdown');
                if (pid === 1 && onCardPointerDown) {
                  this._attachHover(handZone, sp, card);
                  sp.on('pointerdown', (e2) => onCardPointerDown(e2, pid, card, shiftIdx));
                  const playable = this._isPlayable(card, p);
                  if (playable) this._addReadyGlow(sp);
                  else this._clearReadyGlow(sp);
                } else {
                  this._clearReadyGlow(sp);
                }
              } catch (_) { /* skip bad sprite */ }
              shiftIdx++;
            }

            this.handSprites[pid] = oldSprites;
          } catch (_) { /* skip cleanup errors */ }

          if (onComplete) onComplete();
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  computeLayout(handZone, numCards) {
    const scale = 0.95;
    const cardW = 100 * scale;
    const cardH = 140 * scale;
    const gap = 8;
    const minSpacing = cardW * 0.3;
    const zoneW = handZone.width - 20;

    let spacing;
    if (numCards <= 1) {
      spacing = cardW + gap;
    } else if (numCards * cardW + (numCards - 1) * gap <= zoneW) {
      spacing = cardW + gap;
    } else {
      spacing = (zoneW - cardW) / (numCards - 1);
      spacing = Math.max(spacing, minSpacing);
    }

    const actualTotalW = (numCards - 1) * spacing + cardW;
    const startX = (handZone.width - actualTotalW) / 2;
    const yOff = (handZone.height - cardH) / 2;

    const positions = [];
    for (let i = 0; i < numCards; i++) {
      positions.push({ x: startX + i * spacing, y: yOff });
    }
    return { positions, cardW, cardH, spacing };
  }

  _isPlayable(card, player) {
    const cost = card.cost || 0;
    const activeDon = player.costArea.filter(d => d.active && !d.rested).length;
    if (activeDon < cost) return false;
    // Event with only counter effects is not playable in main phase
    if (card.category === 'event') {
      return this._hasMainEffect(card);
    }
    return true;
  }

  /** Check if an event card has a [Main] effect (not just [Counter]). */
  _hasMainEffect(card) {
    // Check structured effects array for non-counter timings
    if (card.effects && Array.isArray(card.effects)) {
      const mainEffects = card.effects.filter(e => e.timing !== 'counter' && e.timing !== 'trigger');
      if (mainEffects.length > 0) return true;
    }
    // Fallback: check raw effect text for [Main] keyword
    if (card.effect && typeof card.effect === 'string') {
      if (card.effect.includes('[Main]')) return true;
    }
    return false;
  }

  _addReadyGlow(sprite) {
    const glow = new PIXI.filters.GlowFilter({
      distance: 20,
      outerStrength: 2,
      innerStrength: 0,
      color: 0x00ff99,
      quality: 0.2
    });
    glow._tickerTime = 0;
    sprite.filters = [glow];
  }

  /** Check if a card is playable as a counter (counter-eligible + has enough DON for event counters). */
  _isCounterPlayable(card, player) {
    // Character counter: always free to trash from hand
    if (card.counter !== null && card.counter !== undefined) return true;
    // Event counter: must have enough active DON
    const cost = card.cost || 0;
    const activeDon = player.costArea.filter(d => d.active && !d.rested).length;
    if (activeDon < cost) return false;
    if (card.effects && Array.isArray(card.effects)) {
      if (card.effects.some(e => e.timing === 'counter')) return true;
    }
    if (card.effect && card.effect.toLowerCase().includes('[counter]')) return true;
    return false;
  }

   /** Tint unplayable cards dark instead of using alpha. */
  _setUnplayableAlpha(pid, sprites, player, isCounterPhase) {
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      if (!sprite || !sprite.cardRef) continue;
      const playable = isCounterPhase
        ? this._isCounterPlayable(sprite.cardRef, player)
        : this._isPlayable(sprite.cardRef, player);
      sprite.tint = playable ? '#ffffff' : '#666666';
    }
  }

  /** Add orange glow only to counter-eligible cards that are actually playable. */
  addCounterGlow(pid) {
    const sprites = this.handSprites[pid];
    if (!sprites) return;
    const player = this.players[pid];
    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      if (!sprite || !sprite.cardRef) continue;
      if (this._isCounterPlayable(sprite.cardRef, player)) {
        this._addCounterGlow(sprite);
      }
    }
  }

  _addCounterGlow(sprite) {
    const glow = new PIXI.filters.GlowFilter({
      distance: 20,
      outerStrength: 2.5,
      innerStrength: 0,
      color: 0xff4400,
      quality: 0.2
    });
    glow._tickerTime = 0;
    sprite.filters = [glow];
  }

  clearAllCounterGlow(pid) {
    const sprites = this.handSprites[pid];
    if (!sprites) return;
    for (const sprite of sprites) {
      if (sprite && sprite.filters) sprite.filters = [];
    }
  }

  /** Ticker callback to pulse counter glow filters. */
  updateCounterGlow(pid) {
    const sprites = this.handSprites[pid];
    if (!sprites) return;
    for (const sprite of sprites) {
      if (!sprite) continue;
      const glow = sprite.filters?.[0];
      if (!glow || !glow._tickerTime) continue;
      const t = glow._tickerTime;
      const pulse = 2 + 3 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.25));
      glow.outerStrength = pulse;
      glow._tickerTime = t + 0.016;
    }
  }

  _clearReadyGlow(sprite) {
    sprite.filters = [];
  }

  clearAllReadyGlow(pid) {
    const sprites = this.handSprites[pid];
    if (!sprites) return;
    for (const sprite of sprites) {
      if (sprite) sprite.filters = [];
    }
  }

  /**
   * Ticker callback to pulse ready-glow filters on hand cards.
   * Call via: app.ticker.add((ticker) => handRenderer.updateReadyGlow(1));
   */
  updateReadyGlow(pid) {
    const sprites = this.handSprites[pid];
    if (!sprites) return;
    for (const sprite of sprites) {
      if (!sprite) continue;
      const glow = sprite.filters?.[0];
      if (!glow || !glow._tickerTime) continue;
      const t = glow._tickerTime;
      const pulse = 2 + 3 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.25));
      glow.outerStrength = pulse;
      glow._tickerTime = t + 0.016;
    }
  }

  render(pid, onCardPointerDown) {
    this._renderHand(pid, onCardPointerDown, false);
  }

  renderWithInteraction(pid, onCardPointerDown, canAct = true, isCounterPhase = false) {
    this._renderHand(pid, onCardPointerDown, canAct, isCounterPhase);
  }

  /**
   * Animate hand cards shifting to new positions after a card was removed.
   * @param {number} pid - Player ID
   * @param {number} removedIdx - Index of the removed card in the OLD hand array
   * @param {function} onCardPointerDown - Pointer down handler for interaction
   */
  renderCardRemoved(pid, removedIdx, onCardPointerDown) {
    const p = this.players[pid];
    const handZone = this.zoneManager.getZone(pid, 'hand');
    if (!handZone) return;

    const oldSprites = this.handSprites[pid] || [];
    const removedSprite = oldSprites[removedIdx];
    if (removedSprite && removedSprite.parent) {
      handZone.removeChild(removedSprite);
    }
    oldSprites.splice(removedIdx, 1);

    const fromPositions = oldSprites.map(s => ({ x: s.position.x, y: s.position.y }));

    const layout = this.computeLayout(handZone, p.hand.length);
    if (!layout) return;
    const { positions } = layout;

    for (const s of oldSprites) {
      s.off('pointerover');
      s.off('pointerdown');
    }

    for (let i = 0; i < p.hand.length; i++) {
      const sprite = oldSprites[i];
      if (!sprite) continue;
      const card = p.hand[i];
      sprite.cardRef = card;
      if (pid === 1 && onCardPointerDown) {
        this._attachHover(handZone, sprite, card);
        sprite.on('pointerdown', (e) => onCardPointerDown(e, pid, card, i));
        const playable = this._isPlayable(card, p);
        if (playable) this._addReadyGlow(sprite);
        else this._clearReadyGlow(sprite);
      } else {
        this._clearReadyGlow(sprite);
      }
    }

    this.handSprites[pid] = oldSprites;
    this._animatePositions(pid, fromPositions, positions);
  }

  _renderHand(pid, onCardPointerDown, canAct = false, isCounterPhase = false) {
    const p = this.players[pid];
    const handZone = this.zoneManager.getZone(pid, 'hand');
    if (!handZone) return;

    const oldSprites = this.handSprites[pid] || [];
    for (const s of oldSprites) {
      if (s.parent) handZone.removeChild(s);
    }
    this.handSprites[pid] = [];

    const layout = this.computeLayout(handZone, p.hand.length);
    if (!layout) return;
    const { positions } = layout;
    const scale = 0.95;

    for (let i = 0; i < p.hand.length; i++) {
      const card = p.hand[i];
      const handCardSprite = this.renderer.render(card, pid === 2, scale);
      handCardSprite.name = `handCard_${pid}_${i}`;
      handCardSprite.position.set(positions[i].x, positions[i].y);
      handCardSprite.cardRef = card;

      handZone.addChild(handCardSprite);

      if (pid === 1 && onCardPointerDown) {
        this._attachHover(handZone, handCardSprite, card);
        handCardSprite.on('pointerdown', (e) => onCardPointerDown(e, pid, card, i));
        const playable = canAct && this._isPlayable(card, p);
        if (playable) this._addReadyGlow(handCardSprite);
        else this._clearReadyGlow(handCardSprite);
      } else {
        this._clearReadyGlow(handCardSprite);
      }

      this.handSprites[pid].push(handCardSprite);
    }

    // Darken unplayable cards in main phase or counter phase (applied after glow so alpha persists)
    if (canAct || isCounterPhase) {
      this._setUnplayableAlpha(pid, this.handSprites[pid], p, isCounterPhase);
    }
  }

  /** Re-apply unplayable card darkening — call after addCounterGlow to ensure alpha persists. */
  applyUnplayableDarken(pid, isCounterPhase = false) {
    const p = this.players[pid];
    if (!p || !this.handSprites[pid]) return;
    this._setUnplayableAlpha(pid, this.handSprites[pid], p, isCounterPhase);
  }

  addSpriteAt(pid, handIdx, card, finalLayout) {
    const p = this.players[pid];
    const handZone = this.zoneManager.getZone(pid, 'hand');
    if (!handZone) return;

    const scale = 0.95;
    const layout = finalLayout || this.computeLayout(handZone, p.hand.length);
    if (!layout) return;
    const { positions } = layout;

    for (let i = 0; i < this.handSprites[pid].length; i++) {
      const sp = this.handSprites[pid][i];
      if (!sp) continue;
      const layoutIdx = i < handIdx ? i : i + 1;
      const pos = positions[layoutIdx] || positions[positions.length - 1];
      sp.position.set(pos.x, pos.y);
    }

    const handCardSprite = this.renderer.render(card, pid === 2, scale);
    handCardSprite.name = `handCard_${pid}_${handIdx}`;
    const pos = positions[handIdx] || positions[positions.length - 1];
    handCardSprite.position.set(pos.x, pos.y);
    handCardSprite.cardRef = card;

    if (!this.handSprites[pid]) this.handSprites[pid] = [];
    this.handSprites[pid].splice(handIdx, 0, handCardSprite);
    handZone.addChild(handCardSprite);
  }

  _attachHover(handZone, sprite, card) {
    const cardW = this.renderer.CARD_WIDTH;
    const cardH = this.renderer.CARD_HEIGHT;
    const baseScale = sprite.scale.x;
    const hoverScale = baseScale * 1.15;
    const hoverLift = -8;
    const bobAmount = 3;
    const bobSpeed = 1.5;

    let _cancelAnim = false;
    const _animateHover = (targetScale, offset) => {
      _cancelAnim = false;
      const fromS = sprite.scale.x;
      const fromX = sprite.position.x;
      const fromY = sprite.position.y;
      const toS = targetScale;
      const toX = sprite._basePosX + offset.x;
      const toY = sprite._basePosY + offset.y;
      const dur = 180;
      const t0 = performance.now();
      const step = () => {
        if (_cancelAnim) return;
        const t = Math.min((performance.now() - t0) / dur, 1);
        const e = easeOutQuad(t);
        sprite.scale.set(fromS + (toS - fromS) * e);
        sprite.position.x = fromX + (toX - fromX) * e;
        sprite.position.y = fromY + (toY - fromY) * e;
        if (t < 1) requestAnimationFrame(step);
        else {
          sprite.scale.set(toS);
          sprite.position.set(toX, toY);
        }
      };
      requestAnimationFrame(step);
    };

    let _bobId = null;
    const _startBob = () => {
      if (_bobId) return;
      const t0 = performance.now();
      const tick = () => {
        const bob = -Math.sin((performance.now() - t0) / 1000 * bobSpeed) * bobAmount;
        sprite.position.y = sprite._basePosY + hoverLift + bob;
        _bobId = requestAnimationFrame(tick);
      };
      _bobId = requestAnimationFrame(tick);
    };
    const _stopBob = () => {
      if (_bobId) {
        cancelAnimationFrame(_bobId);
        _bobId = null;
      }
    };

    sprite.on('pointerover', () => {
      if (sprite._basePosX === undefined) sprite._basePosX = sprite.position.x;
      if (sprite._basePosY === undefined) sprite._basePosY = sprite.position.y;
      const dx = (cardW * hoverScale - cardW * baseScale) / 2;
      const dy = (cardH * hoverScale - cardH * baseScale) / 2;
      _animateHover(hoverScale, { x: -dx, y: -dy + hoverLift });
      _startBob();
      const p1 = this.players[1];
      const pid = (p1.hand && p1.hand.includes(card)) ? 1 : 2;
      this.ui.showCardInfo(card, pid);
    });

    sprite.on('pointerout', () => {
      _cancelAnim = true;
      _stopBob();
      _cancelAnim = false;
      _animateHover(baseScale, { x: 0, y: 0 });
    });
  }
}

export default HandRenderer;
