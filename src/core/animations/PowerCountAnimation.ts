import { Animator } from '../Animator';

class PowerCountAnimation {
  static requires = [];

  constructor(ctx) {
    this.ctx = ctx;
  }

  /**
   * Animate power text counting up with scale peak and color interpolation.
   * @param {PIXI.Text} textObject - The power text object to animate
   * @param {number} oldPower - Starting power value
   * @param {number} newPower - Target power value
   * @param {number} duration - Animation duration in ms
   * @param {number} colorFrom - Starting color (hex)
   * @param {number} colorTo - Target color (hex)
   * @returns {Promise<void>}
   */
  animate(textObject, oldPower, newPower, duration = 700, colorFrom = 0xffffff, colorTo = 0xffd700) {
    if (!textObject) return Promise.resolve();
    const fromR = (colorFrom >> 16) & 255, fromG = (colorFrom >> 8) & 255, fromB = colorFrom & 255;
    const toR = (colorTo >> 16) & 255, toG = (colorTo >> 8) & 255, toB = colorTo & 255;

    return Animator.animate({
      duration,
      easing: 'easeOutQuad',
      onUpdate: (t) => {
        const displayPower = Math.round(oldPower + (newPower - oldPower) * t);
        textObject.text = String(displayPower);
        const liftArc = Math.sin(t * Math.PI);
        const scalePeak = 1 + 0.35 * liftArc;
        textObject.scale.set(scalePeak);

        const r = Math.round(fromR + (toR - fromR) * t);
        const g = Math.round(fromG + (toG - fromG) * t);
        const b = Math.round(fromB + (toB - fromB) * t);
        textObject.style.fill = (r << 16) | (g << 8) | b;
      },
      onComplete: () => {
        textObject.text = String(newPower);
      },
    }).toPromise();
  }
}

export default PowerCountAnimation;
