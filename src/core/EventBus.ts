class EventBus {
  constructor() {
    this.events = {};
  }

  on(name, handler) {
    if (!this.events[name]) this.events[name] = new Set();
    this.events[name].add(handler);
    return () => this.off(name, handler);
  }

  off(name, handler) {
    if (this.events[name]) this.events[name].delete(handler);
  }

  emit(name, data) {
    if (this.events[name]) this.events[name].forEach(h => h(data));
  }

  async emitAsync(name, data) {
    if (!this.events[name]) return;
    for (const h of this.events[name]) {
      await h(data);
    }
  }

  once(name, handler) {
    const unsub = this.on(name, (data) => {
      unsub();
      handler(data);
    });
    return unsub;
  }
}

export default EventBus;
