# Frame: Technical Spike Plan (Days 1–3)

Date: 2026-10-07. Scope: section 21 "Days 1–3 Feasibility Spike" only. Days 4–30 wait for founder review.

## Goal

Prove, on one screen, that:

1. A Univer OSS sheet calculates formulas.
2. Frame can read a range's recalculated values through its own adapter.
3. A Frame-rendered chart bound to that range updates automatically (no refresh), within 250 ms.
4. The workbook snapshot can be saved and reloaded with values, formulas and the binding intact.

## Environment found

- No repository attached to the project and no GitHub account linked to this session, so the spike lives in a fresh local git repo (`frame/`). Docs are copied to `/mnt/project-files/frame/`.
- Node 22.22, npm 10.9, Chromium + Playwright available for automated browser tests.

## Univer: OSS-only verification

Source: official docs (docs.univer.ai, "Installation" + "General API", v1.0.3) and each installed package's `package.json`.

- Install path: `@univerjs/presets` + `@univerjs/preset-sheets-core` (the documented "core" preset). This preset pulls in only `@univerjs/*` packages, no `@univerjs-pro/*`.
- After install, `node_modules/@univerjs-pro` does not exist (verified).
- Every installed Univer package is Apache-2.0 (commercial use permitted, attribution/NOTICE required), except `@univerjs/icons` which is MIT. Full table in `SPIKE_RESULTS.md`.
- `@univerjs/telemetry` is installed transitively. It is an interface package only; a grep of its build finds no `fetch`, `XMLHttpRequest` or `sendBeacon`. No data leaves the machine.
- Univer features that are Pro and therefore off-limits: charts, pivot tables, shapes/drawing editor, print, import/export (xlsx), collaboration, history. None are needed: Frame draws its own charts.

## Chart renderer

Chosen: **Chart.js 4 (MIT)**.

- Smallest well-maintained permissive option that covers column, bar (horizontal) and line natively; waterfall is a floating-bar dataset, so it is "trivial" if we want it.
- Animations can be turned off, so updates are a synchronous redraw, which fits the <250 ms target.
- Rejected: ECharts (Apache-2.0, ~1 MB, more than we need), Recharts (MIT, SVG, pulls d3 modules; heavier), hand-rolled SVG (zero deps, but the spec asks for a library unless none fits; kept as a fallback since the renderer sits behind one component).

## Architecture for the spike

```
src/spreadsheet/SpreadsheetAdapter.ts      interface (getCellValue, getRangeValues, subscribeToChanges,
                                           activateSheet, selectRange, saveSnapshot, loadSnapshot)
src/spreadsheet/UniverSpreadsheetAdapter.ts  the only file that imports Univer
src/bindings/range.ts                      A1 parsing + intersection (pure, tested)
src/bindings/BindingManager.ts             bindings -> resolved values, change filtering (pure, tested)
src/project/FrameProject.ts                document schema + (de)serialization (pure, tested)
src/presentation/LinkedChart.tsx           Chart.js wrapper
src/app/App.tsx                            one screen: sheet left, chart right
```

Change detection: listen to `SheetValueChanged` (user edits) and the formula engine's `calculationResultApplied` (recalculated formula values), coalesce into one refresh per animation frame, and re-read only bindings whose range intersects the changed ranges (formula results always trigger a re-read of the affected sheet's bindings, since a formula's dependants are not reported to us).

Persistence for the spike: `FrameProject` JSON (workbook snapshot embedded + bindings) saved to `localStorage` and downloadable as `project.frame.json`. File System Access API is a Days 21–24 item.

## Assumptions

1. **The spec's test case reads `A3 = =SUM(A1)`, then "bind A1, change A2".** Taken literally, changing A2 would not change anything bound. I assume the intent is `A3 = =SUM(A1:A2)` and the chart bound to `A1:A3`, so editing A2 changes both a raw value and a formula result on the chart. I also test the literal case (A1 bound, `=SUM(A1)`) as a single-cell KPI read.
2. "Latest stable" = Univer 1.0.3, React 19.3, Vite 8, TypeScript 7, Chart.js 4.5.
3. Snapshot stored inside `project.frame.json` (no separate workbook file).

## Blockers

None known at plan time. Risks to watch: whether formula results raise `SheetValueChanged` (if not, the formula-engine hook covers it), Univer's bundle size, and Univer's UI-thread formula engine on 10k-cell workbooks (Days 4+).
