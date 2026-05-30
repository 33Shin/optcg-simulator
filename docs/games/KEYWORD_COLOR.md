# Keyword Color Mapping & Rendering Rules

## Color Rules
| Category | Keywords | Hex |
|---|---|---|
| Timing Keywords | On Play, On K.O., When Attacking, Main, Your Turn, Opponent's Turn, Activate: Main, End of Your Turn, On Your Opponent's Attack | **Blue** `#0273A2` |
| Restriction Keywords | Counter, Once Per Turn | **Red** `#D74063` |
| DON!! Attachment | DON!! xN (x1, x2, ...) | **Black** `#1C0F0D` |
| Trigger | Trigger | **Yellow** `#F9E92B` |
| Special Keywords | Blocker, Rush, Banish, Double Attack | **Orange** `#EB7624` |
| Unknown | Any other keyword | **Pink** `#FF69B4` |

## Rendering Rules
- Keywords are always enclosed in `[ ]` in raw card text.
- On display, brackets are **removed** — only the keyword text is shown.
- Each keyword is rendered as a **solid color background** (no transparency).
- **Text color**: White (`#ffffff`) for all keywords, **except** Trigger which uses Black (`#000000`).
- **Font**: Inter, 14px, weight 500, padding 2px 8px, rounded corners r=4.
- Non-keyword text in effect blocks uses 14px Inter, weight 400.

## Cost Text Bolding
- In effect text, everything before the first `:` on a line is treated as **cost**.
- Non-keyword text in the cost section is **bolded** (weight 700).
- Keywords inside the cost section are **NOT bolded** — they retain normal weight 500.
- Effect text after the `:` is not bolded.
- Lines without `:` are left unbolded.

## Example (Gum-Gum Giant effect)
```
Raw:    [Counter] DON!! -2, You may trash 1 card from your hand: If your Leader has the Straw Hat Crew type, up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, draw 2 cards.
Render: [Counter|Red] DON!! -2, You may trash 1 card from your hand: If your Leader has the Straw Hat Crew type, up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, draw 2 cards.
```
- `[Counter]` → solid red background, white text, brackets removed
- `DON!! -2, You may trash 1 card from your hand:` → bold, plain text
- `If your Leader...` → normal weight, plain text

## Implementation
- `_keywordColor(keyword)` → returns hex color per table above
- `_highlightKeywords(text)` → splits by `<br>`, finds first `:`, applies bold to cost section, highlights keywords
- `_highlightKeywordsSegment(text)` → replaces `[keyword]` with styled span
- `_boldNonKeywords(text)` → highlights keywords first, then wraps non-span text in `<b>` tags
