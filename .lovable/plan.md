# CoachSide visual system cleanup

## Scope
Standardize presentation across existing CoachSide screens without changing routes, permissions, data, pricing, or feature behavior.

## Build
- Expand the shared CoachSide UI primitives with centered section headers, grouped information/checklist panels, metadata-only pills, and centered primary-action layouts.
- Update the global page heading treatment so major titles and summaries have a consistent centered hierarchy on coach and player screens.
- Apply the shared patterns to the highest-use coach screens: Dashboard, Playbook/Library, presenter, Locker Room, Calendar, Stats/Roster, Settings, Profile, game setup, and Membership.
- Apply the same hierarchy to public marketing, Library, and shared-play surfaces where appropriate.
- Keep tables, forms, event details, stats, messages, and instructional copy left aligned; retain compact pills only for status, filters, categories, dates, roles, and other metadata.
- Ensure primary actions are centered, high contrast, at least 44px tall, and clickable across their entire visible area.

## Technical details
- Presentation-only React and Tailwind changes; no backend, schema, security, billing, or entitlement changes.
- Refactor existing `Bubbles` primitives rather than introducing a parallel design system.
- Preserve dense workflows and the persistent-court live game experience.
- Verify representative 390px mobile and desktop screens, then check type safety and the preview build log.
