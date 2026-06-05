import { getEffectivePower, makeFlyCard } from '../animations/utils';
import { disableActionButton } from '../../ui/ActionButton';

class AttackInteraction {
  constructor(game) {
    this.game = game;
    this._defenderPid = null;
    this._counterCommitInProgress = false;
    this._pendingPowerAnims = [];
  }

  onFieldCardDrag(e, pid, card, slotIdx) {
    const { turnManager, ui, dragManager } = this.game;
    if (this.game._animating) return;
    if (!turnManager.canAct || pid !== 1) return;
    if (!card || card.rested || card.playedThisTurn || this.game.state.turnCount === 0) {
      ui.showCardInfo(card, pid);
      return;
    }

    dragManager.beginDragFieldCard(
      pid, card, slotIdx, e,
      (_pid, _attacker, _slotIdx, _targetCard, _targetPid) =>
        this._commitCharacterAttack(_pid, _attacker, _targetCard, _targetPid),
      () => {}
    );

    e.data.eventMode = 'grabbed';
  }

  _commitCharacterAttack(pid, attacker, targetCard, targetPid) {
    if (!targetCard) return;
    this.resolveBattle(pid, attacker, targetCard, this.game.players[targetPid]);
  }

  onLeaderDrag(e, pid) {
    const { turnManager, ui, dragManager, players } = this.game;
    if (this.game._animating) return;
    if (!turnManager.canAct || pid !== 1) return;

    const leader = players[pid].leader;
    if (!leader || leader.rested || this.game.state.turnCount === 0) {
      ui.showCardInfo(leader, pid);
      return;
    }

    dragManager.beginDragLeader(
      pid, leader, e,
      (_pid, _attacker, _targetCard, _targetPid) =>
        this._commitLeaderAttack(_pid, _attacker, _targetCard, _targetPid),
      () => {}
    );

    e.data.eventMode = 'grabbed';
  }

  _commitLeaderAttack(pid, attacker, targetCard, targetPid) {
    if (!targetCard) return;
    this.resolveBattle(pid, attacker, targetCard, this.game.players[targetPid]);
  }

