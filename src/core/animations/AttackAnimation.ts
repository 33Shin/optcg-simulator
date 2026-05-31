import { makeFlyCard, easeOutCubic, easeInOut } from './utils';

const cardW = 100;
const cardH = 140;

function generateLightningSegments(startX, startY, endX, endY, steps, roughness) {
  const segments = [];
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / len;
  const ny = dy / len;
  const px = -ny;
  const py = nx;
  let cx = startX;
  let cy = startY;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tx = startX + dx * t;
    const ty = startY + dy * t;
    const offset = roughness * (1 - Math.abs(t - 0.5) * 2) * (Math.random() - 0.5) * 2;
    cx = tx + px * offset;
    cy = ty + py * offset;
    segments.push({ x: cx, y: cy });
  }
  return segments;
}

function lungeRotation(dx, dy) {
  return Math.atan2(dy, dx) + Math.PI / 2;
}

export default class AttackAnimation {
  static requires = ['app', 'zoneManager', 'players'];

  constructor(ctx) {
    this.ctx = ctx;
    this._attackAnimState = null;
    this._floatTicker = null;
    this._floatTime = 0;
    this._onCleanupDone = null;
  }

  /** Set a callback to run immediately after attack animation cleanup (ghost removed). */
  setOnCleanupDone(cb) {
    this._onCleanupDone = cb;
  }

