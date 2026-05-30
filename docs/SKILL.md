# OPTCG Development Skills Reference

## PixiJS v8 Essentials

### Application Setup
```javascript
// index.html: load PixiJS from CDN
// <script src="https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.min.js"></script>

// js/main.js: async init
const app = new PIXI.Application();
await app.init({
  width: 1200,
  height: 800,
  backgroundColor: 0x1a1a2e,
  antialias: true,
  resolution: window.devicePixelRatio || 1,
});
document.getElementById('game-container').appendChild(app.canvas);
```

### Loading Assets
```javascript
// Load single image
const texture = await PIXI.Assets.load('assets/imgs/OP11-040_EN.webp');
const sprite = new PIXI.Sprite(texture);

// Batch load
const textures = await PIXI.Assets.load(['path/one.png', 'path/two.png']);
```

### Container Hierarchy
```javascript
// Game board as container
const board = new PIXI.Container();
app.stage.addChild(board);

// Zone as child container
const handZone = new PIXI.Container();
handZone.x = 200;
handZone.y = 650;
board.addChild(handZone);
```

### Interactive Cards
```javascript
const cardSprite = new PIXI.Sprite(cardTexture);
cardSprite.eventMode = 'static';
cardSprite.cursor = 'pointer';
cardSprite.on('pointerdown', () => onCardClick(card));
cardSprite.on('pointerover', () => cardSprite.alpha = 0.8);
cardSprite.on('pointerout', () => cardSprite.alpha = 1.0);
```

### Text Rendering
```javascript
// Phase indicator
const phaseText = new PIXI.Text({
  text: 'Main Phase',
  style: {
    fontFamily: 'Russo One',
    fontSize: 24,
    fill: 0xffffff,
  },
});
phaseText.anchor.set(0.5);
phaseText.position.set(600, 30);

// Card power text
const powerText = new PIXI.Text({
  text: `${card.power}`,
  style: {
    fontFamily: 'Russo One',
    fontSize: 30,
    fill: 0xffd700,
    stroke: { color: 0x000000, width: 4 },
  },
});
```

### Graphics for UI
```javascript
// Zone background
const zoneBg = new PIXI.Graphics();
zoneBg.roundRect(0, 0, 400, 120, 10)
  .fill({ color: 0x2d2d44, alpha: 0.6 })
  .stroke({ width: 2, color: 0x4a4a6a });

// Zone border
const zoneBorder = new PIXI.Graphics();
zoneBorder.roundRect(0, 0, 400, 120, 10)
  .stroke({ width: 2, color: 0x4a4a6a });
```

### Ticker for Animations
```javascript
// Animation with ticker
app.ticker.add((ticker) => {
  if (card.animating) {
    card.y -= ticker.delta * 2;
    if (card.y <= targetY) {
      card.y = targetY;
      card.animating = false;
    }
  }
});
```

## Card Rendering Conventions

### Card Dimensions
- Standard card ratio: ~5:7 (e.g., 100x140 pixels)
- Hand rendering: scale 0.95, cards laid out horizontally
- Field rendering: scale 1.0, cards in slots
- Leader rendering: scale 1.5
- DON!! token: 36x36 circular sprite

### Card State Visuals
- Active (vertical): normal sprite
- Rested (horizontal): sprite rotated 90 degrees (rotation = Math.PI / 2)
- Selected: white glow effect (PIXI.filters.GlowFilter)
- KO'd: red tint transition to trash zone

### DON!! Card Representation
- DON!! cards are standard card images, can use any generic card back
- Active DON!!: bright in cost area
- Rested DON!!: dimmed in cost area
- Attached: small count badge next to character showing DON!! count

## Game State Pattern

```javascript
// State shape (inside Game.js)
state = {
  turnCount: 0,
  currentPlayer: 1 | 2,
  currentPhase: 'refresh' | 'draw' | 'don' | 'main' | 'end',
  phaseLocked: false,
  gameOver: false,
  winner: null,
  battle: null,
  leaderDamage: { 1: 0, 2: 0 },
};
```

## CORS Workaround for Images
Since the CDN may block direct browser requests, preload images into assets/imgs/ at build time. Use a Node.js script or manual download to fetch all card images before hosting.

## Performance Tips
- Cache all card textures in `PIXI.Assets` (automatic)
- Use `RenderBatcher` to coalesce multiple render calls per frame
- Reuse card sprite instances via pooling for trash/draw animations
- Minimize container nesting depth
- Use `app.ticker` for animations instead of `setInterval`
- Destroy graphics objects after animation completes to free GPU memory
