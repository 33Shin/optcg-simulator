export const TIMING = {
  ON_PLAY: 'onPlay',
  ON_KO: 'onKO',
  WHEN_ATTACKING: 'whenAttacking',
  TRIGGER: 'trigger',
  COUNTER: 'counter',
} as const;

export type TimingType = (typeof TIMING)[keyof typeof TIMING];

/** Context passed to every effect execute() call. */
export interface EffectContext {
  /** The card that triggered this effect. */
  card: object;
  /** Player ID (1 or 2). */
  pid: number;
  /** The player whose effect is executing. */
  player: object;
  /** The timing that triggered this effect. */
  timing: TimingType;
  /** EffectSystem for registering turn-limited modifiers. */
  effectSystem: object;
  /** All players map. */
  players: Record<string, object>;
  /** EventBus for cross-system communication. */
  eventBus: object;
  /** AnimationManager for VFX. */
  animManager: object;
  /** Find opponent player object. */
  getOpponent(player: object): object | null;
  /** Draw N cards for player. */
  drawCards(count: number): void;
  /** Trash N cards from player hand. */
  trashFromHand(count: number): void;
  /** Add 1 DON from DON deck. */
  addDON(): Promise<void>;
  /** Rest opponent character (optional maxCost filter). */
  restOpponent(maxCost?: number): void;
  /** Return opponent character to hand (optional maxCost filter). */
  returnOpponentCharacter(maxCost?: number): void;
  /** Shuffle opponent hand then draw 5. */
  shuffleOpponentHand(): void;
  /** Add card to player Life. */
  addToLife(source?: 'deck' | 'hand'): void;
  /** Remove opponent Life card to player hand. */
  removeFromLife(): void;
  /** Give rested DON to leader. */
  giveDONToLeader(): void;
  /** Return N cards from hand to bottom of deck. */
  returnToBottomDeck(count: number): void;
}

/** Base class for all card effects. Each card with an effect extends this. */
export abstract class EffectBase {
  /** Card ID this effect belongs to (e.g. 'OP05-067'). */
  public static cardId: string;

  /** Which timings this effect responds to (e.g. ['onPlay', 'onKO']). */
  public static timings: TimingType[];

  /**
   * Execute the effect. Override in subclass.
   * @param ctx - Effect context with all dependencies.
   */
  public abstract execute(ctx: EffectContext): Promise<void> | void;
}
