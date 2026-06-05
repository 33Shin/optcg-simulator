import { gsap } from 'gsap';
import { easeInOut, createFlipCard, getDisplayTexture } from './utils';

export default class DamageTriggerAnimation {
  static requires = ['app', 'zoneManager', 'handRenderer', 'ui'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Interactive damage trigger animation (for P1 human player).
   * 1. Card flies from source zone to center with flip
   * 2. Shows Trigger/Pass buttons (Trigger disabled if no trigger ability)
   * 3. On Pass: card flies to hand, inserted into player.hand, re-renders
   * 4. On Trigger: fly card fades out, returns { played: true } for caller to handle effect+trash
   */
   async animate(pid, player, card, hasTrigger, sourceZoneId = 'deck') {
    const { app, zoneManager, handRenderer } = this.ctx;
    const sourceZone = zoneManager.getZone(pid, sourceZoneId);
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!sourceZone || !handZone) return { played: false };

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const centerC = new PIXI.Point(app.screen.width / 2, app.screen.height / 2);
    const centerPos = app.stage.toLocal(centerC);

    // Source zone position
    const zoneTopLeft = sourceZone.getGlobalPosition();
    const zoneCenter = new PIXI.Point(zoneTopLeft.x + sourceZone.width / 2, zoneTopLeft.y + sourceZone.height / 2);
    const fromPos = app.stage.toLocal(zoneCenter);

    // --- Phase 1: Fly card from source to center with flip ---
    const flyCard = createFlipCard(
      getDisplayTexture(pid, card),
      card,
      cardW,
      cardH
    );
    flyCard.position.copyFrom(fromPos);
    app.stage.addChild(flyCard);

    // Dark overlay on top of game content but below flyCard (added after flyCard so it renders above)
    const overlay = this._createDarkOverlay(app);
    if (overlay.parent) overlay.parent.removeChild(overlay);
    const flyIdx = app.stage.children.indexOf(flyCard);
    app.stage.addChildAt(overlay, Math.max(0, flyIdx));

    await this._flyToCenter(flyCard, fromPos, centerPos, true);

    // Remove overlay before decision buttons (decision overlay has its own)
    if (overlay.parent) overlay.parent.removeChild(overlay);

    // --- Phase 2: Show buttons and wait for decision ---
    const result = await this._showDecisionOverlay(pid, card, flyCard, hasTrigger, sourceZoneId);

    if (result.played) {
      // Card is already face-up, just play golden activation VFX then fly to trash
      const { overlay: decisionOverlay, promptText: decisionPrompt } = result;
      await this._activateOnly(flyCard, app);
      await this._flyToTrash(flyCard, app, pid);
      // Clean up decision overlay after animation
      if (decisionOverlay && decisionOverlay.parent) decisionOverlay.parent.removeChild(decisionOverlay);
      if (decisionPrompt && decisionPrompt.parent) decisionPrompt.parent.removeChild(decisionPrompt);
      return { played: true };
    } else {
      player.hand.push(card);
      await this._flyToHand(pid, player, flyCard, centerPos, cardW, cardH);
      return { played: false };
    }
  }

