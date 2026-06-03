import InitialDrawAnimation from './animations/InitialDrawAnimation';
import DONDrawAnimation from './animations/DONDrawAnimation';
import DONSlamAnimation from './animations/DONSlamAnimation';
import DONDetachAnimation from './animations/DONDetachAnimation';
import DONRestAnimation from './animations/DONRestAnimation';
import DONReturnOnKOAnimation from './animations/DONReturnOnKOAnimation';
import DONBurstAnimation from './animations/DONBurstAnimation';
import CounterCardAnimation from './animations/CounterCardAnimation';
import PowerCountAnimation from './animations/PowerCountAnimation';
import BlockerActivateAnimation from './animations/BlockerActivateAnimation';
import BlockerRestAnimation from './animations/BlockerRestAnimation';
import ActiveAnimation from './animations/ActiveAnimation';
import ShuffleAnimation from './animations/ShuffleAnimation';
import CountdownAnimation from './animations/CountdownAnimation';
import CommitLifeAnimation from './animations/CommitLifeAnimation';
import SlamAnimation from './animations/SlamAnimation';
import FlyToTrashAnimation from './animations/FlyToTrashAnimation';
import FlyToBottomDeckAnimation from './animations/FlyToBottomDeckAnimation';
import AttackAnimation from './animations/AttackAnimation';
import AIPlayAnimation from './animations/AIPlayAnimation';
import AICounterAnimation from './animations/AICounterAnimation';
import AbilityActivateAnimation from './animations/AbilityActivateAnimation';
import MultipleDrawAnimation from './animations/MultipleDrawAnimation';
import CardPickAnimation from './animations/CardPickAnimation';
import DamageTriggerAnimation from './animations/DamageTriggerAnimation';
import { narrowContext } from './animations/utils';

class AnimationManager {
  constructor(app, gameBoard, zoneManager, renderer, players, handRenderer, zoneRenderer, donSystem, ui) {
    this.ctx = { app, gameBoard, zoneManager, renderer, players, handRenderer, zoneRenderer, donSystem, ui };

    this.initialDraw = new InitialDrawAnimation(narrowContext(this.ctx, InitialDrawAnimation));
    this.initialDraw.name = 'initialDraw';
    this.donDraw = new DONDrawAnimation(narrowContext(this.ctx, DONDrawAnimation));
    this.donDraw.name = 'donDraw';
    this.donDetach = new DONDetachAnimation(narrowContext(this.ctx, DONDetachAnimation));
    this.donDetach.name = 'donDetach';
    this.donRest = new DONRestAnimation(narrowContext(this.ctx, DONRestAnimation));
    this.donRest.name = 'donRest';
    this.donReturnOnKO = new DONReturnOnKOAnimation(narrowContext(this.ctx, DONReturnOnKOAnimation));
    this.donReturnOnKO.name = 'donReturnOnKO';
    this.donBurst = new DONBurstAnimation(narrowContext(this.ctx, DONBurstAnimation));
    this.donBurst.name = 'donBurst';
    this.counterCard = new CounterCardAnimation(narrowContext(this.ctx, CounterCardAnimation));
    this.counterCard.name = 'counterCard';
    this.powerCount = new PowerCountAnimation(narrowContext(this.ctx, PowerCountAnimation));
    this.powerCount.name = 'powerCount';
    this.blockerActivate = new BlockerActivateAnimation(narrowContext(this.ctx, BlockerActivateAnimation));
    this.blockerActivate.name = 'blockerActivate';
    this.blockerRest = new BlockerRestAnimation(narrowContext(this.ctx, BlockerRestAnimation));
    this.blockerRest.name = 'blockerRest';
    this.active = new ActiveAnimation(narrowContext(this.ctx, ActiveAnimation));
    this.active.name = 'active';
    this.shuffle = new ShuffleAnimation(narrowContext(this.ctx, ShuffleAnimation));
    this.shuffle.name = 'shuffle';
    this.countdown = new CountdownAnimation(narrowContext(this.ctx, CountdownAnimation));
    this.countdown.name = 'countdown';
    this.commitLife = new CommitLifeAnimation(narrowContext(this.ctx, CommitLifeAnimation));
    this.commitLife.name = 'commitLife';
    this.slam = new SlamAnimation(narrowContext(this.ctx, SlamAnimation));
    this.slam.name = 'slam';
    this.flyToTrash = new FlyToTrashAnimation(narrowContext(this.ctx, FlyToTrashAnimation));
    this.flyToTrash.name = 'flyToTrash';
    this.flyToBottomDeck = new FlyToBottomDeckAnimation(narrowContext(this.ctx, FlyToBottomDeckAnimation));
    this.flyToBottomDeck.name = 'flyToBottomDeck';
    this.attack = new AttackAnimation(narrowContext(this.ctx, AttackAnimation));
    this.attack.name = 'attack';
    this.aiPlay = new AIPlayAnimation(narrowContext(this.ctx, AIPlayAnimation));
    this.aiPlay.name = 'aiPlay';
    this.aiCounter = new AICounterAnimation(narrowContext(this.ctx, AICounterAnimation));
    this.aiCounter.name = 'aiCounter';
    this.abilityActivate = new AbilityActivateAnimation(narrowContext(this.ctx, AbilityActivateAnimation));
    this.abilityActivate.name = 'abilityActivate';
    this.multipleDraw = new MultipleDrawAnimation(narrowContext(this.ctx, MultipleDrawAnimation));
    this.multipleDraw.name = 'multipleDraw';
    this.cardPick = new CardPickAnimation(narrowContext(this.ctx, CardPickAnimation));
    this.cardPick.name = 'cardPick';
    this.damageTrigger = new DamageTriggerAnimation(narrowContext(this.ctx, DamageTriggerAnimation));
    this.damageTrigger.name = 'damageTrigger';
  }

