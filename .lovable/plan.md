# Compact Live Game courtside layout

## Scope
Refine only the existing Live Game screen for faster phone use. Preserve scoring, event creation, substitutions, editing, offline storage, syncing, and game completion behavior.

## Changes
- Replace the sticky clock/control block with a compact score strip showing US, OPP, period, team fouls, and opponent fouls.
- Keep clock state and event timestamps intact, but remove the visible clock, Start/Pause, and ±10-second controls.
- Move Next Period into the lower game-status actions beside Review, Undo Last, Overtime, and End Game & Save.
- Compress the court picker into a small overlay with a compact title row, visible × cancel, and roughly 44px player pills arranged to fit the active five in at most two phone rows.
- Add safe outside-tap dismissal for temporary court prompts and lineup correction without triggering a court event or interrupting choice-button actions.
- Reduce the US free-throw controls to one compact two-button row.
- Compress opponent tracking into a phone-friendly action grid and keep its one-line summary visible when collapsed.
- Tighten panel spacing and secondary actions so score, court, key entry controls, opponent summary, undo/review, and game actions occupy materially less vertical space.

## Technical details
- Use the existing centralized reset path for dismissing uncommitted prompt state.
- Stop pointer propagation inside picker controls; treat only the exposed court/backdrop edge as dismissal while a prompt is open.
- Keep committed parent events intact for optional follow-ups, matching current sequence behavior.
- Retain all existing event handlers, score calculations, clock persistence, per-game court view persistence, and navigation.
- Verify scoring tests, type safety, preview build health, and representative phone/iPad interactions including outside-tap and × dismissal.
