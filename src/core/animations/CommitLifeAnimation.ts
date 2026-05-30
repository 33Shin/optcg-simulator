import { easeInOut, makeFlyCard } from './utils';

export default class CommitLifeAnimation {
  static requires = ['zoneManager', 'app', 'zoneRenderer'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animate(pid, player, cards) {
    return new Promise((resolve) => {
      const { zoneManager, app, zoneRenderer } = this.ctx;
      const deckZone = zoneManager.getZone(pid, 'deck');
      const lifeZone = zoneManager.getZone(pid, 'life');
      if (!deckZone || !lifeZone) {
        player.life.push(...cards);
        resolve(true);
        return;
      }
      if (!cards || cards.length === 0) { resolve(true); return; }

      const cardW = 100, cardH = 140;

      const deckC = deckZone.toGlobal(new PIXI.Point(deckZone.width / 2, deckZone.height / 2));
      const fromPos = app.stage.toLocal(deckC);

      const lifeCardH = lifeZone.height - 20;
      const lifeCardW = lifeCardH * (5 / 7);

      const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
      const flightDuration = 600;
      const fadeInMs = 40;
      const staggerMs = 140;
      const arcHeight = 50;

      const landScale = lifeCardW / cardW;
      const startScale = 0.4;
      const peakScale = 1.1;

      let completed = 0;
      const done = () => {
        completed++;
        if (completed === cards.length) {
          resolve(true);
        }
      };

      cards.forEach((card, cIdx) => {
        // Card will land at index = existingLifeCount + cIdx
        const startLifeCount = player.life.length;
        const landIndex = startLifeCount + cIdx;
        const totalAfterAll = startLifeCount + cards.length;

        const step = Math.min((lifeZone.width - lifeCardW) / Math.max(totalAfterAll, 1), 24);
        const toY_zone = (lifeZone.height - lifeCardH) / 2;
        const spriteX = 16 + landIndex * step;
        const spriteY = toY_zone;
        const globalPos = lifeZone.toGlobal(new PIXI.Point(spriteX + lifeCardW / 2, spriteY + lifeCardH / 2));
        const toPos = app.stage.toLocal(globalPos);

        const commitLifeFlyCard = makeFlyCard(backTexture, card, cardW, cardH);
        commitLifeFlyCard.name = `commitLifeCard_${pid}_${cIdx}`;
        const start = performance.now() + cIdx * staggerMs;

        commitLifeFlyCard.position.set(fromPos.x, fromPos.y);
        commitLifeFlyCard.scale.set(startScale, startScale);
        commitLifeFlyCard.alpha = 0;
        app.stage.addChild(commitLifeFlyCard);

        const animLen = flightDuration - fadeInMs;

        requestAnimationFrame(function tick(now) {
          const elapsed = now - start;
          if (elapsed < 0) {
            requestAnimationFrame(tick);
            return;
          }

          if (elapsed < fadeInMs) {
            commitLifeFlyCard.alpha = elapsed / fadeInMs;
            commitLifeFlyCard.x = fromPos.x;
            commitLifeFlyCard.y = fromPos.y;
            commitLifeFlyCard.scale.set(startScale, startScale);
            requestAnimationFrame(tick);
            return;
          }

          const rawT = Math.min((elapsed - fadeInMs) / animLen, 1);
          const et = easeInOut(rawT);

          commitLifeFlyCard.x = fromPos.x + (toPos.x - fromPos.x) * et;
          commitLifeFlyCard.y = fromPos.y + (toPos.y - fromPos.y) * et
                        - 4 * arcHeight * rawT * (1 - rawT);

          let s;
          if (rawT <= 0.5) {
            const ht = easeInOut(rawT / 0.5);
            s = startScale + (peakScale - startScale) * ht;
          } else {
            const ht = easeInOut((rawT - 0.5) / 0.5);
            s = peakScale + (landScale - peakScale) * ht;
          }
          commitLifeFlyCard.scale.set(s, s);
          commitLifeFlyCard.alpha = 1;

          if (rawT < 1) {
            requestAnimationFrame(tick);
          } else {
            commitLifeFlyCard.x = toPos.x;
            commitLifeFlyCard.y = toPos.y;
            commitLifeFlyCard.scale.set(landScale, landScale);
            app.stage.removeChild(commitLifeFlyCard);
            // Push card into life array now, then place sprite
            player.life.push(card);
            zoneRenderer.addLifeCardAt(pid, landIndex);
            done();
          }
        });
      });
    });
  }
}
