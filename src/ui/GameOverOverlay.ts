import { gsap } from 'gsap';
import { makeFlyCard } from '../core/animations/utils';

class GameOverOverlay {
  constructor(app, renderer, players, zoneManager) {
    this.app = app;
    this.renderer = renderer;
    this.players = players;
    this.zoneManager = zoneManager;
    this.container = null;
    this._tickerRef = null;
    this._ghostContainer = null;
  }

  show(winnerPid) {
    if (this.container || this._ghostContainer) return;

    const { app } = this;
    const w = app.screen.width;
    const h = app.screen.height;
    const CARD_SCALE = 2;
    const cardW = this.renderer.CARD_WIDTH * CARD_SCALE;
    const cardH = this.renderer.CARD_HEIGHT * CARD_SCALE;
    const CARD_GAP = 160;
    const totalCardsW = cardW * 2 + CARD_GAP;
    const rowX = (w - totalCardsW) / 2;
    const cardCenterY = h / 2 - 20;

    // Compute target positions for each ghost (same as overlay card positions)
    const targetPositions = [];
    for (let i = 0; i < 2; i++) {
      const cx = rowX + (cardW + CARD_GAP) * i + cardW / 2;
      targetPositions.push({ x: cx, y: cardCenterY });
    }

    // Dark overlay (added first so ghosts render on top)
    const overlay = new PIXI.Graphics();
    overlay.name = 'gameOverGhostOverlay';
    overlay.rect(0, 0, w, h).fill({ color: 0x000000 });
    overlay.alpha = 0;
    overlay.eventMode = 'none';
    app.stage.addChild(overlay);

    // Ghost cards from leader zones
    const ghosts = [];
    const startPositions = [];
    for (let i = 0; i < 2; i++) {
      const pid = i + 1;
      const leader = this.players[pid].leader;
      const zone = this.zoneManager.getZone(pid, 'leader');
      const slotCenterX = zone ? zone.width / 2 : this.renderer.CARD_WIDTH / 2;
      const slotCenterY = zone ? zone.height / 2 : this.renderer.CARD_HEIGHT / 2;
      const slotStagePos = zone
        ? app.stage.toLocal(zone.toGlobal(new PIXI.Point(slotCenterX, slotCenterY)))
        : new PIXI.Point(targetPositions[i].x, targetPositions[i].y);
      startPositions.push(slotStagePos);

      const displayTexture = leader.imgPath ? PIXI.Texture.from(leader.imgPath) : null;
      const ghost = makeFlyCard(displayTexture, leader, this.renderer.CARD_WIDTH, this.renderer.CARD_HEIGHT);
      ghost.x = slotStagePos.x;
      ghost.y = slotStagePos.y;
      ghost.alpha = 1;
      ghost.eventMode = 'none';
      ghost.tint = 0x88ccff;
      ghost.scale.set(CARD_SCALE);
      app.stage.addChild(ghost);
      ghosts.push(ghost);
    }

    // Animate ghosts to target positions, then show overlay
    const dur = 1.2;
    const proxy = { t: 0 };
    gsap.to(proxy, {
      t: 1,
      duration: dur,
      ease: 'power2.out',
      onUpdate: () => {
        const p = proxy.t;
        const e = 1 - Math.pow(1 - p, 3);

        for (let i = 0; i < 2; i++) {
          ghosts[i].x = startPositions[i].x + (targetPositions[i].x - startPositions[i].x) * e;
          ghosts[i].y = startPositions[i].y + (targetPositions[i].y - startPositions[i].y) * e;
        }
        overlay.alpha = e * 0.88;
      },
      onComplete: () => {
        for (const g of ghosts) { if (g.parent) g.parent.removeChild(g); }
        if (overlay.parent) overlay.parent.removeChild(overlay);
        this._buildOverlay(winnerPid, w, h, CARD_SCALE, cardW, cardH, CARD_GAP, cardCenterY);
      },
    });
  }

  _buildOverlay(winnerPid, w, h, CARD_SCALE, cardW, cardH, CARD_GAP, cardCenterY) {
    this.container = new PIXI.Container();
    this.container.name = 'gameOverOverlay';
    this.container.eventMode = 'passive';

    // Dark background (already at 0.88 from ghost overlay)
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, w, h).fill({ color: 0x000000, alpha: 0.88 });
    this.container.addChild(bg);

    // GAME OVER title
    const titleText = this._text('GAME OVER', 128, 0xffffff, 'Russo One', {
      dropShadow: true, dropShadowColor: 0x000000, dropShadowBlur: 20, dropShadowDistance: 4,
    });
    titleText.anchor.set(0.5);
    titleText.position.set(w / 2, 110);
    this.container.addChild(titleText);

