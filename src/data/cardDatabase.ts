import { LUFFY_DECK_CARDS, NAMI_DECK_CARDS } from './decks/allCardData';

class CardDatabase {
  constructor(cardDataList) {
    this._map = new Map();
    const cards = cardDataList || [...LUFFY_DECK_CARDS, ...NAMI_DECK_CARDS];
    for (const data of cards) {
      this._map.set(data.card_id, data);
    }
  }

  get(cardId) {
    return this._map.get(cardId);
  }

  has(cardId) {
    return this._map.has(cardId);
  }

  getAllImagePaths() {
    const paths = new Set();
    for (const data of this._map.values()) {
      paths.add(data.imgPath);
    }
    return [...paths];
  }
}

export default CardDatabase;
