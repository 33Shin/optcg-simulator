# One Piece Card Game - Official Rules Summary

## Source References
- Official site: https://en.onepiece-cardgame.com/
- Rules learned from TheGamer guide (Jim Ziegler, May 2024): https://www.thegamer.com/one-piece-card-game-start-guide/
- Verified against official API card data from limitlesstcg.com

## Game Overview
The One Piece Card Game is a collectible card game by Bandai, released July 8, 2022 (Japan), December 2, 2022 (Global). Each player selects a Leader and assembles a 50-card deck to battle an opponent. The game resembles Dragon Ball Super CCG and Hearthstone, with simplified resource management via a separate DON!! deck.

## Setup
1. Shuffle 50-card deck, place in deck area
2. Place 10-card DON!! deck face-down in DON!! area
3. Place Leader face-up in Leader area
4. Decide who goes first (rock-paper-scissors or random)
5. Draw 5 cards (mulligan allowed once: cards fly hand→deck, shuffle anim, draw 5 new)
6. Mulligan animation sequence (see ANIMATION.md):
   - Hand sprites hidden, cards fly to deck (FlyToTopDeckAnimation)
   - Hand cleared, deck shuffled (ShuffleAnimation)
   - 5 new cards drawn, fly from deck to hand (RedrawAnimation)
7. Place Leader Life value of cards face-down from deck top into Life area

## Card Types
- **Leader**: 1 card, red back, stays in Leader area. Has Power, Attribute, Color(s), Life, Type, Effect. Determines deck color limits.
- **Character**: Blue back, in deck. Played to Field. Has Cost, Power, Attribute, Type, Color, Effect, Counter (+Trigger). Max 5 on field.
- **Event**: Blue back, in deck. One-shot effects, trashed after play. Has Cost, Effect, Trigger.
- **Stage**: Blue back, in deck. Location card with ongoing effect. Has Cost, Effect, Type, Color. Max 1 at a time.
- **DON!!**: White back, separate 10-card deck. Resource cards, all identical.

## Color Matching
All non-Leader cards in a deck must match at least one color of the Leader card.

## Turn Phases (Detailed)

### Refresh Phase
1. Move all DON!! attached to your Leader/Characters to your Cost Area (rested)
2. Stand up all rested cards (Leader and active Characters)

### Draw Phase
- Draw 1 card from your deck
- Check for Trigger ability
- First player skips this on turn 1

### DON!! Phase
- Draw 2 DON!! from DON!! deck and place face-up in Cost Area (active)
- First player draws only 1 DON!! on turn 1

### Main Phase
During this phase, you may do any of these in any order, any number of times:
1. **Play cards** from hand by resting DON!! equal to Cost
   - Characters: placed active in Field area
   - Events: execute effect, then trash
   - Stages: placed in Stage area, trash existing Stage
2. **Attach DON!!** - take active DON!! from Cost and give to Leader/Characters (+1000 each)
3. **Activate effects** - use card abilities meeting timing requirements
4. **Attack** - rest a Character/Leader, choose target, resolve battle

### End Phase
- End your turn, opponent begins their turn

## Battle Resolution

### Counter Step (Defender Only)
After the attack target is declared, before power comparison, the defending player may counter by trashing cards from hand to boost the attacked card's power for that battle only:

1. **Character with Counter Power**: Any Character whose `counter` value is not null can be trashed from hand for **FREE** (no DON!! cost). The attacked target gains power equal to the trashed character's `counter` value.
2. **Event with [Counter] timing**: Event cards with a `[Counter]` effect can be played, but the player **must pay their normal DON!! cost**. The event resolves immediately, then goes to Trash.

The defender may counter multiple times in one battle (trashing any number of characters and/or playing counter events). All counter power boosts expire after this single battle — the target's power returns to its non-counter value afterward.

### Power Comparison
1. Rest attacking Character or Leader, choose target
2. "When Attacking" effects trigger
3. Attach DON!! to attacker from Cost for power boost
4. Opponent may activate Blocker to redirect attack
5. Counter Step (see above) — defender trashes cards to boost attacked target's power
6. Compare total power (Base + DON!! * 1000 + effects + counter boosts)
7. Defender power <= attacker power: defender is KO'd and trashed (attacker never trashed from combat)
8. Defender power > attacker power: nothing is KO'd, attack ends
9. If attacker hits Leader with 0 Life → opponent takes damage

## Trigger Cards
- Drawn card with Trigger may be activated before going to hand
- Trigger effects resolve immediately then card goes to hand
- Only the player who drew the card checks Trigger

## Damage Phase (Trigger on Taking Damage)
When a player's Leader is hit and has 0 Life cards remaining, the damaged player takes damage. Before the damage is applied:
1. **Draw top card from deck** — the damaged player draws the top card of their deck
2. **Check for Trigger ability** — if the drawn card has a Trigger ability, a prompt appears
3. **Play Trigger** — the effect resolves immediately for FREE (no DON!! cost), then the card is sent to Trash
4. **Pass** — skip the trigger and add the Life card to hand normally
5. If the drawn card has no Trigger ability, it is added to hand normally
6. After the trigger phase resolves (or is skipped), damage is applied to the Leader

## Life Cards
- Equal to Leader Life stat at game start
- Each successful attack on Leader with depleted Life costs 1 damage
- When opponent has Life cards, Leader cannot be damaged
- Once all Life cards are gone, each hit deals 1 damage (with Damage Phase trigger check)

## Win/Lose Conditions
- **WIN**: Deal damage to opponent's Leader when they have 0 Life cards (requires Leader Life hits)
- **LOSE**: Your deck reaches 0 cards (immediate loss, no draw needed)

## Additional Rules
- Each player has their own DON!! deck (10 cards each)
- DON!! deck exhaustion is NOT a win condition
- Trash piles are public
- Life cards are face-down (except own)
- Stage cards are face-up when in play
- "Owner's deck" means the deck of the player who owns that card
- Cards sent to bottom of deck can be top or bottom unless specified
- "Return to hand" means return to owner's hand
- "Return to deck" means shuffle into owner's deck unless specified top/bottom
- Once Per Turn effects are tracked per character/leader
- DON!!-X ability costs DON!! from attachments or Cost area
