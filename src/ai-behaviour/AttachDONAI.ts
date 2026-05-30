import AIBehaviour from './AIBehaviour';

class AttachDONAI extends AIBehaviour {
  async execute() {
    if (!this.canAct()) return false;

    const player = this.player;

    const activeDonCount = () => player.costArea.filter(d => d.active && !d.rested).length;

    const attachTargets = player.field
      .filter(c => c !== null)
      .filter(c => !c.rested && !c.playedThisTurn);

    let anyAttached = false;

    for (const target of attachTargets) {
      if (activeDonCount() > 0) {
        const oldPower = target.currentPower || target.power || 0;
        const newPower = oldPower + 1000;

        const targetZone = this.ai.zoneManager.getZone(this.pid, `field_slot_${player.field.indexOf(target)}`);
        const sprite = targetZone?.children?.find(c => c.isFieldSprite);
        const powerText = sprite?.children?.find(c => c.isPowerText);
        const isAlreadyGold = powerText?.style?.fill === 0xffd700;

        this.ai.donSystem.attachDON(this.pid, target);
        this.ai._renderDONTokens();

        await Promise.all([
          this.ai.animManager.animateDONBurst(targetZone),
          this.ai.animManager.animatePowerCount(powerText, oldPower, newPower, 700, isAlreadyGold ? 0xffd700 : 0xffffff, 0xffd700),
        ]);

        anyAttached = true;
      }
    }

    if (anyAttached) {
      this.renderAll();
      await this.sleep(this.delayMs);
    }

    return anyAttached;
  }
}

export default AttachDONAI;