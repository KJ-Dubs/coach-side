# CoachSide play and drill video export update

Add a shared branded title composition and CoachSide outro to the current browser-based MP4 renderer, while preserving its deterministic animation model, speed controls, encoding fallbacks, download flow, and normal-flow preview layout.

## What will change

- Every play and drill MP4 will use a dedicated header band above the court with a small `PLAY` or `DRILL` label and a larger, bold title.
- Titles will wrap to at most two lines, shrink only when necessary, and use ellipsis only if the smallest supported size still cannot fit.
- The court will be fitted only inside the remaining court region, preserving full/half-court orientation and keeping player movement readable in vertical, square, and landscape formats.
- Every export will append a roughly 1.8-second dark CoachSide end card using the existing CoachSide mark, with a subtle fade/scale and optional “Made with CoachSide” line. No URL, QR code, music, or new audio behavior.
- The existing optional in-animation watermark remains compatible; the outro is always included.

## Play and drill parity

- Keep plays on the existing `ExportPlayVideo` flow and shared deterministic `buildSteps` / `sampleStep` timing.
- Extend the shared export model with a content kind and optional drill data rather than creating a second encoder.
- Add drill rendering to the same frame composer, including independently animated drill balls plus cones, chairs, spots, and text equipment.
- Expose the same mobile-friendly export controls on saved drill pages. The current Drill Maker has preview/replay but no MP4 control; this work adds export for the saved drill representation rather than changing its editing workflow.

## Technical details

- Update `src/lib/playVideo.ts` to load the existing mark asset before encoding, calculate a title-safe layout per aspect ratio, draw wrapped/fitted title text, render play or drill-specific court layers, and include outro frames in total duration/progress for both WebCodecs and WASM paths.
- Reuse `drillStateAtSequenceStart` and `sampleDrillBalls` for drill ball positions while continuing to use `sampleStep` for player/action positions, so Playmaker’s single-ball rules and Drill Maker’s multi-ball rules remain separate.
- Update `src/components/court/ExportPlayVideo.tsx` only as needed for neutral play/drill labels and filenames; preserve the current generated-video preview and download placement.
- Add a drill playback/export adapter and wire it into `src/routes/drills.$drillId.tsx` without changing drill ownership or editing permissions.
- Add focused renderer checks for short titles, long two-line titles, drill extras/multi-ball data, outro duration/frame count, and existing timing calculations.

## Verification

- Generate and inspect a short-name play MP4, long-name play MP4, and drill MP4 in at least vertical and landscape formats.
- Confirm the title stays outside the court, the court remains readable, the real CoachSide mark appears during the final 1.5–2.0 seconds, and no URL or QR code appears on the outro.
- Confirm MP4 signatures/downloads through the current WebCodecs path and available fallback behavior, then check phone/tablet layout, type safety, and the preview build.

## Assumption

Saved drills will receive the export control on their drill detail page. Unsaved Drill Maker drafts must still be saved before export, matching the app’s current saved-content workflow.