   /**
    * Non-interactive damage trigger animation (for P2 AI).
    * Card flies face-down. If trigger plays: flips to reveal + yellow glow activation.
    * If no trigger/pass: stays face-down, flies to hand.
    */
  async animateAI(pid, player, card, hasTrigger, played, sourceZoneId = 'deck') {
    const { app, zoneManager, handRenderer } = this.ctx;
    const sourceZone = zoneManager.getZone(pid, sourceZoneId);
    const handZone = zoneManager.getZone(pid, 'hand');
    if (!sourceZone || !handZone) return { played };

    const cardW = 100 * 0.95;
    const cardH = 140 * 0.95;
    const centerC = new PIXI.Point(app.screen.width / 2, app.screen.height / 2);
    const centerPos = app.stage.toLocal(centerC);

    // Source zone position
    const zoneTopLeft = sourceZone.getGlobalPosition();
    const zoneCenter = new PIXI.Point(zoneTopLeft.x + sourceZone.width / 2, zoneTopLeft.y + sourceZone.height / 2);
    const fromPos = app.stage.toLocal(zoneCenter);

    // Use actual card texture for front so flip reveals it on trigger
    const frontTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;

    // --- Phase 1: Fly card face-down from source to center (ghost card, independent sprite) ---
    const flyCard = createFlipCard(frontTexture, card, cardW, cardH);
    flyCard.position.copyFrom(fromPos);
    app.stage.addChild(flyCard);

    // Dark overlay on top of game content but below flyCard
    const overlay = this._createDarkOverlay(app);
    if (overlay.parent) overlay.parent.removeChild(overlay);
    const flyIdx = app.stage.children.indexOf(flyCard);
    app.stage.addChildAt(overlay, Math.max(0, flyIdx));

    await this._flyToCenterFaceDown(flyCard, fromPos, centerPos);

    // --- Phase 2: Handle trigger or pass ---
    if (hasTrigger && played) {
      // Flip to reveal card + yellow glow activation VFX
      await this._flipAndActivate(flyCard, app);

      const label = sourceZoneId === 'life' ? 'Life card' : 'Drawn';
      const scaledCardH = 140 * 0.95 * 2;
      const promptText = new PIXI.Text({
        text: `Taking damage! ${label}: ${card.name}\nTrigger activated!`,
        style: {
          fontSize: 24,
          fill: 0x4CAF50,
          fontFamily: 'Russo One',
          align: 'center',
        },
      });
      promptText.name = 'damageTriggerPromptAI';
      promptText.anchor.set(0.5, 1);
      promptText.position.set(app.screen.width / 2, flyCard.y - scaledCardH / 2 - 30);
      promptText.alpha = 0;
      promptText.eventMode = 'none';
      app.stage.addChild(promptText);

      await this._fadeInOutHold(promptText, overlay, 300, 600, 250);

      player.trash.push(card);
      await this._fadeOut(flyCard);
    } else {
      // No trigger or pass: keep face-down, show prompt, fly to hand
      const label = sourceZoneId === 'life' ? 'Life card' : 'Drawn';
      const scaledCardH = 140 * 0.95 * 2;
      const promptText = new PIXI.Text({
        text: hasTrigger
          ? `Taking damage! ${label}\nTrigger skipped.`
          : `Taking damage! ${label}`,
        style: {
          fontSize: 24,
          fill: 0xffffff,
          fontFamily: 'Russo One',
          align: 'center',
        },
      });
      promptText.name = 'damageTriggerPromptAIPass';
      promptText.anchor.set(0.5, 1);
      promptText.position.set(app.screen.width / 2, flyCard.y - scaledCardH / 2 - 30);
      promptText.alpha = 0;
      promptText.eventMode = 'none';
      app.stage.addChild(promptText);

      await this._fadeInOutHold(promptText, overlay, 300, 600, 250);

      player.hand.push(card);
      await this._flyToHand(pid, player, flyCard, centerPos, cardW, cardH);
    }

    return { played };
  }

