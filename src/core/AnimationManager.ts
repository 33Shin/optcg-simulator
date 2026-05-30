import InitialDrawAnimation from './animations/InitialDrawAnimation';
import DONDrawAnimation from './animations/DONDrawAnimation';
import DONSlamAnimation from './animations/DONSlamAnimation';
import DONDetachAnimation from './animations/DONDetachAnimation';
import DONRestAnimation from './animations/DONRestAnimation';
import ActiveAnimation from './animations/ActiveAnimation';
import ShuffleAnimation from './animations/ShuffleAnimation';
import CountdownAnimation from './animations/CountdownAnimation';
import CommitLifeAnimation from './animations/CommitLifeAnimation';
import SlamAnimation from './animations/SlamAnimation';
import FlyToTrashAnimation from './animations/FlyToTrashAnimation';
import FlyToBottomDeckAnimation from './animations/FlyToBottomDeckAnimation';
import AttackAnimation from './animations/AttackAnimation';
import AIPlayAnimation from './animations/AIPlayAnimation';
import AICounterAnimation from './animations/AICounterAnimation';
import AbilityActivateAnimation from './animations/AbilityActivateAnimation';
import MultipleDrawAnimation from './animations/MultipleDrawAnimation';
import CardPickAnimation from './animations/CardPickAnimation';
import DamageTriggerAnimation from './animations/DamageTriggerAnimation';
import { Animator } from './Animator';
import { narrowContext, easeOutCubic, easeInOut, makeFlyCard } from './animations/utils';

class AnimationManager {
  constructor(app, gameBoard, zoneManager, renderer, players, handRenderer, zoneRenderer, donSystem, ui) {
    this.ctx = { app, gameBoard, zoneManager, renderer, players, handRenderer, zoneRenderer, donSystem, ui };

    this.initialDraw = new InitialDrawAnimation(narrowContext(this.ctx, InitialDrawAnimation));
    this.initialDraw.name = 'initialDraw';
    this.donDraw = new DONDrawAnimation(narrowContext(this.ctx, DONDrawAnimation));
    this.donDraw.name = 'donDraw';
    this.donDetach = new DONDetachAnimation(narrowContext(this.ctx, DONDetachAnimation));
    this.donDetach.name = 'donDetach';
    this.donRest = new DONRestAnimation(narrowContext(this.ctx, DONRestAnimation));
    this.donRest.name = 'donRest';
    this.active = new ActiveAnimation(narrowContext(this.ctx, ActiveAnimation));
    this.active.name = 'active';
    this.shuffle = new ShuffleAnimation(narrowContext(this.ctx, ShuffleAnimation));
    this.shuffle.name = 'shuffle';
    this.countdown = new CountdownAnimation(narrowContext(this.ctx, CountdownAnimation));
    this.countdown.name = 'countdown';
    this.commitLife = new CommitLifeAnimation(narrowContext(this.ctx, CommitLifeAnimation));
    this.commitLife.name = 'commitLife';
    this.slam = new SlamAnimation(narrowContext(this.ctx, SlamAnimation));
    this.slam.name = 'slam';
    this.flyToTrash = new FlyToTrashAnimation(narrowContext(this.ctx, FlyToTrashAnimation));
    this.flyToTrash.name = 'flyToTrash';
    this.flyToBottomDeck = new FlyToBottomDeckAnimation(narrowContext(this.ctx, FlyToBottomDeckAnimation));
    this.flyToBottomDeck.name = 'flyToBottomDeck';
    this.attack = new AttackAnimation(narrowContext(this.ctx, AttackAnimation));
    this.attack.name = 'attack';
    this.aiPlay = new AIPlayAnimation(narrowContext(this.ctx, AIPlayAnimation));
    this.aiPlay.name = 'aiPlay';
    this.aiCounter = new AICounterAnimation(narrowContext(this.ctx, AICounterAnimation));
    this.aiCounter.name = 'aiCounter';
    this.abilityActivate = new AbilityActivateAnimation(narrowContext(this.ctx, AbilityActivateAnimation));
    this.abilityActivate.name = 'abilityActivate';
    this.multipleDraw = new MultipleDrawAnimation(narrowContext(this.ctx, MultipleDrawAnimation));
    this.multipleDraw.name = 'multipleDraw';
    this.cardPick = new CardPickAnimation(narrowContext(this.ctx, CardPickAnimation));
    this.cardPick.name = 'cardPick';
    this.damageTrigger = new DamageTriggerAnimation(narrowContext(this.ctx, DamageTriggerAnimation));
    this.damageTrigger.name = 'damageTrigger';
  }

