# AI Instructions — OPTCG Simulator

## Before Doing Anything

1. **Read `AGENTS.md`** — contains the full project brief: stack, architecture, dependency graph, state shape, key files, and working rules.
2. **Read `docs/games/MECHANIC.md`** — implementation status table (what works, what doesn't).
3. **Read `docs/games/RULE.md`** — one-piece card game rules reference.
4. **Scan `src/` structure** — understand the folder layout before touching any file.

## Working Rules

- **Follow AGENTS.md instructions exactly** — especially the INSTRUCTION section at the bottom.
- **Always produce a todo list** before starting work (per AGENTS.md).
- **Run `build.bat` after every code change** to verify the build succeeds.
- **End every response** with the summary block format from AGENTS.md.
- **Never use git commands** unless explicitly asked.
- **Never discard code** unless explicitly asked.
- **No browser automation** — trust the code, let the user test.

## Key Principles

- Cross-system communication flows through `EventBus`, not direct calls.
- All game state lives in `Game.ts`. It wires everything together.
- P1-only interactions — P2 is AI-driven.
- Console warnings in source files are intentional live state dumps.
- PixiJS v8 from CDN — global `PIXI` is available.

## When Adding New Features

- Check `docs/games/MECHANIC.md` first to see if it's already implemented or planned.
- Follow existing conventions: naming, folder structure, event patterns.
- Add new cards/decks per the "Adding a new deck" section in AGENTS.md.

## Recommendations

- Keep `docs/games/MECHANIC.md` in sync after any mechanic change.
- Update `docs/ARCHITECTURE.md` if you change the dependency graph or state shape.
- If a task spans multiple files, trace the full call chain before editing.
