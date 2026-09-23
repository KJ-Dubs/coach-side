# Drill Maker multi-ball update

## Goal
Turn every Drill Maker “Extra Ball” into an independent basketball that can be staged, assigned, passed, dribbled, animated, erased, and carried through drill steps without changing Playmaker’s single-ball rules.

## Build
- Extend the drill-only saved frame format with stable ball records: identity, position, owner, state, and last assignment order. Convert the existing primary token ball and legacy Extra Ball objects when a drill loads so older drills continue to work.
- Add a drill-specific deterministic multi-ball timeline layered beside the existing player/action engine. Bind each pass or dribble to a specific ball when the action is created, then fold player and ball states forward by step without later proximity guessing.
- Make setup interaction direct: Extra Ball places a usable ball; Position Player mode drags free or attached balls; dropping near a player assigns it; dragging away detaches it. Keep Extra Ball inside Equipment.
- Require actual possession for pass and dribble. Show a small temporary hint when the selected player has no ball. Allow simultaneous actions when each actor owns a different ball.
- Render all balls in the editor, step preview, replay, saved drill detail, and drill tiles. Owned balls sit beside their player, passes animate in flight, dribble balls follow their owners, and free balls remain fixed.
- Include ball changes in existing Drill Maker Undo/Redo and Eraser behavior. Save all ball state inside the existing JSON frame data, so no database schema or permission changes are required.

## Technical details
- Keep shared Playmaker state and ownership behavior untouched; add drill-only ball/action metadata and timeline helpers.
- Preserve normalized full-court coordinates and existing camera views.
- Recalculate later step starts from immutable IDs and stored action bindings, never from path crossings.
- Verify legacy single-ball frames, three simultaneous dribbles, mixed pass/dribble steps, stationary balls, step carry-forward, Undo/Redo/Erase, phone layout, and type/build checks.
