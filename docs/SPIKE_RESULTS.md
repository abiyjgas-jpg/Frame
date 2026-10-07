# Frame: Feasibility Spike Results (Days 1–3)

Date: 2026-10-07 · Status: **complete, awaiting founder review.** Days 4–30 not started.

## Verdict

**Feasible. Recommend proceeding with Univer OSS + Chart.js.** Every item the spike had to prove works, end to end, on the open-source Univer packages only, with automated browser tests.

| Must prove | Result | Evidence |
|---|---|---|
| Univer OSS sheet with formula calculation | ✅ | `A3 = =SUM(A1:A2)` recalculates on edit |
| Frame reads recalculated range values | ✅ | via `SpreadsheetAdapter.getRangeValues` |
| Frame chart bound to a range | ✅ | Chart.js column chart bound to `Model!A1:A3`, plus a KPI bound to `A3` |
| Live update with no refresh button | ✅ | editing A2 updates A2's bar, A3's bar and the KPI |
| Update under 250 ms | ✅ (with a caveat, below) | 24 measured edits: median 161–195 ms, max 243 ms |
| Save workbook snapshot | ✅ | `FrameProject` JSON with embedded snapshot, to localStorage + `.frame.json` download |
| Reload workbook snapshot | ✅ | both in-app reload and a full page reload restore values, the **formula** (not just its value), and both bindings |
| No `@univerjs-pro` | ✅ | not in `node_modules` at all |
| No network calls | ✅ | test asserts zero non-localhost requests during load + edit |
| Go to source (bonus, it was cheap) | ✅ | selects `A1:A3` in the sheet |

Screenshot: `docs/screenshots/goto-source.png`.

## What was built

One screen: Univer sheet on the left, one slide-shaped panel on the right with a KPI and a column chart. Top bar: Save snapshot, Reload snapshot, Download `.frame.json`, Reset.

```
src/spreadsheet/SpreadsheetAdapter.ts        the interface the rest of Frame uses
src/spreadsheet/UniverSpreadsheetAdapter.ts  the ONLY file that imports Univer (~110 lines)
src/bindings/range.ts                        A1 parsing, intersection
src/bindings/BindingManager.ts               bindings → values, change filtering, batching
src/bindings/types.ts                        Binding schema (as in the spec)
src/project/FrameProject.ts                  document schema, (de)serialisation + validation
src/presentation/LinkedChart.tsx             Chart.js wrapper
src/app/                                     the spike screen
tests/                                       Vitest unit tests (Frame logic, Univer faked)
e2e/                                         Playwright tests against the production build
```

How the live update works: the adapter listens to Univer's `SheetValueChanged` event (fires for user edits **and** for formula results written back to cells) and, as a safety net, the formula engine's `calculationResultApplied` hook. It hands Frame plain `{ sheetId, ranges[] }` changes. `BindingManager` finds bindings whose source range intersects, re-reads only those, skips unchanged values, and notifies the renderer.

## Tests

- **Unit (Vitest): 20 passing.** Range parsing (incl. `$A$1`, `AA`, reversed, invalid), binding create/delete/validation, change filtering by range and sheet, whole-sheet (formula) invalidation, no-op suppression, batching, missing sheet, reverse lookup (`bindingsForRange`), project serialise/deserialise round trip and malformed-file errors.
- **Browser (Playwright, production build, Chromium 1440×900): 5 tests, 15/15 passing over 3 repeats.** Real keyboard edits into the Univer canvas: A2 edits with latency measurement, A1 edit, save → edit → reload snapshot → edit → full page reload → edit, Go to source, no external requests.