  animateAttack(pid, attacker, attackerZone, target, targetZone) {
    return this.attack.animate(pid, attacker, attackerZone, target, targetZone);
  }

  async animateAttackLiftAndRotate(pid, attacker, attackerZone, target, targetZone) {
    return this.attack.animateLiftAndRotate(pid, attacker, attackerZone, target, targetZone);
  }

  async animateAttackContinueFromHeld() {
    return this.attack.continueAttackFromHeldState();
  }

  get attackAnimState() {
    return this.attack._attackAnimState;
  }

  animateDrawCard(pid, card, handIdx) {
    return this.multipleDraw.drawOne(pid, this.ctx.players[pid], card, handIdx);
  }

  async animateDONDraw(pid) {
    return this.donDraw.animateDONDraw(pid);
  }

  async animateDONSlam(pid, visibleCount) {
    const slam = new DONSlamAnimation(narrowContext(this.ctx, DONSlamAnimation));
    await slam.animate(pid, visibleCount);
  }

  animateDONDetach(pid) {
    return this.donDetach.animate(pid);
  }

  animateDONRest(pid, count, indices) {
    return this.donRest.animate(pid, count, indices);
  }

  animateActive(pid) {
    return this.active.animate(pid);
  }

  /**
   * Animate DON tokens flying from a KO'd card back to the cost zone as rested.
   * @param {number} pid - Player ID
   * @param {PIXI.Container} targetZone - The field slot or leader zone the card was in
   * @param {number} donCount - Number of DONs to animate
   * @returns {Promise<void>}
   */
  async animateDONReturnOnKO(pid, targetZone, donCount) {
    if (!targetZone || donCount <= 0) return;
    const { app, zoneManager } = this.ctx;
    const costZone = zoneManager.getZone(pid, 'cost');
    if (!costZone) return;

    const donTexture = PIXI.Texture.from('assets/imgs/don.png');
    const startCenter = targetZone.toGlobal(new PIXI.Point(targetZone.width / 2, targetZone.height / 2));
    const costCenter = costZone.toGlobal(new PIXI.Point(costZone.width / 2, costZone.height / 2));
    const startPos = app.stage.toLocal(startCenter);
    const endPos = app.stage.toLocal(costCenter);

    const duration = 350;
    const stagger = 60;
    const t0 = performance.now();

    const tokens = [];
    for (let i = 0; i < donCount; i++) {
      const sp = new PIXI.Sprite(donTexture);
      sp.width = 28;
      sp.height = 40;
      sp.anchor.set(0.5);
      sp.position.set(startPos.x, startPos.y);
      sp.alpha = 1;
      sp.eventMode = 'none';
      sp._delay = i * stagger;
      app.stage.addChild(sp);
      tokens.push(sp);
    }

    return new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - t0;
        let allDone = true;
        for (const sp of tokens) {
          const te = Math.max(0, elapsed - sp._delay);
          const t = Math.min(te / duration, 1);
          if (t < 1) allDone = false;
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          sp.x = startPos.x + (endPos.x - startPos.x) * e;
          sp.y = startPos.y + (endPos.y - startPos.y) * e;
          sp.rotation = (Math.PI / 2) * (1 - e);
          sp.alpha = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
        }
        if (allDone) {
          for (const sp of tokens) {
            if (sp.parent) sp.parent.removeChild(sp);
          }
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  animateDONBurst(targetZone, duration = 400) {
    if (!targetZone) return Promise.resolve();
    const { app } = this.ctx;

    const targetCardSprite = targetZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
    const cardScale = targetCardSprite ? targetCardSprite.scale.x : 1;

    const donBurstSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donBurstSprite.name = 'donBurstSprite';
    donBurstSprite.anchor.set(0.5);
    donBurstSprite.position.set(50, 70);
    donBurstSprite.alpha = 0.5;
    donBurstSprite.eventMode = 'none';
    const targetW = 30 * cardScale;
    donBurstSprite.width = targetW;
    const baseScale = donBurstSprite.scale.x;
    donBurstSprite.scale.set(baseScale);
    if (targetCardSprite) {
      const powerText = targetCardSprite.children.find(c => c.isPowerText);
      const powerIndex = targetCardSprite.children.indexOf(powerText);
      if (powerIndex > -1) {
        targetCardSprite.addChildAt(donBurstSprite, powerIndex);
      } else {
        targetCardSprite.addChild(donBurstSprite);
      }
    }

    const screenFlashGraphics = new PIXI.Graphics();
    screenFlashGraphics.name = 'screenFlash';
    screenFlashGraphics.eventMode = 'none';
    screenFlashGraphics.alpha = 0;
    app.stage.addChildAt(screenFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    return Animator.animate({
      duration,
      easing: 'easeOutQuad',
      onUpdate: (t) => {
        donBurstSprite.scale.set(baseScale * (2 + 6 * t));
        donBurstSprite.alpha = Math.max(0, 0.8 * (1 - t));

        const shakeAmt = 10 * Math.max(0, 1 - t * 2);
        app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeAmt;
        app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeAmt;

        screenFlashGraphics.clear();
        const flashAlpha = 0.3 * Math.max(0, 1 - t * 2);
        if (flashAlpha > 0) {
          screenFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
              .fill({ color: 0xffd700, alpha: flashAlpha });
        }
      },
      onComplete: () => {
        app.stage.position.x = origStageX;
        app.stage.position.y = origStageY;
        donBurstSprite.alpha = 0;
        screenFlashGraphics.clear();
        if (donBurstSprite.parent) donBurstSprite.parent.removeChild(donBurstSprite);
        if (screenFlashGraphics.parent) screenFlashGraphics.parent.removeChild(screenFlashGraphics);
      },
    }).toPromise();
  }

  animateCounterCard(targetZone, counterCard, duration = 400) {
    if (!targetZone) return Promise.resolve();
    const { app } = this.ctx;

    const targetCardSprite = targetZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
    const cardScale = targetCardSprite ? targetCardSprite.scale.x : 1;

    // Same DON burst style but with counter card image
    const texture = counterCard.imgPath ? PIXI.Texture.from(counterCard.imgPath) : null;
    let burstSprite;
    if (texture) {
      burstSprite = new PIXI.Sprite(texture);
      burstSprite.width = 30 * cardScale;
      burstSprite.height = 42 * cardScale;
    } else {
      // Fallback: golden circle when no image available
      burstSprite = new PIXI.Graphics();
      burstSprite.circle(0, 0, 15 * cardScale).fill({ color: 0xffd700 });
    }
    burstSprite.name = 'counterBurstSprite';
    burstSprite.anchor.set(0.5);
    burstSprite.position.set(50, 70);
    burstSprite.alpha = 0.5;
    burstSprite.eventMode = 'none';
    const baseScale = burstSprite.scale.x || 1;
    if (targetCardSprite) {
      const powerText = targetCardSprite.children.find(c => c.isPowerText);
      const powerIndex = targetCardSprite.children.indexOf(powerText);
      if (powerIndex > -1) {
        targetCardSprite.addChildAt(burstSprite, powerIndex);
      } else {
        targetCardSprite.addChild(burstSprite);
      }
    }

    const screenFlashGraphics = new PIXI.Graphics();
    screenFlashGraphics.name = 'screenFlash';
    screenFlashGraphics.eventMode = 'none';
    screenFlashGraphics.alpha = 0;
    app.stage.addChildAt(screenFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    return Animator.animate({
      duration,
      easing: 'easeOutQuad',
      onUpdate: (t) => {
        burstSprite.scale.set(baseScale * (2 + 6 * t));
        burstSprite.alpha = Math.max(0, 0.8 * (1 - t));

        const shakeAmt = 10 * Math.max(0, 1 - t * 2);
        app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeAmt;
        app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeAmt;

        screenFlashGraphics.clear();
        const flashAlpha = 0.3 * Math.max(0, 1 - t * 2);
        if (flashAlpha > 0) {
          screenFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
              .fill({ color: 0xffd700, alpha: flashAlpha });
        }
      },
      onComplete: () => {
        app.stage.position.x = origStageX;
        app.stage.position.y = origStageY;
        burstSprite.alpha = 0;
        screenFlashGraphics.clear();
        if (burstSprite.parent) burstSprite.parent.removeChild(burstSprite);
        if (screenFlashGraphics.parent) screenFlashGraphics.parent.removeChild(screenFlashGraphics);
      },
    }).toPromise();
  }

  animatePowerCount(textObject, oldPower, newPower, duration = 700, colorFrom = 0xffffff, colorTo = 0xffd700) {
    if (!textObject) return Promise.resolve();
    const fromR = (colorFrom >> 16) & 255, fromG = (colorFrom >> 8) & 255, fromB = colorFrom & 255;
    const toR = (colorTo >> 16) & 255, toG = (colorTo >> 8) & 255, toB = colorTo & 255;

    return Animator.animate({
      duration,
      easing: 'easeOutQuad',
      onUpdate: (t) => {
        const displayPower = Math.round(oldPower + (newPower - oldPower) * t);
        textObject.text = String(displayPower);
        const liftArc = Math.sin(t * Math.PI);
        const scalePeak = 1 + 0.35 * liftArc;
        textObject.scale.set(scalePeak);

        const r = Math.round(fromR + (toR - fromR) * t);
        const g = Math.round(fromG + (toG - fromG) * t);
        const b = Math.round(fromB + (toB - fromB) * t);
        textObject.style.fill = (r << 16) | (g << 8) | b;
      },
      onComplete: () => {
        textObject.text = String(newPower);
      },
    }).toPromise();
  }

  animateShuffle(pid) {
    return this.shuffle.animateShuffle(pid);
  }

  animateCommitLife(pid, player, cards) {
    return this.commitLife.animate(pid, player, cards);
  }

  /**
    * Orange-glow activation VFX for blocker (same style as ability activate but orange).
    * @param {object} card - The blocker card data
    * @param {PIXI.Container} fieldSlot - The slot container the card is in
    */
    async animateBlockerActivate(card, fieldSlot) {
    return new Promise((resolve) => {
      const { app } = this.ctx;
      if (!fieldSlot) { resolve(); return; }

      // Store refs for cleanup on cancel
      this._blockerActivateGhost = null;
      this._blockerActivateOverlay = null;
      this._blockerActivateFxContainer = null;
      this._blockerActivateResolve = resolve;

      const cardW = 100, cardH = 140;
      const displayTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
      const ghost = makeFlyCard(displayTexture, card, cardW, cardH);
      this._blockerActivateGhost = ghost;

      const slotCenterX = fieldSlot.width / 2;
      const slotCenterY = fieldSlot.height / 2;
      const slotStagePos = app.stage.toLocal(
        fieldSlot.toGlobal(new PIXI.Point(slotCenterX, slotCenterY))
      );

      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;

      ghost.x = slotStagePos.x;
      ghost.y = slotStagePos.y;
      ghost.alpha = 0;
      ghost.eventMode = 'none';

      // Dark overlay
      const overlay = new PIXI.Graphics();
      overlay.rect(0, 0, app.screen.width, app.screen.height)
             .fill({ color: 0x000000 });
      overlay.alpha = 0;
      overlay.eventMode = 'none';
      this._blockerActivateOverlay = overlay;
      app.stage.addChild(overlay);

      // FX container for activation effects
      const fxContainer = new PIXI.Container();
      fxContainer.eventMode = 'none';
      this._blockerActivateFxContainer = fxContainer;
      app.stage.addChild(fxContainer);

      // Ghost card on top
      app.stage.addChild(ghost);

      // --- Activation VFX elements (orange theme) ---

      // Card glow filter — orange
      const glowFilter = new PIXI.filters.GlowFilter({
        distance: 20,
        outerStrength: 2,
        innerStrength: 0,
        color: 0xff8800,
        quality: 0.2
      });
      ghost.filters = [glowFilter];

      // Center light spark
      const spark = new PIXI.Graphics();
      spark.circle(0, 0, 12);
      spark.fill({ color: 0xffffff, alpha: 1 });
      spark.x = centerX;
      spark.y = centerY;
      spark.blendMode = 'add';
      spark.filters = [
        new PIXI.filters.KawaseBlurFilter({ blur: 12, quality: 4 })
      ];
      spark.alpha = 0;
      spark.scale.set(0);
      fxContainer.addChild(spark);

      // Light ring — orange
      const ring = new PIXI.Graphics();
      ring.circle(0, 0, 50);
      ring.stroke({ width: 6, color: 0xff8800, alpha: 1 });
      ring.x = centerX;
      ring.y = centerY;
      ring.blendMode = 'add';
      ring.alpha = 0;
      ring.scale.set(0.2);
      fxContainer.addChild(ring);

      // Shine sweep
      const shine = new PIXI.Graphics();
      shine.rect(-80, -500, 160, 1000);
      shine.fill({ color: 0xffffff, alpha: 0.55 });
      shine.rotation = 0.4;
      shine.x = centerX - 400;
      shine.y = centerY;
      shine.blendMode = 'add';
      shine.alpha = 0;
      shine.filters = [
        new PIXI.filters.KawaseBlurFilter({ blur: 6, quality: 3 })
      ];
      fxContainer.addChild(shine);

      // Energy particles — orange
      const particles = [];
      for (let i = 0; i < 40; i++) {
        const p = new PIXI.Graphics();
        p.circle(0, 0, 2 + Math.random() * 2);
        p.fill({ color: 0xff8800 });
        p.x = centerX;
        p.y = centerY;
        p.blendMode = 'add';
        p.alpha = 1;
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 120;
        p._targetX = centerX + Math.cos(angle) * dist;
        p._targetY = centerY + Math.sin(angle) * dist;
        fxContainer.addChild(p);
        particles.push(p);
      }

      // Border activation glow — orange
      const border = new PIXI.Graphics();
      border.roundRect(-250, -350, 500, 700, 24);
      border.stroke({ width: 8, color: 0xff8800, alpha: 1 });
      border.x = centerX;
      border.y = centerY;
      border.blendMode = 'add';
      border.alpha = 0;
      border.filters = [
        new PIXI.filters.KawaseBlurFilter({ blur: 4, quality: 3 })
      ];
      fxContainer.addChild(border);

      // --- Timing ---
      const flyInDur = 500;
      const vfxDur = 800;
      const fadeOutDur = 200;
      const total = flyInDur + vfxDur + fadeOutDur;

      const start = performance.now();
      let cancelled = false;
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - start;
        const t = Math.min(elapsed / total, 1);

        if (t < flyInDur / total) {
          // Phase 1: Fly in + scale up to 1.5x + fade in
          const p = (elapsed / total) / (flyInDur / total);
          const e = 1 - Math.pow(1 - p, 3);

          ghost.x = slotStagePos.x + (centerX - slotStagePos.x) * e;
          ghost.y = slotStagePos.y + (centerY - slotStagePos.y) * e;
          ghost.alpha = Math.min(p / 0.1, 1);
          ghost.scale.set(1 + e * 1.5, 1 + e * 1.5);

          overlay.alpha = e * 0.85;

        } else if (t < (flyInDur + vfxDur) / total) {
          // Phase 2: Activation VFX
          const raw = (elapsed / total - flyInDur / total) / (vfxDur / total);
          const p = Math.min(raw, 1);

          ghost.x = centerX;
          ghost.y = centerY;
          ghost.alpha = 1;
          ghost.scale.set(2.5, 2.5);

          // Spark: scale 0 -> 8, fade out
          const sparkP = Math.min(p / 0.45, 1);
          spark.alpha = Math.max(0, 1 - sparkP);
          spark.scale.set(sparkP * 8);

          // Ring: scale 0.2 -> 3, fade out
          const ringP = Math.min(p / 0.7, 1);
          ring.alpha = Math.max(0, 1 - ringP);
          ring.scale.set(0.2 + ringP * 2.8);

          // Shine sweep: left to right
          const shineP = Math.min(p / 0.45, 1);
          shine.x = (centerX - 400) + shineP * 800;
          shine.alpha = Math.max(0, 1 - shineP);

          // Border: flash in then fade
          const borderP = Math.min(p / 0.8, 1);
          if (p < 0.15) {
            border.alpha = p / 0.15;
          } else {
            border.alpha = Math.max(0, 1 - (p - 0.15) / 0.65);
          }

          // Glow filter pulse
          glowFilter.outerStrength = 2 + 6 * Math.sin(p * Math.PI);

          // Particles: spread out and fade
          const partP = Math.min(p / 0.6, 1);
          for (const pt of particles) {
            pt.x = pt.x + (pt._targetX - pt.x) * partP * 0.1;
            pt.y = pt.y + (pt._targetY - pt.y) * partP * 0.1;
            pt.alpha = Math.max(0, 1 - partP);
          }

        } else {
          // Phase 3: Fast fade out
          const p = (elapsed / total - (flyInDur + vfxDur) / total) / (fadeOutDur / total);
          const e = p * p;

          ghost.x = centerX;
          ghost.y = centerY;
          ghost.alpha = Math.max(0, 1 - e);
          glowFilter.outerStrength = 2 * (1 - e);
          ghost.scale.set(2.5, 2.5);

          overlay.alpha = Math.max(0, 0.85 * (1 - e));
          fxContainer.alpha = Math.max(0, 1 - e);

          if (p >= 1) {
            cancelled = true;
            ghost.alpha = 0;
            overlay.alpha = 0;
            fxContainer.alpha = 0;
            if (ghost.parent) ghost.parent.removeChild(ghost);
            if (overlay.parent) overlay.parent.removeChild(overlay);
            if (fxContainer.parent) fxContainer.parent.removeChild(fxContainer);
            this._blockerActivateRafId = null;
            resolve();
            return;
          }
        }

        this._blockerActivateRafId = requestAnimationFrame(tick);
      };
      this._blockerActivateRafId = requestAnimationFrame(tick);
    });
  }

  /** Cancel in-flight blocker activation animation. */
  cancelBlockerActivate() {
    if (this._blockerActivateRafId != null) {
      cancelAnimationFrame(this._blockerActivateRafId);
      this._blockerActivateRafId = null;
    }
    // Clean up VFX elements left on stage
    if (this._blockerActivateGhost && this._blockerActivateGhost.parent) {
      this._blockerActivateGhost.parent.removeChild(this._blockerActivateGhost);
    }
    if (this._blockerActivateOverlay && this._blockerActivateOverlay.parent) {
      this._blockerActivateOverlay.parent.removeChild(this._blockerActivateOverlay);
    }
    if (this._blockerActivateFxContainer && this._blockerActivateFxContainer.parent) {
      this._blockerActivateFxContainer.parent.removeChild(this._blockerActivateFxContainer);
    }
    this._blockerActivateGhost = null;
    this._blockerActivateOverlay = null;
    this._blockerActivateFxContainer = null;
    if (this._blockerActivateResolve) {
      const r = this._blockerActivateResolve;
      this._blockerActivateResolve = null;
      r();
    }
  }

  /**
    * Animate a blocker card resting: lift up with scale, rotate to rest angle (90deg), slam down with bounce.
    * @param {PIXI.Container} sprite - The field card sprite to animate
    * @returns {Promise<void>}
    */
   animateBlockerRest(sprite) {
    if (!sprite || !sprite.parent) return;

    const { app } = this.ctx;
    const gp = sprite.getGlobalPosition() || new PIXI.Point(0, 0);
    const sp = app.stage.toLocal(gp) || new PIXI.Point(gp.x, gp.y);
    const origX = sp.x;
    const origY = sp.y;
    const origRotation = sprite.rotation;
    const origScale = sprite.scale.x;
    const liftDistance = 40;
    const slamOvershoot = 12;
    const bounceCount = 3;
    const restAngle = Math.PI / 2; // 90 degrees

    // Store references for cancelBlockerRest
    this._blockerRestSprite = sprite;
    this._blockerRestGhost = null;

    // Create ghost card on stage so it renders above combat zone
    const cardRef = sprite.cardRef;
    let ghost;
    if (cardRef && this.ctx.renderer) {
      ghost = this.ctx.renderer.render(cardRef, false, 1.0);
    } else {
      ghost = new PIXI.Container();
      const child0 = sprite.children[0];
      if (child0 && child0.clone) {
        const copy = child0.clone();
        if (copy) ghost.addChild(copy);
      }
    }
    this._blockerRestGhost = ghost;
    ghost.pivot.set(sprite.pivot.x, sprite.pivot.y);
    ghost.position.set(origX, origY);
    ghost.scale.copyFrom(sprite.scale);
    ghost.rotation = sprite.rotation;
    ghost.alpha = 1;
    ghost.eventMode = 'none';
    app.stage.addChild(ghost);

    // Hide original during animation
    sprite.visible = false;

    const liftDur = 350;
    const slamDur = 90;
    const impactDur = 40;
    const bounceDur = 350;
    const shakeIntensity = 10;
    const total = liftDur + slamDur + impactDur + bounceDur;

    const start = performance.now();
    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    return new Promise((resolve) => {
      let cancelled = false;
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - start;
        const t = Math.min(elapsed / total, 1);

        if (t < liftDur / total) {
          // Phase 1: Lift up with scale increase AND rotate to rest angle simultaneously
          const p = elapsed / liftDur;
          const e = easeOutCubic(p);
          ghost.position.y = origY - liftDistance * e;
          ghost.scale.set(origScale * (1 + 0.3 * e), origScale * (1 + 0.3 * e));
          ghost.rotation = origRotation + (restAngle - origRotation) * e;
        }
        else if (t < (liftDur + slamDur) / total) {
          // Phase 2: Slam down (scale shrink + drop with overshoot)
          const p = (elapsed - liftDur) / slamDur;
          const e = p * p * p;
          ghost.position.y = origY - liftDistance + (liftDistance + slamOvershoot) * e;
          ghost.scale.set(
            origScale * 1.3 - e * 0.3,
            origScale * 1.3 - e * 0.3
          );
        }
        else if (t < (liftDur + slamDur + impactDur) / total) {
          // Phase 3: Impact frame (crush + max shake)
          ghost.scale.set(origScale * 1.15, origScale * 0.85);
          ghost.position.y = origY + slamOvershoot * 0.1;
          app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeIntensity * 2.5;
          app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeIntensity * 2.5;
        }
        else {
          // Phase 4: Bounce back with decaying scale oscillation + shake decay
          const p = (elapsed - liftDur - slamDur - impactDur) / bounceDur;
          const decay = Math.pow(1 - p, 2);

          const angle = p * Math.PI * bounceCount * 2;
          const scaleBounce = 1 + Math.sin(angle) * decay * 0.08;
          ghost.position.y = origY;
          ghost.scale.set(origScale * scaleBounce, origScale * scaleBounce);

          const shakeDecay = Math.pow(1 - Math.min(p, 1), 1.5) * (300 / bounceDur);
          const effectiveShake = shakeIntensity * Math.max(0, shakeDecay);
          app.stage.position.x = origStageX + (Math.random() - 0.5) * effectiveShake;
          app.stage.position.y = origStageY + (Math.random() - 0.5) * effectiveShake;

          if (p >= 1) {
            cancelled = true;
            // Finalize: snap to rest position, restore stage
            ghost.position.set(origX, origY);
            ghost.rotation = restAngle;
            ghost.scale.set(origScale, origScale);
            app.stage.position.x = origStageX;
            app.stage.position.y = origStageY;

            // Remove ghost and show original with rested rotation
            if (ghost.parent) ghost.parent.removeChild(ghost);
            sprite.visible = true;
            sprite.rotation = restAngle;
            this._blockerRestRafId = null;
            this._blockerRestGhost = null;
            this._blockerRestSprite = null;
            resolve();
            return;
          }
        }
        this._blockerRestRafId = requestAnimationFrame(tick);
      };
      this._blockerRestRafId = requestAnimationFrame(tick);
    });
  }

   /** Cancel in-flight blocker rest animation. */
  cancelBlockerRest() {
    if (this._blockerRestRafId != null) {
      cancelAnimationFrame(this._blockerRestRafId);
      this._blockerRestRafId = null;
    }
    if (this._blockerRestGhost && this._blockerRestGhost.parent) {
      this._blockerRestGhost.parent.removeChild(this._blockerRestGhost);
      this._blockerRestGhost = null;
    }
    if (this._blockerRestSprite) {
      this._blockerRestSprite.visible = true;
      this._blockerRestSprite = null;
    }
  }
}

export default AnimationManager;