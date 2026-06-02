import { easeOutCubic, easeInOut } from './utils';
import { Animator } from '../Animator';

const DON_TOKEN_SIZE = 36; // matches ZoneRenderer.DON_TOKEN_SIZE

export default class DONSlamAnimation {
  static requires = ['app', 'zoneManager', 'zoneRenderer', 'players'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate a DON token slamming onto the cost area.
   * The DON drops from above, impacts with screen shake + slamFlashGraphics, then bounces into place.
   * Renders the updated cost tokens after animation completes.
   *
   * @param {number} pid - Player ID (1 or 2)
   * @param {number} [visibleCount] - Number of DONs to render (during DON phase animation)
   * @returns {Promise<void>}
   */
  async animate(pid, visibleCount) {
    const { app, zoneManager, zoneRenderer, players } = this.ctx;
    const costZone = zoneManager.getZone(pid, 'cost');
    if (!costZone) return;

    const p = players[pid];
    if (p.costArea.length === 0) return;

    // Calculate target position for the newest DON token
    const tokenW = DON_TOKEN_SIZE;
    const gap = 10;
    const numTokens = Math.max(p.costArea.length, 10);
    const totalW = numTokens * tokenW + (numTokens - 1) * gap;
    const startX = (costZone.width - totalW) / 2;
    const yOff = (40 - DON_TOKEN_SIZE) / 2; // cost zone height is 40

    const newestIdx = p.costArea.length - 1;
    const targetX = startX + newestIdx * (tokenW + gap) + tokenW / 2;
    const targetY = yOff + tokenW / 2;

    // Convert target position to global coordinates so we can add sprite to stage
    const targetGlobal = costZone.toGlobal(new PIXI.Point(targetX, targetY));

    // Create DON ghost sprite on stage (not inside cost zone, to avoid expanding zone bounds)
    const donSlamSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donSlamSprite.name = 'donSlamSprite';
    donSlamSprite.anchor.set(0.5);
    donSlamSprite.width = tokenW;
    donSlamSprite.height = tokenW;
    const baseScale = donSlamSprite.scale.x;
    donSlamSprite.alpha = 0;
    donSlamSprite.eventMode = 'none';
    app.stage.addChild(donSlamSprite);

    // Flash overlay on stage
    const slamFlashGraphics = new PIXI.Graphics();
    slamFlashGraphics.name = 'donSlamFlash';
    slamFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
          .fill({ color: 0xffd700, alpha: 0 });
    slamFlashGraphics.eventMode = 'none';
    app.stage.addChildAt(slamFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    // Animation phases: fade-in with scale down, then shake
    const fadeInDur = 80;
    const shakeDur = 120;
    const total = fadeInDur + shakeDur;

    await Animator.animate({
      duration: total,
      easing: 'linear',
      onUpdate: (t) => {
        donSlamSprite.x = targetGlobal.x;
        donSlamSprite.y = targetGlobal.y;

        if (t < fadeInDur / total) {
          // Phase 1: Fade in at final position, scale from 2x → 1x, alpha 0→1
          const phaseT = t / (fadeInDur / total);
          donSlamSprite.alpha = phaseT;
          const currentScale = baseScale * (2 - phaseT);
          donSlamSprite.scale.set(currentScale);

          slamFlashGraphics.alpha = 0;
          app.stage.position.x = origStageX;
          app.stage.position.y = origStageY;
        } else {
          // Phase 2: Shake effect with decay
          const phaseT = (t - fadeInDur / total) / (shakeDur / total);
          const decay = Math.pow(1 - phaseT, 2);

          donSlamSprite.alpha = 1;
          donSlamSprite.scale.set(baseScale);

          slamFlashGraphics.alpha = 0.3 * decay;

          app.stage.position.x = origStageX + (Math.random() - 0.5) * 10 * decay;
          app.stage.position.y = origStageY + (Math.random() - 0.5) * 10 * decay;
        }
      },
      onComplete: () => {
        app.stage.position.x = origStageX;
        app.stage.position.y = origStageY;
        slamFlashGraphics.clear();

        // Remove ghost and slamFlashGraphics from scene graph
        if (donSlamSprite.parent) donSlamSprite.parent.removeChild(donSlamSprite);
        if (slamFlashGraphics.parent) slamFlashGraphics.parent.removeChild(slamFlashGraphics);

        // Render cost tokens synchronously so subsequent animations (e.g. DONRest)
        // see the correct number of sprites when querying the zone.
        zoneRenderer.renderCostTokens(pid, false, null, visibleCount);
      },
    }).toPromise();
  }

  /**
   * Lightweight slam without re-rendering (for DON phase where render is handled separately).
   * @param {number} pid - Player ID
   * @returns {Promise<void>}
   */
  async animateLightweight(pid) {
    const { app, zoneManager, players } = this.ctx;
    const costZone = zoneManager.getZone(pid, 'cost');
    if (!costZone) return;

    const p = players[pid];
    if (p.costArea.length === 0) return;

    const tokenW = DON_TOKEN_SIZE;
    const gap = 10;
    const numTokens = Math.max(p.costArea.length, 10);
    const totalW = numTokens * tokenW + (numTokens - 1) * gap;
    const startX = (costZone.width - totalW) / 2;
    const yOff = (40 - DON_TOKEN_SIZE) / 2; // cost zone height is 40

    const newestIdx = p.costArea.length - 1;
    const targetX = startX + newestIdx * (tokenW + gap) + tokenW / 2;
    const targetY = yOff + tokenW / 2;

    // Convert target position to global coordinates so we can add sprite to stage
    const targetGlobal = costZone.toGlobal(new PIXI.Point(targetX, targetY));

    // Create DON ghost sprite on stage (not inside cost zone, to avoid expanding zone bounds)
    const donSlamSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donSlamSprite.name = 'donSlamSpriteLightweight';
    donSlamSprite.anchor.set(0.5);
    donSlamSprite.width = tokenW;
    donSlamSprite.height = tokenW;
    const baseScale = donSlamSprite.scale.x;
    donSlamSprite.alpha = 0;
    donSlamSprite.eventMode = 'none';
    app.stage.addChild(donSlamSprite);

    // Flash overlay on stage
    const slamFlashGraphics = new PIXI.Graphics();
    slamFlashGraphics.name = 'donSlamFlashLightweight';
    slamFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
          .fill({ color: 0xffd700, alpha: 0 });
    slamFlashGraphics.eventMode = 'none';
    app.stage.addChildAt(slamFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    const dropDur = 500;
    const impactDur = 160;
    const bounceDur = 600;
    const total = dropDur + impactDur + bounceDur;

    await Animator.animate({
      duration: total,
      easing: 'linear',
      onUpdate: (t) => {
        if (t < dropDur / total) {
          const phaseT = t / (dropDur / total);
          const e = easeInOut(phaseT);
          donSlamSprite.x = targetGlobal.x;
          donSlamSprite.y = targetGlobal.y - 200 * (1 - e);
          donSlamSprite.alpha = Math.min(phaseT / 0.15, 1);
          donSlamSprite.scale.set(baseScale * (0.3 + e * 0.7));
          slamFlashGraphics.alpha = 0;
        } else if (t < (dropDur + impactDur) / total) {
          const phaseT = (t - dropDur / total) / (impactDur / total);
          donSlamSprite.x = targetGlobal.x;
          donSlamSprite.y = targetGlobal.y;
          donSlamSprite.alpha = 1;
          const squash = 1 + Math.sin(phaseT * Math.PI) * 0.2;
          donSlamSprite.scale.set(baseScale * 1.3 * squash, baseScale * (1 - 0.15 * Math.sin(phaseT * Math.PI)) * squash);
          slamFlashGraphics.alpha = 0.4 * (1 - phaseT);
          app.stage.position.x = origStageX + (Math.random() - 0.5) * 12;
          app.stage.position.y = origStageY + (Math.random() - 0.5) * 12;
        } else {
          const phaseT = (t - (dropDur + impactDur) / total) / (bounceDur / total);
          const decay = Math.pow(1 - phaseT, 2);
          donSlamSprite.x = targetGlobal.x;
          donSlamSprite.y = targetGlobal.y;
          donSlamSprite.alpha = 1;
          const bounceAngle = phaseT * Math.PI * 4;
          const scaleBounce = 1 + Math.sin(bounceAngle) * decay * 0.08;
          donSlamSprite.scale.set(baseScale * scaleBounce, baseScale * scaleBounce);
          slamFlashGraphics.alpha = Math.max(0, 0.2 * (1 - phaseT * 3));
          const shakeDecay = Math.pow(1 - phaseT, 2);
          app.stage.position.x = origStageX + (Math.random() - 0.5) * 6 * shakeDecay;
          app.stage.position.y = origStageY + (Math.random() - 0.5) * 6 * shakeDecay;
        }
      },
      onComplete: () => {
        donSlamSprite.width = DON_TOKEN_SIZE;
        donSlamSprite.height = DON_TOKEN_SIZE;
        app.stage.position.x = origStageX;
        app.stage.position.y = origStageY;
        slamFlashGraphics.clear();
        if (donSlamSprite.parent) donSlamSprite.parent.removeChild(donSlamSprite);
        if (slamFlashGraphics.parent) slamFlashGraphics.parent.removeChild(slamFlashGraphics);
      },
    }).toPromise();
  }
}
