# Fix Live Game rebound capture and prompt sizing

## Scope
Refine only the existing Live Game court prompts. Preserve scoring, event semantics, lineup behavior, editing, undo, offline storage, and syncing.

## Changes
- Separate rebound-location mode from the normal dismissible chooser backdrop so court taps reach the existing rebound location handler and save coordinates.
- Show rebound-location guidance as a shallow top-anchored banner with **Skip location** and **× Cancel** controls; leave the rest of the court unobstructed and tappable.
- Keep normal temporary choosers dismissible from unused court/backdrop space without allowing button taps to bubble into dismissal.
- Replace tap-coordinate prompt positioning with one predictable bottom-center court anchor, constrained on every side and capped to available court/viewport height.
- Wrap choices in compact rows and reduce player pills to 44px-high, low-padding labels that retain jersey number and short name.
- Apply the same bounded prompt treatment to player, stat, assist, rebound, foul, turnover, opponent, free-throw, and lineup-correction prompts.

## Technical details
- Render rebound-location guidance on a pointer-transparent layer, restoring pointer events only for Skip and Cancel.
- Read the current step through the synchronous step reference in the court handler to avoid stale render state during rapid touch input.
- Preserve the existing rebound commit path and related event ID; Skip saves the rebound without coordinates, while Cancel clears only the pending location step.
- Verify scoring tests, type safety, preview build health, and phone interactions for court location capture, skip, cancel, outside dismissal, and prompt bounds.
