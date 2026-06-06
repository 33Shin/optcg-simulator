import { gsap } from 'gsap';
import { makeFlyCard, getDisplayTexture } from './utils';

export default class EventPlayAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Event card play animation:
   * 1. Ghost card flies from hand to center of screen
   * 2. Glows with cyan VFX (ring, spark, particles)
   * 3. Flies from center to trash zone and fades
   * @param {number} pid - Player ID
   * @param {object} card - Event card being played
   * @param {PIXI.Point} handGlobalPos - Global position of the card in hand
   * @returns {Promise<void>}
   */
  animate(pid, card, handGlobalPos) {
    return new Promise((resolve) => {
      const { app, zoneManager } = this.ctx;
      if (!app) { resolve(); return; }

      const trashZone = zoneManager.getZone(pid, 'trash');

      const cardW = 100, cardH = 140;
      const displayTexture = getDisplayTexture(pid, card);
      const ghost = makeFlyCard(displayTexture, card, cardW, cardH);
      ghost.name = 'eventPlayGhost';
      ghost.eventMode = 'none';

      const handPos = app.stage.toLocal(handGlobalPos || new PIXI.Point(app.screen.width / 2, app.screen.height - 100));
      const centerX = app.screen.width / 2;
      const centerY = app.screen.height / 2;

      let trashPos = null;
      if (trashZone) {
        const trashCenter = trashZone.toGlobal(new PIXI.Point(trashZone.width / 2, trashZone.height / 2));
        trashPos = app.stage.toLocal(trashCenter);
      }
      if (!trashPos) {
        trashPos = new PIXI.Point(centerX, centerY + 100);
      }

      ghost.x = handPos.x;
      ghost.y = handPos.y;
      ghost.alpha = 1;
      ghost.scale.set(1, 1);

      // Dark overlay
      const overlay = new PIXI.Graphics();
      overlay.name = 'eventPlayOverlay';
      overlay.rect(0, 0, app.screen.width, app.screen.height)
             .fill({ color: 0x000000 });
      overlay.alpha = 0;
      overlay.eventMode = 'none';
      app.stage.addChild(overlay);

      // VFX container
      const fxContainer = new PIXI.Container();
      fxContainer.name = 'eventPlayFx';
      fxContainer.eventMode = 'none';
      app.stage.addChild(fxContainer);

      app.stage.addChild(ghost);

      // Glow filter on ghost
      const glowFilter = new PIXI.filters.GlowFilter({
        distance: 20,
        outerStrength: 2,
        innerStrength: 0,
        color: 0x00ffff,
        quality: 0.2
      });
      ghost.filters = [glowFilter];

      // Spark at center
      const spark = new PIXI.Graphics();
      spark.name = 'eventPlaySpark';
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

      // Expanding ring
      const ring = new PIXI.Graphics();
      ring.name = 'eventPlayRing';
      ring.circle(0, 0, 50);
      ring.stroke({ width: 6, color: 0x00ffff, alpha: 1 });
      ring.x = centerX;
      ring.y = centerY;
      ring.blendMode = 'add';
      ring.alpha = 0;
      ring.scale.set(0.2);
      fxContainer.addChild(ring);

      // Border glow
      const border = new PIXI.Graphics();
      border.name = 'eventPlayBorder';
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

      // Particles
      const particles = [];
      for (let i = 0; i < 30; i++) {
        const p = new PIXI.Graphics();
        p.name = `eventPlayParticle_${i}`;
        p.circle(0, 0, 2 + Math.random() * 2);
        p.fill({ color: 0x00ffff });
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

      // Timing
      const flyInDur = 400;
      const glowDur = 600;
      const flyToTrashDur = 350;
      const total = flyInDur + glowDur + flyToTrashDur;

      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = proxy.t;

          // Phase 1: Fly to center
          if (t < flyInDur / total) {
            const p = t / (flyInDur / total);
            const e = 1 - Math.pow(1 - p, 3);

            ghost.x = handPos.x + (centerX - handPos.x) * e;
            ghost.y = handPos.y + (centerY - handPos.y) * e;
            ghost.alpha = 1;
            ghost.scale.set(1 + e * 1.2, 1 + e * 1.2);

            overlay.alpha = e * 0.85;

          // Phase 2: Glow VFX at center
          } else if (t < (flyInDur + glowDur) / total) {
            const raw = (t - flyInDur / total) / (glowDur / total);
            const p = Math.min(raw, 1);

            ghost.x = centerX;
            ghost.y = centerY;
            ghost.alpha = 1;
            ghost.scale.set(2.2, 2.2);

            // Spark fades in then out
            const sparkP = Math.min(p / 0.4, 1);
            spark.alpha = Math.max(0, 1 - sparkP);
            spark.scale.set(sparkP * 6);

            // Ring expands and fades
            const ringP = Math.min(p / 0.6, 1);
            ring.alpha = Math.max(0, 1 - ringP);
            ring.scale.set(0.2 + ringP * 2.5);

            // Border flash
            if (p < 0.2) {
              border.alpha = p / 0.2;
            } else {
              border.alpha = Math.max(0, 1 - (p - 0.2) / 0.6);
            }

            // Glow pulse
            glowFilter.outerStrength = 2 + 6 * Math.sin(p * Math.PI);

            // Particles fly out
            const partP = Math.min(p / 0.5, 1);
            for (const pt of particles) {
              pt.x = pt.x + (pt._targetX - pt.x) * partP * 0.1;
              pt.y = pt.y + (pt._targetY - pt.y) * partP * 0.1;
              pt.alpha = Math.max(0, 1 - partP);
            }

            overlay.alpha = 0.85;

          // Phase 3: Fly to trash
          } else {
            const p = (t - (flyInDur + glowDur) / total) / (flyToTrashDur / total);
            const e = p * p; // ease in

            ghost.x = centerX + (trashPos.x - centerX) * e;
            ghost.y = centerY + (trashPos.y - centerY) * e;
            ghost.alpha = Math.max(0, 1 - e);
            ghost.scale.set(2.2 - e * 1.2, 2.2 - e * 1.2);

            glowFilter.outerStrength = 2 * (1 - e);
            overlay.alpha = Math.max(0, 0.85 * (1 - e));
            fxContainer.alpha = Math.max(0, 1 - e);
          }
        },
        onComplete: () => {
          ghost.alpha = 0;
          overlay.alpha = 0;
          fxContainer.alpha = 0;
          if (ghost.parent) ghost.parent.removeChild(ghost);
          if (overlay.parent) overlay.parent.removeChild(overlay);
          if (fxContainer.parent) fxContainer.parent.removeChild(fxContainer);
          resolve();
        },
      });
    });
  }
}
