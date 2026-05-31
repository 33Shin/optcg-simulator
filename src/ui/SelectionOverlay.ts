class SelectionOverlay {
  constructor(app, renderer) {
    this.app = app;
    this.renderer = renderer;
    this.container = null;
    this.flyCards = [];
  }

  showMulligan(pid, cards, options) {
    return new Promise((resolve) => {
      this.flyCards = [];
      this._setupOverlay();
      this._setupPrompt(options.prompt || 'Keep your hand or mulligan?');
      this._setupButtons([
        {
          label: 'Keep Hand',
          color: 0x4CAF50,
          callback: () => { this._destroyOverlay(); resolve(true); }
        },
        {
          label: 'Mulligan',
          color: 0xff9800,
          callback: () => { this._destroyOverlay(); resolve(false); }
        },
      ]);
    });
  }

  _destroyOverlay() {
    if (!this.container) return;
    this.container.eventMode = 'auto';
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container = null;
    this.cardSprites = [];
    this.buttons = [];
    this.promptText = null;
  }

  _setupOverlay() {
    this.container = new PIXI.Container();
    this.container.name = 'selectionOverlay';
    this.container.eventMode = 'auto';
    this.container.hitArea = null;

    const overlayBackground = new PIXI.Graphics();
    overlayBackground.name = 'overlayBg';
    overlayBackground.rect(0, 0, this.app.renderer.width, this.app.renderer.height).fill({ color: 0x000000, alpha: 0.6 });
    overlayBackground.eventMode = 'none';
    this.container.addChild(overlayBackground);

    this.promptText = null;
    this.cardSprites = [];
    this.buttons = [];

    this.app.stage.addChild(this.container);
  }

  _setupPrompt(text) {
    this.promptText = new PIXI.Text({
      text: text,
      style: {
        fontSize: 28,
        fill: 0xffffff,
        fontFamily: 'Russo One',
      },
    });
    this.promptText.name = 'overlayPrompt';
    this.promptText.anchor.set(0.5, 0);
    this.promptText.position.set(600, 200);
    this.container.addChild(this.promptText);
  }

  _setupButtons(buttons) {
    const btnW = 180;
    const btnH = 48;
    const totalW = buttons.length * btnW + (buttons.length - 1) * 20;
    const startX = 600 - totalW / 2;
    const Y = 590;

    buttons.forEach((btn, i) => {
      const bx = startX + i * (btnW + 20);

      const buttonBackground = new PIXI.Graphics();
      buttonBackground.name = `overlayButton_${btn.label}`;
      buttonBackground.roundRect(0, 0, btnW, btnH, 10).fill({ color: btn.color, alpha: 0.85 });
      buttonBackground.position.set(bx, Y);
      buttonBackground.eventMode = 'static';
      buttonBackground.cursor = 'pointer';
      buttonBackground.hitArea = new PIXI.Rectangle(0, 0, btnW, btnH);

      const buttonText = new PIXI.Text({
        text: btn.label,
        style: {
          fontSize: 18,
          fill: 0xffffff,
          fontFamily: 'Russo One',
        },
      });
      buttonText.name = `overlayButtonText_${btn.label}`;
      buttonText.anchor.set(0.5);
      buttonText.position.set(bx + btnW / 2, Y + btnH / 2);
      buttonText.eventMode = 'none';

      const buttonHoverBackground = new PIXI.Graphics();
      buttonHoverBackground.name = `overlayButtonHover_${btn.label}`;
      buttonHoverBackground.roundRect(0, 0, btnW, btnH, 10).fill({ color: 0xffffff, alpha: 0 });
      buttonHoverBackground.position.set(bx, Y);
      buttonHoverBackground.eventMode = 'none';

      buttonBackground.on('pointerover', () => {
        buttonHoverBackground.alpha = 0.15;
      });
      buttonBackground.on('pointerout', () => {
        buttonHoverBackground.alpha = 0;
      });
      buttonBackground.on('pointerdown', btn.callback);

      this.container.addChild(buttonHoverBackground);
      this.container.addChild(buttonBackground);
      this.container.addChild(buttonText);
      this.buttons.push({ bg: buttonBackground, hoverBg: buttonHoverBackground, text: buttonText });
    });
  }

  _destroy() {
    if (this.container) {
      this.app.stage.removeChild(this.container);
      this.container = null;
    }
    this.cardSprites = [];
    this.buttons = [];
    this.promptText = null;
  }

  /**
   * Show a dialog to select a Blocker character.
   * @param {Array} blockers - Array of active characters with Blocker keyword
   * @param {object} attacker - The attacking character/leader
   * @returns {Promise<object|null>} - Selected blocker card or null
   */
  showBlockerSelection(blockers, attacker) {
    return new Promise((resolve) => {
      this._setupOverlay();

      this._setupPrompt(
        `Incoming attack! (${attacker.name || 'Attacker'})\nSelect a Blocker or skip.`
      );

      const btnW = 140;
      const btnH = 48;
      const gap = 16;
      const totalW = (blockers.length + 1) * btnW + blockers.length * gap;
      const startX = 600 - totalW / 2;
      const Y = 560;

      const buttons = [];

      // One button per blocker
      for (let i = 0; i < blockers.length; i++) {
        buttons.push({
          label: blockers[i].name.length > 12 ? blockers[i].name.slice(0, 11) + '…' : blockers[i].name,
          sublabel: `${blockers[i].currentPower} PWR`,
          color: 0x2196F3,
          callback: () => {
            this._destroyOverlay();
            resolve(blockers[i]);
          },
        });
      }

      // Skip button
      buttons.push({
        label: 'Skip',
        sublabel: '',
        color: 0x666666,
        callback: () => {
          this._destroyOverlay();
          resolve(null);
        },
      });

      this._setupBlockerButtons(buttons, btnW, btnH, gap, startX, Y);
    });
  }

  _setupBlockerButtons(buttons, btnW, btnH, gap, startX, startY) {
    buttons.forEach((btn, i) => {
      const bx = startX + i * (btnW + gap);

      // Background
      const bg = new PIXI.Graphics();
      bg.name = `blockerBtn_${i}`;
      bg.roundRect(0, 0, btnW, btnH, 10)
        .fill({ color: btn.color, alpha: 0.85 });
      bg.position.set(bx, startY);
      bg.eventMode = 'static';
      bg.cursor = 'pointer';

      // Main label
      const text = new PIXI.Text({
        text: btn.label,
        style: {
          fontSize: 14,
          fill: 0xffffff,
          fontFamily: 'Russo One',
        },
      });
      text.name = `blockerBtnText_${i}`;
      text.anchor.set(0.5);
      text.position.set(bx + btnW / 2, startY + btnH / 2 - 8);
      text.eventMode = 'none';

      // Sub label (power)
      let sub = null;
      if (btn.sublabel) {
        sub = new PIXI.Text({
          text: btn.sublabel,
          style: {
            fontSize: 12,
            fill: 0xcccccc,
            fontFamily: 'Russo One',
          },
        });
        sub.name = `blockerBtnSub_${i}`;
        sub.anchor.set(0.5);
        sub.position.set(bx + btnW / 2, startY + btnH / 2 + 10);
        sub.eventMode = 'none';
      }

      // Hover overlay
      const hover = new PIXI.Graphics();
      hover.name = `blockerBtnHover_${i}`;
      hover.roundRect(0, 0, btnW, btnH, 10)
        .fill({ color: 0xffffff, alpha: 0 });
      hover.position.set(bx, startY);
      hover.eventMode = 'none';

      bg.on('pointerover', () => { hover.alpha = 0.15; });
      bg.on('pointerout', () => { hover.alpha = 0; });
      bg.on('pointerdown', btn.callback);

      this.container.addChild(hover);
      this.container.addChild(bg);
      this.container.addChild(text);
      if (sub) this.container.addChild(sub);
    });
  }
}

export default SelectionOverlay;
