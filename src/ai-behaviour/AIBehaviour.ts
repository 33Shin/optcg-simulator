import { delay } from '../core/animations/utils';

class AIBehaviour {
  constructor(pid, delayMs, ai) {
    this.pid = pid;
    this.delayMs = delayMs;
    this.ai = ai;
  }

  sleep(ms) {
    return delay(ms);
  }

  get player() {
    return this.ai.players[this.pid];
  }

  get opponent() {
    const oppPid = this.pid === 1 ? 2 : 1;
    return this.ai.players[oppPid];
  }

  get opponentPid() {
    return this.pid === 1 ? 2 : 1;
  }

  canAct() {
    return this.ai.turnManager.canAct;
  }

  renderAll() {
    this.ai.handRenderer.render(1);
    this.ai.handRenderer.render(2);
    this.ai.fieldRenderer.renderField(1);
    this.ai.fieldRenderer.renderField(2);
    this.ai.fieldRenderer.renderLeaders();
    this.ai.zoneRenderer.renderAll();
    this.ai._renderDONTokens();
  }
}

export default AIBehaviour;