  _setupAttackAnimElements(pid, attacker, attackerZone, target, targetZone) {
    const { app, zoneManager, players } = this.ctx;
    if (!attackerZone || !targetZone) return null;

    const atkCenter = attackerZone.toGlobal(
      new PIXI.Point(attackerZone.width / 2, attackerZone.height / 2)
    );
    const defCenter = targetZone.toGlobal(
      new PIXI.Point(targetZone.width / 2, targetZone.height / 2)
    );
    const atkPos = app.stage.toLocal(atkCenter);
    const defPos = app.stage.toLocal(defCenter);

    const targetPid = (pid === 1 ? 2 : 1);
    const isAtkLeader = attacker.isLeader || attacker === players[pid].leader;
    const isTgtLeader = target.isLeader || target === players[targetPid].leader;

    const atkW = isAtkLeader ? cardW * 1.5 : cardW;
    const atkH = isAtkLeader ? cardH * 1.5 : cardH;
    const atkTexture = attacker.imgPath
      ? PIXI.Texture.from(attacker.imgPath)
      : (pid === 2 ? PIXI.Texture.from('assets/imgs/back.webp') : null);
    const attackerFlyCard = makeFlyCard(atkTexture, attacker, atkW, atkH);
    attackerFlyCard.name = 'attackerFlyCard';
    attackerFlyCard.position.copyFrom(atkPos);
    attackerFlyCard.alpha = 0; // Start invisible, shown when lift animation begins
    app.stage.addChild(attackerFlyCard);

    // Power text overlay (matches CardRenderer.setPowerBadge style)
    const effectivePower = (attacker.currentPower || attacker.power || 0) + (attacker._counterBoost || 0);
    const powerText = new PIXI.Text({
      text: String(effectivePower),
      style: {
        fontSize: isAtkLeader ? 45 : 30,
        fill: attacker.donAttached > 0 ? 0xffd700 : 0xffffff,
        stroke: { color: 0x000000, width: 4 },
        fontFamily: 'Russo One',
      },
    });
    powerText.anchor.set(0.5, 1);
    powerText.position.set(atkW / 2, atkH + 2);
    powerText.name = 'attackPowerText';
    attackerFlyCard.addChild(powerText);

    const screenFlashGraphics = new PIXI.Graphics();
    screenFlashGraphics.name = 'attackScreenFlash';
    screenFlashGraphics.eventMode = 'none';
    screenFlashGraphics.alpha = 0;
    app.stage.addChildAt(screenFlashGraphics, 0);

    const impactBurstGraphics = new PIXI.Graphics();
    impactBurstGraphics.name = 'impactBurst';
    impactBurstGraphics.eventMode = 'none';
    impactBurstGraphics.alpha = 0;
    impactBurstGraphics.position.copyFrom(defPos);
    app.stage.addChildAt(impactBurstGraphics, 0);

    const shockwaveRings = [];
    for (let i = 0; i < 5; i++) {
      const shockwaveRing = new PIXI.Graphics();
      shockwaveRing.name = `shockwaveRing_${i}`;
      shockwaveRing.eventMode = 'none';
      shockwaveRing.alpha = 0;
      shockwaveRing.position.copyFrom(defPos);
      app.stage.addChild(shockwaveRing);
      shockwaveRings.push(shockwaveRing);
    }

    const impactParticles = [];
    const numParticles = 24;
    for (let i = 0; i < numParticles; i++) {
      const particleGraphics = new PIXI.Graphics();
      particleGraphics.name = `impactParticle_${i}`;
      particleGraphics.eventMode = 'none';
      particleGraphics.alpha = 0;
      particleGraphics.position.copyFrom(defPos);
      app.stage.addChild(particleGraphics);
      impactParticles.push(particleGraphics);
    }

    const fireSparks = [];
    const sparkData = [];
    const numSparks = 60;
    for (let i = 0; i < numSparks; i++) {
      const sparkGraphics = new PIXI.Graphics();
      sparkGraphics.name = `fireSpark_${i}`;
      sparkGraphics.eventMode = 'none';
      sparkGraphics.alpha = 0;
      app.stage.addChild(sparkGraphics);
      fireSparks.push(sparkGraphics);
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 350;
      const size = 1.5 + Math.random() * 3;
      const life = 0.3 + Math.random() * 0.7;
      const grav = 80 + Math.random() * 120;
      const color = [0xff4400, 0xff6600, 0xffaa00, 0xffcc00, 0xff2200, 0xff8800][Math.floor(Math.random() * 6)];
      sparkData.push({ angle, speed, size, life, grav, color, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 100 });
    }

    const glowAuraGraphics = new PIXI.Graphics();
    glowAuraGraphics.name = 'glowAura';
    glowAuraGraphics.eventMode = 'none';
    glowAuraGraphics.alpha = 0;
    glowAuraGraphics.position.copyFrom(defPos);
    app.stage.addChildAt(glowAuraGraphics, 0);

    const lightningBolts = [];
    for (let i = 0; i < 6; i++) {
      const lightningGraphics = new PIXI.Graphics();
      lightningGraphics.name = `lightningBolt_${i}`;
      lightningGraphics.eventMode = 'none';
      lightningGraphics.alpha = 0;
      app.stage.addChild(lightningGraphics);
      lightningBolts.push(lightningGraphics);
    }

    const origStageX = app.stage.position.x;
    const origStageY = app.stage.position.y;

    const dx = defPos.x - atkPos.x;
    const dy = defPos.y - atkPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    const attackRotation = lungeRotation(defPos.x - atkPos.x, defPos.y - atkPos.y);
    const tgtH = isTgtLeader ? cardH * 1.5 : cardH;
    const impactX = defPos.x - nx * (tgtH / 2);
    const impactY = defPos.y - ny * (tgtH / 2);

    const attackerFieldSprite = attackerZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);

