class ZoneManager {
  constructor(app, gameBoard) {
    this.app = app;
    this.gameBoard = gameBoard;
  }

  init() {}

  getZone(playerId, zoneName) {
    return this.gameBoard.getZone(playerId, zoneName);
  }

  addCard(playerId, zoneName, cardSprite) {
    const zone = this.getZone(playerId, zoneName);
    if (zone) zone.addChild(cardSprite);
  }

  removeCard(playerId, zoneName, cardSprite) {
    const zone = this.getZone(playerId, zoneName);
    if (zone) zone.removeChild(cardSprite);
  }

  clearZone(playerId, zoneName) {
    const zone = this.getZone(playerId, zoneName);
    if (zone) zone.removeChildren();
  }

  findZoneForCard(players, card) {
    for (const pid of [1, 2]) {
      for (let i = 0; i < 5; i++) {
        if (players[pid].field[i] === card) {
          return this.getZone(pid, `field_slot_${i}`);
        }
      }
      if (players[pid].leader === card) {
        return this.getZone(pid, 'leader');
      }
    }
    return null;
  }
}

export default ZoneManager;
