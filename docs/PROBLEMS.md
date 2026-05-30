# Problems, Issues & Fixes Log

Track all bugs, issues, and their resolutions encountered during development.

---

## Issue #1 - Card Image Download Failures with Invoke-WebRequest

**Date**: 2026-05-10 | **Severity**: High | **Status**: Fixed

**Problem**: Initial card image download using PowerShell `Invoke-WebRequest` failed for all 31 files. Output files were empty or contained only 246 bytes (error page).

```powershell
Invoke-WebRequest -Uri $url -OutFile $out -ErrorAction Stop
```

**Root Cause**: The DigitalOcean CDN at `limitlesstcg.nyc3.cdn.digitaloceanspaces.com` blocks or rejects requests with the default `Invoke-WebRequest` user-agent. The server returns a 246-byte block/error page instead of the image.

**Fix**: Use `curl.exe` (native Windows curl, not the PowerShell alias) which sends a different user-agent:

```powershell
curl.exe -s -L -o "OP11-040_EN.webp" "https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/OP11/OP11-040_EN.webp"
```

**Lesson**: Always use `curl.exe` with `-L` flag for CDN downloads in PowerShell. Add file-size validation (> 1000 bytes) after download.

---

## Issue #2 - Promo Card Set Path (P-107, P-096)

**Date**: 2026-05-10 | **Severity**: Medium | **Status**: Fixed

**Problem**: Two promo cards returned 246-byte error responses when downloading.

| Card | API Set Field | Tried Paths | Result |
|---|---|---|---|
| P-107 (Gol.D.Roger) | `*PCS1` | `*PCS1`, `*P`, `P` → only `P` works | Fixed |
| P-096 (Girl) | `*P` | `*P`, `P` → only `P` works | Fixed |

**Root Cause**: The API returns set names like `*PCS1` and `*P` with asterisks, but the CDN file path uses plain `P` for promo cards. The asterisk causes the URL to fail.

**Fix**: Map both to set path `P`:
```
https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/P/P-107_EN.webp
https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/P/P-096_EN.webp
```

**Rule of thumb**: Strip `*` prefix from any set ID before building CDN paths. For other sets (OP01, EB01, ST18, PRB02, etc.), use as-is.

---

## Issue #3 - PixiJS v7 Loader API Removed

**Date**: 2026-05-10 | **Severity**: Critical | **Status**: Fixed

**Problem**: Browser console error:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'add')
```

**Root Cause**: PixiJS v7 **removed** `app.loader`. The old v5/v6 API pattern no longer exists:
```javascript
// BROKEN in v7
app.loader.add('key', 'path/to/image.png').load(callback);
```

**Fix**: Use the new `PIXI.Assets` async API:
```javascript
// WORKS in v7
const texture = await PIXI.Assets.load('path/to/image.png');
const sprite = new PIXI.Sprite(texture);
app.stage.addChild(sprite);
```

Or batch load multiple assets:
```javascript
const textures = await PIXI.Assets.load(['path/one.png', 'path/two.png']);
```

**Lesson**: Always check PixiJS v7 migration guide. Key changes:
- `app.loader` → `PIXI.Assets.load()`
- `PIXI.loader` (global) → `PIXI.Assets`
- Textures are cached automatically by `PIXI.Assets`

---

## Issue #4 - Vite Migration: Top-Level Await Build Error

**Date**: 2026-05-29 | **Severity**: High | **Status**: Fixed

**Problem**: After migrating to Vite + TypeScript, `npm run build` failed with:
```
Top-level await is not available in the configured target environment ("chrome87", "edge88", "es2020", "firefox78", "safari14" + 2 overrides)
```

**Root Cause**: Vite's default build target is `es2020` which doesn't support top-level await. The entry point `main.ts` uses top-level await for `app.init()` and asset loading.

**Fix**: Set `target: 'esnext'` in both `build` and `esbuild` sections of `vite.config.ts`:
```ts
build: { target: 'esnext' },
esbuild: { target: 'esnext' },
```

**Lesson**: When using top-level await in Vite, always set `esnext` target.

---

## Issue #5 - Vite Preview: 404 for Static Assets

**Date**: 2026-05-29 | **Severity**: High | **Status**: Fixed

**Problem**: `npm run preview` (serving from `dist/`) returned 404 for `assets/imgs/back.webp` and `css/style.css`.

**Root Cause**: Vite only copies files from `public/` to `dist/`. The `assets/` and `css/` directories were at the project root, not inside `public/`.

**Fix**: Moved `assets/`, `css/`, `favicon.ico` into `public/`. Vite now auto-copies them to `dist/` at build time.

**Lesson**: All static assets must be in `public/` for Vite to include them in production builds.

---

## Issue #6 - Action Button State Race Condition

**Date**: 2026-05-29 | **Severity**: Medium | **Status**: Fixed

**Problem**: After opponent takes damage, clicking the PASS button does nothing. The button appears enabled but `_currentStateKey` is `'disabled'` at click time.

**Root Cause**: `updateActionButton` runs every frame via ticker and on every phase event. Between the frame where it shows `'endTurn'` and the click, another update cycle set `_currentStateKey = 'disabled'` because `turnManager.canAct` briefly evaluated to `false` during animation transitions.

**Fix**: Added fallback in `_actionBtnHandler`: if `_currentStateKey` doesn't match but `_onEndTurn` exists, call the callback anyway. The Game callback already guards with `turnManager.canAct`.

**Lesson**: UI state that changes every frame can race with user input. Always guard the callback itself, not just the visual state.

---

## Issue #7 - Action Button Visuals During Battle

**Date**: 2026-05-29 | **Severity**: Medium | **Status**: Fixed

**Problem**: During battle animations, the action button still appeared clickable (active state) even though clicking it was blocked by `_inBattle`.

**Root Cause**: `updateActionButton` had `if (!button._inBattle)` guard that skipped updating, so the button kept showing its previous state. The ticker also forced `ACTION_STYLES.disabled` when `_inBattle` was true, overriding the PASS button state set by counter/blocker phases.

**Fix**: `updateActionButton` now returns early when `_inBattle` is `true`, letting the battle flow manage button state. The ticker no longer forces disabled style — it respects whatever `_currentStateKey` the battle flow set.

**Lesson**: During managed UI states (battle flow), don't let the global update loop override the managed state.

---

## Issue #8 - Counter Card Drops During Battle Resolution

**Date**: 2026-05-29 | **Severity**: Medium | **Status**: Fixed

**Problem**: During battle resolution (after counter phase ends), the defender could still drag counter cards from hand, bypassing the counter phase.

**Root Cause**: The counter phase re-renders the defender's hand with its own drag handler. After counter phase ends, the hand sprites still had the counter-phase drag handler attached. `PlayCardInteraction.onHandCardDrag` only checked `turnManager.canAct` (still `true`) but not `game._animating`.

**Fix**: (1) Added `game._animating` guard in `PlayCardInteraction.onHandCardDrag` to reject drags during any animation. (2) After `_counterPhase` returns, call `handRenderer.render(defenderPid)` to replace hand sprites with fresh ones that have no drag handler.

**Lesson**: After a managed interaction phase ends, re-render to clear handlers. Also guard drag handlers with the global animation flag.
