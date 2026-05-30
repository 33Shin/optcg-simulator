# AI Agent Instructions

Instructions given by the user for the AI agent to follow.

---

## Rule #1 — Log tool issues to TOOL.md

**Date**: 2026-05-12 | **Status**: Active

**Instruction**: If you encounter any problem with tool usage (e.g., unrecognized commands, wrong tool for the job, platform limitations), immediately record the issue and its fix in `AI/TOOL.md` for future reference.

This ensures tool-related mistakes are not repeated in later sessions.

## Rule #2 — Only move to the next phase on my Approve

**Date**: 2026-05-12 | **Status**: Active

**Instruction**: Only proceed to the next development phase after receiving explicit approval from the user. You may ask for approval when the current phase is complete, but do not move forward without explicit confirmation.

## Rule #3 — End responses with summary + status

**Date**: 2026-05-28 | **Status**: Active

**Instruction**: After finishing a response or task, you MUST end with a summary block formatted exactly as follows:

```
📋 **Request:** `<brief description of what was asked>`
✅ **Result:** `<completed / fixed / status summary>`
### WAITING FOR NEXT REQUEST!!!
```

## Rule #4 — NEVER discard code

**Date**: 2026-05-30 | **Status**: Active

**Instruction**: Do NOT use `git reset --hard`, `git clean`, `rm -rf`, or any command that permanently deletes working tree changes, untracked files, or committed history — unless the user **explicitly** asks you to do so.

- Use `git stash` for temporary changes
- Use branches for experiments
- Always ask the user before modifying git history
- If you need to undo changes, prefer `git revert` over `git reset --hard`

This is a hard rule. Violating it causes irreversible data loss.
