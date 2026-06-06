const SEG_W = 96;
const SEG_H = 44;
const GAP = 6;
const ARROW_W = 14;
const PAD = 18;
const PHASE_POSITION = { x: 275, y: 360 };
const COMBAT_ZONE_W = 650;
const COMBAT_ZONE_H = 72;
const PHASES = ['Refresh', 'Draw', 'DON!!', 'Main', 'End'];

class CombatZone {
  constructor(app) {
    this.app = app;
    this.container = null;
    this._phaseLabel = null;
    this._timerLabel = null;
    this._atkInfo = null;
    this._defInfo = null;
    this._totalW = PHASES.length * SEG_W + (PHASES.length - 1) * (GAP + ARROW_W);
    this._bgW = COMBAT_ZONE_W;
    this._bgH = COMBAT_ZONE_H;
    this._timerInterval = null;
    this._remainingSeconds = 0;
  }

  show(attacker, defender, phase) {
    if (this.container) return;

    this.container = new PIXI.Container();
    this.container.name = 'combatZone';
    this.container.position.set(PHASE_POSITION.x, PHASE_POSITION.y);
    this.app.stage.addChild(this.container);

    // Background — same size as center zone
    const bg = new PIXI.Graphics();
    bg.name = 'combatZoneBg';
    bg.roundRect(0, 0, this._bgW, this._bgH, 18)
      .fill({ color: 0x1a0a0a, alpha: 0.95 })
      .stroke({ width: 2, color: 0xff4422, alpha: 0.8 });
    this.container.addChild(bg);

    // Center positions for layout
    const centerX = this._bgW / 2;
    const centerY = this._bgH / 2;
    const sideGap = 210; // distance from center to attacker/defender info

    // Attacker info (left side)
    const atkName = new PIXI.Text({
      text: attacker.name || 'Attacker',
      style: { fontSize: 16, fill: 0xff6644, fontFamily: 'Russo One', align: 'center' },
    });
    atkName.name = 'combatAtkName';
    atkName.anchor.x = 0.5;
    atkName.position.set(centerX - sideGap, PAD + 2);
    this.container.addChild(atkName);

    const atkPower = new PIXI.Text({
      text: `${attacker.currentPower || attacker.power || 0} PWR`,
      style: { fontSize: 18, fill: 0xffd700, fontFamily: 'Russo One', align: 'center' },
    });
    atkPower.name = 'combatAtkPower';
    atkPower.anchor.x = 0.5;
    atkPower.position.set(centerX - sideGap, PAD + 22);
    this.container.addChild(atkPower);

    this._atkInfo = { name: atkName, power: atkPower };

    // Defender info (right side) — symmetric mirror of attacker
    const defName = new PIXI.Text({
      text: defender.name || 'Defender',
      style: { fontSize: 16, fill: 0x44aaff, fontFamily: 'Russo One', align: 'center' },
    });
    defName.name = 'combatDefName';
    defName.anchor.x = 0.5;
    defName.position.set(centerX + sideGap, PAD + 2);
    this.container.addChild(defName);

    const defPower = new PIXI.Text({
      text: `${defender.currentPower || defender.power || 0} PWR`,
      style: { fontSize: 18, fill: 0xffd700, fontFamily: 'Russo One', align: 'center' },
    });
    defPower.name = 'combatDefPower';
    defPower.anchor.x = 0.5;
    defPower.position.set(centerX + sideGap, PAD + 22);
    this.container.addChild(defPower);

    this._defInfo = { name: defName, power: defPower };

    // Phase label (center)
    this._phaseLabel = new PIXI.Text({
      text: phase,
      style: { fontSize: 18, fill: 0xffffff, fontFamily: 'Russo One', align: 'center' },
    });
    this._phaseLabel.name = 'combatPhaseLabel';
    this._phaseLabel.anchor.set(0.5);
    this._phaseLabel.position.set(centerX, centerY - 6);
    this.container.addChild(this._phaseLabel);

    // Timer label (below phase)
    this._timerLabel = new PIXI.Text({
      text: '',
      style: { fontSize: 14, fill: 0xffaa44, fontFamily: 'Russo One', align: 'center' },
    });
    this._timerLabel.name = 'combatTimerLabel';
    this._timerLabel.anchor.set(0.5);
    this._timerLabel.position.set(centerX, centerY + 16);
    this.container.addChild(this._timerLabel);

    // Divider lines — between side info and center phase label
    const divider1 = new PIXI.Graphics();
    divider1.name = 'combatDivider1';
    divider1.moveTo(centerX - sideGap / 2, 0).lineTo(centerX - sideGap / 2, this._bgH)
      .stroke({ width: 1, color: 0x444466, alpha: 0.5 });
    this.container.addChild(divider1);

    const divider2 = new PIXI.Graphics();
    divider2.name = 'combatDivider2';
    divider2.moveTo(centerX + sideGap / 2, 0).lineTo(centerX + sideGap / 2, this._bgH)
      .stroke({ width: 1, color: 0x444466, alpha: 0.5 });
    this.container.addChild(divider2);
  }

  updatePhase(phase) {
    if (this._phaseLabel) {
      this._phaseLabel.text = phase;
      this._phaseLabel.style.dirty = true;
    }
  }

  updatePower(attacker, defender) {
    if (this._atkInfo) {
      const atkPwr = (attacker.currentPower || attacker.power || 0) + (attacker._counterBoost || 0);
      this._atkInfo.power.text = `${atkPwr} PWR`;
      this._atkInfo.power.style.dirty = true;
    }
    if (this._defInfo) {
      const defPwr = (defender.currentPower || defender.power || 0) + (defender._counterBoost || 0);
      this._defInfo.power.text = `${defPwr} PWR`;
      this._defInfo.power.style.dirty = true;
    }
  }

  updateDefender(defender) {
    if (this._defInfo) {
      this._defInfo.name.text = defender.name || 'Defender';
      this._defInfo.name.style.dirty = true;
      const defPwr = (defender.currentPower || defender.power || 0) + (defender._counterBoost || 0);
      this._defInfo.power.text = `${defPwr} PWR`;
      this._defInfo.power.style.dirty = true;
    }
  }

  startTimer(seconds) {
    this.stopTimer();
    this._remainingSeconds = seconds;
    this._updateTimerText();
    this._timerInterval = setInterval(() => {
      this._remainingSeconds--;
      if (this._remainingSeconds <= 0) {
        this.stopTimer();
        return;
      }
      this._updateTimerText();
    }, 1000);
  }

  stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    this._remainingSeconds = 0;
    if (this._timerLabel) {
      this._timerLabel.text = '';
    }
  }

  _updateTimerText() {
    if (!this._timerLabel) return;
    const s = Math.max(0, this._remainingSeconds);
    this._timerLabel.text = `${s}s remaining`;
    // Turn red when under 5 seconds
    this._timerLabel.style.fill = s <= 5 ? 0xff4422 : 0xffaa44;
    this._timerLabel.style.dirty = true;
  }

  hide() {
    this.stopTimer();
    if (!this.container) return;
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
    this.container = null;
    this._phaseLabel = null;
    this._timerLabel = null;
    this._atkInfo = null;
    this._defInfo = null;
  }
}

export default CombatZone;
