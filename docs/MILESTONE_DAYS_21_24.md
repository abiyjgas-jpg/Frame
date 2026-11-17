# Milestone: Project files (Days 21–24)

Date: 2026-11-17. Stacked on the presentation workflow (PR #3).

## What's in

- **Save / Save As / Open / New.** A project is one `.frame` file (JSON): the workbook with its values, formulas and formatting, the slides, the links between them, and any images.
  - In Chrome and Edge, Save asks where to save the first time and then writes to the same file without asking. Save As always asks. Open keeps the file, so Save after Open writes back to it.
  - In browsers without the File System Access API, Save downloads a `.frame` file and Open uses a normal file picker.
  - Shortcuts: Ctrl+S save, Ctrl+Shift+S save as, Ctrl+O open (Cmd on Mac).
- **Unsaved changes.** The top bar shows the file name and an "Unsaved changes" badge; the tab title gets a dot. Sheet edits (values, formatting, rows and columns, undo and redo), slide edits, links and the project name all count. Selecting cells, switching sheets or slides, and loading a project don't.
- **Nothing lost on reload or crash.** The open project is copied to the browser half a second after each change and when the tab closes. Reopening Frame brings it back, still marked unsaved if it never reached a file. The browser only warns before leaving if that copy couldn't be written (storage full, usually from large images).
- **Safe Open and New.** Both ask before discarding unsaved changes, and New doesn't ask when there's nothing to lose. A file that isn't a Frame project is refused with the reason, and the open project stays as it was. If a file's workbook fails to load, Frame puts the previous workbook back.
- Projects saved by earlier builds (the old in-browser Save) are picked up automatically.

## Design notes

- Sheet changes are tracked through user-level Univer commands (`sheet.command.*`, undo, redo), not mutations, because loading a workbook and every formula pass run mutations. That logic lives in `UniverSpreadsheetAdapter.subscribeToEdits`.
- "Unsaved" compares the current state with what was last opened or saved. Making a change and then reverting it by hand still counts as unsaved.
- The file code (`src/project/fileAccess.ts`) takes the browser APIs as a parameter, so it's unit-tested with an in-memory disk.

## Tests

- Unit: 78 passing. New: file names, Save reusing the file handle, Save As, cancel vs real errors, download/upload fallback, Open then Save writing back, and the browser copy round trip (including old-format pickup).
- Browser (production build): 26 tests. New:
  - Opening the app and selecting things leaves the project clean.
  - Save asks once, Ctrl+S saves in place, Save As asks again.
  - Full round trip through Save, New and Open: a changed value, bold, a number format, a new formula, a text box, an image and a new KPI all come back, and the model stays live.
  - Download and upload fallback.
  - A non-Frame file is refused.
  - Unsaved work survives a reload, and Open asks before discarding it.
- Playwright can't drive the real Chrome save and open dialogs, so the browser tests stand in for them with an in-memory disk. The real dialogs need a manual check in Chrome (listed in the feedback checklist).

## Known limits

- After a reload, Save asks for the location again, because the browser doesn't keep file access across reloads.
- No "Recent files" list.
- Images still count toward the browser copy's ~5 MB limit. A file save has no such limit.
