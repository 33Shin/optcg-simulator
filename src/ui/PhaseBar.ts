const PHASES = ['Refresh', 'Draw', 'DON!!', 'Main', 'End'];

const ZONE_W = 600;
const ZONE_H = 72;
const PAD = 14;

const COLORS = {
  glow:          0x06061a,
  bg:            0x0a0a20,
  bgStroke:      0x1e2a4a,
  bgStrokeInner: 0x121830,
  activeStroke:  0x60a5fa,
  textActive:    0xffffff,
  phaseInactive: 0x0e1225,
  phaseInactiveText: 0x2a3456,
  phaseInactiveStroke: 0x1a2244,
  phaseDone:     0x0a1e14,
  phaseDoneText: 0x33cc77,
  phaseDoneStroke: 0x22aa55,
  trackBg:       0x0c1020,
  trackStroke:   0x1a2244,
};

const PHASE_HIGHLIGHTS = {
  Refresh: { fill: 0x061428, stroke: 0x2277cc, glow: 0x1155aa, particle: 0x4488dd },
  Draw:    { fill: 0x061428, stroke: 0x2277cc, glow: 0x1155aa, particle: 0x4488dd },
  'DON!!': { fill: 0x1e1000, stroke: 0xffaa00, glow: 0xcc8800, particle: 0xffcc44 },
  Main:    { fill: 0x061a0e, stroke: 0x33cc55, glow: 0x22aa44, particle: 0x55ee77 },
  End:     { fill: 0x1e0618, stroke: 0xdd3355, glow: 0xaa2244, particle: 0xff5577 },
};

export function phaseToIndex(phase) {
  if (!phase) return -1;
  const normalized = phase.charAt(0).toUpperCase() + phase.slice(1);
  const mapped = normalized === 'Don' ? 'DON!!' : normalized;
  return PHASES.indexOf(mapped);
}

