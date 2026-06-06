import { EffectBase, TimingType } from './base';

/**
 * Auto-discovers all effect classes in src/effects/ by scanning files
 * that export a class extending EffectBase. Maps cardId -> EffectClass.
 */
class EffectRegistry {
  private _map: Map<string, typeof EffectBase> = new Map();

  constructor() {
    this._discover();
  }

  /** Scan all effect files and register classes by cardId. */
  private _discover() {
    const effectModules = import.meta.glob('../effects/*.ts', { eager: true });
    for (const mod of Object.values(effectModules)) {
      // Each module exports the effect class as default
      const cls = mod.default;
      if (cls && cls.cardId && cls.timings) {
        this._map.set(cls.cardId, cls);
      }
    }
  }

  /** Get effect class for a cardId, or null if none registered. */
  get(cardId: string): typeof EffectBase | null {
    return this._map.get(cardId) || null;
  }

  /** Check if a cardId has a registered effect class. */
  has(cardId: string): boolean {
    return this._map.has(cardId);
  }

  /**
   * Check if a card has an effect for a given timing.
   */
  hasTiming(cardId: string, timing: TimingType): boolean {
    const cls = this._map.get(cardId);
    return cls?.timings.includes(timing) ?? false;
  }

  /** Get all registered cardIds. */
  getAllCardIds(): string[] {
    return [...this._map.keys()];
  }
}

export default EffectRegistry;
