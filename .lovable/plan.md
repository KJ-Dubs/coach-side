# Center the mobile Game Report

## Scope
Adjust only responsive presentation on the existing Game Report and shared shell. Preserve report calculations, filters, court plotting, PDF contents, event data, and substitutions.

## Changes
- Remove report-specific controls from the crowded global header and place them in a dedicated compact action panel directly below the centered report title/date.
- Use a two-column mobile action grid that expands cleanly on larger screens without affecting title centering or the profile control.
- Constrain the report page, summary rows, filters, map, side panels, and timelines with `min-w-0`, `max-w-full`, and wrapping where appropriate.
- Keep the report map/sidebar grid single-column on phones and tablets until sufficient desktop width is available.
- Keep the box score wider than its viewport only inside its own horizontal scroll container; prevent it from widening the document.
- Stabilize filter and timeline content so changing selections cannot alter page width or horizontal position.

## Technical details
- Harden the shared header action slot against future overflow while retaining the existing desktop navigation.
- Use the balanced title layout so action widths cannot push the report title off-center.
- Verify no document-level horizontal overflow at 360px, 430px, and iPad widths, then run type safety and preview build checks.
