const TURN_PANEL_W = 160;
const TURN_PANEL_H = 72;

const COLORS = {
  bg:        0x0a0a20,
  stroke:    0x1e2a4a,
  inner:     0x121830,
  turnLbl:   0x667799,
  turnNum:   0xffffff,
  playerLbl: 0xaabbdd,
  p1Dot:     0x44aa44,
  p2Dot:     0xaa4444,
};

function hexPath(g, cx, cy, r) {
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
}

export function createTurnInfoPanel(app, state, position) {
  const container = new PIXI.Container();
  container.name = 'turnInfoPanel';
  container.position.set(position.x, position.y);

  // ── Background ──
  const bg = new PIXI.Graphics();
  bg.name = 'turnPanelBg';
  bg.roundRect(0, 0, TURN_PANEL_W, TURN_PANEL_H, 14)
    .fill({ color: COLORS.bg, alpha: 0.95 })
    .stroke({ width: 1.5, color: COLORS.stroke, alpha: 0.8 });
  container.addChild(bg);

  // ── Inner border highlight ──
  const inner = new PIXI.Graphics();
  inner.name = 'turnPanelInner';
  inner.roundRect(3, 3, TURN_PANEL_W - 6, TURN_PANEL_H - 6, 12)
    .stroke({ width: 0.5, color: COLORS.inner, alpha: 0.4 });
  container.addChild(inner);

  const cy = TURN_PANEL_H / 2;
  const hexR = 28;
  const turnCx = 38;
  const labelCx = TURN_PANEL_W - 52;

  // ── Turn hex (left) ──
  const turnGlow = new PIXI.Graphics();
  turnGlow.name = 'turnHexGlow';
  hexPath(turnGlow, turnCx, cy, hexR + 4);
  turnGlow.fill({ color: 0x06061a, alpha: 0.5 });
  container.addChild(turnGlow);

  const turnBg = new PIXI.Graphics();
  turnBg.name = 'turnHexBg';
  hexPath(turnBg, turnCx, cy, hexR);
  turnBg.fill({ color: COLORS.bg, alpha: 0.95 });
  turnBg.stroke({ width: 1.5, color: COLORS.stroke, alpha: 0.8 });
  container.addChild(turnBg);

  const turnInner = new PIXI.Graphics();
  turnInner.name = 'turnHexInner';
  hexPath(turnInner, turnCx, cy, hexR - 4);
  turnInner.stroke({ width: 0.5, color: COLORS.inner, alpha: 0.4 });
  container.addChild(turnInner);

  // "TURN" label (top inside hex)
  const turnTitle = new PIXI.Text({
    text: 'TURN',
    style: {
      fontSize: 9,
      fill: COLORS.turnLbl,
      fontFamily: 'Russo One',
    },
  });
  turnTitle.name = 'turnTitle';
  turnTitle.anchor.set(0.5);
  turnTitle.position.set(turnCx, cy - 8);
  container.addChild(turnTitle);

  // Turn number (bottom inside hex)
  const turnNumber = new PIXI.Text({
    text: '1',
    style: {
      fontSize: 14,
      fill: COLORS.turnNum,
      fontFamily: 'Russo One',
    },
  });
  turnNumber.name = 'turnNumber';
  turnNumber.anchor.set(0.5);
  turnNumber.position.set(turnCx, cy + 8);
  container.addChild(turnNumber);

  // "PLAYER" label (top, right of hex)
  const playerLabel = new PIXI.Text({
    text: "PLAYER'S",
    style: {
      fontSize: 12,
      fill: COLORS.p1Dot,
      fontFamily: 'Russo One',
    },
  });
  playerLabel.name = 'playerLabel';
  playerLabel.anchor.set(0.5);
  playerLabel.position.set(labelCx, cy - 8);
  container.addChild(playerLabel);

  // "TURN" label (bottom, right of hex)
  const playerTurnLabel = new PIXI.Text({
    text: 'TURN',
    style: {
      fontSize: 12,
      fill: COLORS.p1Dot,
      fontFamily: 'Russo One',
    },
  });
  playerTurnLabel.name = 'playerTurnLabel';
  playerTurnLabel.anchor.set(0.5);
  playerTurnLabel.position.set(labelCx, cy + 8);
  container.addChild(playerTurnLabel);

  container.turnNumber = turnNumber;
  container.playerLabel = playerLabel;
  container.playerTurnLabel = playerTurnLabel;
  container.turnCx = turnCx;
  container.cy = cy;
  container.hexR = hexR;
  container.turnBg = turnBg;
  container.turnGlow = turnGlow;

  container.eventMode = 'static';
  container.cursor = 'default';

  return container;
}

export function updateTurnInfoPanel(panel, state) {
  if (!panel) return;

  const turn = (state?.turnCount || 0) + 1;
  const p = state?.currentPlayer || 1;
  const dotColor = p === 1 ? COLORS.p1Dot : COLORS.p2Dot;

  panel.turnNumber.text = `${turn}`;
  panel.playerLabel.text = p === 1 ? "PLAYER'S" : "OPPONENT'S";
  panel.playerLabel.style.fill = dotColor;
  panel.playerTurnLabel.style.fill = dotColor;

  panel.turnBg.clear();
  hexPath(panel.turnBg, panel.turnCx, panel.cy, panel.hexR);
  panel.turnBg.fill({ color: COLORS.bg, alpha: 0.95 });
  panel.turnBg.stroke({ width: 1.5, color: dotColor, alpha: 0.5 });

  panel.turnGlow.clear();
  hexPath(panel.turnGlow, panel.turnCx, panel.cy, panel.hexR + 4);
  panel.turnGlow.fill({ color: dotColor, alpha: 0.12 });
}