    return {
      app, atkPos, defPos, pid, targetPid, isAtkLeader, isTgtLeader,
      attackerFlyCard, screenFlashGraphics, impactBurstGraphics,
      shockwaveRings, impactParticles, fireSparks, sparkData, numParticles, numSparks,
      glowAuraGraphics, lightningBolts, origStageX, origStageY,
      nx, ny, attackRotation, impactX, impactY, attackerFieldSprite, targetZone,
    };
  }

  async animateLiftAndRotate(pid, attacker, attackerZone, target, targetZone) {
    const state = this._setupAttackAnimElements(pid, attacker, attackerZone, target, targetZone);
    if (!state) return null;
    this._attackAnimState = state;

    // Ghost stays invisible until lift tick loop starts moving it
    const liftDur = 350;
    const start = performance.now();

    await new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - start;
        if (elapsed < liftDur) {
          const p = elapsed / liftDur;
          const e = easeOutCubic(p);
          state.attackerFlyCard.alpha = 1;
          state.attackerFlyCard.scale.set(1 + 0.4 * e, 1 + 0.4 * e);
          state.attackerFlyCard.rotation = state.attackRotation * e;
          requestAnimationFrame(tick);
        } else {
          state.attackerFlyCard.scale.set(1.4, 1.4);
          state.attackerFlyCard.rotation = state.attackRotation;
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });

    // Start floating animation on held card during counter phase
    this._startFloatAnimation(state);

    return this._attackAnimState;
  }

  _startFloatAnimation(state) {
    this._floatTime = 0;
    this._floatTicker = (ticker) => {
      this._floatTime += ticker.deltaMS / 1000;
      const bobAmount = 8;
      const bobSpeed = 3.5 / 1.5;
      const offset = Math.sin(this._floatTime * bobSpeed) * bobAmount;
      state.attackerFlyCard.x = state.atkPos.x + state.nx * offset;
      state.attackerFlyCard.y = state.atkPos.y + state.ny * offset;
    };
    state.app.ticker.add(this._floatTicker);
  }

  _stopFloatAnimation() {
    if (this._floatTicker) {
      this.ctx.app.ticker.remove(this._floatTicker);
      this._floatTicker = null;
    }
  }

  /**
   * Rotate attacker fly card toward a new target after blocker redirects.
   * @param {object} newTarget - The blocker character that becomes the new target
   * @returns {Promise<void>}
   */
  async animateRetarget(newTarget) {
    const state = this._attackAnimState;
    if (!state || !newTarget) return;

    const { app, zoneManager, players } = this.ctx;
    const newTargetZone = zoneManager.findZoneForCard(players, newTarget);
    if (!newTargetZone) return;

    // Compute new target position in stage space
    const newDefCenter = newTargetZone.toGlobal(
      new PIXI.Point(newTargetZone.width / 2, newTargetZone.height / 2)
    );
    const newDefPos = app.stage.toLocal(newDefCenter);

    const dx = newDefPos.x - state.atkPos.x;
    const dy = newDefPos.y - state.atkPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nnx = dx / dist;
    const nny = dy / dist;

    const newRotation = lungeRotation(newDefPos.x - state.atkPos.x, newDefPos.y - state.atkPos.y);
    const isTgtLeader = newTarget.isLeader || (state.targetPid && (newTarget === players[state.targetPid]?.leader));
    const tgtH = isTgtLeader ? cardH * 1.5 : cardH;
    const newImpactX = newDefPos.x - nnx * (tgtH / 2);
    const newImpactY = newDefPos.y - nny * (tgtH / 2);

    // Animate rotation and position shift toward new target
    const dur = 400;
    const start = performance.now();
    const oldRotation = state.attackRotation;
    const oldNx = state.nx;
    const oldNy = state.ny;
    const oldImpactX = state.impactX;
    const oldImpactY = state.impactY;

    await new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - start;
        const p = Math.min(elapsed / dur, 1);
        const e = easeInOut(p);

        // Interpolate rotation toward new target direction
        state.attackRotation = oldRotation + (newRotation - oldRotation) * e;
        state.attackerFlyCard.rotation = state.attackRotation;

        // Interpolate direction vector for bob animation
        state.nx = oldNx + (nnx - oldNx) * e;
        state.ny = oldNy + (nny - oldNy) * e;

        // Shift impact point toward new target
        state.impactX = oldImpactX + (newImpactX - oldImpactX) * e;
        state.impactY = oldImpactY + (newImpactY - oldImpactY) * e;

        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          // Update all target references for later attack phases
          state.defPos.copyFrom(newDefPos);
          state.targetZone = newTargetZone;
          // Reposition static effect graphics to new defender position
          for (const ring of state.shockwaveRings) ring.position.copyFrom(newDefPos);
          state.glowAuraGraphics.position.copyFrom(newDefPos);
          state.impactBurstGraphics.position.copyFrom(newDefPos);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  async continueAttackFromHeldState() {
    const state = this._attackAnimState;
    if (!state) return;

    // Stop floating animation before continuing attack
    this._stopFloatAnimation();

    const pullBackDur = 200;
    const slamDur = 120;
    const impactDur = 80;
    const bounceBackDur = 200;
    const shockDur = 500;
    const returnDur = 700;
    const totalAfterLift = pullBackDur + slamDur + impactDur + shockDur + returnDur;

    const start = performance.now();
    const afterImpactStart = pullBackDur + slamDur + impactDur;

    await new Promise((resolve) => {
      const tick = (now) => {
        const elapsed = now - start;

        // === Phase 2: Pull back ===
        if (elapsed < pullBackDur) {
          const p = easeInOut(elapsed / pullBackDur);
          state.attackerFlyCard.x = state.atkPos.x - state.nx * 100 * p;
          state.attackerFlyCard.y = state.atkPos.y - state.ny * 100 * p;
          state.attackerFlyCard.rotation = state.attackRotation;
          requestAnimationFrame(tick);
          return;
        }

        // === Phase 3: Slam ===
        if (elapsed < pullBackDur + slamDur) {
          const p = ((elapsed - pullBackDur) / slamDur) ** 2;
          const sx = state.atkPos.x - state.nx * 100;
          const sy = state.atkPos.y - state.ny * 100;
          state.attackerFlyCard.x = sx + (state.impactX - sx) * p;
          state.attackerFlyCard.y = sy + (state.impactY - sy) * p;
          state.attackerFlyCard.scale.set(1.4, 1.4);
          state.attackerFlyCard.rotation = state.attackRotation;
          requestAnimationFrame(tick);
          return;
        }

        // === Phase 4: Impact ===
        if (elapsed < afterImpactStart) {
          const p = (elapsed - pullBackDur - slamDur) / impactDur;
          state.attackerFlyCard.x = state.impactX;
          state.attackerFlyCard.y = state.impactY;
          state.attackerFlyCard.rotation = state.attackRotation;
          const squash = 1 + 0.5 * Math.sin(p * Math.PI);
          state.attackerFlyCard.scale.set(1.6 / squash, 1.6 * squash);

          const shakeAmt = 22 * (1 - p);
          state.app.stage.position.x = state.origStageX + (Math.random() - 0.5) * shakeAmt;
          state.app.stage.position.y = state.origStageY + (Math.random() - 0.5) * shakeAmt;

          state.screenFlashGraphics.clear();
          state.screenFlashGraphics.rect(0, 0, state.app.screen.width, state.app.screen.height)
            .fill({ color: 0xffffff, alpha: 0.85 * (1 - p) });
          state.screenFlashGraphics.alpha = 1;

          state.impactBurstGraphics.clear();
          const burstR = 10 + 60 * Math.sin(p * Math.PI);
          state.impactBurstGraphics.circle(0, 0, burstR).fill({ color: 0xffffaa, alpha: 0.9 * (1 - p) });
          state.impactBurstGraphics.circle(0, 0, burstR * 0.5).fill({ color: 0xffffff, alpha: 0.95 * (1 - p) });
          state.impactBurstGraphics.alpha = 1;

          for (let i = 0; i < 6; i++) {
            const g = state.lightningBolts[i];
            g.clear();
            const baseAngle = (Math.PI * 2 * i) / 6 + Math.sin(p * Math.PI) * 0.5;
            const dist = 120 + 80 * Math.sin(p * Math.PI);
            const segs = generateLightningSegments(0, 0, Math.cos(baseAngle) * dist, Math.sin(baseAngle) * dist, 8, 25 * (1 - p));
            const la = 0.8 * (1 - p);
            g.moveTo(segs[0].x, segs[0].y);
            for (let s = 1; s < segs.length; s++) g.lineTo(segs[s].x, segs[s].y);
            g.stroke({ width: 6, color: 0x445588, alpha: la * 0.4 });
            g.moveTo(segs[0].x, segs[0].y);
            for (let s = 1; s < segs.length; s++) g.lineTo(segs[s].x, segs[s].y);
            g.stroke({ width: 2, color: 0xaabbff, alpha: la * 1.2 });
            g.alpha = 1;
          }

          state.glowAuraGraphics.clear();
          const glowR = 40 + 80 * Math.sin(p * Math.PI);
          for (let r = glowR; r > 0; r -= 8) {
            const ga = 0.3 * (1 - p) * (1 - r / (glowR + 10));
            state.glowAuraGraphics.circle(0, 0, r).stroke({ width: 8, color: 0xff6600, alpha: ga });
          }
          state.glowAuraGraphics.alpha = 1;

          requestAnimationFrame(tick);
          return;
        }

        // === Phase 5: Bounce back + shockwave + sparks ===
        if (elapsed < afterImpactStart + shockDur) {
          const bounceElapsed = elapsed - afterImpactStart;
          const bounceP = Math.min(bounceElapsed / bounceBackDur, 1);
          const shockP = easeOutCubic(bounceElapsed / shockDur);

          state.attackerFlyCard.x = state.impactX - state.nx * easeOutCubic(bounceP) * 180;
          state.attackerFlyCard.y = state.impactY - state.ny * easeOutCubic(bounceP) * 180;
          state.attackerFlyCard.rotation = state.attackRotation;
          state.attackerFlyCard.scale.set(1.4 - 0.3 * easeOutCubic(bounceP), 1.4 - 0.3 * easeOutCubic(bounceP));

          for (let i = 0; i < state.shockwaveRings.length; i++) {
            const ring = state.shockwaveRings[i];
            const stagger = i * 0.08;
            const rp = Math.max(0, Math.min((shockP - stagger) / (1 - stagger), 1));
            ring.clear();
            const radius = rp * rp * 280;
            const thickness = Math.max(0.5, 6 * (1 - rp));
            const alpha = Math.max(0, (1 - rp * 1.2) * 0.8);
            ring.circle(0, 0, radius).stroke({ width: thickness, color: 0xffffff, alpha });
            if (radius > 10) {
              ring.circle(0, 0, radius * 0.92).stroke({ width: thickness * 0.3, color: 0xffffdd, alpha: alpha * 0.4 });
            }
            ring.alpha = 1;
          }

          for (let i = 0; i < state.numParticles; i++) {
            const g = state.impactParticles[i];
            const angle = (2 * Math.PI * i) / state.numParticles + 0.3 * shockP;
            const speed = (80 + 150 * easeOutCubic(shockP)) * (0.5 + 0.5 * ((i % 3) / 3));
            g.clear();
            g.position.set(state.defPos.x + Math.cos(angle) * speed, state.defPos.y + Math.sin(angle) * speed);
            const fadeOut = Math.max(0, 1 - shockP * shockP * 1.5);
            g.circle(0, 0, Math.max(0.5, 4 * fadeOut)).fill({ color: 0xffffcc, alpha: fadeOut * 0.9 });
            g.alpha = 1;
          }

          for (let i = 0; i < state.numSparks; i++) {
            const g = state.fireSparks[i];
            const sd = state.sparkData[i];
            const t = bounceElapsed / 1000;
            const sparkAlpha = Math.max(0, 1 - t / sd.life);
            if (sparkAlpha * sparkAlpha <= 0) continue;
            g.position.set(state.defPos.x + sd.vx * t, state.defPos.y + sd.vy * t + 0.5 * sd.grav * t * t - 20 * t);
            g.clear();
            g.rect(-sd.size * sparkAlpha, -sd.size * sparkAlpha, sd.size * 2 * sparkAlpha, sd.size * 3 * sparkAlpha)
              .fill({ color: sd.color, alpha: sparkAlpha * sparkAlpha * 0.9 });
            g.alpha = 1;
            g.rotation = t * 2;
          }

          for (let i = 0; i < 6; i++) {
            const g = state.lightningBolts[i];
            if (shockP > 0.45) { g.clear(); g.alpha = 0; continue; }
            g.clear();
            if (Math.random() > 0.15 + shockP * 0.3) continue;
            const baseAngle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
            const dist = 100 + 150 * (1 - shockP);
            const segs = generateLightningSegments(0, 0, Math.cos(baseAngle) * dist, Math.sin(baseAngle) * dist, 10, 30 * (1 - shockP));
            const la = 0.8 * (1 - shockP * 1.5);
            g.moveTo(segs[0].x, segs[0].y);
            for (let s = 1; s < segs.length; s++) g.lineTo(segs[s].x, segs[s].y);
            g.stroke({ width: 6, color: 0x222244, alpha: la * 0.6 });
            g.moveTo(segs[0].x, segs[0].y);
            for (let s = 1; s < segs.length; s++) g.lineTo(segs[s].x, segs[s].y);
            g.stroke({ width: 2, color: 0x8888ff, alpha: la * 1.2 });
            g.alpha = 1;
          }

          if (shockP < 0.7) {
            state.glowAuraGraphics.clear();
            const glowR = 80 * (1 - shockP / 0.7);
            for (let r = glowR; r > 5; r -= 10) {
              state.glowAuraGraphics.circle(0, 0, r).stroke({ width: 10, color: 0xff4400, alpha: 0.25 * (1 - r / glowR) * (1 - shockP / 0.7) });
            }
            state.glowAuraGraphics.alpha = 1;
          } else {
            state.glowAuraGraphics.clear();
            state.glowAuraGraphics.alpha = 0;
          }

          const shakeAmt = 14 * (1 - shockP);
          state.app.stage.position.x = state.origStageX + (Math.random() - 0.5) * shakeAmt;
          state.app.stage.position.y = state.origStageY + (Math.random() - 0.5) * shakeAmt;
          state.impactBurstGraphics.clear();
          state.impactBurstGraphics.alpha = 0;

          requestAnimationFrame(tick);
          return;
        }

        // === Phase 6: Fly back ===
        if (elapsed < totalAfterLift) {
          const p = easeInOut((elapsed - afterImpactStart - shockDur) / returnDur);
          state.attackerFlyCard.x = (state.impactX - state.nx * 180) + (state.atkPos.x - state.impactX + state.nx * 180) * p;
          state.attackerFlyCard.y = (state.impactY - state.ny * 180) + (state.atkPos.y - state.impactY + state.ny * 180) * p;
          state.attackerFlyCard.rotation = state.attackRotation + (Math.PI / 2 - state.attackRotation) * p;
          state.attackerFlyCard.scale.set(1.1 - 0.1 * p, 1.1 - 0.1 * p);
          state.app.stage.position.x = state.origStageX;
          state.app.stage.position.y = state.origStageY;
          requestAnimationFrame(tick);
          return;
        }

        // === Cleanup ===
        this._cleanupAttackAnim(state);
        resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  _cleanupAttackAnim(state) {
    this._stopFloatAnimation();

    state.app.stage.position.x = state.origStageX;
    state.app.stage.position.y = state.origStageY;

    state.screenFlashGraphics.clear();
    state.screenFlashGraphics.alpha = 0;
    if (state.screenFlashGraphics.parent) state.screenFlashGraphics.parent.removeChild(state.screenFlashGraphics);

    state.impactBurstGraphics.clear();
    state.impactBurstGraphics.alpha = 0;
    if (state.impactBurstGraphics.parent) state.impactBurstGraphics.parent.removeChild(state.impactBurstGraphics);

    state.glowAuraGraphics.clear();
    state.glowAuraGraphics.alpha = 0;
    if (state.glowAuraGraphics.parent) state.glowAuraGraphics.parent.removeChild(state.glowAuraGraphics);

    for (const ring of state.shockwaveRings) { ring.clear(); if (ring.parent) ring.parent.removeChild(ring); }
    for (const p of state.impactParticles) { p.clear(); if (p.parent) p.parent.removeChild(p); }
    for (const s of state.fireSparks) { s.clear(); if (s.parent) s.parent.removeChild(s); }
    for (const l of state.lightningBolts) { l.clear(); if (l.parent) l.parent.removeChild(l); }

    if (state.attackerFlyCard.parent) state.attackerFlyCard.parent.removeChild(state.attackerFlyCard);

    this._attackAnimState = null;

    // Signal that cleanup is done so the attacker can be rendered immediately
    if (this._onCleanupDone) {
      this._onCleanupDone();
      this._onCleanupDone = null;
    }
  }

  // Legacy: full animation without counter phase interruption
  async animate(pid, attacker, attackerZone, target, targetZone) {
    await this.animateLiftAndRotate(pid, attacker, attackerZone, target, targetZone);
    await this.continueAttackFromHeldState();
  }
}
