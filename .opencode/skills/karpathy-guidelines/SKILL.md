---
name: karpathy-guidelines
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
license: MIT
---

# Karpathy Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Anti-Pattern: Hidden Assumptions

When asked to "Add a feature to export user data", don't silently assume:
- Export ALL users (what about pagination? privacy?)
- File location without asking
- Which fields to include
- Format (JSON, CSV, etc.)

**Instead:** List assumptions explicitly, ask for clarification before implementing.

### Anti-Pattern: Multiple Interpretations

When asked to "Make the search faster", don't silently pick one interpretation. Present options:
1. Faster response time (database indexes, caching)
2. Handle more concurrent searches (async, connection pooling)
3. Faster perceived speed (partial results, progressive loading)

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Anti-Pattern: Over-abstraction

When asked to "Add a function to calculate discount", don't create:
- Abstract base classes with multiple strategies
- Config objects with min/max constraints
- Factory patterns for a single calculation

**Instead:** One simple function until complexity is actually needed.

### Anti-Pattern: Speculative Features

When asked to "Save user preferences to database", don't add:
- Caching layer (nobody asked for it)
- Validation pipeline (no bad data seen yet)
- Merge logic (requirement doesn't exist)
- Notification system (speculative)

**Instead:** Just the database save. Add complexity later when requirements emerge.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### Anti-Pattern: Drive-by Refactoring

When asked to "Fix the bug where empty emails crash the validator", don't:
- "Improve" email validation beyond the bug fix
- Add unrelated validation (username length, alphanumeric check)
- Change comments or add docstrings
- Add type hints if the codebase doesn't use them

**Instead:** Only change the specific lines that fix the reported issue.

### Anti-Pattern: Style Drift

When asked to "Add logging to the upload function", don't:
- Change quote style ('' to "")
- Add type hints nobody asked for
- Add docstrings
- Reformat whitespace
- Change boolean return logic

**Instead:** Match existing style (quotes, spacing, patterns) exactly.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

### Anti-Pattern: Vague Approach

When asked to "Fix the authentication system", don't:
- Review code vaguely
- Make "improvements" without clear criteria
- Proceed without defining what "fixed" means

**Instead:** Define specific success criteria, write tests first, verify each step.

### Anti-Pattern: Test-First Missing

When asked to fix "sorting breaks with duplicate scores", don't:
- Immediately change sort logic without confirming the bug

**Instead:** Write a test that reproduces the issue first, verify it fails, then fix it.

## Key Insight

> "LLMs are exceptionally good at looping until they meet specific goals... Don't tell it what to do, give it success criteria and watch it go." — Andrej Karpathy

The "overcomplicated" examples aren't obviously wrong—they follow design patterns and best practices. The problem is **timing**: they add complexity before it's needed, which makes code harder to understand, introduces more bugs, takes longer to implement, and is harder to test.

**Good code is code that solves today's problem simply, not tomorrow's problem prematurely.**

## How to Know It's Working

These guidelines are working if you see:
- **Fewer unnecessary changes in diffs** — Only requested changes appear
- **Fewer rewrites due to overcomplication** — Code is simple the first time
- **Clarifying questions come before implementation** — Not after mistakes
- **Clean, minimal PRs** — No drive-by refactoring or "improvements"
