import { gsap } from 'gsap';

class PowerCountAnimation {
  static requires = [];

  constructor(ctx) {
    this.ctx = ctx;
  }

  animate(textObject, oldPower, newPower, duration = 700, colorFrom = 0xffffff, colorTo = 0xffd700, noScale = false) {
    if (!textObject) return Promise.resolve();
    const fromR = (colorFrom >> 16) & 255, fromG = (colorFrom >> 8) & 255, fromB = colorFrom & 255;
    const toR = (colorTo >> 16) & 255, toG = (colorTo >> 8) & 255, toB = colorTo & 255;

    return new Promise((resolve) => {
      const proxy = { t: 0 };
      gsap.to(proxy, {
        t: 1,
        duration: duration / 1000,
        ease: 'power2.out',
        onUpdate: () => {
          const t = proxy.t;
          const displayPower = Math.round(oldPower + (newPower - oldPower) * t);
          textObject.text = String(displayPower);
          if (!noScale) {
            const liftArc = Math.sin(t * Math.PI);
            const scalePeak = 1 + 0.35 * liftArc;
            textObject.scale.set(scalePeak);
          }

          const r = Math.round(fromR + (toR - fromR) * t);
          const g = Math.round(fromG + (toG - fromG) * t);
          const b = Math.round(fromB + (toB - fromB) * t);
          textObject.style.fill = (r << 16) | (g << 8) | b;
        },
        onComplete: () => {
          textObject.text = String(newPower);
          if (!noScale) {
            textObject.scale.set(1);
          }
          resolve();
        },
      });
    });
  }
}

export default PowerCountAnimation;
