import Game from './core/Game';
import EventBus from './core/EventBus';
import CardDatabase from './data/cardDatabase';
import Deck from './entities/Deck';
import { BluePurpleLuffy, BlueYellowNami } from './data/decks/index';

const app = new PIXI.Application();
await app.init({
  width: 1200,
  height: 800,
  backgroundColor: 0x1a1a2e,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
});
document.getElementById('game-container').appendChild(app.canvas);

const eventBus = new EventBus();
const db = new CardDatabase();
const luffy = new Deck(BluePurpleLuffy, db);
const nami = new Deck(BlueYellowNami, db);

const loadCardImages = async () => {
  const paths = db.getAllImagePaths();
  await Promise.all(
    paths.map(async (path) => {
      try {
        await PIXI.Assets.load(path);
      } catch (e) {
        // skip missing card images
      }
    })
  );
  await PIXI.Assets.load('assets/imgs/back.webp');
  await PIXI.Assets.load('assets/imgs/don.png');
  await PIXI.Assets.load('assets/imgs/don_back.png');
};

window.__PIXI_DEVTOOLS__ = { app };

const game = new Game({ app, eventBus, p1Deck: luffy, p2Deck: nami });
await loadCardImages();
game.init();