  async resolveBattle(pid, attacker, target, targetPlayer) {
    const { battleManager, players, animManager, zoneManager, combatZone } = this.game;
    this._defenderPid = this.game._findPid(targetPlayer);
    this.game._animating = true;
    if (this.game.ui?.actionButton) {
      this.game.ui.actionButton._inBattle = true;
      this.game.ui.actionButton._actionBtnRestored = false;
    }
    // Disable hand interaction during attack animation — relies on game._animating
    // guard in PlayCardInteraction.onHandCardDrag to reject drags.
    let _atkRestoreSlot = null;
    try {
      // Find zones for attack animation
      const attackerZone = zoneManager.findZoneForCard(players, attacker);
      const targetZone = zoneManager.findZoneForCard(players, target);

      // Show combat zone
      combatZone.show(attacker, target, '⚔ ATTACK DECLARED ⚔');

      // --- When Attacking: activate ability BEFORE lift/rotate animation ---
      // (Run before removing attacker so the field sprite stays visible during ability VFX)
      if (attacker.effects && Array.isArray(attacker.effects) && attacker.effects.some(e => e.timing === 'whenAttacking')) {
        await animManager.abilityActivate.animate(pid, attacker, attackerZone);
        this.game.effectSystem.processWhenAttacking(attacker, players[pid]);
        combatZone.updatePower(attacker, target);
      }

      // Remove attacker from field/leader data so any re-render (blocker, counter)
      // won't recreate the original sprite.
      const isAtkLeader = attacker.isLeader || attacker === players[pid].leader;
      if (isAtkLeader) {
        _atkRestoreSlot = 'leader';
        players[pid].leader = null;
      } else {
        for (let i = 0; i < 5; i++) {
          if (players[pid].field[i] === attacker) {
            _atkRestoreSlot = i;
            players[pid].field[i] = null;
            break;
          }
        }
      }

      // Remove field sprite immediately after data removal so card disappears
      const fieldSprite = attackerZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
      if (fieldSprite && fieldSprite.parent) fieldSprite.parent.removeChild(fieldSprite);

      // --- Phase 1: Attacker card lifts up and rotates toward target ---
      await animManager.animateAttackLiftAndRotate(pid, attacker, attackerZone, target, targetZone);

      // --- Blocker phase (before counter phase) ---
      combatZone.updatePhase('🛡 BLOCKER PHASE 🛡');
      combatZone.startTimer(10);
      const blockerResult = await this._checkBlockerPhase(pid, attacker, target, targetPlayer);
      if (blockerResult) {
        // Animate attacker rotating toward new target (blocker character)
        combatZone.updatePhase('🛡 BLOCKER ACTIVATED 🛡');
        await animManager.attack.animateRetarget(blockerResult.target);

        target = blockerResult.target;
        targetPlayer = blockerResult.targetPlayer;
        combatZone.updateDefender(target);
      }

      // --- Counter Phase: defender can play counter cards from hand ---
      // Attacker fly card is held mid-air during this phase
      combatZone.updatePhase('⚡ COUNTER PHASE ⚡');
      combatZone.startTimer(15);
      const counterBoosts = await this._counterPhase(pid, attacker, target, targetPlayer);
      // Disable counter-phase hand interaction during battle resolution so the
      // defender can't drop cards after the counter phase has ended.
      this.game.handRenderer.render(this._defenderPid);

      // Re-hide attacker field sprite after counter overlay destroyed (it restored hidden elements)
      if (attackerZone) {
        const attackerFieldSprite = attackerZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
        if (attackerFieldSprite) attackerFieldSprite.visible = false;
      }

      // --- Continue attack animation from held state, then resolve battle ---
      combatZone.stopTimer();
      combatZone.updatePhase('💥 BATTLE RESOLUTION 💥');
      // Render attacker immediately when ghost is removed, so it appears at the same time
      animManager.attack.setOnCleanupDone(() => {
        // Restore attacker data and render right after ghost disappears
        if (_atkRestoreSlot !== null) {
          if (_atkRestoreSlot === 'leader') {
            players[pid].leader = attacker;
          } else {
            players[pid].field[_atkRestoreSlot] = attacker;
          }
        }
        this.game.fieldRenderer.renderFieldWithInteraction(1, (...args) => this.onFieldCardDrag(...args));
        this.game.fieldRenderer.renderField(2);
        this.game.fieldRenderer.renderLeaders();
      });
      await battleManager.resolveBattle(
        pid, attacker, target, targetPlayer, counterBoosts
      );
    } finally {
      // Clean up all pending timers before hiding combat zone
      clearTimeout(this._counterTimeoutId);
      this._counterTimeoutId = null;
      clearTimeout(this._blockerTimeoutId);
      this._blockerTimeoutId = null;
      if (this._counterGlowTickerRef) {
        this.game.app.ticker.remove(this._counterGlowTickerRef);
        this._counterGlowTickerRef = null;
      }
      if (this._blockerGlowTickerRef) {
        this.game.app.ticker.remove(this._blockerGlowTickerRef);
        this._blockerGlowTickerRef = null;
      }
      // Stop float animation on attacker fly card (leaks if battle errors mid-counter phase)
      this.game.animManager.attack._stopFloatAnimation();
      // Restore attacker to field/leader data so _afterBattleResolve re-renders it
      if (_atkRestoreSlot !== null) {
        if (_atkRestoreSlot === 'leader') {
          players[pid].leader = attacker;
        } else {
          players[pid].field[_atkRestoreSlot] = attacker;
        }
      }
      this._counterResolve = null;
      this._blockerResolve = null;
      this._committedCardIds = null;
      this._counterContext = null;
      this._pendingPowerAnims = [];
      // Reset counter phase state in DragManager so next drag works normally
      this.game.dragManager.resetCounterPhase();
      // Hide combat zone when battle ends
      combatZone.hide();
      // Clear counter glow and re-render defender's hand to remove counter-phase sprites
      const defPid = this._defenderPid || 1;
      this.game.handRenderer.clearAllCounterGlow(defPid);
      this.game.handRenderer.render(defPid);
      this._defenderPid = null;
      this.game.ui.restoreActionButton();
      this.game._animating = false;
    }
    // Call _afterBattleResolve AFTER the finally block so the attacker has been
    // restored to field/leader data before re-rendering.
    this._afterBattleResolve();
  }