// ── Hexagon path ──
function hexPath(g, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

// ── Checkmark ──
function checkmark(g, cx, cy, size) {
  g.moveTo(cx - size * 0.4, cy);
  g.lineTo(cx - size * 0.1, cy + size * 0.3);
  g.lineTo(cx + size * 0.45, cy - size * 0.25);
  g.stroke({ width: 2.5, color: 0x33dd77, alpha: 0.9 });
}

// ── Particle pool ──
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

  // ── Outer glow ──
  const glow = new PIXI.Graphics();
  glow.name = 'phaseZoneGlow';
  glow.roundRect(-8, -8, ZONE_W + 16, ZONE_H + 16, 18)
    .fill({ color: COLORS.glow, alpha: 0.6 });
  container.addChild(glow);

  // ── Background ──
  const bg = new PIXI.Graphics();
  bg.name = 'phaseZoneBg';
  bg.roundRect(0, 0, ZONE_W, ZONE_H, 14)
    .fill({ color: COLORS.bg, alpha: 0.95 })
    .stroke({ width: 1.5, color: COLORS.bgStroke, alpha: 0.8 });
  container.addChild(bg);

  // ── Scanline overlay ──
  const scanlineGfx = new PIXI.Graphics();
  scanlineGfx.roundRect(2, 2, ZONE_W - 4, ZONE_H - 4, 12)
    .fill({ color: 0x000000, alpha: 0 });
  container.addChild(scanlineGfx);

  // ── Inner border highlight ──
  const innerBorder = new PIXI.Graphics();
  innerBorder.roundRect(3, 3, ZONE_W - 6, ZONE_H - 6, 12)
    .stroke({ width: 0.5, color: COLORS.bgStrokeInner, alpha: 0.4 });
  container.addChild(innerBorder);

  // ── Corner accents ──
  const cornerLen = 16;
  const cornerOff = 8;
  const cornerGfx = new PIXI.Graphics();
  // Top-left
  cornerGfx.moveTo(cornerOff, cornerOff + cornerLen).lineTo(cornerOff, cornerOff).lineTo(cornerOff + cornerLen, cornerOff);
  // Top-right
  cornerGfx.moveTo(ZONE_W - cornerOff - cornerLen, cornerOff).lineTo(ZONE_W - cornerOff, cornerOff).lineTo(ZONE_W - cornerOff, cornerOff + cornerLen);
  // Bottom-left
  cornerGfx.moveTo(cornerOff, ZONE_H - cornerOff - cornerLen).lineTo(cornerOff, ZONE_H - cornerOff).lineTo(cornerOff + cornerLen, ZONE_H - cornerOff);
  // Bottom-right
  cornerGfx.moveTo(ZONE_W - cornerOff - cornerLen, ZONE_H - cornerOff).lineTo(ZONE_W - cornerOff, ZONE_H - cornerOff).lineTo(ZONE_W - cornerOff, ZONE_H - cornerOff - cornerLen);
  cornerGfx.stroke({ width: 1.5, color: COLORS.bgStroke, alpha: 0.5 });
  container.addChild(cornerGfx);

  // ── Phase track ──
  const trackStartX = PAD + 14;
  const trackEndX = ZONE_W - PAD - 14;
  const trackWidth = trackEndX - trackStartX;
  const trackY = ZONE_H / 2;

  // Pill layout
  const nodeSpacing = trackWidth / (PHASES.length - 1);
  const nodeR = 13;

  // Track background groove
  const trackGroove = new PIXI.Graphics();
  trackGroove.moveTo(trackStartX, trackY)
    .lineTo(trackEndX, trackY)
    .stroke({ width: 6, color: COLORS.trackBg, alpha: 0.9 });
  container.addChild(trackGroove);

  // Track center line
  const trackLine = new PIXI.Graphics();
  trackLine.moveTo(trackStartX, trackY)
    .lineTo(trackEndX, trackY)
    .stroke({ width: 1.5, color: COLORS.trackStroke, alpha: 0.6 });
  container.addChild(trackLine);

  // Progress glow line (wider, softer, behind solid)
  const trackProgressGlow = new PIXI.Graphics();
  trackProgressGlow.blendMode = 'add';
  container.addChild(trackProgressGlow);

  // Progress fill line
  const trackProgress = new PIXI.Graphics();
  container.addChild(trackProgress);

  // Particle pool for energy flow
  const particles = new ParticlePool(12);
  particles.reset(trackStartX, trackEndX, trackY);

  // Particle render target
  const particleGfx = new PIXI.Graphics();
  container.addChild(particleGfx);

  // Phase nodes (hexagons)
  const phaseNodes = [];
  const phaseNodeGlows = [];
  const phaseTexts = [];

  for (let i = 0; i < PHASES.length; i++) {
    const nodeCx = trackStartX + nodeSpacing * i;

    // Glow behind node
    const glowGfx = new PIXI.Graphics();
    container.addChildAt(glowGfx, 3);
    phaseNodeGlows.push(glowGfx);

    // Node body
    const node = new PIXI.Graphics();
    node.name = `phaseNode_${i}`;
    container.addChild(node);
    phaseNodes.push(node);

    // Text label
    const pillText = new PIXI.Text({
      text: PHASES[i],
      style: {
        fontSize: 9,
        fill: COLORS.phaseInactiveText,
        fontFamily: 'Russo One',
      },
    });
    pillText.anchor.set(0.5);
    pillText.position.set(nodeCx, trackY + nodeR + 9);
    container.addChild(pillText);
    phaseTexts.push(pillText);
  }

  // Central phase indicator (large text showing current phase)
  const phaseIndicator = new PIXI.Text({
    text: '',
    style: {
      fontSize: 11,
      fill: 0x60a5fa,
      fontFamily: 'Russo One',
      fontWeight: 'normal',
    },
  });
  phaseIndicator.anchor.set(0.5);
  phaseIndicator.position.set(ZONE_W / 2, 13);
  container.addChild(phaseIndicator);

  container.eventMode = 'static';
  container.cursor = 'default';

  // Store refs
  container.phaseNodes = phaseNodes;
  container.phaseNodeGlows = phaseNodeGlows;
  container.phaseTexts = phaseTexts;
  container.phaseIndicator = phaseIndicator;
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

  app.stage.addChild(container);

  let _scanPhase = 0;
  let _pulsePhase = 0;
  let _lastTime = performance.now();

  const _phaseTicker = (ticker) => {
    const now = performance.now();
    const dt = Math.min(now - _lastTime, 100);
    _lastTime = now;

    _pulsePhase += 0.04;
    _scanPhase += 0.015;

    // Scanline sweep
    const scanY = (Math.sin(_scanPhase) * 0.5 + 0.5) * ZONE_H;
    const currentPhaseIdx = phaseToIndex(state?.currentPhase);
    const hl = currentPhaseIdx >= 0 ? PHASE_HIGHLIGHTS[PHASES[currentPhaseIdx]] : null;
    container.scanlineGfx.clear();
    container.scanlineGfx.rect(0, scanY - 1, ZONE_W, 2)
      .fill({ color: hl ? hl.stroke : 0x334466, alpha: 0.06 });

    // Particle update and render
    container.particles.update(dt);
    container.particles.render(container.particleGfx, container.trackStartX,
      container.trackStartX + container.nodeSpacing * Math.max(currentPhaseIdx, 0),
      container.trackY, hl ? hl.particle : 0x4488dd);

    // Active node pulse
    const pulse = 0.85 + 0.15 * Math.sin(_pulsePhase * 1.2);
    if (currentPhaseIdx >= 0) {
      const nodeCx = container.trackStartX + container.nodeSpacing * currentPhaseIdx;
      container.phaseNodeGlows[currentPhaseIdx].clear();
      container.phaseNodeGlows[currentPhaseIdx].circle(nodeCx, container.trackY, container.nodeR + 10)
        .fill({ color: hl.glow, alpha: 0.3 * pulse });
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

    if (i === currentPhaseIdx) {
      // ── Active phase ──
      const hl = PHASE_HIGHLIGHTS[PHASES[i]];
      const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.004);

      // Glow
      glow.clear();
      glow.circle(nodeCx, zone.trackY, nodeR + 10)
        .fill({ color: hl.glow, alpha: 0.3 * pulse });

      // Node body
      node.clear();
      hexPath(node, nodeCx, zone.trackY, nodeR);
      node.fill({ color: hl.fill, alpha: 1 });
      node.stroke({ width: 2, color: hl.stroke, alpha: 0.9 });

      // Inner hex
      hexPath(node, nodeCx, zone.trackY, nodeR - 3);
      node.stroke({ width: 0.5, color: hl.stroke, alpha: 0.3 });

      text.style.fill = 0xffffff;
      text.style.fontSize = 10;

      // Update central indicator
      zone.phaseIndicator.text = PHASES[i];
      zone.phaseIndicator.style.fill = hl.stroke;

    } else if (i < currentPhaseIdx) {
      // ── Completed phase ──
      glow.clear();

      node.clear();
      hexPath(node, nodeCx, zone.trackY, nodeR);
      node.fill({ color: COLORS.phaseDone, alpha: 0.9 });
      node.stroke({ width: 1.5, color: COLORS.phaseDoneStroke, alpha: 0.7 });

      // Checkmark
      checkmark(node, nodeCx, zone.trackY, 10);

      text.style.fill = COLORS.phaseDoneText;
      text.style.fontSize = 9;

    } else {
      // ── Upcoming phase ──
      glow.clear();

      node.clear();
      hexPath(node, nodeCx, zone.trackY, nodeR);
      node.fill({ color: COLORS.phaseInactive, alpha: 0.8 });
      node.stroke({ width: 1, color: COLORS.phaseInactiveStroke, alpha: 0.5 });

      text.style.fill = COLORS.phaseInactiveText;
      text.style.fontSize = 9;
    }
  }

  // ── Progress line ──
  zone.trackProgress.clear();
  zone.trackProgressGlow.clear();

  if (currentPhaseIdx >= 0) {
    const hl = PHASE_HIGHLIGHTS[PHASES[currentPhaseIdx]];
    const progressEnd = zone.trackStartX + zone.nodeSpacing * currentPhaseIdx;

    // Glow (wider, softer)
    zone.trackProgressGlow.moveTo(zone.trackStartX, zone.trackY)
      .lineTo(progressEnd, zone.trackY)
      .stroke({ width: 6, color: hl.glow, alpha: 0.2 });

    // Solid line
    zone.trackProgress.moveTo(zone.trackStartX, zone.trackY)
      .lineTo(progressEnd, zone.trackY)
      .stroke({ width: 2, color: hl.stroke, alpha: 0.6 });

    // Reset particles to flow to current phase
    zone.particles.reset(zone.trackStartX, progressEnd, zone.trackY);
  }
}

export function setPhaseZoneCallbacks(zone, onEndTurn) {
  if (!zone) return;
  zone._onEndTurn = onEndTurn;
}
