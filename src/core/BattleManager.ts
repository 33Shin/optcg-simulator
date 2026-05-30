class BattleManager {
  constructor(players, donSystem, combatSystem, effectSystem, ui, fieldRenderer, zoneManager, animManager) {
    this.players = players;
    this.donSystem = donSystem;
    this.combatSystem = combatSystem;
    this.effectSystem = effectSystem;
    this.ui = ui;
    this.fieldRenderer = fieldRenderer;
    this.zoneManager = zoneManager;
    this.animManager = animManager;
  }

  async resolveBattle(pid, attacker, target, targetPlayer, counterBoosts, onAfterResolve) {
    const targetPid = targetPlayer === this.players[1] ? 1 : 2;
    const attackerZone = this.zoneManager.findZoneForCard(this.players, attacker);
    const targetZone = this.zoneManager.findZoneForCard(this.players, target);

    // Continue attack animation from held state (after counter phase)
    await this.animManager.animateAttackContinueFromHeld();

    attacker.rested = true;

    return this._resolveBattleOutcome(pid, targetPid, attacker, target, targetPlayer, counterBoosts, onAfterResolve);
  }

  async _resolveBattleOutcome(pid, targetPid, attacker, target, targetPlayer, counterBoosts, onAfterResolve) {
    const attackerZone = this.zoneManager.findZoneForCard(this.players, attacker);
    const targetZone = this.zoneManager.findZoneForCard(this.players, target);

    // Calculate power with counter boosts (from Map only — _counterBoost is already reflected in the Map)
    const attackerBoost = (counterBoosts && typeof counterBoosts.get === 'function') ? (counterBoosts.get(attacker) || 0) : 0;
    const defenderBoost = (counterBoosts && typeof counterBoosts.get === 'function') ? (counterBoosts.get(target) || 0) : 0;

    const atkPower = this.combatSystem._calcPower(attacker, [{ value: attackerBoost }]);
    const defPower = this.combatSystem._calcPower(target, [{ value: defenderBoost }]);

    let winner;
    const koAnimations = [];
    if (atkPower > defPower) {
      winner = 'attacker';
      if (target.isLeader || target === targetPlayer.leader) {
        await this.combatSystem.damageLeader(targetPlayer);
      } else {
        const donCount = target.donAttached || 0;
        this.combatSystem.KO(target, targetPlayer);
        this.effectSystem.processOnKO(target, targetPlayer);
        if (donCount > 0 && this.animManager) {
          await this.animManager.animateDONReturnOnKO(targetPid, targetZone, donCount);
        }
        if (this.animManager.flyToTrash && targetZone) {
          koAnimations.push(this.animManager.flyToTrash.animate(targetPid, target, targetZone));
        }
      }
    } else if (defPower > atkPower) {
      winner = 'defender';
    } else {
      // Tie: defender loses per rules
      winner = 'attacker';
      if (target.isLeader || target === targetPlayer.leader) {
        await this.combatSystem.damageLeader(targetPlayer);
      } else {
        const donCount = target.donAttached || 0;
        this.combatSystem.KO(target, targetPlayer);
        this.effectSystem.processOnKO(target, targetPlayer);
        if (donCount > 0 && this.animManager) {
          await this.animManager.animateDONReturnOnKO(targetPid, targetZone, donCount);
        }
        if (this.animManager.flyToTrash && targetZone) {
          koAnimations.push(this.animManager.flyToTrash.animate(targetPid, target, targetZone));
        }
      }
    }

    await Promise.all(koAnimations);

    // Animate power down for surviving defender that was counter-boosted
    if (target._counterBoost && target._counterBoost > 0) {
      const isLeader = target.isLeader || target === targetPlayer.leader;
      const survived = winner === 'defender' || (winner === 'attacker' && isLeader);
      if (survived && targetZone) {
        const targetSprite = targetZone.children.find(c => c.isFieldSprite || c.isLeaderSprite);
        if (targetSprite) {
          const powerText = targetSprite.children.find(c => c.isPowerText);
          if (powerText) {
            const boostedPower = (target.currentPower || target.power || 0) + target._counterBoost;
            const basePower = target.currentPower || target.power || 0;
            await this.animManager.animatePowerCount(
              powerText, boostedPower, basePower, 600,
              0xffd700, 0xffffff
            );
          }
        }
      }
    }

    // Clean up counter boost tracker
    if (attacker._counterBoost) delete attacker._counterBoost;
    if (target._counterBoost) delete target._counterBoost;

    onAfterResolve();
  }
}

export default BattleManager;
