# CoachSide creator discovery update

## What will change

- Remove the bright Create Play action from the Playbook page header and add a smaller contextual action inside My Playbook. A selected Play Type will keep the matching quick-create flow.
- Expand CoachSide Library navigation to Plays, Drills, and Coaches, with typed deep links for the signed-in Library and matching discovery navigation on the public Library.
- Add a compact Coaches directory with name/handle search, public bio and counts, View Profile, and Follow/Following actions.
- Add My Coach Profile in the Library for signed-in coaches. It will open their public page when configured or take them to the existing profile editor when not configured.
- Keep author names directly linked on non-anonymous Library plays while Anonymous Coach remains plain text with no hidden identity.
- Make a coach’s own public profile view-only, replace self-follow with a clear self-profile state, and offer a small edit link.
- Point the existing Follow a Coach achievement and tip to the Coaches directory without changing achievement keys or history.
- Preserve browser-history Back behavior and add a Coaches-directory fallback for direct profile links.

## Data and privacy

- Add one public read-only creator-directory function returning only username, public display name, bio, published non-anonymous play count, hearts, followers, and profile creation date for sorting.
- Include only profiles with a handle and at least one non-anonymous published play; never return email, team, roster, unpublished-play, or anonymous attribution data.
- Keep follow writes authenticated and retain the existing database-level self-follow rejection. No ownership, sharing, play assignment, folder, or RLS rules will be loosened.

## Validation

- Check signed-in Playbook/Library, public Library, creator profile, profile setup, follow/unfollow counts, author links, anonymous cards, direct-link fallback, and phone/iPad layouts.
- Run focused tests, TypeScript validation, and confirm the preview build is healthy.

## Technical details

- Reuse the current `LibraryFeed`, `FollowButton`, public profile RPC, and route search patterns.
- Invalidate directory, profile, follow, achievement, and progress queries after follow changes so counts and progress update immediately.
- Preserve existing Plays/Drills behavior, thumbnails, hearts, Play of the Day, menus, Add to My Playbook, canonical sharing, and existing creator-profile routes.