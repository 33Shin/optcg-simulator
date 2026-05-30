import { makeFlyCard, getDisplayTexture, easeInOut } from './utils';

export default class FlyToTrashAnimation {
  static requires = ['app', 'zoneManager'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * KO animation: red flash + screen shake on the field slot, then ghost card
   * flies to trash zone with rotation, shrink, and fade.
   * Mirrors ActiveAnimation's structure (rAF loop, overlay graphics, cleanup).
   * @param {number} pid - Player ID
   * @param {object} card - Card being KO'd
   * @param {PIXI.Container} fieldSlot - The field slot zone the card occupies
   * @returns {Promise<void>}
   */
  animate(pid, card, fieldSlot) {
    return new Promise((resolve) => {
      const { app, zoneManager } = this.ctx;
      if (!fieldSlot) { resolve(); return; }

      const trashZone = zoneManager.getZone(pid, 'trash');
      if (!trashZone) { resolve(); return; }

      // Hide original field sprite so only ghost card is visible during animation
      const origSprite = fieldSlot.children.find(c => c.isFieldSprite);
      if (origSprite) origSprite.visible = false;

      const cardW = 100, cardH = 140;
      const displayTexture = card.imgPath ? PIXI.Texture.from(card.imgPath) : null;
      const trashFlyCard = makeFlyCard(displayTexture, card, cardW, cardH);
      trashFlyCard.name = 'trashFlyCard';

      const slotCenter = fieldSlot.toGlobal(new PIXI.Point(fieldSlot.width / 2, fieldSlot.height / 2));
      const trashCenter = trashZone.toGlobal(new PIXI.Point(trashZone.width / 2, trashZone.height / 2));
      const slotPos = app.stage.toLocal(slotCenter);
      const trashPos = app.stage.toLocal(trashCenter);

      trashFlyCard.x = slotPos.x;
      trashFlyCard.y = slotPos.y;
      trashFlyCard.alpha = 1;
      // Start rotation matches card's rested state
      trashFlyCard.rotation = card.rested ? Math.PI / 2 : 0;
      app.stage.addChild(trashFlyCard);

      const startRotation = card.rested ? Math.PI / 2 : 0;
      const duration = 400;
      const start = performance.now();

      const tick = (now) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        const e = easeInOut(t);

        // Ghost card: fly to trash
        trashFlyCard.x = slotPos.x + (trashPos.x - slotPos.x) * e;
        trashFlyCard.y = slotPos.y + (trashPos.y - slotPos.y) * e;
        trashFlyCard.rotation = startRotation * (1 - e);
        const trashScale = 0.857;
        const shrink = 1 - e * (1 - trashScale);
        trashFlyCard.scale.set(shrink, shrink);
        trashFlyCard.alpha = 1;

        if (t >= 1) {
          if (trashFlyCard.parent) trashFlyCard.parent.removeChild(trashFlyCard);
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }
}
