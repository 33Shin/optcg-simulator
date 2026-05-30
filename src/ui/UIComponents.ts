import { highlightKeywords } from './KeywordHighlighter';
import { buildCardInfoHtml, buildPlayButtonHtml } from './CardInfoPanel';
import { createPhaseZone, updatePhaseZone, setPhaseZoneCallbacks } from './PhaseBar';
import { createActionButton, updateActionButton, setActionButtonCallback } from './ActionButton';

const PHASE_POSITION = { x: 302, y: 360 };

class UIComponents {
  constructor(app, state, gameRef) {
    this.app = app;
    this.state = state;
    this._gameRef = gameRef || null;
  }

  init() {
    this.phaseZone = createPhaseZone(this.app, this.state, PHASE_POSITION);
    const btnPos = {
      x: this.app.screen.width,
      y: PHASE_POSITION.y + 36,
      radius: 64,
    };
    this.actionButton = createActionButton(this.app, this.state, btnPos);
    this.updatePhase();
    this._setupOverlay();
    this._setupConfirmDialog();
  }

  setEndTurnCallback(callback) {
    this._onEndTurn = callback;
    if (this.phaseZone) {
      setPhaseZoneCallbacks(this.phaseZone, callback);
    }
    if (this.actionButton) {
      setActionButtonCallback(this.actionButton, callback);
    }
  }

  updatePhase() {
    const turnManager = this._gameRef ? this._gameRef.turnManager : null;
    if (this.phaseZone) {
      updatePhaseZone(this.phaseZone, this.state, turnManager);
    }
    if (this.actionButton) {
      updateActionButton(this.actionButton, this.state, turnManager);
    }
  }

  setEndTurnBtn(enabled) {
    this.updatePhase();
  }

  updateActionBtn() {
    this.updatePhase();
  }

  restoreActionButton() {
    if (this.actionButton) {
      this.actionButton._inBattle = false;
      this.actionButton._tickerPaused = false;
      this.actionButton.actionBg.eventMode = 'static';
      if (!this.actionButton._actionBtnRestored && this.actionButton._actionBtnHandler) {
        this.actionButton.actionBg.on('pointerdown', this.actionButton._actionBtnHandler);
        this.actionButton._actionBtnRestored = true;
      }
    }
    this.updatePhase();
  }

  updateTurn() {
    this.updateActionBtn();
  }

  showCardInfo(card, pid) {
    this._clearInfoPanel();
    const panel = document.getElementById('card-info-panel');
    if (!panel) {
      this._fallbackShowCardInfo(card);
      return;
    }
    panel.innerHTML = buildCardInfoHtml(card);
  }

  showCardInfoWithPlay(card, pid, onPlayCallback) {
    this._clearInfoPanel();
    const panel = document.getElementById('card-info-panel');
    if (!panel) return;

    const getFieldCount = (p) => {
      const game = this._gameRef;
      if (!game || !game.players) return 0;
      return game.players[p].field.filter(c => c !== null).length;
    };

    const canPay = (p, cost) => {
      const game = this._gameRef;
      if (!game || !game.players) return false;
      const player = game.players[p];
      return player.costArea.filter(d => d.active && !d.rested).length >= cost;
    };

    const playButtonHtml = buildPlayButtonHtml(
      null, this.state, card, getFieldCount, canPay, pid
    );

    panel.innerHTML = buildCardInfoHtml(card, playButtonHtml);

    const btn = document.getElementById('play-card-btn');
    if (btn && btn.disabled === false) {
      btn.addEventListener('click', onPlayCallback);
    }
  }

  _fallbackShowCardInfo(card) {
    this._clearInfoPanel();
    const lines = [];
    lines.push(`${card.name || ''}`);
    if (card.category === 'character') {
      lines.push(`Cost: ${card.cost}`);
      if (card.power !== null && card.power !== undefined) lines.push(`Power: ${card.power}`);
      if (card.counter !== null && card.counter !== undefined) lines.push(`Counter: ${card.counter}`);
      if (card.type) lines.push(`Type: ${card.type}`);
    } else if (card.category === 'event' || card.category === 'leader') {
      if (card.type) lines.push(`Type: ${card.type}`);
      if (card.power !== null && card.power !== undefined) lines.push(`Power: ${card.power}`);
      if (card.life !== null && card.life !== undefined) lines.push(`Life: ${card.life}`);
    }
    if (card.effect) lines.push(card.effect);
    const text = new PIXI.Text({ text: lines.join('\n\n'), style: { fontSize: 10, fill: 0xcccccc, lineHeight: 14 }});
    text.position.set(885, 280);
    this.app.stage.addChild(text);
    this.infoTexts = this.infoTexts || [];
    this.infoTexts.push(text);
  }

  _clearInfoPanel() {
    if (this.infoTexts) {
      for (const t of this.infoTexts) this.app.stage.removeChild(t);
    }
    this.infoTexts = [];
  }

  _setupOverlay() {
    const overlay = document.getElementById('game-overlay');
    overlay.innerHTML = `
      <div id="card-info-panel" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;"></div>
      <div id="confirm-dialog" style="display:none;padding:16px;border-top:1px solid #334466;background:rgba(10,10,30,0.95);">
        <p id="confirm-question" style="color:#ffffff;font-size:14px;margin-bottom:12px;font-family:'Inter',sans-serif;"></p>
        <div style="display:flex;gap:12px;">
          <button id="confirm-yes" style="flex:1;padding:8px 16px;background:#4CAF50;color:#fff;border:none;border-radius:6px;font-family:'Inter',sans-serif;cursor:pointer;font-size:13px;">Yes</button>
          <button id="confirm-no" style="flex:1;padding:8px 16px;background:#f44336;color:#fff;border:none;border-radius:6px;font-family:'Inter',sans-serif;cursor:pointer;font-size:13px;">No</button>
        </div>
      </div>
    `;
  }

  _setupConfirmDialog() {
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');
    if (yesBtn) yesBtn.addEventListener('click', () => this._onConfirm(true));
    if (noBtn) noBtn.addEventListener('click', () => this._onConfirm(false));
  }

  _onConfirm(result) {
    const dialog = document.getElementById('confirm-dialog');
    if (dialog) dialog.style.display = 'none';
    if (this._confirmCallback) {
      this._confirmCallback(result);
      this._confirmCallback = null;
    }
  }

  showConfirm(question, callback) {
    this._confirmCallback = callback;
    const questionEl = document.getElementById('confirm-question');
    if (questionEl) questionEl.textContent = question;
    const dialog = document.getElementById('confirm-dialog');
    if (dialog) dialog.style.display = 'block';
  }

  hideConfirm() {
    const dialog = document.getElementById('confirm-dialog');
    if (dialog) dialog.style.display = 'none';
    this._confirmCallback = null;
  }
}

export default UIComponents;