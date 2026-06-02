const CENTER_ZONE_W = 650;
const CENTER_ZONE_H = 72;

const COLORS = {
  glow: 0x06061a,
};

export function createCenterZone(app, state, position) {
  const container = new PIXI.Container();
  container.name = 'centerZone';
  container.position.set(position.x, position.y);

  // ── Center zone background glow ──
  const bgGlow = new PIXI.Graphics();
  bgGlow.name = 'centerZoneBgGlow';
  bgGlow.roundRect(-8, -8, CENTER_ZONE_W + 16, CENTER_ZONE_H + 16, 18)
    .fill({ color: COLORS.glow, alpha: 0.6 });
  container.addChild(bgGlow);

  container.eventMode = 'static';
  container.cursor = 'default';

  app.stage.addChild(container);

  return container;
}
