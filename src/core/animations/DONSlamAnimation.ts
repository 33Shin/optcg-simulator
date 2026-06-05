import { gsap } from 'gsap';

const DON_TOKEN_SIZE = 36;

export default class DONSlamAnimation {
  static requires = ['app', 'zoneManager', 'zoneRenderer', 'players'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  async animate(pid, visibleCount) {
    const { app, zoneManager, zoneRenderer, players } = this.ctx;
    const costZone = zoneManager.getZone(pid, 'cost');
    if (!costZone) return;

    const p = players[pid];
    if (p.costArea.length === 0) return;

    const tokenW = DON_TOKEN_SIZE;
    const gap = 10;
    const numTokens = Math.max(p.costArea.length, 10);
    const totalW = numTokens * tokenW + (numTokens - 1) * gap;
    const startX = (costZone.width - totalW) / 2;
    const yOff = (40 - DON_TOKEN_SIZE) / 2;

    const newestIdx = p.costArea.length - 1;
    const targetX = startX + newestIdx * (tokenW + gap) + tokenW / 2;
    const targetY = yOff + tokenW / 2;

    const targetGlobal = costZone.toGlobal(new PIXI.Point(targetX, targetY));

    const donSlamSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donSlamSprite.name = 'donSlamSprite';
    donSlamSprite.anchor.set(0.5);
    donSlamSprite.width = tokenW;
    donSlamSprite.height = tokenW;
    const baseScale = donSlamSprite.scale.x;
    donSlamSprite.alpha = 0;
    donSlamSprite.eventMode = 'none';
    app.stage.addChild(donSlamSprite);

    const slamFlashGraphics = new PIXI.Graphics();
    slamFlashGraphics.name = 'donSlamFlash';
    slamFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
          .fill({ color: 0xffd700, alpha: 0 });
    slamFlashGraphics.eventMode = 'none';
    app.stage.addChildAt(slamFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    // GSAP-driven animation: fadeIn (150ms) + shake (200ms)
    const fadeInDur = 150;
    const shakeDur = 200;
    const total = fadeInDur + shakeDur;

    await new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = proxy.t;
          donSlamSprite.x = targetGlobal.x;
          donSlamSprite.y = targetGlobal.y;

          if (t < fadeInDur / total) {
            const phaseT = t / (fadeInDur / total);
            donSlamSprite.alpha = phaseT;
            const currentScale = baseScale * (2 - phaseT);
            donSlamSprite.scale.set(currentScale);
            slamFlashGraphics.alpha = 0;
            app.stage.position.x = origStageX;
            app.stage.position.y = origStageY;
          } else {
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
          if (donSlamSprite.parent) donSlamSprite.parent.removeChild(donSlamSprite);
          if (slamFlashGraphics.parent) slamFlashGraphics.parent.removeChild(slamFlashGraphics);
          zoneRenderer.renderCostTokens(pid, false, null, visibleCount);
          resolve();
        },
      });
    });
  }

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
    const yOff = (40 - DON_TOKEN_SIZE) / 2;

    const newestIdx = p.costArea.length - 1;
    const targetX = startX + newestIdx * (tokenW + gap) + tokenW / 2;
    const targetY = yOff + tokenW / 2;

    const targetGlobal = costZone.toGlobal(new PIXI.Point(targetX, targetY));

    const donSlamSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donSlamSprite.name = 'donSlamSpriteLightweight';
    donSlamSprite.anchor.set(0.5);
    donSlamSprite.width = tokenW;
    donSlamSprite.height = tokenW;
    const baseScale = donSlamSprite.scale.x;
    donSlamSprite.alpha = 0;
    donSlamSprite.eventMode = 'none';
    app.stage.addChild(donSlamSprite);

    const slamFlashGraphics = new PIXI.Graphics();
    slamFlashGraphics.name = 'donSlamFlashLightweight';
    slamFlashGraphics.rect(0, 0, app.screen.width, app.screen.height)
          .fill({ color: 0xffd700, alpha: 0 });
    slamFlashGraphics.eventMode = 'none';
    app.stage.addChildAt(slamFlashGraphics, 0);

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    // GSAP-driven: drop (1000ms) + impact (320ms) + bounce (1200ms)
    const dropDur = 1000;
    const impactDur = 320;
    const bounceDur = 1200;
    const total = dropDur + impactDur + bounceDur;

    await new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = proxy.t;
          if (t < dropDur / total) {
            const phaseT = t / (dropDur / total);
            const e = phaseT < 0.5 ? 2 * phaseT * phaseT : 1 - Math.pow(-2 * phaseT + 2, 2) / 2;
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
          resolve();
        },
      });
    });
  }
}
