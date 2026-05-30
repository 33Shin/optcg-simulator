class Card {
  constructor(data) {
    this.id = data.card_id;
    this.cardId = data.card_id;
    this.name = data.name;
    this.set = data.set;
    this.number = data.number;
    this.color = data.color;
    this.attribute = data.attribute;
    this.type = data.type;
    this.category = data.category;
    this.effect = data.effect || null;
    this.trigger = data.trigger || null;
    this.rarity = data.rarity;
    this.imgPath = data.imgPath || null;
  }
}

export default Card;
