# Drill Maker, Playmaker, and Coach's Board corrections

Correct the existing editing interactions and diagram conventions without changing authentication, saved-play ownership, backend permissions, or deterministic playback timing.

## Drill Maker

- Split the current combined tool into **Position Player** for direct setup editing and **Cut / Move** for animated movement actions.
- Position Player will drag the current step’s token without creating an action; tapping empty court will retain the offense/defense add-player workflow.
- Add snapshot-based Undo and Redo for player positions, action creation/deletion, equipment placement/movement, and other editor changes.
- Replace the horizontal tool strip with a fixed two-row responsive grid containing all eight primary tools; keep sequence and playback controls in a wrapped row below it.
- Remove Starting Line from equipment choices and stop creating “START” labels. Legacy line objects remain accepted by saved-data types but will be hidden by Drill Maker rendering.

## Shared dribble rendering

- Update the shared court-path helper so dribble squiggles follow every segment of the actual drawn path, with consistent perpendicular amplitude and a destination arrow.
- Keep movement timing and normalized coordinates unchanged.
- Apply the shared renderer to Playmaker, Drill Maker, previews/presenters, library thumbnails, and MP4 export paths that already use the shared court renderer or path helper.

## Coach's Board

- Add a dedicated **X / O** tool with a compact X/O selector.
- Place and drag X/O markers; include them in erasing, clear, undo, redo, and session persistence.
- Default fresh board sessions to Thin while preserving existing in-session board contents.

## Verification

- Exercise Position Player versus Cut / Move, Undo/Redo, equipment placement/movement, second steps, dribble rendering, and legacy drill loading.
- Exercise Board X/O placement, dragging, erasing, undo/redo, and Thin default.
- Verify phone and tablet layouts have no horizontal core-tool scrolling.
- Check Playmaker/Drill Maker preview rendering, type safety, and the automatic preview build.
