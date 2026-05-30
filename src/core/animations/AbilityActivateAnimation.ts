import { makeFlyCard } from './utils';

export default class AbilityActivateAnimation {
  static requires = ['app'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animate(pid, card, fieldSlot) {
    return new Promise((resolve) => {
      const { app } = this.ctx;
      if (!fieldSlot) { resolve(); return; }

      const cardW = 100, cardH = 140;
      const displayTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
      const ghost = makeFlyCard(displayTexture, card, cardW, cardH);

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
      app.stage.addChild(overlay);

      // FX container for activation effects
      const fxContainer = new PIXI.Container();
      fxContainer.eventMode = 'none';
      app.stage.addChild(fxContainer);

      // Ghost card on top
      app.stage.addChild(ghost);

      // --- Activation VFX elements ---

      // Card glow filter
      const glowFilter = new PIXI.filters.GlowFilter({
        distance: 20,
        outerStrength: 2,
        innerStrength: 0,
        color: 0x00ffff,
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

      // Light ring
      const ring = new PIXI.Graphics();
      ring.circle(0, 0, 50);
      ring.stroke({ width: 6, color: 0x00ffff, alpha: 1 });
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

      // Energy particles
      const particles = [];
      for (let i = 0; i < 40; i++) {
        const p = new PIXI.Graphics();
        p.circle(0, 0, 2 + Math.random() * 2);
        p.fill({ color: 0x00ffff });
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

      // Border activation glow
      const border = new PIXI.Graphics();
      border.roundRect(-250, -350, 500, 700, 24);
      border.stroke({ width: 8, color: 0x00ffff, alpha: 1 });
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

      const tick = (now) => {
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
            ghost.alpha = 0;
            overlay.alpha = 0;
            fxContainer.alpha = 0;
            if (ghost.parent) ghost.parent.removeChild(ghost);
            if (overlay.parent) overlay.parent.removeChild(overlay);
            if (fxContainer.parent) fxContainer.parent.removeChild(fxContainer);
            resolve();
            return;
          }
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    });
  }
}
