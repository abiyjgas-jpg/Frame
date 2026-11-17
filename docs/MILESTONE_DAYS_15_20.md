# Milestone: Presentation workflow (Days 15–20)

Date: 2026-11-17. Stacked on bindings (PR #2).

## What's in

- **Objects:** select, drag to move, resize from 8 handles, nudge with arrow keys (Shift = 10 px). Objects stay on the slide and can't shrink below 24 px. Align to the slide's left, centre, right, top, middle or bottom (64 px margins). Bring to front or send to back. Duplicate with the button or Ctrl+D; a duplicated chart, table or KPI gets its own link to the same cells. Delete with the button or the Delete key.
- **Text boxes:** Text inserts a box and starts editing. Double-click or Enter to edit; Escape, Ctrl+Enter or clicking away commits. Formatting: font size, bold, italic, colour, left/centre/right.
- **Images:** PNG, JPEG, GIF, WebP or SVG up to 5 MB, sized to fit and keeping their aspect ratio. Images are stored in the project as data URLs, so a project stays one file. Unused images are dropped on save.
- **Slides:** new (after the current one), duplicate (linked objects stay linked), delete (asks first if the slide has content; its links are removed), reorder by dragging thumbnails, background colour.
- **Present:** full screen from the current slide. Next with → ↓ Space PageDown Enter or click; previous with ← ↑ PageUp Backspace; Home/End jump; Escape exits back to the slide you ended on. Slides stay live while presenting.
- **Chart polish:** value labels on bars and points (hidden past 24 points), and axis and labels use the sheet's own number format (12%, $1,200.00).

## Tests

- Unit: 70 passing. New: deck operations (move, resize from every handle incl. past the opposite edge and the slide edge, align, duplicate with fresh bindings, delete reporting bindings, slide add/delete/duplicate/move) and number-format inference.
- Browser (production build): 20 tests, 60/60 over 3 repeats. New: drag, resize, nudge and align; text insert, edit, format, save and reload; image insert, save and reload; a duplicated linked chart stays live and deleting it keeps the original's link; slides new, duplicate (live), drag-reorder, background and delete; present mode navigation, a live update while presenting, and Escape returning to the right slide.
- Latency: median 80–104 ms, max 128 ms.

## Known limits

- No undo for slide edits yet (the sheet has its own undo).
- Browser storage holds about 5 MB, so large images can make Save fail. The status bar says so. Save to file (next milestone) removes that limit.
- One object selected at a time; no snapping guides.