  animateAttack(pid, attacker, attackerZone, target, targetZone) {
    return this.attack.animate(pid, attacker, attackerZone, target, targetZone);
  }

  async animateAttackLiftAndRotate(pid, attacker, attackerZone, target, targetZone) {
    return this.attack.animateLiftAndRotate(pid, attacker, attackerZone, target, targetZone);
  }

  async animateAttackContinueFromHeld() {
    return this.attack.continueAttackFromHeldState();
  }

  get attackAnimState() {
    return this.attack._attackAnimState;
  }

  animateDrawCard(pid, card, handIdx) {
    return this.multipleDraw.drawOne(pid, this.ctx.players[pid], card, handIdx);
  }

  async animateDONDraw(pid) {
    return this.donDraw.animateDONDraw(pid);
  }

  async animateDONSlam(pid, visibleCount) {
    const slam = new DONSlamAnimation(narrowContext(this.ctx, DONSlamAnimation));
    await slam.animate(pid, visibleCount);
  }

  animateDONDetach(pid) {
    return this.donDetach.animate(pid);
  }

  animateDONRest(pid, count, indices) {
    return this.donRest.animate(pid, count, indices);
  }

  animateActive(pid) {
    return this.active.animate(pid);
  }

  /**
   * Animate DON tokens flying from a KO'd card back to the cost zone as rested.
   */
  async animateDONReturnOnKO(pid, targetZone, donCount) {
    return this.donReturnOnKO.animate(pid, targetZone, donCount);
  }

  /**
   * DON attachment burst VFX: expanding DON sprite, screen shake, golden flash.
   */
  animateDONBurst(targetZone, duration = 400) {
    return this.donBurst.animate(targetZone, duration);
  }

  /**
   * Counter card burst VFX: expanding card image, screen shake, golden flash.
   */
  animateCounterCard(targetZone, counterCard, duration = 400) {
    return this.counterCard.animate(targetZone, counterCard, duration);
  }

  /**
   * Animate power text counting up with scale peak and color interpolation.
   */
  animatePowerCount(textObject, oldPower, newPower, duration = 700, colorFrom = 0xffffff, colorTo = 0xffd700) {
    return this.powerCount.animate(textObject, oldPower, newPower, duration, colorFrom, colorTo);
  }

  animateShuffle(pid) {
    return this.shuffle.animateShuffle(pid);
  }

  animateCommitLife(pid, player, cards) {
    return this.commitLife.animate(pid, player, cards);
  }

  /**
   * Orange-glow activation VFX for blocker (same style as ability activate but orange).
   * @param {object} card - The blocker card data
   * @param {PIXI.Container} fieldSlot - The slot container the card is in
   */
  async animateBlockerActivate(card, fieldSlot) {
    return this.blockerActivate.animate(card, fieldSlot);
  }

  /** Cancel in-flight blocker activation animation. */
  cancelBlockerActivate() {
    this.blockerActivate.cancel();
  }

  /**
   * Animate a blocker card resting: lift up with scale, rotate to rest angle (90deg), slam down with bounce.
   * @param {PIXI.Container} sprite - The field card sprite to animate
   * @returns {Promise<void>}
   */
  animateBlockerRest(sprite) {
    return this.blockerRest.animate(sprite);
  }

  /** Cancel in-flight blocker rest animation. */
  cancelBlockerRest() {
    this.blockerRest.cancel();
  }
}

export default AnimationManager;