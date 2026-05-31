export function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Check if a global point is inside a zone's bounds. */
export function isPointInZone(zone, globalPoint) {
  const lp = zone.toLocal(globalPoint);
  return lp.x >= 0 && lp.x <= zone.width && lp.y >= 0 && lp.y <= zone.height;
}

/** Get effective power of a card including counter boosts. */
export function getEffectivePower(card) {
  if (!card) return 0;
  return (card.currentPower || card.power || 0) + (card._counterBoost || 0);
}

/**
 * Build a narrowed context object for an animation class.
 * Only includes the keys declared in the class's static `requires` array.
 */
export function narrowContext(fullCtx, AnimationClass) {
  const requires = AnimationClass.requires;
  if (!requires || requires.length === 0) return {};
  const narrowed = {};
  for (const key of requires) {
    if (key in fullCtx) narrowed[key] = fullCtx[key];
  }
  return narrowed;
}

export function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function makeFlyCard(texture, card, cardW, cardH) {
  const flyCard = new PIXI.Container();
  flyCard.name = `flyCard_${card.cardId || 'unknown'}`;
  if (texture) {
    const sp = new PIXI.Sprite(texture);
    sp.name = 'flyCardSprite';
    sp.width = cardW; sp.height = cardH;
    flyCard.addChild(sp);
  } else {
    const bg = new PIXI.Graphics();
    bg.name = 'flyCardFallbackBg';
    bg.roundRect(0, 0, cardW, cardH, 6).fill(0x333355);
    flyCard.addChild(bg);
    const nameText = new PIXI.Text({ text: card.name || '', style: { fontSize: 12, fill: 0xffffff, fontFamily: 'Russo One' }});
    nameText.name = 'flyCardNameText';
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cardW / 2, 5);
    flyCard.addChild(nameText);
  }
  flyCard.pivot.set(cardW / 2, cardH / 2);
  return flyCard;
}

export function createFlipCard(frontTexture, card, cardW, cardH) {
  const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
  const container = new PIXI.Container();
  container.name = `flipCard_${card.cardId || 'unknown'}`;

  const makeSprite = (tex) => {
    if (tex) {
      const sp = new PIXI.Sprite(tex);
      sp.name = 'flipCardSprite';
      sp.width = cardW; sp.height = cardH;
      return sp;
    }
    const bg = new PIXI.Graphics();
    bg.name = 'flipCardFallbackBg';
    bg.roundRect(0, 0, cardW, cardH, 6).fill(0x333355);
    const nameText = new PIXI.Text({ text: card.name || '', style: { fontSize: 12, fill: 0xffffff, fontFamily: 'Russo One' }});
    nameText.name = 'flipCardNameText';
    nameText.anchor.set(0.5, 0);
    nameText.position.set(cardW / 2, 5);
    bg.addChild(nameText);
    return bg;
  };

  const frontSprite = makeSprite(frontTexture);
  const backSprite = makeSprite(backTexture);
  backSprite.visible = false;
  container.addChild(frontSprite);
  container.addChild(backSprite);
  container.pivot.set(cardW / 2, cardH / 2);

  container._frontSprite = frontSprite;
  container._backSprite = backSprite;

  container.showFront = () => {
    container._frontSprite.visible = true;
    container._backSprite.visible = false;
    container.scale.x = Math.abs(container.scale.x) || 1;
  };
  container.showBack = () => {
    container._frontSprite.visible = false;
    container._backSprite.visible = true;
    container.scale.x = Math.abs(container.scale.x) || 1;
  };

  container.showBack();
  return container;
}

const backTexture = PIXI.Texture.from('assets/imgs/back.webp');

export function getDisplayTexture(pid, card) {
  return pid === 2 ? backTexture : (card.imgPath ? PIXI.Texture.from(card.imgPath) : null);
}
