class GameBoard {
  constructor(app) {
    this.app = app;
    this.board = new PIXI.Container();
    this.board.name = 'GameBoard';
    app.stage.addChild(this.board);
    this.zones = {};
  }

  init() {
    this._drawBackground();
    this._drawCenterDivider();
    this._createZones(2, { fieldY: 206, costY: 164, handY: 16, stageY: 240, lifeY: 16, donDeckY: 164, trashY: 16, deckY: 16, leaderY: 161 });
    this._createZones(1, { fieldY: 454, costY: 596, handY: 644, stageY: 420, lifeY: 644, donDeckY: 596, trashY: 644, deckY: 644, leaderY: 409 });
  }

  _drawBackground() {
    const background = new PIXI.Graphics();
    background.name = 'background';
    background.rect(0, 0, 1200, 800).fill(0x1a1a2e);
    this.board.addChild(background);
  }

  _drawCenterDivider() {
    const centerDivider = new PIXI.Graphics();
    centerDivider.name = 'centerDivider';
    centerDivider.moveTo(100, 400).lineTo(1100, 400).stroke({ width: 1, color: 0x334466, alpha: 0.4 });
    this.board.addChild(centerDivider);
  }

  _createSlot(x, y, w, h, name) {
    const slotContainer = new PIXI.Container();
    slotContainer.name = name;
    const slotBackground = new PIXI.Graphics();
    slotBackground.name = 'slotBackground';
    slotBackground.eventMode = 'none';
    slotBackground.roundRect(0, 0, w, h, 6).fill({ color: 0x2d2d44, alpha: 0.2 }).stroke({ width: 2, color: 0x3a3a6a, alpha: 0.6 });
    slotContainer.addChild(slotBackground);
    slotContainer.position.set(x, y);
    slotContainer.width = w;
    slotContainer.height = h;
    this.board.addChild(slotContainer);
    return slotContainer;
  }

  _createStageSlot(x, y, w, h, name) {
    const stageContainer = new PIXI.Container();
    stageContainer.name = name;
    const stageBackground = new PIXI.Graphics();
    stageBackground.name = 'stageBackground';
    stageBackground.eventMode = 'none';
    stageBackground.roundRect(0, 0, w, h, 6).fill({ color: 0x3d3d22, alpha: 0.25 }).stroke({ width: 3, color: 0x887733, alpha: 0.8 });
    stageContainer.addChild(stageBackground);
    stageContainer.position.set(x, y);
    stageContainer.width = w;
    stageContainer.height = h;
    this.board.addChild(stageContainer);
    return stageContainer;
  }

  _addZoneLabel(container, text) {
    const zoneLabel = new PIXI.Text({ text, style: { fontSize: 17, fill: 0x666688, fontFamily: 'Russo One', fontWeight: 'normal' }});
    zoneLabel.name = 'zoneLabel';
    zoneLabel.anchor.set(0.5);
    zoneLabel.position.set(container.width / 2, container.height / 2);
    container.zoneLabel = zoneLabel;
    container.addChildAt(zoneLabel, 1);
    return zoneLabel;
  }

  _createZoneArea(x, y, w, h, color, label, alpha = 0.3, name) {
    const zoneContainer = new PIXI.Container();
    zoneContainer.name = name;
    const zoneBackground = new PIXI.Graphics();
    zoneBackground.name = 'zoneBackground';
    zoneBackground.eventMode = 'none';
    zoneBackground.roundRect(0, 0, w, h, 8).fill({ color, alpha }).stroke({ width: 1, color });
    zoneContainer.addChild(zoneBackground);
    zoneContainer.position.set(x, y);
    zoneContainer.width = w;
    zoneContainer.height = h;
    this.board.addChild(zoneContainer);
    return zoneContainer;
  }

  _createRectZone(x, y, w, h, color, name) {
    const rectZoneContainer = new PIXI.Container();
    rectZoneContainer.name = name;
    rectZoneContainer.width = w;
    rectZoneContainer.height = h;
    const rectZoneBackground = new PIXI.Graphics();
    rectZoneBackground.name = 'rectZoneBackground';
    rectZoneBackground.eventMode = 'none';
    rectZoneBackground.roundRect(0, 0, w, h, 6).fill({ color: 0x1a1a3a, alpha: 0.4 }).stroke({ width: 1, color });
    rectZoneContainer.addChild(rectZoneBackground);
    rectZoneContainer.position.set(x, y);
    this.board.addChild(rectZoneContainer);
    return rectZoneContainer;
  }

  _createZones(pid, pos) {
    const slotW = 130;
    const gap = 12;
    const fieldW = 5 * slotW + 4 * gap;
    const fieldX = 600 - fieldW / 2;

    // Hand & cost zones use player-specific colors
    const handColor = pid === 1 ? 0x44aa44 : 0xaa4444;
    const handLabel = pid === 1 ? 'Hand' : 'Hand';

    this.zones[`${pid}_hand`] = this._createZoneArea(fieldX, pos.handY, fieldW, 140, handColor, '', 0.3, `P${pid}HandZone`);
    this._addZoneLabel(this.zones[`${pid}_hand`], handLabel);

    this.zones[`${pid}_cost`] = this._createZoneArea(fieldX, pos.costY, fieldW, 40, 0x5a3a3a, '', 0.3, `P${pid}CostZone`);
    this._addZoneLabel(this.zones[`${pid}_cost`], 'Cost');

    this.zones[`${pid}_stage`] = this._createStageSlot(960, pos.stageY, 100, 140, `P${pid}StageZone`);
    this._addZoneLabel(this.zones[`${pid}_stage`], 'Stage');

    for (let i = 0; i < 5; i++) {
      this.zones[`${pid}_field_slot_${i}`] = this._createSlot(fieldX + (slotW + gap) * i, pos.fieldY, slotW, 140, `P${pid}FieldSlot${i}`);
      this._addZoneLabel(this.zones[`${pid}_field_slot_${i}`], `${i + 1}`);
    }

    this.zones[`${pid}_life`] = this._createRectZone(10, pos.lifeY, 229, 140, 0x4a8a8a, `P${pid}LifeZone`);
    this._addZoneLabel(this.zones[`${pid}_life`], 'Life');

    this.zones[`${pid}_dondeck`] = this._createRectZone(959, pos.donDeckY, 210, 40, 0x4a4a8a, `P${pid}DONDeckZone`);
    this._addZoneLabel(this.zones[`${pid}_dondeck`], 'DON!!');

    this.zones[`${pid}_trash`] = this._createRectZone(1071, pos.trashY, 100, 140, 0x6a4a6a, `P${pid}TrashZone`);
    this._addZoneLabel(this.zones[`${pid}_trash`], 'Trash');

    this.zones[`${pid}_deck`] = this._createRectZone(961, pos.deckY, 100, 140, 0x4a6a4a, `P${pid}DeckZone`);
    this._addZoneLabel(this.zones[`${pid}_deck`], 'Deck');

    this.zones[`${pid}_leader`] = this._createSlot(10, pos.leaderY, 210, 230, `P${pid}LeaderZone`);
    this._addZoneLabel(this.zones[`${pid}_leader`], 'Leader');
  }

  getZone(playerId, zoneName) {
    return this.zones[`${playerId}_${zoneName}`] || null;
  }
}

export default GameBoard;