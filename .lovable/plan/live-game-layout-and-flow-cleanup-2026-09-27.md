# Live Game layout and flow cleanup

## Scope
Refine the existing Live Game screen without changing event creation, scoring, substitutions, persistence, syncing, editing, or game-finalization logic.

## Build
- Reorder the screen into a compact score/clock header, court, temporary action prompt, Opponent panel, lineup/events controls, and game-status actions.
- Make the score and clock easier to scan, with larger Start/Pause and appropriately tiered clock/period controls.
- Separate Opponent tracking into clearly labeled Scoring, Possession, and Foul groups, plus one concise stat summary; allow one-tap collapse on phones while keeping the summary visible.
- Replace the permanent free-throw roster with two compact “FT Made” and “FT Miss” actions. After either tap, show “Who shot it?” with the on-court five first and an “Other Player” reveal for the bench, then use the existing event and lineup behavior and close automatically.
- Update all player-based follow-ups to show the on-court five first with jersey and short name, revealing bench players only through “Other Player.”
- Present the current question in one focused temporary panel near the court, keeping all existing make/miss, assist, rebound, foul, turnover, opponent, and lineup-correction outcomes intact.
- Apply the requested orange/purple/gray/red action hierarchy and 44px minimum touch targets, with larger primary controls.

## Technical details
- Keep `scoreFromEvents`, `eventPoints`, event types, event helpers, offline queueing, court coordinates, and state persistence unchanged.
- Add only small UI state for free-throw intent, bench disclosure, and phone Opponent collapse.
- Preserve overlays on the court where necessary so the court remains visible, while using the same focused picker pattern for all player questions.
- Verify scoring tests, type safety, preview build health, and representative phone/iPad layouts and interactions.
