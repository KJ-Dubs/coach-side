# Playmaker deterministic sequence engine

Rebuild the play state/animation core so every player, defender, and the ball has one exact authoritative position after each sequence, and sequence N always starts from sequence N-1's end state. No app rebuild, no visual redesign.

## What changes for the coach

- Jumping to any sequence instantly shows the court exactly as that sequence begins — no guessing where a player will be.
- Players never swap routes or identities when paths cross, and the ball never jumps to the wrong player.
- Several players moving in one sequence now start at staggered times and finish together.
- Two players ending on the same spot both stay visible (tiny visual nudge only; the real spot is unchanged).
- If a coach draws "1 passes to 2" and "2 hands off to 3" in the same sequence, a friendly prompt explains 2 must receive the ball first and offers to move the handoff to the next sequence.
- Separate controls: Preview Sequence (animate just this one, leave players at its end), Reset Play (back to the original setup), Replay Play (animate the whole play from the start).
- Selecting an action while editing shows a small identity tag like `P5 • Cut • Seq 6`.

## Technical approach

### 1. `src/lib/playAnimation.ts` — rewritten as a state engine

- `buildSteps(frame)` becomes a pure fold over sequences producing, per sequence: `startTokens`, `endTokens`, `startBall`, `endBall`, `actions`, plus per-action resolved `actorId`/`targetId` and a per-action `delayMs`/`durationMs` for stagger.
- Ownership is resolved **once, at step-build time, from explicit `actor`/`target` IDs**. Geometry-based `nearestToken` inference is removed from playback entirely.
- Legacy compatibility: a single deterministic resolver (`resolveLegacyActors`) runs once when a frame is loaded/normalized, binding missing `actor`/`target` by nearest token **at the sequence's own start state**, then those IDs are written into the in-memory action objects (and persisted on the next save). Playback never re-infers.
- Movement actions in a sequence are staggered by path length: `delay = maxDuration - ownDuration`, all sharing a common finish, with `MIN_MOVE_MS`/`MAX_MOVE_MS` clamps. Existing speed multipliers keep working since they scale elapsed time.
- Ball rules: dribble/cut/move keep the ball attached to its owner; possession transfers only on pass/handoff completion; during a pass the ball is in flight from the owner's live position to the target's live position; shot clears ownership.
- Chain detection: `validateSequence(actions, startState)` flags any pass/handoff whose actor is the target of another ball action in the same sequence, returning a structured conflict the editor can act on.
- Absolute destinations: action endpoints stay as stored normalized coordinates; only the rendered start of a route is redrawn from the recomputed actor position, so editing sequence 2 cascades automatically (the fold recomputes 3..N).
- `sampleStep(step, phase, progress)` keeps its existing signature so `PlayPresenter` and `playVideo.ts` need no behavioural change; internally it uses the new per-action delay/duration.
- New helpers: `stateAtSequenceStart(frame, seqIndex)` and `visualOffset(tokens)` (deterministic index-based nudge for overlapping tokens, applied at render only).

### 2. `src/components/court/PlayCanvas.tsx`

Apply the deterministic visual offset when drawing tokens; stored coordinates untouched. Optional `selectedActionId` renders the `P5 • Cut • Seq 6` identity chip.

### 3. `src/routes/_authenticated/plays.$playId.index.tsx` (editor)

- Add an active-sequence selector. Selecting sequence N renders projected start state from the engine.
- Drawing binds the action to the token ID under the drag start **using projected positions**, and always writes `actor` (and `target` for pass/handoff). If no token is under the start point, the stroke is rejected with a short message instead of creating an ownerless action.
- Chain conflict prompt with "Move to next sequence" / "Cancel".
- Replace the single Play/Reset pair with Preview Sequence, Replay Play, Reset Play.
- Keep drag-from-player interaction and all existing tools, press setup, zoom, flip, frames.

### 4. Presenter and MP4 export

No engine fork — both already call `buildSteps`/`sampleStep`, so they inherit the new determinism. `playVideo.ts` gets updated only where it assumes fixed `DO_MS` per step (it must use the step's computed duration).

### 5. Data and compatibility

- No schema migration. `actor`/`target` already exist on `PlayAction` in `play_frames.actions` JSON.
- Older actions with no `actor` are bound once by the deterministic legacy resolver and persisted the next time the coach saves that play. Limitation: for a legacy action drawn from a point that was not near any token at that sequence's start, the action is kept as a drawing-only annotation (no movement/possession effect) rather than guessed.

## Verification

Typecheck plus build, and scripted engine checks covering the acceptance cases: repeated identical playback, crossing routes, ball retention through crossings and dribbles, pass ownership on arrival, chain detection, shared destinations, editing an early sequence with later ones present, direct jump to a later sequence, and a 20+ sequence play. MP4 export is exercised once to confirm it matches presenter output.