Run: `npm test` and `PW_CHROMIUM=<chromium path> npm run e2e` (or just `npm run e2e` with Playwright's own browser).

## Univer packages and licenses

Installed via `@univerjs/presets` + `@univerjs/preset-sheets-core` (the documented OSS "core" preset), version **1.0.3** (latest stable, 2026-10-07). Checked from each package's own `package.json`.

| Package | License |
|---|---|
| @univerjs/presets | Apache-2.0 |
| @univerjs/preset-sheets-core | Apache-2.0 |
| @univerjs/core | Apache-2.0 |
| @univerjs/design | Apache-2.0 |
| @univerjs/docs | Apache-2.0 |
| @univerjs/docs-ui | Apache-2.0 |
| @univerjs/drawing | Apache-2.0 |
| @univerjs/engine-formula | Apache-2.0 |
| @univerjs/engine-render | Apache-2.0 |
| @univerjs/network | Apache-2.0 |
| @univerjs/protocol | Apache-2.0 |
| @univerjs/rpc | Apache-2.0 |
| @univerjs/sheets | Apache-2.0 |
| @univerjs/sheets-formula | Apache-2.0 |
| @univerjs/sheets-formula-ui | Apache-2.0 |
| @univerjs/sheets-numfmt | Apache-2.0 |
| @univerjs/sheets-numfmt-ui | Apache-2.0 |
| @univerjs/sheets-ui | Apache-2.0 |
| @univerjs/telemetry | Apache-2.0 (interface only; no network code in its build) |
| @univerjs/themes | Apache-2.0 |
| @univerjs/ui | Apache-2.0 |
| @univerjs/icons | MIT |

Whole production dependency tree (127 packages): 80 MIT, 27 Apache-2.0, 10 BSD-3-Clause, 9 ISC, 1 0BSD. No copyleft, no unlicensed packages. Apache-2.0 obligation: ship the license + NOTICE text with any distributed build (Days 28–30 README task).

Other runtime deps: React 19.3 (MIT), Chart.js 4.5.1 (MIT).

## API limitations found

1. **No precise "these cells changed because of recalculation" signal for Frame.** Formula results do arrive through `SheetValueChanged` with the cell ranges, which is enough. `calculationResultApplied` only tells us which sheets, so we treat it as "re-read every binding on this sheet". Cheap at our scale.
2. **Two-step update ("torn" frame).** An edit to A2 fires one event for A2, then ~20–40 ms later a second event for the recalculated A3. The chart briefly (one or two frames) shows the new A2 with the old total. Barely visible, but a finance user might notice a total that doesn't add up for an instant. Fix in Days 8–14: have the adapter hold change notifications while the formula engine is mid-calculation (`calculationStart`/`calculationEnd`) and flush once. Small and contained in the adapter.
3. **Univer's canvas isn't ready for input at first paint.** Clicks in the first moments after load can be dropped. Only affects automated tests (handled there); a person won't notice.
4. **Facade typings are good** (`getRange('A1:A3').getValues()`, `save()`, `setActiveSheet`, `activate()`, `disposeUnit`). No internal Univer services were needed. Everything Frame uses is on the public Facade API.
5. **Snapshot = Univer's `IWorkbookData`.** Stores formulas (`f`) and cached values (`v`), styles, sheet order. We store it opaquely inside `project.frame.json`. Size for the spike sheet: ~1 KB.

## Risks

| Risk | Severity | Note / mitigation |
|---|---|---|
| Latency headroom | Medium | Median ~185 ms, worst 243 ms on a 4-vCPU cloud VM with **software rendering** in headless Chromium. Frame's own share is ~10–20 ms; the rest is Univer committing the edit, redrawing its canvas and recalculating. Expect faster on a real laptop with a GPU, but this needs a check on the founder's machine and with the FY27 demo model (4 sheets, ~50 cross-sheet formulas) in Days 8–14. Dev mode is ~3× slower; demos must use the production build. |
| Bundle size | Medium-low | Main JS is 6.5 MB (1.8 MB gzipped), mostly Univer, plus lazily loaded hyphenation dictionaries. Fine for a local app; first load ~1–2 s. Not worth optimising for the MVP. |
| 10k cells / 50 bindings | Unknown | Not tested in the spike. Binding refresh is O(bindings) per change and skips unchanged values; Univer is designed for much larger sheets. Test in Days 8–14 with a generated workbook. |
| Univer version churn | Low | 1.0 is recent. Pin exact versions (`1.0.3`) and keep all Univer calls in the adapter. |
| Pro feature creep | Low | Univer's charts, pivots, shapes, xlsx import/export and print are Pro. We need none of them; Frame draws its own charts. The core preset has no Pro dependency. |

## Recommended architecture (for Days 4+)

Keep the spike's shape; it already matches the spec's section 17–18 separation:

- **Spreadsheet engine:** Univer behind `SpreadsheetAdapter`. Add `onSelectionChange` (for Add to Presentation and reverse highlighting) and the calculation-settled batching above. Nothing else outside the adapter imports Univer.
- **Binding layer:** `BindingManager` as-is; it already has the three binding types, validation, range-intersection filtering and `bindingsForRange` for reverse highlighting. Bindings reference `sheetId` (stable across renames), not sheet names.
- **Presentation:** own React components per object type (Text, KPI, Table, Chart, Image), positioned absolutely on a fixed 1280×720 slide scaled with CSS. Chart.js for column, bar, line; waterfall as a floating-bar dataset if trivial.
- **Persistence:** `FrameProject` JSON with the Univer snapshot embedded. File System Access API (Chrome/Edge) for Save/Open, with download/upload fallback. Version field already validated.

## Decisions for the founder

1. **Approve proceeding to Days 4–7 (Frame shell)?**
2. **Where should the code live?** No repository is attached to this project and no GitHub account is linked here, so the code is committed in a local repo in this session's container (commit `spike: prove live sheet-to-visual binding`). It will be lost when the container is recycled unless it is pushed. Options: create an empty GitHub repo (e.g. `frame`) and connect GitHub to this project; or take the zipped source from the project files.
3. **Assumption to confirm:** the spec's test case says `A3 = =SUM(A1)`, "bind A1", "change A2". Taken literally nothing visible changes, so the spike uses `A3 = =SUM(A1:A2)` with the chart bound to `A1:A3`. Editing A1 (the literal bound cell) is also tested and works.