  /** Fade in a text object, hold it visible, then fade out + remove both objects. */
  _fadeInOutHold(textObj, overlay, fadeInDur, holdDur, fadeOutDur) {
    const total = fadeInDur + holdDur + fadeOutDur;
    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = _p.t;
          const elapsed = t * total;

          if (elapsed < fadeInDur) {
            textObj.alpha = Math.min(elapsed / fadeInDur, 1);
          } else if (elapsed < fadeInDur + holdDur) {
            textObj.alpha = 1;
          } else if (elapsed < fadeInDur + holdDur + fadeOutDur) {
            const pt = (elapsed - fadeInDur - holdDur) / fadeOutDur;
            textObj.alpha = Math.max(0, 1 - pt);
            overlay.alpha = Math.max(0, 0.7 * (1 - pt));
          } else {
            if (textObj.parent) textObj.parent.removeChild(textObj);
            if (overlay.parent) overlay.parent.removeChild(overlay);
          }
        },
        onComplete: () => {
          if (textObj.parent) textObj.parent.removeChild(textObj);
          if (overlay.parent) overlay.parent.removeChild(overlay);
          resolve();
        },
      });
    });
  }

  /** Fly card from source to screen center with flip animation. */
  _flyToCenter(flyCard, fromPos, centerPos, doFlip = true) {
    const duration = 500;
    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: duration / 1000,
        ease: 'sine.inOut',
        onUpdate: () => {
          const e = _p.t;
          if (doFlip) {
            if (e < 0.5) flyCard.showBack();
            else flyCard.showFront();
            const flipSign = 2 * e - 1;
            const growthScale = 1 + e * 1;
            flyCard.scale.set(Math.abs(flipSign) * growthScale, growthScale);
          } else {
            flyCard.showFront();
            const growthScale = 1 + e * 1;
            flyCard.scale.set(growthScale, growthScale);
          }
          flyCard.x = fromPos.x + (centerPos.x - fromPos.x) * e;
          flyCard.y = fromPos.y + (centerPos.y - fromPos.y) * e;
        },
        onComplete: () => {
          flyCard.scale.set(2, 2);
          resolve();
        },
      });
    });
  }

  /** Fly card face-down from source to center, no flip reveal. */
  _flyToCenterFaceDown(flyCard, fromPos, centerPos) {
    const duration = 500;
    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: duration / 1000,
        ease: 'sine.inOut',
        onUpdate: () => {
          const e = _p.t;
          flyCard.showBack();
          const growthScale = 1 + e * 1;
          flyCard.scale.set(growthScale, growthScale);
          flyCard.x = fromPos.x + (centerPos.x - fromPos.x) * e;
          flyCard.y = fromPos.y + (centerPos.y - fromPos.y) * e;
        },
        onComplete: () => {
          flyCard.scale.set(2, 2);
          resolve();
        },
      });
    });
  }

  /** Flip card to reveal front + yellow glow activation VFX. */
  _flipAndActivate(flyCard, app) {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    const totalDur = 800;
    const flipDur = 400;

    // Glow filter (yellow/golden)
    const glowFilter = new PIXI.filters.GlowFilter({
      distance: 20,
      outerStrength: 2,
      innerStrength: 0,
      color: 0xffd700,
      quality: 0.2
    });

    // FX container for activation effects
    const fxContainer = new PIXI.Container();
    fxContainer.name = 'damageTriggerFlipFx';
    fxContainer.eventMode = 'none';
    app.stage.addChild(fxContainer);

    // Light ring — golden
    const ring = new PIXI.Graphics();
    ring.name = 'damageTriggerFlipRing';
    ring.circle(0, 0, 50);
    ring.stroke({ width: 6, color: 0xffd700, alpha: 1 });
    ring.x = centerX;
    ring.y = centerY;
    ring.blendMode = 'add';
    ring.alpha = 0;
    ring.scale.set(0.2);
    fxContainer.addChild(ring);

    // Sparkle burst
    const spark = new PIXI.Graphics();
    spark.name = 'damageTriggerFlipSpark';
    spark.circle(0, 0, 12);
    spark.fill({ color: 0xffffff, alpha: 1 });
    spark.x = centerX;
    spark.y = centerY;
    spark.blendMode = 'add';
    spark.alpha = 0;
    spark.scale.set(0);
    fxContainer.addChild(spark);

    // Energy particles — golden
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const p = new PIXI.Graphics();
      p.name = `damageTriggerFlipParticle_${i}`;
      p.circle(0, 0, 2 + Math.random() * 2);
      p.fill({ color: 0xffd700 });
      p.x = centerX;
      p.y = centerY;
      p.blendMode = 'add';
      p.alpha = 1;
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 100;
      p._targetX = centerX + Math.cos(angle) * dist;
      p._targetY = centerY + Math.sin(angle) * dist;
      fxContainer.addChild(p);
      particles.push(p);
    }

    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: totalDur / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = _p.t;

          if (t < flipDur / totalDur) {
            // Phase 1: Flip reveal with scale pulse
            const p = t / (flipDur / totalDur);
            flyCard.x = centerX;
            flyCard.y = centerY;
            flyCard.scale.set(2 + Math.sin(p * Math.PI) * 0.3, 2 + Math.sin(p * Math.PI) * 0.3);

            if (p < 0.5) {
              flyCard.showBack();
            } else {
              flyCard.showFront();
              flyCard.filters = [glowFilter];
            }

            // Glow pulse during flip
            glowFilter.outerStrength = 2 + 4 * Math.sin(p * Math.PI);

          } else {
            // Phase 2: Activation VFX then fade
            const p = (t - flipDur / totalDur) / (1 - flipDur / totalDur);

            flyCard.x = centerX;
            flyCard.y = centerY;
            flyCard.scale.set(2, 2);
            flyCard.showFront();

            // Spark: scale up then fade
            const sparkP = Math.min(p / 0.3, 1);
            spark.alpha = Math.max(0, 1 - sparkP);
            spark.scale.set(sparkP * 6);

            // Ring: expand and fade
            const ringP = Math.min(p / 0.5, 1);
            ring.alpha = Math.max(0, 1 - ringP);
            ring.scale.set(0.2 + ringP * 3);

            // Particles: spread out and fade
            const partP = Math.min(p / 0.6, 1);
            for (const pt of particles) {
              pt.x = pt.x + (pt._targetX - pt.x) * partP * 0.1;
              pt.y = pt.y + (pt._targetY - pt.y) * partP * 0.1;
              pt.alpha = Math.max(0, 1 - partP);
            }

            // Glow decay
            glowFilter.outerStrength = 2 * (1 - p);
          }
        },
        onComplete: () => {
          flyCard.filters = null;
          fxContainer.removeChild(ring);
          fxContainer.removeChild(spark);
          for (const pt of particles) {
            if (pt.parent) pt.parent.removeChild(pt);
          }
          if (fxContainer.parent) fxContainer.parent.removeChild(fxContainer);
          resolve();
        },
      });
    });
  }

  /** Activation VFX only (card already face-up). Golden glow, ring, spark, particles. */
  _activateOnly(flyCard, app) {
    const centerX = app.screen.width / 2;
    const centerY = app.screen.height / 2;
    const totalDur = 800;

    // Glow filter (yellow/golden)
    const glowFilter = new PIXI.filters.GlowFilter({
      distance: 20,
      outerStrength: 2,
      innerStrength: 0,
      color: 0xffd700,
      quality: 0.2
    });
    flyCard.filters = [glowFilter];

    // FX container for activation effects
    const fxContainer = new PIXI.Container();
    fxContainer.eventMode = 'none';
    app.stage.addChild(fxContainer);

    // Light ring — golden
    const ring = new PIXI.Graphics();
    ring.circle(0, 0, 50);
    ring.stroke({ width: 6, color: 0xffd700, alpha: 1 });
    ring.x = centerX;
    ring.y = centerY;
    ring.blendMode = 'add';
    ring.alpha = 0;
    ring.scale.set(0.2);
    fxContainer.addChild(ring);

    // Sparkle burst
    const spark = new PIXI.Graphics();
    spark.circle(0, 0, 12);
    spark.fill({ color: 0xffffff, alpha: 1 });
    spark.x = centerX;
    spark.y = centerY;
    spark.blendMode = 'add';
    spark.alpha = 0;
    spark.scale.set(0);
    fxContainer.addChild(spark);

    // Energy particles — golden
    const particles = [];
    for (let i = 0; i < 30; i++) {
      const p = new PIXI.Graphics();
      p.circle(0, 0, 2 + Math.random() * 2);
      p.fill({ color: 0xffd700 });
      p.x = centerX;
      p.y = centerY;
      p.blendMode = 'add';
      p.alpha = 1;
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 100;
      p._targetX = centerX + Math.cos(angle) * dist;
      p._targetY = centerY + Math.sin(angle) * dist;
      fxContainer.addChild(p);
      particles.push(p);
    }

    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: totalDur / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = _p.t;

          flyCard.x = centerX;
          flyCard.y = centerY;
          flyCard.scale.set(2, 2);

          // Spark: scale up then fade
          const sparkP = Math.min(t / 0.3, 1);
          spark.alpha = Math.max(0, 1 - sparkP);
          spark.scale.set(sparkP * 6);

          // Ring: expand and fade
          const ringP = Math.min(t / 0.5, 1);
          ring.alpha = Math.max(0, 1 - ringP);
          ring.scale.set(0.2 + ringP * 3);

          // Particles: spread out and fade
          const partP = Math.min(t / 0.6, 1);
          for (const pt of particles) {
            pt.x = pt.x + (pt._targetX - pt.x) * partP * 0.1;
            pt.y = pt.y + (pt._targetY - pt.y) * partP * 0.1;
            pt.alpha = Math.max(0, 1 - partP);
          }

          // Glow pulse then decay
          glowFilter.outerStrength = 2 + 4 * Math.sin(t * Math.PI);
        },
        onComplete: () => {
          flyCard.filters = null;
          fxContainer.removeChild(ring);
          fxContainer.removeChild(spark);
          for (const pt of particles) {
            if (pt.parent) pt.parent.removeChild(pt);
          }
          if (fxContainer.parent) fxContainer.parent.removeChild(fxContainer);
          resolve();
        },
      });
    });
  }

  /** Fly card from center to trash zone. */
  _flyToTrash(flyCard, app, pid) {
    const trashZone = this.ctx.zoneManager.getZone(pid, 'trash');
    if (!trashZone) {
      return this._fadeOut(flyCard);
    }

    const trashCenter = trashZone.toGlobal(new PIXI.Point(trashZone.width / 2, trashZone.height / 2));
    const toPos = app.stage.toLocal(trashCenter);

    const fromX = flyCard.x;
    const fromY = flyCard.y;
    const duration = 400;

    return new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: duration / 1000,
        ease: 'sine.inOut',
        onUpdate: () => {
          const e = _p.t;
          flyCard.x = fromX + (toPos.x - fromX) * e;
          flyCard.y = fromY + (toPos.y - fromY) * e;
          flyCard.alpha = 1;
          const shrink = 2 - e * 1.0;  // 2 → 1 (normal trash size)
          flyCard.scale.set(shrink, shrink);
        },
        onComplete: () => {
          if (flyCard.parent) flyCard.parent.removeChild(flyCard);
          resolve();
        },
      });
    });
  }

  /** Create a dark overlay matching mulligan background style. */
  _createDarkOverlay(app) {
    const overlay = new PIXI.Graphics();
    overlay.name = 'damageTriggerDarkOverlay';
    overlay.rect(0, 0, app.screen.width, app.screen.height)
           .fill({ color: 0x000000 });
    overlay.alpha = 0.7;
    overlay.eventMode = 'none';
    return overlay;
  }

  /** Fade out and remove a display object. */
  _fadeOut(obj) {
    const duration = 300;
    return new Promise((resolve) => {
      gsap.to(obj, {
        alpha: 0,
        duration: duration / 1000,
        ease: 'none',
        onComplete: () => {
          if (obj.parent) obj.parent.removeChild(obj);
          resolve();
        },
      });
    });
  }

  /** Show dark overlay with Trigger/Pass buttons below the card. */
   _showDecisionOverlay(pid, card, flyCard, hasTrigger, sourceZoneId = 'deck') {
    return new Promise((resolve) => {
      const { app } = this.ctx;

      // Dark overlay behind everything except fly card (mulligan-style)
      const overlay = this._createDarkOverlay(app);
      if (overlay.parent) overlay.parent.removeChild(overlay);
      const flyIdx = app.stage.children.indexOf(flyCard);
      app.stage.addChildAt(overlay, Math.max(0, flyIdx));

      // Track button elements for trigger cleanup
      let _triggerBg, _triggerText, _passBg, _passText;
      let _triggerHover, _passHover;

      const label = sourceZoneId === 'life' ? 'Life card' : 'Drawn';
      const scaledCardH = 140 * 0.95 * 2;
      // Prompt text above card
      const promptText = new PIXI.Text({
        text: hasTrigger
          ? `Taking damage! ${label}: ${card.name}\nThis card has a Trigger ability.`
          : `Taking damage! ${label}: ${card.name}`,
        style: {
          fontSize: 24,
          fill: 0xffffff,
          fontFamily: 'Russo One',
          align: 'center',
        },
      });
      promptText.name = 'damageTriggerDecisionPrompt';
      promptText.anchor.set(0.5, 1);
      promptText.position.set(app.screen.width / 2, flyCard.y - scaledCardH / 2 - 30);
      promptText.alpha = 0;
      promptText.eventMode = 'none';
      app.stage.addChild(promptText);

      // Fade in prompt text (GSAP)
      gsap.to(promptText, { alpha: 1, duration: 0.3, ease: 'none', onComplete: () => setupButtons() });

      // Button dimensions
      const btnW = 180, btnH = 48;
      const totalW = btnW * 2 + 20;
      const startX = app.screen.width / 2 - totalW / 2;
      const btnY = flyCard.y + scaledCardH / 2 + 30;

      // Trigger button
      _triggerBg = new PIXI.Graphics();
      _triggerBg.name = 'damageTriggerBtnBg';
      _triggerBg.roundRect(0, 0, btnW, btnH, 10)
              .fill({ color: hasTrigger ? 0x4CAF50 : 0x555555 });
      _triggerBg.position.set(startX, btnY);
      _triggerBg.alpha = 0;

      _triggerText = new PIXI.Text({
        text: 'Trigger',
        style: {
          fontSize: 18,
          fill: hasTrigger ? 0xffffff : 0x999999,
          fontFamily: 'Russo One',
        },
      });
      _triggerText.name = 'damageTriggerBtnText';
      _triggerText.anchor.set(0.5);
      _triggerText.position.set(startX + btnW / 2, btnY + btnH / 2);
      _triggerText.alpha = 0;
      _triggerText.eventMode = 'none';

      // Pass button
      _passBg = new PIXI.Graphics();
      _passBg.name = 'damagePassBtnBg';
      _passBg.roundRect(0, 0, btnW, btnH, 10)
            .fill({ color: 0xff9800 });
      _passBg.position.set(startX + btnW + 20, btnY);
      _passBg.alpha = 0;

      _passText = new PIXI.Text({
        text: 'Pass',
        style: { fontSize: 18, fill: 0xffffff, fontFamily: 'Russo One' },
      });
      _passText.name = 'damagePassBtnText';
      _passText.anchor.set(0.5);
      _passText.position.set(startX + btnW + 20 + btnW / 2, btnY + btnH / 2);
      _passText.alpha = 0;

      // Hover highlights
      _triggerHover = new PIXI.Graphics();
      _triggerHover.name = 'damageTriggerBtnHover';
      _triggerHover.roundRect(0, 0, btnW, btnH, 10)
                 .fill({ color: 0xffffff });
      _triggerHover.position.set(startX, btnY);
      _triggerHover.alpha = 0;
      _triggerHover.eventMode = 'none';

      _passHover = new PIXI.Graphics();
      _passHover.name = 'damagePassBtnHover';
      _passHover.roundRect(0, 0, btnW, btnH, 10)
               .fill({ color: 0xffffff });
      _passHover.position.set(startX + btnW + 20, btnY);
      _passHover.alpha = 0;
      _passHover.eventMode = 'none';

      const setupButtons = () => {
        app.stage.addChild(_triggerHover);
        app.stage.addChild(_passHover);
        app.stage.addChild(_triggerBg);
        app.stage.addChild(_triggerText);
        app.stage.addChild(_passBg);
        app.stage.addChild(_passText);

        // Fade in buttons (GSAP)
        const _p = { a: 0 };
        gsap.to(_p, {
          a: 1,
          duration: 0.25,
          ease: 'none',
          onUpdate: () => {
            _triggerBg.alpha = _p.a;
            _triggerText.alpha = _p.a;
            _passBg.alpha = _p.a;
            _passText.alpha = _p.a;
          },
        });

        // Hover on fly card: show card info panel
        flyCard.eventMode = 'static';
        flyCard.cursor = 'pointer';
        flyCard.on('pointerover', () => { this.ctx.ui.showCardInfo(card, pid); });
        flyCard.on('pointerout', () => { const p = document.getElementById('card-info-panel'); if (p) p.innerHTML = ''; });

        // Only make Trigger button interactive if card has trigger
        if (hasTrigger) {
          _triggerBg.eventMode = 'static';
          _triggerBg.cursor = 'pointer';
          _triggerBg.on('pointerover', () => { _triggerHover.alpha = 0.15; });
          _triggerBg.on('pointerout', () => { _triggerHover.alpha = 0; });
        }

        // Pass button always interactive
        _passBg.eventMode = 'static';
        _passBg.cursor = 'pointer';
        _passBg.on('pointerover', () => { _passHover.alpha = 0.15; });
        _passBg.on('pointerout', () => { _passHover.alpha = 0; });

        // Click handlers
        if (hasTrigger) {
          _triggerBg.on('pointerdown', () => {
            _cleanupButtons();
            resolve({ played: true, overlay, promptText });
          });
        }
        _passBg.on('pointerdown', () => { cleanup(); resolve({ played: false }); });
      };

      const _cleanupButtons = () => {
        flyCard.off('pointerover');
        flyCard.off('pointerout');
        flyCard.eventMode = 'none';
        if (_triggerHover.parent) _triggerHover.parent.removeChild(_triggerHover);
        if (_passHover.parent) _passHover.parent.removeChild(_passHover);
        if (_triggerBg.parent) {
          _triggerBg.off('pointerover');
          _triggerBg.off('pointerout');
          _triggerBg.off('pointerdown');
          _triggerBg.parent.removeChild(_triggerBg);
        }
        if (_triggerText.parent) _triggerText.parent.removeChild(_triggerText);
        if (_passBg.parent) {
          _passBg.off('pointerover');
          _passBg.off('pointerout');
          _passBg.off('pointerdown');
          _passBg.parent.removeChild(_passBg);
        }
        if (_passText.parent) _passText.parent.removeChild(_passText);
      };

      const cleanup = () => {
        _cleanupButtons();
        if (overlay.parent) overlay.parent.removeChild(overlay);
        if (promptText.parent) promptText.parent.removeChild(promptText);
      };
    });
  }

  /** Fly card from center to hand position, shifting existing sprites. */
  async _flyToHand(pid, player, flyCard, centerPos, cardW, cardH) {
    const { app, zoneManager, handRenderer } = this.ctx;
    const handZone = zoneManager.getZone(pid, 'hand');

    // Compute layout with the new card already in hand (inserted by caller before this)
    const insertIdx = player.hand.length - 1;
    const layout = handRenderer.computeLayout(handZone, player.hand.length);
    if (!layout) return;

    const targetPos = layout.positions[insertIdx] || layout.positions[layout.positions.length - 1];
    const handC = handZone.toGlobal(new PIXI.Point(targetPos.x + cardW / 2, targetPos.y + cardH / 2));
    const toPos = app.stage.toLocal(handC);

    // Get old sprite positions
    const oldSprites = handRenderer.handSprites[pid] || [];
    const oldPositions = oldSprites.map(s => s ? { x: s.position.x, y: s.position.y } : null);

    // Compute new positions for existing sprites (they shift to make room)
    const spriteTargets = [];
    for (let i = 0; i < oldSprites.length; i++) {
      const newPos = layout.positions[i] || layout.positions[layout.positions.length - 1];
      spriteTargets.push({
        sprite: oldSprites[i],
        from: oldPositions[i] || newPos,
        to: newPos,
      });
    }

    // Animate fly card + shift sprites (GSAP proxy)
    const duration = 500;

    await new Promise((resolve) => {
      const _p = { t: 0 };
      gsap.to(_p, {
        t: 1,
        duration: duration / 1000,
        ease: 'sine.inOut',
        onUpdate: () => {
          const e = _p.t;
          flyCard.x = centerPos.x + (toPos.x - centerPos.x) * e;
          flyCard.y = centerPos.y + (toPos.y - centerPos.y) * e;
          flyCard.scale.set(2 - e * 1.05, 2 - e * 1.05);

          for (const st of spriteTargets) {
            if (!st.sprite || !st.sprite.parent) continue;
            st.sprite.position.x = st.from.x + (st.to.x - st.from.x) * e;
            st.sprite.position.y = st.from.y + (st.to.y - st.from.y) * e;
          }
        },
        onComplete: () => {
          // Cleanup fly card and re-render hand with the new card
          if (flyCard.parent) flyCard.parent.removeChild(flyCard);
          handRenderer.render(pid);
          resolve();
        },
      });
    });
  }
}
