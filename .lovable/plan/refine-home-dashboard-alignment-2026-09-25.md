# Refine Home dashboard alignment

## What will change
- Balance the Home welcome card with matching left and right logo-width columns, with a stacked fallback on narrow phones.
- Center the Current Team content and constrain every team action to the same intentional width.
- Turn active games into a labeled vertical list of equal-size orange resume actions.
- Rework Up Next and Game Today into centered, readable stacks on phones and balanced rows on larger screens.
- Normalize the main Home card spacing and place trial status without interrupting the requested core section order.

## Technical details
- Add an opt-in balanced-header layout to the existing app shell so other pages keep their current presentation.
- Preserve all existing links, queries, team switching, live-game resume routes, calendar behavior, conditional sections, and authorization.
- Verify authenticated Home at narrow phone, iPad portrait, and iPad landscape sizes, then run the type check and inspect the preview build.
