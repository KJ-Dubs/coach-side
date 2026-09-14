# Fix mobile MP4 export

## What will change
- Replace the fixed export overlay with one dedicated Export Video section inside the play presenter’s normal page flow.
- Keep play-to-play navigation, the court, playback controls, and export controls as separate stacked sections at 320–430px widths.
- Show explicit Ready, Generating, and Ready to Download states, with a format-matched responsive preview and Regenerate action.
- Replace the nested link/button download with one direct user-click download action and a stable CoachSide play filename.
- Keep the generated object URL alive until regeneration, play change, or presenter unmount.

## Technical details
- Preserve the existing genuine H.264 MP4 paths: WebCodecs plus MP4 muxing when supported, and the current WASM H.264 MP4 fallback on Android.
- Validate the returned Blob MIME and MP4 signature before exposing a download.
- Trigger a temporary native anchor from the Download button’s click handler, then remove the anchor without revoking the Blob URL.
- Verify mobile layout and downloaded bytes with browser checks, then run TypeScript and production build checks.
