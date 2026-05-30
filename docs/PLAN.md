# OPTCG Simulation Game - Implementation Plan

## Architecture Overview
The game will be implemented as a single-page application with PixiJS for rendering. The architecture follows a component-based pattern within vanilla JavaScript.

## Core Systems

### 1. Game Engine
- **GameState**: Central state machine managing turn flow, phase transitions
- **GameLoop**: PixiJS ticker-driven main loop handling rendering and input
- **SceneManager**: Handles screen transitions (menu, game, game over)

### 2. Player System
- **Player**: Represents Player 1 (Luffy) and Player 2 (Nami/AI)
- **Hand**: Collection of cards in player's hand
- **Deck**: Main deck with shuffle/draw functionality
- **Life**: Life cards drawn from deck based on Leader Life stat
- **DON!! Deck**: Separate 10-card resource deck

### 3. Card System
- **Card**: Base class with properties (name, cost, power, counter, effect, trigger, type, color, category, set, number)
- **LeaderCard**: Leader-specific properties (Life stat)
- **CharacterCard**: Character-specific properties (Blocker, Counter)
- **EventCard**: Event-specific properties (Main, Counter timing)
- All 31 unique cards loaded from GAME/ deck files

### 4. Combat System
- **BattleResolver**: Handles attack declaration, power calculation, DON!! attachment, Counter check, KO resolution
- **PowerTracker**: Tracks base power + modifiers (DON!!, effects, temporary boosts)

### 5. Effect System
- **EffectEngine**: Parses and executes card effect text
- **TriggerHandler**: Detects trigger conditions (On Play, On K.O., When Attacking, Counter, Blocker)
- **TimingWindows**: Manages ability activation timing

### 6. UI System
- **GameBoard**: PixiJS Container with all game zones
- **CardRenderer**: Renders card sprites with hover states
- **ZoneManager**: Manages card zones (Hand, Field, Deck, Life, DON!!, Cost, Trash)
- **PhaseIndicator**: Displays current phase
- **InfoPanel**: Shows selected card details

## Player Zones Layout (Top to Bottom - P2 to P1)
```
┌─────────────────────────────────────────────────────────┐
│  P2 (AI) Hand (face-down)                               │
│  P2 DON!! Deck | P2 Life | P2 Trash                      │
│  P2 Cost Area | P2 DON!! Attachments                     │
│  P2 Leader | P2 Characters (5 slots)                     │
│             ────────── MIDDLE ──────────                 │
│  P1 Leader | P1 Characters (5 slots)                     │
│  P1 Cost Area | P1 DON!! Attachments                     │
│  P1 DON!! Deck | P1 Life | P1 Trash                      │
│  P1 Hand (face-up, clickable)                            │
└─────────────────────────────────────────────────────────┘
```

## Implementation Order
1. **Phase 0**: PixiJS setup + image loading test
2. **Phase 1**: Game board layout + static rendering
3. **Phase 2**: Card data loading + deck building
4. **Phase 3**: Phase system + turn management
5. **Phase 4**: Card play mechanics (Characters, Events)
6. **Phase 5**: DON!! system + resource management
7. **Phase 6**: Attack + battle resolution
8. **Phase 7**: Effects + triggers
9. **Phase 8**: AI opponent for Nami deck
10. **Phase 9**: Polish + win/lose conditions
