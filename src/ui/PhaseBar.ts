const PHASES = ['REFRESH', 'DRAW', 'DON!!', 'MAIN', 'END'];

const ZONE_W = 476;
const ZONE_H = 72;
const PAD = 14;

const COLORS = {
  bg:            0x0a0a20,
  bgStroke:      0x1e2a4a,
  bgStrokeInner: 0x121830,
  phaseInactive: 0x0e1225,
  phaseInactiveText: 0x2a3456,
  phaseInactiveStroke: 0x1a2244,
  trackBg:       0x0c1020,
  trackStroke:   0x1a2244,
};

const PHASE_COLORS = {
  REFRESH: 0x22cccc,
  DRAW:    0x2277cc,
  'DON!!': 0xffaa00,
  MAIN:    0x33cc55,
  END:     0xdd3355,
};

export function phaseToIndex(phase) {
  if (!phase) return -1;
  const upper = phase.toUpperCase();
  const mapped = upper === 'DON' ? 'DON!!' : upper;
  return PHASES.indexOf(mapped);
}

function hexPath(g, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

function lerpColor(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function checkmark(g, cx, cy, size, color) {
  g.moveTo(cx - size * 0.4, cy);
  g.lineTo(cx - size * 0.1, cy + size * 0.3);
  g.lineTo(cx + size * 0.45, cy - size * 0.25);
  g.stroke({ width: 2.5, color, alpha: 0.9 });
}

class ParticlePool {
  constructor(maxCount) {
    this.particles = [];
    for (let i = 0; i < maxCount; i++) {
      this.particles.push({ x: 0, speed: 0, size: 0, alpha: 0 });
    }
    this.activeCount = 0;
  }

  reset(trackStart, trackEnd, trackY) {
    this.activeCount = 0;
    for (const p of this.particles) {
      if (this.activeCount < 12) {
        p.x = trackStart + Math.random() * (trackEnd - trackStart);
        p.speed = 0.4 + Math.random() * 0.8;
        p.size = 1 + Math.random() * 1.5;
        p.alpha = 0.3 + Math.random() * 0.5;
        p.offsetY = (Math.random() - 0.5) * 6;
        this.activeCount++;
      } else {
        p.alpha = 0;
      }
    }
  }

  update(dt) {
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particles[i];
      p.x += p.speed * dt * 0.06;
      p.alpha *= 0.998;
    }
  }

  render(g, trackStart, trackEnd, trackY, color) {
    g.clear();
    for (let i = 0; i < this.activeCount; i++) {
      const p = this.particles[i];
      if (p.x > trackEnd) {
        p.x = trackStart;
        p.alpha = 0.3 + Math.random() * 0.5;
      }
      if (p.alpha > 0.02) {
        g.circle(p.x, trackY + p.offsetY, p.size)
          .fill({ color, alpha: p.alpha });
      }
    }
  }
}

export function createPhaseZone(app, state, position, onEndTurn) {
  const container = new PIXI.Container();
  container.name = 'phaseZone';
  container.position.set(position.x, position.y);

  // ── Background ──
  const bg = new PIXI.Graphics();
  bg.name = 'phaseZoneBg';
  bg.roundRect(0, 0, ZONE_W, ZONE_H, 14)
    .fill({ color: COLORS.bg, alpha: 0.95 })
    .stroke({ width: 1.5, color: COLORS.bgStroke, alpha: 0.8 });
  container.addChild(bg);

  // ── Inner border highlight ──
  const innerBorder = new PIXI.Graphics();
  innerBorder.name = 'phaseZoneInnerBorder';
  innerBorder.roundRect(3, 3, ZONE_W - 6, ZONE_H - 6, 12)
    .stroke({ width: 0.5, color: COLORS.bgStrokeInner, alpha: 0.4 });
  container.addChild(innerBorder);

  // ── Scanline overlay ──
  const scanlineGfx = new PIXI.Graphics();
  scanlineGfx.name = 'phaseZoneScanline';
  scanlineGfx.roundRect(2, 2, ZONE_W - 4, ZONE_H - 4, 12)
    .fill({ color: 0x000000, alpha: 0 });
  container.addChild(scanlineGfx);

  // ── Phase track ──
  const trackPad = 40;
  const trackStartX = trackPad;
  const trackEndX = ZONE_W - trackPad;
  const trackWidth = trackEndX - trackStartX;
  const trackY = ZONE_H / 2 - 8;

  const nodeSpacing = trackWidth / (PHASES.length - 1);
  const nodeR = 13;

  // Track background groove
  const trackGroove = new PIXI.Graphics();
  trackGroove.name = 'phaseZoneTrackGroove';
  trackGroove.moveTo(trackStartX, trackY)
    .lineTo(trackEndX, trackY)
    .stroke({ width: 6, color: COLORS.trackBg, alpha: 0.9 });
  container.addChild(trackGroove);

  // Track center line
  const trackLine = new PIXI.Graphics();
  trackLine.name = 'phaseZoneTrackLine';
  trackLine.moveTo(trackStartX, trackY)
    .lineTo(trackEndX, trackY)
    .stroke({ width: 1.5, color: COLORS.trackStroke, alpha: 0.6 });
  container.addChild(trackLine);

  // Progress glow line
  const trackProgressGlow = new PIXI.Graphics();
  trackProgressGlow.name = 'phaseZoneTrackProgressGlow';
  trackProgressGlow.blendMode = 'add';
  container.addChild(trackProgressGlow);

  // Progress fill line
  const trackProgress = new PIXI.Graphics();
  trackProgress.name = 'phaseZoneTrackProgress';
  container.addChild(trackProgress);

  // Particle pool
  const particles = new ParticlePool(12);
  particles.reset(trackStartX, trackEndX, trackY);

  const particleGfx = new PIXI.Graphics();
  particleGfx.name = 'phaseZoneParticleGfx';
  container.addChild(particleGfx);

  // Phase nodes
  const phaseNodes = [];
  const phaseNodeGlows = [];
  const phaseTexts = [];

  for (let i = 0; i < PHASES.length; i++) {
    const nodeCx = trackStartX + nodeSpacing * i;

    const glowGfx = new PIXI.Graphics();
    glowGfx.name = `phaseNodeGlow_${i}`;
    container.addChildAt(glowGfx, 3);
    phaseNodeGlows.push(glowGfx);

    const node = new PIXI.Graphics();
    node.name = `phaseNode_${i}`;
    container.addChild(node);
    phaseNodes.push(node);

    const pillText = new PIXI.Text({
      text: PHASES[i],
      style: {
        fontSize: 12,
        fill: COLORS.phaseInactiveText,
        fontFamily: 'Russo One',
      },
    });
    pillText.name = `phasePillText_${i}`;
    pillText.anchor.set(0.5);
    pillText.position.set(nodeCx, trackY + nodeR + 14);
    container.addChild(pillText);
    phaseTexts.push(pillText);
  }

  container.eventMode = 'static';
  container.cursor = 'default';

  // Store refs
  container.phaseNodes = phaseNodes;
  container.phaseNodeGlows = phaseNodeGlows;
  container.phaseTexts = phaseTexts;
  container.trackProgress = trackProgress;
  container.trackProgressGlow = trackProgressGlow;
  container.trackStartX = trackStartX;
  container.trackEndX = trackEndX;
  container.trackY = trackY;
  container.nodeSpacing = nodeSpacing;
  container.nodeR = nodeR;
  container.particles = particles;
  container.particleGfx = particleGfx;
  container.scanlineGfx = scanlineGfx;

  let _scanPhase = 0;
  let _pulsePhase = 0;
  let _lastTime = performance.now();

  const _phaseTicker = (ticker) => {
    const now = performance.now();
    const dt = Math.min(now - _lastTime, 100);
    _lastTime = now;

    _pulsePhase += 0.04;
    _scanPhase += 0.015;

    // Scanline sweep (phase panel only)
    const scanY = (Math.sin(_scanPhase) * 0.5 + 0.5) * ZONE_H;
    const currentPhaseIdx = phaseToIndex(state?.currentPhase);
    const color = currentPhaseIdx >= 0 ? PHASE_COLORS[PHASES[currentPhaseIdx]] : 0x334466;
    container.scanlineGfx.clear();
    container.scanlineGfx.rect(2, scanY - 1, ZONE_W - 4, 2)
      .fill({ color, alpha: 0.06 });

    // Particle update and render
    container.particles.update(dt);
    container.particles.render(container.particleGfx, container.trackStartX,
      container.trackStartX + container.nodeSpacing * Math.max(currentPhaseIdx, 0),
      container.trackY, color);

    // Active node pulse
    const pulse = 0.85 + 0.15 * Math.sin(_pulsePhase * 1.2);
    if (currentPhaseIdx >= 0) {
      const nodeCx = container.trackStartX + container.nodeSpacing * currentPhaseIdx;
      container.phaseNodeGlows[currentPhaseIdx].clear();
      container.phaseNodeGlows[currentPhaseIdx].circle(nodeCx, container.trackY, container.nodeR + 10)
        .fill({ color, alpha: 0.3 * pulse });
    }
  };
  app.ticker.add(_phaseTicker);

  container._phaseTicker = _phaseTicker;

  return container;
}

export function updatePhaseZone(zone, state, turnManager) {
  if (!zone) return;

  const currentPhaseIdx = phaseToIndex(state?.currentPhase);

  for (let i = 0; i < PHASES.length; i++) {
    const node = zone.phaseNodes[i];
    const text = zone.phaseTexts[i];
    const glow = zone.phaseNodeGlows[i];
    const nodeCx = zone.trackStartX + zone.nodeSpacing * i;
    const nodeR = zone.nodeR;
    const c = PHASE_COLORS[PHASES[i]];

    if (i === currentPhaseIdx) {
      // ── Active phase ──
      const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.004);

      glow.clear();
      glow.circle(nodeCx, zone.trackY, nodeR + 10)
        .fill({ color: c, alpha: 0.3 * pulse });

      node.clear();
      hexPath(node, nodeCx, zone.trackY, nodeR);
      node.fill({ color: COLORS.phaseInactive, alpha: 1 });
      node.stroke({ width: 2, color: c, alpha: 0.9 });

      hexPath(node, nodeCx, zone.trackY, nodeR - 3);
      node.stroke({ width: 0.5, color: c, alpha: 0.3 });

      text.style.fill = 0xffffff;
      text.style.fontSize = 13;

    } else if (i < currentPhaseIdx) {
      // ── Completed phase ──
      glow.clear();

      node.clear();
      hexPath(node, nodeCx, zone.trackY, nodeR);
      node.fill({ color: COLORS.phaseInactive, alpha: 0.8 });
      node.stroke({ width: 1.5, color: c, alpha: 0.5 });

      checkmark(node, nodeCx, zone.trackY, 10, c);

      text.style.fill = c;
      text.style.fontSize = 12;

    } else {
      // ── Upcoming phase ──
      glow.clear();

      node.clear();
      hexPath(node, nodeCx, zone.trackY, nodeR);
      node.fill({ color: COLORS.phaseInactive, alpha: 0.8 });
      node.stroke({ width: 1, color: c, alpha: 0.25 });

      text.style.fill = COLORS.phaseInactiveText;
      text.style.fontSize = 12;
    }
  }

  // ── Progress line (gradient per segment) ──
  zone.trackProgress.clear();
  zone.trackProgressGlow.clear();

  if (currentPhaseIdx >= 0) {
    for (let s = 0; s <= currentPhaseIdx; s++) {
      const xFrom = zone.trackStartX + zone.nodeSpacing * Math.max(s - 1, 0);
      const xTo   = zone.trackStartX + zone.nodeSpacing * s;
      const cFrom = s > 0 ? PHASE_COLORS[PHASES[s - 1]] : PHASE_COLORS[PHASES[s]];
      const cTo   = PHASE_COLORS[PHASES[s]];
      const steps = 8;

      for (let k = 0; k < steps; k++) {
        const t1 = k / steps;
        const t2 = (k + 1) / steps;
        const sx = xFrom + (xTo - xFrom) * t1;
        const ex = xFrom + (xTo - xFrom) * t2;
        const mid = (t1 + t2) / 2;
        const c = lerpColor(cFrom, cTo, mid);

        zone.trackProgressGlow.moveTo(sx, zone.trackY)
          .lineTo(ex, zone.trackY)
          .stroke({ width: 6, color: c, alpha: 0.2 });

        zone.trackProgress.moveTo(sx, zone.trackY)
          .lineTo(ex, zone.trackY)
          .stroke({ width: 2, color: c, alpha: 0.6 });
      }
    }

    const progressEnd = zone.trackStartX + zone.nodeSpacing * currentPhaseIdx;
    zone.particles.reset(zone.trackStartX, progressEnd, zone.trackY);
  }
}

export function setPhaseZoneCallbacks(zone, onEndTurn) {
  if (!zone) return;
  zone._onEndTurn = onEndTurn;
}
