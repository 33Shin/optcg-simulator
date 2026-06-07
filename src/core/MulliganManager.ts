import type Game from './Game';
import { HAND_SIZE, FIELD_SLOTS } from '../types/game';

class MulliganManager {
  game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  /** Create a fresh player object from deck definition. */
  createPlayer(deck: any) {
    return {
      deck,
      hand: [],
      field: new Array(FIELD_SLOTS).fill(null),
      leader: deck.leader,
      life: [],
      trash: [],
      donDeck: [],
      costArea: [],
    };
  }

  /** Prepare game state for setup: shuffle decks, draw initial hands, init DON. */
  prepareSetup() {
    for (const pid of [1, 2]) {
      this.game.players[pid].deck.shuffle();
      this.game._initialCards[pid] = [];
      for (let i = 0; i < HAND_SIZE; i++) {
        const card = this.game.players[pid].deck.draw();
        if (card) this.game._initialCards[pid].push(card);
      }
      this.game.players[pid].deck.shuffleWithTriggerLife(this.game.players[pid].leader.life);
      this.game.donSystem.init(pid);
    }
  }

  /** Commit life cards for both players, render, show sample card, start turn. */
  async commitLifeAndStart() {
    for (const pid of [1, 2]) {
      const p = this.game.players[pid];
      const lifeCards: any[] = [];
      for (let i = 0; i < p.leader.life; i++) {
        const card = p.deck.draw();
        if (card) lifeCards.push(card);
      }
      await this.game.animManager.animateCommitLife(pid, p, lifeCards);
    }
    this.game.renderCoordinator.renderAll();
    this._showSampleCard();
    setTimeout(() => this.game.turnManager.startTurn(), 300);
  }

  /** Show a sample card in the info panel after game starts. */
  _showSampleCard() {
    const p1Hand = this.game.players[1].hand;
    if (p1Hand.length > 0) this.game.ui.showCardInfo(p1Hand[0], 1);
    else if (this.game.players[1].leader) this.game.ui.showCardInfo(this.game.players[1].leader, 1);
  }

  /** Start the mulligan flow: P2 draw, P1 mulligan dialog, P2 AI mulligan, commit life. */
  async startMulliganFlow() {
    const pid = 1;

    // P2 draws first (face-down, will mulligan later)
    const p2Cards = this.game._initialCards[2];
    if (p2Cards && p2Cards.length) {
      await this.game.animManager.initialDraw.animateInitialDrawToHand(2, p2Cards);
    }

    // P1 cards: load into hand
    const p1Cards = this.game._initialCards[pid];
    if (p1Cards && p1Cards.length) {
      for (const card of p1Cards) {
        this.game.players[pid].hand.push(card);
      }
    }

    const player = this.game.players[pid];
    let kept: boolean;
    if (this.game._playerAIEnabled) {
      kept = !this.game.ai.shouldMulligan(player.hand);
      if (!kept) {
        await this.game.animManager.initialDraw.animateAIMulligan(pid, this.game.animManager.shuffle);
      }
    } else {
      kept = await this.game.animManager.multipleDraw.animateMulligan(pid, player, true);
      if (!kept) await this._doMulliganRedraw(pid);
    }

    // P2 AI mulligan (after P1 mulligan completes)
    await this._doAIMulligan(2);

    await this.commitLifeAndStart();
  }

  /** AI mulligan decision for a player. */
  async _doAIMulligan(pid: number) {
    const player = this.game.players[pid];
    if (this.game.ai.shouldMulligan(player.hand)) {
      await this.game.animManager.initialDraw.animateAIMulligan(pid, this.game.animManager.shuffle);
    }
  }

  /** Mulligan redraw: return old hand, shuffle, draw new cards, animate. */
  async _doMulliganRedraw(pid: number) {
    const player = this.game.players[pid];
    const oldHand = [...player.hand];
    player.hand.length = 0;
    this.game.handRenderer.render(pid);

    player.deck.cards.push(...oldHand);
    await this.game.animManager.animateShuffle(pid);

    const newCards: any[] = [];
    for (let i = 0; i < HAND_SIZE; i++) {
      const card = player.deck.draw();
      if (card) newCards.push(card);
    }
    await this.game.animManager.initialDraw._drawCardsForPlayer(pid, newCards, true);
  }
}

export default MulliganManager;
