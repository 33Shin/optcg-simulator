import { gsap } from 'gsap';

class BlockerRestAnimation {
  static requires = ['app', 'renderer'];

  constructor(ctx) {
    this.ctx = ctx;
    this._tween = null;
    this._ghost = null;
    this._sprite = null;
  }

  /**
   * Animate a blocker card resting: lift up with scale, rotate to rest angle (90deg), slam down with bounce.
   * @param {PIXI.Container} sprite - The field card sprite to animate
   * @returns {Promise<void>}
   */
  animate(sprite) {
    if (!sprite || !sprite.parent) return Promise.resolve();

    const { app, renderer } = this.ctx;
    const gp = sprite.getGlobalPosition() || new PIXI.Point(0, 0);
    const sp = app.stage.toLocal(gp) || new PIXI.Point(gp.x, gp.y);
    const origX = sp.x;
    const origY = sp.y;
    const origRotation = sprite.rotation;
    const origScale = sprite.scale.x;
    const liftDistance = 40;
    const slamOvershoot = 12;
    const bounceCount = 3;
    const restAngle = Math.PI / 2;

    this._sprite = sprite;
    this._ghost = null;

    const cardRef = sprite.cardRef;
    let ghost;
    if (cardRef && renderer) {
      ghost = renderer.render(cardRef, false, 1.0);
    } else {
      ghost = new PIXI.Container();
      ghost.name = 'blockerRestGhostFallback';
      const child0 = sprite.children[0];
      if (child0 && child0.clone) {
        const copy = child0.clone();
        if (copy) ghost.addChild(copy);
      }
    }
    this._ghost = ghost;
    ghost.pivot.set(sprite.pivot.x, sprite.pivot.y);
    ghost.position.set(origX, origY);
    ghost.scale.copyFrom(sprite.scale);
    ghost.rotation = sprite.rotation;
    ghost.alpha = 1;
    ghost.eventMode = 'none';
    app.stage.addChild(ghost);

    sprite.visible = false;

    const liftDur = 350;
    const slamDur = 90;
    const impactDur = 40;
    const bounceDur = 350;
    const shakeIntensity = 10;
    const total = liftDur + slamDur + impactDur + bounceDur;

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    return new Promise((resolve) => {
      const _p = { t: 0 };
      this._tween = gsap.to(_p, {
        t: 1,
        duration: total / 1000,
        ease: 'none',
        onUpdate: () => {
          const t = _p.t;

          if (t < liftDur / total) {
            const p = t / (liftDur / total);
            const e = 1 - Math.pow(1 - p, 3);
            ghost.position.y = origY - liftDistance * e;
            ghost.scale.set(origScale * (1 + 0.3 * e), origScale * (1 + 0.3 * e));
            ghost.rotation = origRotation + (restAngle - origRotation) * e;
          }
          else if (t < (liftDur + slamDur) / total) {
            const p = (t - liftDur / total) / (slamDur / total);
            const e = p * p * p;
            ghost.position.y = origY - liftDistance + (liftDistance + slamOvershoot) * e;
            ghost.scale.set(
              origScale * 1.3 - e * 0.3,
              origScale * 1.3 - e * 0.3
            );
          }
          else if (t < (liftDur + slamDur + impactDur) / total) {
            ghost.scale.set(origScale * 1.15, origScale * 0.85);
            ghost.position.y = origY + slamOvershoot * 0.1;
            app.stage.position.x = origStageX + (Math.random() - 0.5) * shakeIntensity * 2.5;
            app.stage.position.y = origStageY + (Math.random() - 0.5) * shakeIntensity * 2.5;
          }
          else {
            const p = (t - (liftDur + slamDur + impactDur) / total) / (bounceDur / total);
            const decay = Math.pow(1 - p, 2);

            const angle = p * Math.PI * bounceCount * 2;
            const scaleBounce = 1 + Math.sin(angle) * decay * 0.08;
            ghost.position.y = origY;
            ghost.scale.set(origScale * scaleBounce, origScale * scaleBounce);

            const shakeDecay = Math.pow(1 - Math.min(p, 1), 1.5) * (300 / bounceDur);
            const effectiveShake = shakeIntensity * Math.max(0, shakeDecay);
            app.stage.position.x = origStageX + (Math.random() - 0.5) * effectiveShake;
            app.stage.position.y = origStageY + (Math.random() - 0.5) * effectiveShake;
          }
        },
        onComplete: () => {
          ghost.position.set(origX, origY);
          ghost.rotation = restAngle;
          ghost.scale.set(origScale, origScale);
          app.stage.position.x = origStageX;
          app.stage.position.y = origStageY;

          if (ghost.parent) ghost.parent.removeChild(ghost);
          sprite.visible = true;
          sprite.rotation = restAngle;
          this._tween = null;
          this._ghost = null;
          this._sprite = null;
          resolve();
        },
      });
    });
  }

  /** Cancel in-flight blocker rest animation. */
  cancel() {
    if (this._tween) {
      this._tween.kill();
      this._tween = null;
    }
    if (this._ghost && this._ghost.parent) {
      this._ghost.parent.removeChild(this._ghost);
      this._ghost = null;
    }
    if (this._sprite) {
      this._sprite.visible = true;
      this._sprite = null;
    }
  }
}

export default BlockerRestAnimation;
