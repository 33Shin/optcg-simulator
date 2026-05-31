const ACTION_STYLES = {
  endTurn: {
    text: 'PASS',
    fill: 0xcc3300,
    stroke: 0xff6644,
    textColor: 0xffffff,
    clickable: true,
  },
  disabled: {
    text: 'PASS',
    fill: 0x2a1010,
    stroke: 0x663333,
    textColor: 0x886666,
    clickable: false,
  },
  gameOver: {
    text: 'RESTART',
    fill: 0x1a3a1a,
    stroke: 0x44cc44,
    textColor: 0xaaffaa,
    clickable: true,
  },
};

// ── Draw half-circle action button ──
function drawActionButton(g, cx, cy, radius, style, pulsePhase) {
  const pulse = 0.85 + 0.15 * Math.sin(pulsePhase);
  const outerR = radius;

  // Outer glow ring
  g.circle(cx, cy, outerR + 6)
    .stroke({ width: 1, color: style.stroke, alpha: 0.1 * pulse });

  // Tick marks
  for (let i = 0; i < 36; i++) {
    const angle = -Math.PI / 2 + (Math.PI * i) / 36;
    const inner = outerR - (i % 3 === 0 ? 6 : 3);
    g.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    g.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
    g.stroke({ width: i % 3 === 0 ? 2 : 1, color: style.stroke, alpha: 0.35 * pulse });
  }

  g.circle(cx, cy, outerR - 1)
    .stroke({ width: 2, color: style.stroke, alpha: 0.25 * pulse });

  // Half circle body
  g.moveTo(cx, cy - outerR + 3);
  g.arc(cx, cy, outerR - 3, -Math.PI / 2, Math.PI / 2, true);
  g.closePath();
  g.fill({ color: style.fill, alpha: 0.85 });

  // Inner ring
  const innerR = outerR - 10;
  g.moveTo(cx, cy - innerR);
  g.arc(cx, cy, innerR, -Math.PI / 2, Math.PI / 2, true);
  g.stroke({ width: 1, color: style.stroke, alpha: 0.2 * pulse });

  // Decorative arcs
  for (let i = 0; i < 3; i++) {
    const arcR = outerR - 4 - i * 4;
    g.moveTo(cx, cy - arcR);
    g.arc(cx, cy, arcR, -Math.PI / 2 - 0.15, -Math.PI / 2 + 0.15);
    g.moveTo(cx, cy + arcR);
    g.arc(cx, cy, arcR, Math.PI / 2 - 0.15, Math.PI / 2 + 0.15);
    g.stroke({ width: 1, color: style.stroke, alpha: 0.15 * pulse });
  }

  // Center diamond
  const dX = cx - outerR * 0.35, dY = cy, dS = 3.5 * pulse;
  g.moveTo(dX, dY - dS);
  g.lineTo(dX + dS, dY);
  g.lineTo(dX, dY + dS);
  g.lineTo(dX - dS, dY);
  g.closePath();
  g.fill({ color: style.stroke, alpha: 0.35 * pulse });
}

