

export default class ShuffleAnimation {
  static requires = ['zoneManager', 'zoneRenderer', 'players'];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animateShuffle(pid) {
    return new Promise((resolve) => {
      const { zoneManager, zoneRenderer, players } = this.ctx;
      const deckZone = zoneManager.getZone(pid, 'deck');
      if (!deckZone) { resolve(); return; }

      const player = players[pid];
      const count = player.deck.cards.length;
      if (count < 1) { resolve(); return; }

      const backTexture = PIXI.Texture.from('assets/imgs/back.webp');
      const cardH = deckZone.height - 20;
      const cardW = cardH * (5 / 7);
      const baseX = (deckZone.width - cardW) / 2;
      const baseY = (deckZone.height - cardH) / 2;

      const existing = deckZone.children.filter(c => c.isCardBack);
      existing.forEach(c => deckZone.removeChild(c));

      const shuffleSprites = [], startPoses = [];
      let completedCount = 0;

      const onAllDone = () => {
        shuffleSprites.forEach(s => deckZone.removeChild(s));
        zoneRenderer._renderDeck(pid);
        player.deck.shuffle();
        setTimeout(resolve, 50);
      };

      for (let i = 0; i < count; i++) {
        startPoses.push({ x: baseX, y: baseY });
        const shuffleCardSprite = new PIXI.Sprite(backTexture);
        shuffleCardSprite.name = `shuffleCard_${pid}_${i}`;
        shuffleCardSprite.width = cardW; shuffleCardSprite.height = cardH;
        shuffleCardSprite.position.set(baseX, baseY);
        deckZone.addChild(shuffleCardSprite);
        shuffleSprites.push(shuffleCardSprite);

        const angle = Math.random() * Math.PI * 2;
        const maxDist = Math.max(cardW, cardH) * 0.5;
        const dist = maxDist * (0.3 + Math.random() * 0.7);
        const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;

        setTimeout(() => {
          const start = performance.now();
          const dur = 150 + Math.random() * 75;
          const animate = (now) => {
            const t = Math.min((now - start) / dur, 1);
            const out = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            shuffleCardSprite.x = startPoses[i].x + dx * out;
            shuffleCardSprite.y = startPoses[i].y + dy * out;
            if (t >= 1) {
              deckZone.removeChild(shuffleCardSprite);
              completedCount++;
              if (completedCount >= count) onAllDone();
              return;
            }
            requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }, Math.random() * 500);
      }
    });
  }
}
