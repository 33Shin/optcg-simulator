class CardRenderer {
  constructor() {
    this.CARD_WIDTH = 100;
    this.CARD_HEIGHT = 140;
  }

  render(card, faceDown = false, scale = 1) {
    const cardContainer = new PIXI.Container();
    cardContainer.cardId = card.cardId;

    if (faceDown) {
      const texture = PIXI.Texture.from('assets/imgs/back.webp');
      const cardBackSprite = new PIXI.Sprite(texture);
      cardBackSprite.name = 'cardBack';
      cardBackSprite.width = this.CARD_WIDTH;
      cardBackSprite.height = this.CARD_HEIGHT;
      cardContainer.addChild(cardBackSprite);
    } else if (card.imgPath) {
      const texture = PIXI.Texture.from(card.imgPath);
      const cardFaceSprite = new PIXI.Sprite(texture);
      cardFaceSprite.name = 'cardFace';
      cardFaceSprite.width = this.CARD_WIDTH;
      cardFaceSprite.height = this.CARD_HEIGHT;
      cardContainer.addChild(cardFaceSprite);
    } else {
      const cardBackground = new PIXI.Graphics();
      cardBackground.name = 'cardFallbackBg';
      cardBackground.roundRect(0, 0, this.CARD_WIDTH, this.CARD_HEIGHT, 6).fill(0x333355);
      cardContainer.addChild(cardBackground);

      const cardNameText = new PIXI.Text({ text: card.name || '', style: { fontSize: 12, fill: 0xffffff, fontFamily: 'Russo One' }});
      cardNameText.name = 'cardFallbackName';
      cardNameText.anchor.set(0.5, 0);
      cardNameText.position.set(50, 5);
      cardContainer.addChild(cardNameText);
    }

    cardContainer.scale.set(scale);
    cardContainer.eventMode = 'static';
    return cardContainer;
  }

  setCostBadge(container, cost) {
    if (!cost && cost !== 0) return;
    const costBadgeGraphics = new PIXI.Graphics();
    costBadgeGraphics.name = 'costBadge';
    costBadgeGraphics.circle(14, 14, 12).fill(0xff8800);
    container.addChildAt(costBadgeGraphics, 0);

    const costText = new PIXI.Text({ text: String(cost), style: { fontSize: 14, fill: 0xffffff, fontWeight: 'bold' }});
    costText.name = 'costText';
    costText.anchor.set(0.5);
    costText.position.set(14, 14);
    container.addChild(costText);
  }

  setCounterBadge(container, counterValue) {
    if (counterValue == null) return;
    const badgeGraphics = new PIXI.Graphics();
    badgeGraphics.name = 'counterBadge';
    badgeGraphics.circle(this.CARD_WIDTH - 14, this.CARD_HEIGHT - 14, 12).fill(0xff8844);
    container.addChildAt(badgeGraphics, 0);

    const text = new PIXI.Text({ text: String(counterValue), style: { fontSize: 12, fill: 0xffffff, fontWeight: 'bold' }});
    text.name = 'counterText';
    text.anchor.set(0.5);
    text.position.set(this.CARD_WIDTH - 14, this.CARD_HEIGHT - 14);
    container.addChild(text);
  }

  setPowerBadge(container, power, hasDON = false) {
    if (power == null) return null;
    const powerText = new PIXI.Text({ text: String(power), style: {
      fontSize: 30,
      fill: hasDON ? 0xffd700 : 0xffffff,
      stroke: { color: 0x000000, width: 4 },
      fontFamily: 'Russo One',
    }});
    powerText.name = 'powerBadge';
    powerText.anchor.set(0.5, 1);
    powerText.position.set(this.CARD_WIDTH / 2, this.CARD_HEIGHT + 2);
    container.addChild(powerText);
    return powerText;
  }

  markRested(container) {
    container.rotation = Math.PI / 2;
  }

  markActive(container) {
    container.rotation = 0;
  }

  createDragGhost(card, baseScale = 0.95) {
    const ghostContainer = new PIXI.Container();
    ghostContainer.name = 'dragGhost';
    const scale = baseScale * 1.15;
    ghostContainer.dragW = this.CARD_WIDTH * scale;
    ghostContainer.dragH = this.CARD_HEIGHT * scale;

    const ghostShadow = new PIXI.Graphics();
    ghostShadow.name = 'ghostShadow';
    ghostShadow.ellipse(ghostContainer.dragW / 2, ghostContainer.dragH + 6, ghostContainer.dragW * 0.42, 8).fill({ color: 0x000000, alpha: 0.22 });
    ghostContainer.addChild(ghostShadow);

    const ghostCardSprite = this.render(card, false, scale);
    ghostContainer.addChild(ghostCardSprite);

    const ghostGlow = new PIXI.Graphics();
    ghostGlow.name = 'ghostGlow';
    ghostGlow.roundRect(-2, -2, ghostContainer.dragW + 4, ghostContainer.dragH + 4, 8).stroke({ width: 3, color: 0xFFD700, alpha: 0.6 });
    ghostContainer.addChildAt(ghostGlow, 1);

    ghostContainer.alpha = 0.88;
    ghostContainer.eventMode = 'none';
    return ghostContainer;
  }

  createDropHighlight(slotW, slotH, color = 0x4CAF50) {
    const dropHighlightGraphics = new PIXI.Graphics();
    dropHighlightGraphics.name = 'dropHighlight';
    const c = new PIXI.Color(color);
    dropHighlightGraphics.roundRect(0, 0, slotW, slotH, 6).fill({ color: c, alpha: 0.15 }).stroke({ width: 3, color: c, alpha: 0.9 });
    dropHighlightGraphics.alpha = 0;
    dropHighlightGraphics.eventMode = 'none';
    return dropHighlightGraphics;
  }

  createSlotBorder(slotW, slotH, color = 0x4CAF50) {
    const slotBorderGraphics = new PIXI.Graphics();
    slotBorderGraphics.name = 'slotBorder';
    const c = new PIXI.Color(color);
    slotBorderGraphics.roundRect(0, 0, slotW, slotH, 6).stroke({ width: 2, color: c, alpha: 0.7 });
    slotBorderGraphics.eventMode = 'none';
    return slotBorderGraphics;
  }

  createDONGhost() {
    const donGhostContainer = new PIXI.Container();
    donGhostContainer.name = 'donDragGhost';
    const size = 40;
    donGhostContainer.dragW = size;
    donGhostContainer.dragH = size;

    const donGhostShadow = new PIXI.Graphics();
    donGhostShadow.name = 'donGhostShadow';
    donGhostShadow.ellipse(size / 2, size + 4, size * 0.5, 6).fill({ color: 0x000000, alpha: 0.22 });
    donGhostContainer.addChild(donGhostShadow);

    const donSprite = new PIXI.Sprite(PIXI.Texture.from('assets/imgs/don.png'));
    donSprite.name = 'donGhostSprite';
    donSprite.width = size;
    donSprite.height = size;
    donSprite.anchor.set(0.5);
    donSprite.position.set(size / 2, size / 2);
    donGhostContainer.addChild(donSprite);

    donGhostContainer.alpha = 0.88;
    donGhostContainer.eventMode = 'none';
    return donGhostContainer;
  }
}

export default CardRenderer;