export function createActionButton(app, state, position, onEndTurn) {
  const container = new PIXI.Container();
  container.name = 'actionButton';
  container.position.set(position.x, position.y);

  const btnRadius = position.radius || 64;

  const actionBg = new PIXI.Graphics();
  actionBg.name = 'actionBg';
  actionBg.eventMode = 'static';
  actionBg.cursor = 'default';
  container.addChild(actionBg);

  const actionText = new PIXI.Text({
    text: '',
    style: {
      fontSize: 15,
      fill: 0xaaccff,
      fontFamily: 'Russo One',
      align: 'center',
      stroke: { color: 0x000000, width: 3 },
    },
  });
  actionText.name = 'actionText';
  actionText.anchor.set(0.5);
  actionText.position.set(-btnRadius * 0.45, 0);
  container.addChild(actionText);

  container._onEndTurn = onEndTurn || null;
  container._currentStateKey = 'disabled';
  container._inBattle = false;
  container._tickerPaused = false;
  container._hovered = false;

  let _pulsePhase = 0;
  let _lastTime = performance.now();

  // Hover glow filter
  const hoverGlow = new PIXI.filters.GlowFilter({
    distance: 18,
    outerStrength: 3,
    innerStrength: 0,
    color: 0xffffff,
    quality: 0.2,
  });
  hoverGlow.alpha = 0;

  const _actionTicker = (ticker) => {
    if (container._tickerPaused) return;
    const now = performance.now();
    const dt = Math.min(now - _lastTime, 100);
    _lastTime = now;

    _pulsePhase += 0.04;

    const style = ACTION_STYLES[container._currentStateKey] || ACTION_STYLES.disabled;
    actionBg.clear();
    drawActionButton(actionBg, 0, 0, btnRadius, style, _pulsePhase);

    // Update glow color to match current style stroke
    hoverGlow.color = style.stroke;
    hoverGlow.alpha = container._hovered ? 1 : 0;
    actionBg.filters = container._hovered ? [hoverGlow] : null;
    actionBg.cursor = style.clickable ? 'pointer' : 'default';
  };
  app.ticker.add(_actionTicker);

  const _actionBtnHandler = () => {
    if (container._inBattle) return;
    if (container._currentStateKey === 'endTurn' && container._onEndTurn) {
      container._onEndTurn();
    } else if (container._currentStateKey === 'gameOver') {
      location.reload();
    } else if (container._onEndTurn) {
      // _currentStateKey may have been overwritten by a concurrent update cycle.
      // Call the callback anyway — it guards with turnManager.canAct internally.
      container._onEndTurn();
    }
  };
  actionBg.on('pointerdown', () => { container._pressed = true; });
  actionBg.on('pointerup', () => {
    container._pressed = false;
    _actionBtnHandler();
  });
  actionBg.on('pointerupoutside', () => { container._pressed = false; });
  container._actionBtnHandler = _actionBtnHandler;

  actionBg.on('pointerover', () => {
    const style = ACTION_STYLES[container._currentStateKey] || ACTION_STYLES.disabled;
    if (style.clickable) {
      container._hovered = true;
      actionText.scale.set(1.15);
    }
  });
  actionBg.on('pointerout', () => {
    container._hovered = false;
    container._pressed = false;
    actionText.scale.set(1);
  });

  container.actionBg = actionBg;
  container.actionText = actionText;
  container.btnRadius = btnRadius;
  container._actionTicker = _actionTicker;

  app.stage.addChild(container);

  return container;
}

export function updateActionButton(button, state, turnManager) {
  if (!button) return;

  let stateKey, displayText;

  if (state && state.gameOver) {
    stateKey = 'gameOver';
    displayText = ACTION_STYLES.gameOver.text;
  } else if (state && state.currentPlayer === 2) {
    stateKey = 'disabled';
    displayText = ACTION_STYLES.disabled.text;
  } else if (!turnManager || !turnManager.canAct) {
    stateKey = 'disabled';
    displayText = ACTION_STYLES.disabled.text;
  } else {
    stateKey = 'endTurn';
    displayText = ACTION_STYLES.endTurn.text;
  }

  if (button._inBattle) {
    // During battle, the battle flow manages the button state itself
    // (e.g., PASS for counter/blocker phases). Don't overwrite it.
    return;
  } else {
    const style = ACTION_STYLES[stateKey];
    button.actionText.text = displayText;
    button.actionText.style.fill = style.textColor;
    button.actionText.style.dirty = true;
    button.actionBg.cursor = style.clickable ? 'pointer' : 'default';
    button._currentStateKey = stateKey;
  }
}

export function setActionButtonCallback(button, onEndTurn) {
  if (!button) return;
  button._onEndTurn = onEndTurn;
}

export function disableActionButton(button) {
  if (!button) return;
  button.actionBg.eventMode = 'none';
  button.actionBg.cursor = 'default';
  button._currentStateKey = 'disabled';
  button.actionText.style.fill = ACTION_STYLES.disabled.textColor;
  button.actionText.style.dirty = true;
  button.actionBg.filters = null;
  button._hovered = false;
}

export function enableActionButton(button) {
  if (!button) return;
  button.actionBg.eventMode = 'static';
  button.actionBg.cursor = 'pointer';
}