  /**
   * Check if a card can be used in counter step.
   */
  _isCounterCard(card) {
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

  /** Check if a card is a character with counter power. */
  _isCharacterCounter(card) {
    return card.counter !== null && card.counter !== undefined;
  }

  /**
   * Counter Phase: defender plays counter cards from hand.
   * Returns a Map of card -> powerBoost for counter boosts applied.
   */
  async _counterPhase(attackerPid, attacker, target, targetPlayer) {
    const { players, animManager } = this.game;
    const defenderPid = this.game._findPid(targetPlayer);
    if (!defenderPid) return new Map();

    // Find defended target's power text for animation
    let defPowerText = null;
    const defZone = this.game.zoneManager.findZoneForCard(players, target);
    if (defZone) {
      const sprite = defZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
      if (sprite) {
        defPowerText = sprite.children.find(c => c.isPowerText);
      }
    }

    // AI defender: decide counters programmatically
    if (defenderPid === 2) {
      return this._aiCounterPhase(defenderPid, attacker, target, players, animManager, defZone, defPowerText);
    }

    // Human defender: use existing hand renderer with counter drag handler
    const boosts = await this._humanCounterPhase(defenderPid, attacker, target, players, animManager, defZone, defPowerText);
    return boosts;
  }

  /** Render hand for counter phase — drop outside hand plays as counter. */
  async _humanCounterPhase(defenderPid, attacker, target, players, animManager, defZone, defPowerText) {
    const game = this.game;

    // Store context for re-rendering after each counter
    this._counterContext = { defenderPid, attacker, target, players, animManager, defZone, defPowerText };
    this._pendingPowerAnims = [];

    // Render hand with custom pointer handler — only counter cards are draggable
    const onCounterDrag = (e, pid, card, handIdx) => {
      if (!game.turnManager.canAct || pid !== defenderPid) return;
      if (!this._isCounterCard(card)) return;

      // Compute defender card's global position for ghost fly animation
      let targetGlobal = null;
      if (defZone) {
        const sprite = defZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
        if (sprite) {
          targetGlobal = defZone.toGlobal(new PIXI.Point(sprite.position.x, sprite.position.y));
        }
      }

      game.dragManager.beginDragHandCard(
        pid, card, handIdx,
        { x: e.global.x, y: e.global.y },
        e,
        // onCommit: play as counter (called by DragManager for any drop during counter phase)
        (_pid, _card, _idx, _dp) => this._commitCounter(_pid, _card, _idx, _dp),
        () => {},
        () => {},
        true, // in counter phase
        targetGlobal // fly ghost toward defender card
      );
      e.data.eventMode = 'grabbed';
    };

        this.game.handRenderer.renderWithInteraction(defenderPid, (...args) => onCounterDrag(...args), false, true);
        this.game.handRenderer.addCounterGlow(defenderPid);
        // Re-apply darkening after glow so unplayable cards stay dimmed
        this.game.handRenderer.applyUnplayableDarken(defenderPid, true);

    // Wire up ticker for pulsing counter glow
    const _counterGlowTicker = () => game.handRenderer.updateCounterGlow(defenderPid);
    game.app.ticker.add(_counterGlowTicker);
    this._counterGlowTickerRef = _counterGlowTicker;

    // Set up action button as clickable PASS to end counter phase
    this._setupPassButton();

    // Wait for counter phase to end (timeout, PASS button, or no more counters)
    return new Promise((resolve) => {
      const onResolve = async () => {
        // Disable button immediately so it can't fire again
        disableActionButton(game.ui?.actionButton);
        // Wait for all pending power-up animations to finish
        if (this._pendingPowerAnims.length > 0) {
          await Promise.all(this._pendingPowerAnims);
          this._pendingPowerAnims = [];
        }
        clearTimeout(this._counterTimeoutId);
        if (this._counterGlowTickerRef) game.app.ticker.remove(this._counterGlowTickerRef);
        game.handRenderer.clearAllCounterGlow(defenderPid);
        this._committedCardIds = null;
        resolve(this._collectCounterBoosts(target));
      };
      this._counterTimeoutId = setTimeout(() => onResolve(), 15000);
      this._counterResolve = () => onResolve();

      // Wire PASS button to resolve counter phase
      const btnObj = game.ui?.actionButton;
      if (btnObj) {
        btnObj.actionBg.off('pointerdown');
        btnObj.actionBg.on('pointerdown', () => {
          btnObj.actionBg.eventMode = 'none';
          btnObj.actionBg.cursor = 'default';
          onResolve();
        });
      }
    });
  }

  /** Called when a counter card is dropped. */
   async _commitCounter(pid, card, handIdx, dropPos) {
    const ctx = this._counterContext;
    if (!ctx || !card) return false;
    // Prevent double-commit (my handler + DragManager may both fire) — use object reference, not cardId, since copies share the same cardId
    if (this._committedCardIds && this._committedCardIds.has(card)) return true;
    if (!this._committedCardIds) this._committedCardIds = new Set();
    this._committedCardIds.add(card);

    const { defenderPid, attacker, target, players, animManager, defZone, defPowerText } = ctx;

    this._counterCommitInProgress = true;
    try {
      // Capture power before mutation for animation range
      const fromPower = getEffectivePower(target);

      // Process data logic first (mutates hand, trash, DON state)
      const result = await this._processCounterCardData(defenderPid, card, handIdx, target, players);
      if (!(result && result.ok)) return false;

      const toPower = getEffectivePower(target);

      // Update combat zone to reflect new power values
      if (this.game.combatZone.container) {
        this.game.combatZone.updatePower(attacker, target);
      }

      // Re-render trash so counter card appears immediately after data is committed
      if (this.game.zoneRenderer) this.game.zoneRenderer.renderAll();

      // Create fly card at drop position before re-rendering hand
      let flyCard = null;
      let targetGlobal = null;
      if (defZone) {
        const defSprite = defZone.children.find(ch => ch.isFieldSprite || ch.isLeaderSprite);
        if (defSprite) targetGlobal = defZone.toGlobal(new PIXI.Point(defSprite.position.x, defSprite.position.y));
      }
      if (dropPos) {
        const displayTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
        flyCard = makeFlyCard(displayTexture, card, 100, 140);
        flyCard.position.set(dropPos.x, dropPos.y);
        flyCard.alpha = 1;
        this.game.app.stage.addChild(flyCard);
      }

      // Always re-render hand so next counter can be dragged while animations play
      const onCounterDrag = (e, p, c, i) => {
        if (!this.game.turnManager.canAct || p !== defenderPid) return;
        if (!this._isCounterCard(c)) return;
        let tg = null;
        if (defZone) {
          const sp = defZone.children.find(ch => ch.isFieldSprite || ch.isLeaderSprite);
          if (sp) tg = defZone.toGlobal(new PIXI.Point(sp.position.x, sp.position.y));
        }
        this.game.dragManager.beginDragHandCard(
          p, c, i, { x: e.global.x, y: e.global.y }, e,
          (_p, _c, _i, _dp) => this._commitCounter(_p, _c, _i, _dp), () => {}, () => {}, true, tg // in counter phase + target
        );
        e.data.eventMode = 'grabbed';
      };
      this.game.handRenderer.renderWithInteraction(defenderPid, (...args) => onCounterDrag(...args), false, true);
      this.game.handRenderer.addCounterGlow(defenderPid);
      // Re-apply darkening after glow so unplayable cards stay dimmed
      this.game.handRenderer.applyUnplayableDarken(defenderPid, true);

      // Animate fly card fading and flying toward defender target, in parallel with DON rest and power-up
      let flyAnim = Promise.resolve();
      if (flyCard && targetGlobal) {
        flyAnim = animManager.aiCounter.animateFadeOut(flyCard, targetGlobal);
      }

      // Collect DON rest animations from data processing
      const donRestAnims = result.donRestAnims || [];

      // Delay 100ms so fade+fly animation starts before power-up
      await new Promise(r => setTimeout(r, 100));
      const animPromise = this._animateCounterPowerUp(card, target, fromPower, toPower, animManager, defZone, defPowerText);
      this._pendingPowerAnims.push(animPromise);
      await Promise.all([flyAnim, animPromise, ...donRestAnims]);

      // Reset both visual timer and resolve timeout so attack waits for new countdown
      clearTimeout(this._counterTimeoutId);
      this._counterTimeoutId = setTimeout(() => { if (this._counterResolve) this._counterResolve(); }, 15000);
      if (this.game.combatZone.container) {
        this.game.combatZone.startTimer(15);
      }

      return true;
    } catch (_err) {
      return false;
    } finally {
      this._counterCommitInProgress = false;
    }
  }

  /** Collect accumulated boosts from _counterBoost tracker. */
  _collectCounterBoosts(target) {
    const boosts = new Map();
    if (target._counterBoost > 0) {
      boosts.set(target, target._counterBoost);
    }
    return boosts;
  }

  /** AI counter phase: evaluate and play counters that can win the fight. */
  async _aiCounterPhase(defenderPid, attacker, target, players, animManager, defZone, defPowerText) {
    const { ai } = this.game;
    if (!ai) return new Map();

    const defender = players[defenderPid];
    const toPlay = await ai.chooseCounters(defender, attacker, target);

    // Stop counter phase timer — AI doesn't use the overlay UI
    this.game.combatZone.stopTimer();

    const boosts = new Map();
    for (const { card, idx } of toPlay) {
      try {
        const correctedIdx = defender.hand.indexOf(card);
        if (correctedIdx === -1) continue;

        // Process data logic first (remove from hand, add to trash, apply boost)
        const result = await this._processCounterCardData(defenderPid, card, correctedIdx, target, players);
        if (!(result && result.ok)) continue;

        const fromPower = getEffectivePower(target);

        // Phase 1: Fly animation + hand shift animation run in parallel
        const flyPromise = animManager.aiCounter.animateFlyToCenter(defenderPid, card).catch(() => (null));
        this.game.handRenderer.renderCardRemoved(defenderPid, correctedIdx);
        if (this.game.zoneRenderer) this.game.zoneRenderer.renderAll();

        const { flyCard } = await flyPromise;
        if (!flyCard) continue;

        const toPower = getEffectivePower(target);
        // Compute defender card's global position for fly animation
        let targetGlobal = null;
        if (defZone) {
          const sp = defZone.children.find(ch => ch.isFieldSprite || ch.isLeaderSprite);
          if (sp) targetGlobal = defZone.toGlobal(new PIXI.Point(sp.position.x, sp.position.y));
        }
        // Phase 3: Await power-up animation so battle doesn't proceed while it's playing
        // Delay power-up 100ms so fade+fly animation starts first
        const donRestAnims = result.donRestAnims || [];
        await Promise.all([
          animManager.aiCounter.animateFadeOut(flyCard, targetGlobal),
          new Promise(r => setTimeout(r, 100)).then(() => this._animateCounterPowerUp(card, target, fromPower, toPower, animManager, defZone, defPowerText)),
          ...donRestAnims,
        ]);

        if (result.powerBoost > 0) {
          boosts.set(target, (boosts.get(target) || 0) + result.powerBoost);
          this.game.combatZone.updatePower(attacker, target);
        }
      } catch (_err) {
      }
    }

    return boosts;
  }

  /** Process counter card data logic only (no animation). Returns result object. */
  async _processCounterCardData(defenderPid, card, handIdx, target, players) {
    const defender = players[defenderPid];
    const actualIdx = defender.hand.indexOf(card);
    if (actualIdx === -1) return { ok: false, msg: 'Card not in hand' };

    const isCharacterCounter = this._isCharacterCounter(card);

    // --- Character counter: FREE, trash from hand, add counter value to target ---
    if (isCharacterCounter) {
      defender.hand.splice(actualIdx, 1);
      defender.trash.push(card);
      const boost = card.counter || 0;
      target._counterBoost = (target._counterBoost || 0) + boost;
      return { ok: true, powerBoost: boost, isCharacterCounter: true, removedIdx: actualIdx };
    }

    // --- Event counter: must pay DON!! cost ---
    const cost = card.cost || 0;
    const activeDon = defender.costArea.filter(d => d.active && !d.rested).length;
    if (activeDon < cost) return { ok: false, msg: 'Not enough DON!!' };

    // Capture indices before resting DONs
    const restIndices = [];
    let remaining = cost;
    for (let i = 0; i < defender.costArea.length && remaining > 0; i++) {
      if (defender.costArea[i].active && !defender.costArea[i].rested) {
        restIndices.push(i);
        remaining--;
      }
    }

    // Mutate DON state immediately
    for (let i = 0; i < cost;) {
      const don = defender.costArea.find(d => d.active && !d.rested);
      if (!don) break;
      don.active = false;
      don.rested = true;
      i++;
    }

    defender.hand.splice(actualIdx, 1);
    defender.trash.push(card);

    let powerBoost = 0;
    const counterEffects = (card.effects || []).filter(e => e.timing === 'counter');

    for (const eff of counterEffects) {
      if (eff.type === 'powerBoost') {
        powerBoost += eff.params?.value || 0;
      }
      if (EFFECT_COUNTER_HANDLERS[eff.type]) {
        EFFECT_COUNTER_HANDLERS[eff.type]({
          player: defender,
          players,
          eventBus: this.game.eventBus,
          getOpponent: (p) => {
            for (const [k, v] of Object.entries(players)) {
              if (v !== p) return v;
            }
            return null;
          },
        }, eff.params || {});
      }
    }

    if (powerBoost === 0 && card.effect) {
      const match = card.effect.match(/\+(\d+)\s*power/i);
      if (match) powerBoost = parseInt(match[1]);
    }

    // Collect DON rest animations to run in parallel with fly animation
    const donRestAnims = [];
    if (cost > 0 && restIndices.length > 0 && this.game.animManager) {
      donRestAnims.push(this.game.animManager.animateDONRest(defenderPid, cost, restIndices));
    }

    if (card.effect && card.effect.match(/DON!!\s*-\d+/i)) {
      const donSubMatch = card.effect.match(/DON!!\s*(-?)(\d+)/i);
      if (donSubMatch) {
        const subCount = parseInt(donSubMatch[2]);
        // Capture indices before resting DONs
        const extraRestIndices = [];
        let extraRemaining = subCount;
        for (let i = 0; i < defender.costArea.length && extraRemaining > 0; i++) {
          if (defender.costArea[i].active && !defender.costArea[i].rested) {
            extraRestIndices.push(i);
            extraRemaining--;
          }
        }
        if (subCount > 0 && extraRestIndices.length > 0 && this.game.animManager) {
          donRestAnims.push(this.game.animManager.animateDONRest(defenderPid, subCount, extraRestIndices));
        }
        for (let i = 0; i < subCount;) {
          const don = defender.costArea.find(d => d.active && !d.rested);
          if (!don) break;
          don.active = false;
          don.rested = true;
          i++;
        }
      }
    }

    target._counterBoost = (target._counterBoost || 0) + powerBoost;
    return { ok: true, powerBoost, isCharacterCounter: false, removedIdx: actualIdx, donRestAnims };
  }

  /** Animate counter power-up on defended target. */
  async _animateCounterPowerUp(card, target, fromPower, toPower, animManager, defZone, defPowerText) {
    await Promise.all([
      animManager.animateCounterCard(defZone, card),
      animManager.animatePowerCount(
        defPowerText, fromPower, toPower, 700,
        defPowerText?.style?.fill === 0xffd700 ? 0xffd700 : 0xffffff,
        0xffd700
      ),
    ]);
  }

  /** Execute a single counter card: data + animations (legacy wrapper). */
  async _executeCounterCard(defenderPid, card, handIdx, target, players, animManager, defZone, defPowerText) {
    const fromPower = getEffectivePower(target);
    const dataResult = await this._processCounterCardData(defenderPid, card, handIdx, target, players);
    if (!dataResult.ok) return dataResult;
    const toPower = getEffectivePower(target);
    await this._animateCounterPowerUp(card, target, fromPower, toPower, animManager, defZone, defPowerText);
    return dataResult;
  }

  /**
   * Check if the defending player activates a Blocker character.
   * Returns { target, targetPlayer } if blocked, null otherwise.
   */
  async _checkBlockerPhase(attackerPid, attacker, target, targetPlayer) {
    const { players, ai } = this.game;
    const defenderPid = this.game._findPid(targetPlayer);
    if (!defenderPid) return null;

    const defender = players[defenderPid];
    const blockers = defender.field.filter(c => c && c.isBlocker && !c.rested);
    if (blockers.length === 0) return null;

    let selected = null;

    if (defenderPid === 1) {
      selected = await this._humanBlockerPhase(defenderPid, blockers, attacker);
    } else {
      selected = await ai.chooseBlocker(blockers, attacker.currentPower || 0);
    }

      if (selected) {
        // Play activation VFX first, then rest animation on the blocker's field sprite
        const slotIdx = defender.field.indexOf(selected);
        if (slotIdx >= 0) {
          const slot = this.game.zoneManager.getZone(defenderPid, `field_slot_${slotIdx}`);
          await this.game.animManager.animateBlockerActivate(selected, slot);
          const sprite = slot?.children.find(c => c.isFieldSprite);
          if (sprite) {
            await this.game.animManager.animateBlockerRest(sprite);
          }
        }
      selected.rested = true;
      // Re-render field to show rested state
      this.game.fieldRenderer.renderField(defenderPid);

      return { target: selected, targetPlayer: defender };
    }

    return null;
  }

  /** Human blocker phase: glow + click on field cards, PASS button, timeout. */
  async _humanBlockerPhase(defenderPid, blockers, attacker) {
    const game = this.game;
    const defender = game.players[defenderPid];

    // Add orange glow to blocker sprites and make them clickable
    const blockerSprites = [];
    for (let i = 0; i < defender.field.length; i++) {
      const card = defender.field[i];
      if (!card || !blockers.includes(card)) continue;
      const slot = game.zoneManager.getZone(defenderPid, `field_slot_${i}`);
      if (!slot) continue;
      const sprite = slot.children.find(c => c.isFieldSprite);
      if (!sprite) continue;

      // Add orange glow filter
      const glow = new PIXI.filters.GlowFilter({
        distance: 20,
        outerStrength: 2.5,
        innerStrength: 0,
        color: 0xff8800,
        quality: 0.2,
      });
      glow._tickerTime = 0;
      sprite.filters = [glow];
      blockerSprites.push({ sprite, card, slot, i });

      // Make clickable
      const onClick = (e) => {
        e.stopPropagation();
        if (this._blockerResolve) this._blockerResolve(card);
      };
      sprite.off('pointerdown', sprite._blockerClickHandler);
      sprite._blockerClickHandler = onClick;
      sprite.on('pointerdown', onClick);
    }

    // Wire ticker for pulsing blocker glow
    const _blockerGlowTicker = () => {
      for (const { sprite } of blockerSprites) {
        const glow = sprite.filters?.[0];
        if (!glow || !glow._tickerTime) continue;
        const t = glow._tickerTime;
        const pulse = 2 + 3 * (0.5 + 0.5 * Math.sin(t * Math.PI * 1.25));
        glow.outerStrength = pulse;
        glow._tickerTime = t + 0.016;
      }
    };
    game.app.ticker.add(_blockerGlowTicker);
    this._blockerGlowTickerRef = _blockerGlowTicker;

    // Set up PASS button
    this._setupPassButton();

    // Wait for selection (click, PASS, or timeout)
    return new Promise((resolve) => {
      const onResolve = (card) => {
        // Disable button immediately so it can't fire again
        disableActionButton(game.ui?.actionButton);
        clearTimeout(this._blockerTimeoutId);
        game.app.ticker.remove(_blockerGlowTicker);
        this._blockerGlowTickerRef = null;
        // Clean up glow and click handlers
        for (const { sprite } of blockerSprites) {
          if (sprite.filters) sprite.filters = [];
          if (sprite._blockerClickHandler) {
            sprite.off('pointerdown', sprite._blockerClickHandler);
            delete sprite._blockerClickHandler;
          }
        }
        resolve(card || null);
      };
      this._blockerTimeoutId = setTimeout(() => onResolve(null), 10000);
      this._blockerResolve = (card) => onResolve(card);

      // Wire PASS button
      const btnObj = game.ui?.actionButton;
      if (btnObj) {
        btnObj.actionBg.off('pointerdown');
        btnObj.actionBg.on('pointerdown', () => {
          btnObj.actionBg.eventMode = 'none';
          btnObj.actionBg.cursor = 'default';
          onResolve(null);
        });
      }
    });
  }

  _afterBattleResolve() {
    const { fieldRenderer, zoneRenderer } = this.game;
    this.game.actionState = 'idle';
    // restoreActionButton() is called by the outer finally block, not here
    fieldRenderer.renderFieldWithInteraction(1, (...args) => this.onFieldCardDrag(...args));
    fieldRenderer.renderField(2);
    fieldRenderer.renderLeaders();
    zoneRenderer.renderAll();
    this.game._renderDONTokens();
    this.game._bindLeaderInteraction(1);
  }

  /** Configure the action button as a clickable PASS button. */
  _setupPassButton() {
    const btnObj = this.game.ui?.actionButton;
    if (!btnObj) return;
    btnObj.actionText.text = 'PASS';
    btnObj.actionText.style.fill = 0xffffff;
    btnObj.actionText.dirty = true;
    btnObj.actionBg.eventMode = 'static';
    btnObj.actionBg.cursor = 'pointer';
    btnObj._currentStateKey = 'endTurn';
  }
}

// Counter effect handlers for common counter card effects
const EFFECT_COUNTER_HANDLERS = {
  draw: (ctx, params) => {
    for (let i = 0; i < (params.count || 1) && ctx.player.deck.cards.length > 0; i++) {
      const drawn = ctx.player.deck.draw();
      if (drawn) ctx.player.hand.push(drawn);
    }
  },

  trashFromHand: (ctx, params) => {
    for (let i = 0; i < (params.count || 1) && ctx.player.hand.length > 0; i++) {
      const trashed = ctx.player.hand.pop();
      if (trashed) ctx.player.trash.push(trashed);
    }
  },

  addDON: (ctx) => {
    if (ctx.player.donDeck.length > 0) {
      const don = ctx.player.donDeck.pop();
      if (don) {
        don.active = true;
        don.rested = false;
        ctx.player.costArea.push(don);
      }
    }
  },

  restOpponent: (ctx, params) => {
    const opponent = ctx.getOpponent(ctx.player);
    if (!opponent) return;
    const activeChars = opponent.field.filter(c => c && !c.rested && (params.maxCost === undefined || c.cost <= params.maxCost));
    if (activeChars.length > 0) {
      activeChars[0].rested = true;
    }
  },

  powerBoost: () => { /* handled separately, returns value via result */ },
};

export default AttackInteraction;