    // --- Layout ---
    const totalCardsW = cardW * 2 + CARD_GAP;
    const rowX = (w - totalCardsW) / 2;

    for (let i = 0; i < 2; i++) {
      const pid = i + 1;
      const isWinner = pid === winnerPid;
      const cx = rowX + (cardW + CARD_GAP) * i + cardW / 2;

      // Card
      const leader = this.players[pid].leader;
      const card = this.renderer.render(leader, false, CARD_SCALE);
      card.pivot.set(this.renderer.CARD_WIDTH / 2, this.renderer.CARD_HEIGHT / 2);
      card.position.set(cx, cardCenterY);
      this._applyCardEffect(card, isWinner);
      this.container.addChild(card);

      // Result text below card
      const resultFontSize = isWinner ? 44 : 36;
      const resultY = cardCenterY + cardH / 2 + 20 + resultFontSize / 2;
      const resultLabel = this._text(
        isWinner ? 'WINNER' : 'LOSER',
        isWinner ? 44 : 36,
        isWinner ? 0xffd700 : 0x888888,
        'Russo One',
        isWinner
          ? { dropShadow: true, dropShadowColor: 0xffaa00, dropShadowBlur: 12, dropShadowDistance: 3 }
          : {}
      );
      resultLabel.anchor.set(0.5);
      resultLabel.position.set(cx, resultY);
      this.container.addChild(resultLabel);
    }

    // Restart button
    const btnW = 220;
    const btnH = 52;
    const btnX = w / 2;
    const btnY = cardCenterY + cardH / 2 + 140;
    const btnBg = this._button(btnW, btnH, 0x4CAF50, 0x66BB6A);
    btnBg.position.set(btnX - btnW / 2, btnY);
    btnBg.on('pointerdown', () => { this.hide(); location.reload(); });
    this.container.addChild(btnBg);

    const btnLabel = this._text('RESTART', 26, 0xffffff, 'Russo One');
    btnLabel.anchor.set(0.5);
    btnLabel.position.set(btnX, btnY + btnH / 2);
    this.container.addChild(btnLabel);

    // Add to stage (instant, dark bg already set from ghost overlay)
    this.app.stage.addChild(this.container);
    this.container.alpha = 1;

    gsap.from(titleText.scale, { x: 0.5, y: 0.5, duration: 0.4, ease: 'back.out(1.7)' });
  }

  _applyCardEffect(cardSprite, isWinner) {
    if (isWinner) {
      const glow = new PIXI.filters.GlowFilter({
        distance: 30,
        outerStrength: 5,
        innerStrength: 0,
        color: 0xffd700,
        quality: 0.2,
      });
      glow._isGameOverGlow = true;
      cardSprite.filters = [glow];

      if (!this._tickerRef) {
        this._tickerRef = () => this._pulseGlow();
        this.app.ticker.add(this._tickerRef);
      }
    }
  }

  _pulseGlow() {
    if (!this.container) return;
    const t = performance.now() / 1000;
    const s = Math.sin(t * Math.PI * 1.5);
    const factor = 3 + 2 * (0.5 + 0.5 * s);
    this.container.children.forEach((child) => {
      if (child.filters?.length) {
        const g = child.filters[0];
        if (g?._isGameOverGlow) {
          g.outerStrength = factor;
        }
      }
    });
  }

  _text(content, size, color, font, shadow) {
    return new PIXI.Text({
      text: content,
      style: {
        fontSize: size,
        fill: color,
        fontFamily: font,
        ...shadow,
      },
    });
  }

  _button(w, h, color, hoverColor) {
    const g = new PIXI.Graphics();
    g.roundRect(0, 0, w, h, 12).fill({ color, alpha: 0.9 });
    g.eventMode = 'static';
    g.on('pointerover', () => {
      g.clear();
      g.roundRect(0, 0, w, h, 12).fill({ color: hoverColor, alpha: 1 });
    });
    g.on('pointerout', () => {
      g.clear();
      g.roundRect(0, 0, w, h, 12).fill({ color, alpha: 0.9 });
    });
    return g;
  }

  hide() {
    if (this._tickerRef) {
      this.app.ticker.remove(this._tickerRef);
      this._tickerRef = null;
    }
    if (this._ghostContainer) {
      this.app.stage.removeChild(this._ghostContainer);
      this._ghostContainer = null;
    }
    if (this.container) {
      this.app.stage.removeChild(this.container);
      this.container = null;
    }
  }
}

export default GameOverOverlay;
