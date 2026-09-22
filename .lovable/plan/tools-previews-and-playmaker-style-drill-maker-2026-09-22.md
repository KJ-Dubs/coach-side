# Tools previews and Playmaker-style Drill Maker

Upgrade only the Tools showcase and Drill Maker. Preserve every existing route, permission, saved drill shape, and unrelated CoachSide feature.

## Tools page

- Reorder cards to Playmaker, Coach's Board, Drill Maker, Practice Planner, Live Game, Team Stats, Playbook.
- Replace generic/static previews with compact internal miniatures that demonstrate each tool's real value:
  - Board: drawn court plus Marker, Arrow, Players, Eraser, color, and Clear Board controls.
  - Drill Maker: players, defenders, cones, extra ball, movement path, tool row, and active step.
  - Playmaker: players, ball, multiple routes, and active sequence controls.
  - Practice Planner: ordered timed practice blocks.
  - Live Game: shot locations, selected player, and MADE/MISS controls.
  - Team Stats: record, score/stat tiles, leaders, percentages, and a miniature shot chart.
  - Playbook: visual play cards and court thumbnails.
- Keep each whole card clickable, with snapshot first, a strong title, one short sentence, and one centered action.

## Drill Maker interaction

- Make court and compact controls the first working experience; move details into a Save/Details panel opened only when requested.
- Replace permanent equipment buttons with main tools: Move/Player, Pass, Dribble, Screen, Shot, Equipment, Erase, Add Step.
- Put Cone, Chair, Spot, Extra Ball, Starting Line, and Text inside one compact Equipment chooser.
- Use pointer-down/move/up drawing like Playmaker:
  - Move/Player drags an existing player to create a deterministic movement action.
  - Tapping empty court with Move/Player adds another offensive player; a compact choice allows defenders.
  - Pass, dribble, screen, and shot bind to the player under the drag start and store explicit stable actor IDs.
  - Pass receiver inference uses the existing deterministic Playmaker helper.
  - Equipment taps place objects; dragging an existing object repositions it; Erase removes the touched item/action.
- Store actions on every drill frame and use the existing deterministic sequence engine for projected step starts and animation.
- New steps retain the original stable token set and persistent equipment while their displayed start state is projected from prior actions.
- Add Preview Step, Replay Drill, and Reset controls without changing the shared Playmaker engine.
- Preserve the current database schema and saved drill compatibility. Older drills with empty actions continue to render normally.

## Save and details

- Open drill details after Save is tapped, keeping name, skill, player count, time, equipment, style, difficulty, intended result, instructions, and publishing choices.
- Keep current save APIs, ownership, Library behavior, and data fields unchanged.

## Verification

- Exercise add player, draw movement, add/reposition cone, add extra ball, add a second step, preview, and replay.
- Verify Tools and Drill Maker at phone, tablet, and desktop sizes.
- Confirm existing Playmaker, Live Game, and Team Stats routes still load.
- Check type safety and the automatic preview build.

## Assumption

“Starting marker / line” will be one equipment type represented by the existing `line` drill object; optional labels use the existing `text` object.