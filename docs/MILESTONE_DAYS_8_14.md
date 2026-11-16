# Milestone: Bindings (Days 8–14)

Date: 2026-11-16. Stacked on the Frame shell (PR #1), per Abiy's go-ahead.

## What's in

- **Add to Presentation.** Select cells in the model and the bar above the slide shows `Add Model!C1:F4 · Chart | Table | KPI`. One click creates the object on the current slide, creates its binding, and selects it. Options that don't fit the selection are disabled with the reason on hover. KPI needs one cell, a chart needs at least two, and tables are capped at 25×12.
- **Three binding types, all live.**
  - Range → chart: column (default), bar or line, switchable from the bar. Ranges are read the way a model is laid out: periods across the top, line items down the side, one series per line item. Single rows or columns become one series. Years typed as numbers (2026, 2027) are recognised as a header.
  - Range → table: uses the sheet's own number formats (12%, $1,200) via Univer's display values. The header row and label column are emphasised.
  - Cell → KPI: shows the sheet's formatted value, labelled from the model ("Total · FY27" = line item to the left and period above).
- **Placement.** New objects go in the first free spot on the slide, shrinking (down to half size) rather than overlapping. They cascade only if the slide is full.
- **Source traceability.** A selected object shows its source and has Go to source. Selecting cells in the model outlines every slide object that reads them, marks their slide thumbnails, and says how many objects use the selection.
- **Delete.** The Delete button, or the Delete key with the slide focused, removes the object and its binding. Delete in the sheet still clears cells.
- **No more stale-total flash.** The spike found that an edit reached the slide as two updates: first the new input next to the old total, then the recalculated total. The adapter now holds edits until Univer's formula pass ends and releases them together. If no pass comes (style-only changes) they are released after 400 ms. A browser test records every chart state and asserts there is no intermediate one.

## Univer notes

- `univerAPI.Event.SelectionChanged` does not fire for pointer selection in 1.0.3. Frame listens for the `sheet.operation.set-selections` command instead, inside the adapter.
- `FRange.getDisplayValues()` gives formatted text. The adapter exposes it as `getRangeDisplayValues`, and bindings now resolve to `{ values, display }`.
- Every edit triggers a formula pass (`calculationStart`/`calculationEnd`), even with no dependants. That is what makes the hold-until-recalc approach reliable.

## Tests

- Unit: 52 passing. New: chart series detection (spec model, single row/column, header detection incl. numeric years, blanks), Add-to-Presentation validation, placement (no overlap, shrink, stay on slide), KPI labelling, display values on bindings.
- Browser (production build): 13 tests, 39/39 over 3 repeats. New: create chart, table and KPI from mouse selections, then edit FY27 Enterprise and verify the chart, table, KPI and thumbnail all update. Also covered: reverse highlighting on the right objects and thumbnail only, Go to source from a KPI, delete removes the binding, chart type and new objects survive save and reload and stay live, Delete in the sheet doesn't delete slide objects, and edits arrive as one update.
- Latency on this run: median 74–101 ms, max 158 ms. This is a different cloud machine from the spike's measurements, so the drop may be partly hardware.

## Not in

Move and resize, text editing, images, slide create/delete/duplicate, presentation mode (Days 15–20); file Save As/Open (Days 21–24); the FY27 demo (Days 25–27). The starter sheet now includes the spec's FY26–FY28 example at C1:F4 so Add to Presentation can be tried straight away.
