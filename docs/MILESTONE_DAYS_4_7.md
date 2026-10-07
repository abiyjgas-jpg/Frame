# Milestone: Frame shell (Days 4–7)

Date: 2026-10-07. Builds on the approved spike.

## What's in

- **Split workspace.** Model (Univer) on the left, presentation on the right, both always visible. Draggable divider with 360 px / 420 px minimums, arrow-key resizing, double-click to reset to 50/50, and the position remembered per browser. Univer redraws into the new width and keeps working.
- **Top bar.** Frame wordmark, editable project name, New / Open / Save, Present. Save (and Ctrl/Cmd+S) works, saving to browser storage. New asks for confirmation, then loads a blank project. Open and Present are shown but disabled until their milestones (file persistence, Days 21–24; presentation mode, Days 15–20).
- **Presentation canvas.** Slides are a fixed 1280×720 logical surface scaled to fit the pane, so object coordinates never depend on screen size. Objects can be selected. A selected linked object shows its source (e.g. `Model!A1:A3`) and a Go to source button.
- **Slide thumbnails.** Bottom strip mirroring Univer's sheet tabs. Thumbnails are live: they show the same bound values and update after the main canvas, so they don't slow down the update the user is looking at.
- **Project structure.** `FrameProject` now carries `slides[]`, each with `objects[]` (`id, type, slideId, x, y, width, height, style, bindingId?`), validated on load. The starter project has a title slide and a slide with a live KPI and chart.

## Not in (by design, later milestones)

Add to Presentation, new binding types in the UI (Days 8–14); creating, deleting and duplicating slides, move/resize, text editing, images, presentation mode (Days 15–20); file Save As/Open (Days 21–24); the FY27 demo (Days 25–27).

## Tests

- Unit: 27 passing (adds layout maths, slide/object validation, starter project binding integrity).
- Browser (production build, 1440×900): 8 tests, 24/24 over 3 repeats. Covers both panes visible, divider drag/clamp/persist/reset with the sheet still editable, thumbnail switching and live thumbnails, object selection with source and Go to source, Save → reload → New, live-update latency, and no external network calls.
- Update latency with the shell (canvas and thumbnails): median 181–200 ms, max 249–261 ms over 24 edits on the cloud VM. That's the same as the spike. The slowest edit is usually the first after load.

## Layout

```
src/app/            App, TopBar, ObjectBar, styles
src/components/     SplitPane
src/presentation/   PresentationCanvas, Slide, SlideThumbnails, types, objects/
src/project/        FrameProject (schema + validation), persistence (browser storage for now)
src/demo/           starter project
src/utils/          layout maths
```
