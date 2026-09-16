# Playmaker tools and court orientation update

## Scope
Update only the existing Play Designer workflow and shared court camera projection. Preserve saved play geometry, deterministic sequence behavior, playback, presenter/export behavior, permissions, and all unrelated features.

## Build
- Reorder the mobile editor so the court is followed immediately by Tools, including action tools, Undo, Add/Remove Defense, and a prominent validated `+ New Sequence` control.
- Place compact sequence navigation below Tools, followed by Preview Sequence, Replay Play, Reset Play, and Use End Positions. Keep frames, play details, and other setup choices secondary.
- Replace the current split court controls with one clear five-choice view control: Right, Left, Top, Bottom, Full. New editor sessions default to Right Half and the chosen editor view is remembered without changing play data.
- Extend the court camera projection so all five views display the same normalized full-court coordinates. Left/Right crop the matching logical half; Top/Bottom rotate the matching half into portrait orientation. Switching views never edits tokens or action coordinates.
- Seed all five defenders in sensible visible positions for the active view when Add Defense is used on a frame with no defenders. Existing defenders keep their logical positions when the view changes.
- Keep the next-sequence action subject to the existing deterministic action validation; it will not bypass chained-transfer or other invalid-state protections.

## Technical details
- Add a shared court-view transform with logical-to-display and pointer-to-logical conversion, including portrait aspect ratios for Top/Bottom.
- Apply that transform consistently to court lines, tokens, actions, ball, selected-action label, pointer drawing, and visual overlap offsets.
- Keep attack direction (`attack_basket`) separate from the editor camera choice.
- Use the existing CoachSide buttons, panels, colors, and compact mobile patterns rather than introducing a new visual system.

## Verification
- Run TypeScript checks and inspect the preview build log.
- Test a mobile viewport to confirm Tools are directly below the court before sequence/animation panels.
- Exercise all five views, draw/select actions, switch views without coordinate changes, and verify five defenders appear in every newly seeded half-court view.
