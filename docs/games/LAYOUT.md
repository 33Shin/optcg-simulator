# OPTCG Game Board Layout

## Canvas
- **Resolution**: 1200 × 800 px
- **Background**: Solid fill `#1a1a2e`
- **Center divider**: Horizontal line at y=400, from x=100 to x=1100, color `#334466` (alpha 0.4)
- **Engine**: PixiJS v8

## Card Dimensions
- **Standard card**: 100 × 140 px (ratio 5:7)
- **Fonts**: `'Russo One'` (UI elements, phase bar), `'Inter'` wght 400/500/700 (card info panel)

## Card Dimensions by Context
| Context | Width | Height | Scale |
|---|---|---|---|
| Hand zone rendering | 95 | 133 | 0.95 |
| Fly animation (stage-level) | 100 | 140 | 1.0 (animated up to 1.5x) |
| Field slot rendering | 100 | 140 | 1.0 |
| Stage slot rendering | 70 | 98 | 0.7 |
| Leader slot rendering | 150 | 210 | 1.5 |

---

## Game Board Zones

### Card Zones (Both Players)
| Zone | Style | Description |
|---|---|-|
| **Hand** | ZoneArea | Semi-transparent rounded rect, corner r=8, alpha 0.3 fill |
| **Cost** | ZoneArea | Semi-transparent rounded rect below hand |
| **Field** | Slot × 5 | Rounded rect, corner r=6, stroke `#3a3a6a`, fill `#2d2d44` |
| **Leader** | Slot | Larger rounded rect, stroke `#3a3a6a`, fill `#2d2d44` |
| **Stage** | StageSlot | Corner r=6, stroke `#887733`, fill `#3d3d22` |
| **Life** | RectZone | Corner r=6, fill `#1a1a3a` alpha 0.4 |
| **DON!!** | RectZone | DON!! deck area, fill `#1a1a3a` alpha 0.4 |
| **Deck** | RectZone | Main deck area, fill `#1a1a3a` alpha 0.4 |
| **Trash** | RectZone | Discard pile, fill `#1a1a3a` alpha 0.4 |

### Color Coding by Zone
| Zone | Base Color |
|---|---|
| Hand (P1) | `#44aa44` |
| Hand (P2) | `#aa4444` |
| Cost | `#5a3a3a` |
| DON!! | `#4a4a8a` |
| Life | `#4a8a8a` |
| Deck | `#4a6a4a` |
| Trash | `#6a4a6a` |

### Zone Coordinates
```
slotW = 130, gap = 12
fieldW = 5 × 130 + 4 × 12 = 698
fieldX = 600 - 698/2 = 251
```

### Zone Naming Convention
- Zone keys: `{playerId}_{zoneName}`
- Field slots: `{playerId}_field_slot_{i}` (i = 0–4)
- Accessed via `ZoneManager.getZone(playerId, zoneName)`

---

## UI Overlay (Phase Bar — PixiJS Rendered)

- **Position**: `{ x: 302, y: 360 }` on canvas — vertically centered on divider
- **Container**: `phaseZone` (PixiJS Container)
- **Phases**: 5 segments: Refresh → Draw → DON!! → Main → End
- **Button size**: 96 × 44 px
- **Gap between buttons**: 6px + 14px arrow = 20px total gap
- **Arrows**: Triangles pointing right between each segment

### Phase Bar Background
| Layer | Style |
|---|---|
| Outer glow | `#1a1040` alpha 0.5, rounded r=16 |
| Inner bg | `#0d0d1f` alpha 0.85, rounded r=14, stroke `#7b5ea8` alpha 0.5 |

### Segment Styling
| State | Fill | Stroke | Text Color |
|---|---|---|---|
| **Active** (current phase) | `#bf360c` alpha 0.9 | `#ff6d00` alpha 0.9, w=2 | White `#ffffff` |
| **Completed** (passed) | `#00c853` alpha 0.12 | `#00e676` alpha 0.25, w=1 | Green `#00e676` |
| **Upcoming** | `#1a1a2e` alpha 0.3 | None | Dim `#4a4a6a` |

### Arrows Between Segments
- **Color**: Green `#00e676` for arrows after completed segments, dim `#4a4a6a` for others
- **Alpha**: 0.8 (completed), 0.35 (upcoming)
- **Shape**: Triangle pointing right, 14px wide

### Turn Label (PixiJS Text)
- **Position**: right side of screen, vertically centered
- **Style**: 16px Russo One, color `#aabbdd`
- **Format**: `TURN {turnCount} | P{currentPlayer}`

### Action Button (PixiJS Rendered)
- **Position**: right of phase bar
- **Type**: Half-circle button with decorative elements
- **States**: PASS (clickable, red), disabled (non-clickable, dim), RESTART (green)
- **Hover**: GlowFilter effect matching stroke color, text scale 1.15x
- **Callback fires on**: `pointerup` (not `pointerdown`)

### Combat Zone (PixiJS Rendered)
- **Position**: overlays phase bar during battle
- **Shows**: attacker/defender names, power values, phase label, countdown timer
- **Phases**: ATTACK DECLARED → BLOCKER PHASE → COUNTER PHASE → BATTLE RESOLUTION
- **Auto-hides** when battle resolves

### DOM Overlay
- Right sidebar: `#game-overlay` (flex column, full height)
- Contains: `#card-info-panel`, `#confirm-dialog`
- See `GAME-OVERLAY.md` for details.
