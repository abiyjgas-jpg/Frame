# Milestone: FY27 Operating Plan demo and dogfooding (Days 25–27)

Date: 2026-11-17. Stacked on project files (PR #4).

## The demo

Frame now opens on **FY27 Operating Plan** the first time. **Demo** in the top bar opens a fresh copy at any time, for example between test participants.

- **Sheets**
  - **Assumptions:** inputs in blue, such as Enterprise growth 12%, SMB growth 10%, gross margin, other opex, cost per head and hires.
  - **Revenue:** Enterprise and SMB revenue by year, total revenue and growth.
  - **Headcount:** ending headcount, people cost and revenue per head.
  - **P&L:** revenue, cost of revenue, gross profit, people cost, other opex, EBITDA and EBITDA margin.
  - Every number traces back to Assumptions through cross-sheet formulas.
- **Slides:** 12 live links in total.
  1. **FY27 Operating Plan:** KPIs for FY27 revenue, EBITDA and headcount.
  2. **Revenue Outlook:** a column chart of Enterprise and SMB, plus KPIs for total revenue and growth.
  3. **Profitability:** a P&L table plus KPIs for EBITDA and EBITDA margin.
  4. **Headcount:** a column chart, a table and a revenue-per-head KPI.

Changing Enterprise growth from 12% to 8% takes FY27 revenue from 111.2 to 108.8 and EBITDA from 18.4 to 17.0. The chart, both tables and five KPIs move with it.

**The spec's acceptance test (section 22) is automated** in `e2e/demo.spec.ts` and passes:

1. Open the demo and check that both panes are visible.
2. Change 12% to 8%.
3. Check that revenue, the P&L, the revenue slide and the EBITDA KPIs update.
4. Click the chart to see its source, then use Go to source.
5. Present.
6. Save, reload, open a fresh demo, and reopen the saved file. Sheets, formulas, formatting, slides and bindings are intact and still live.

## Fixed while dogfooding

- **Formatted numbers reached charts and tables as text.** Univer's `getValues()` returns "12.0%" rather than 0.12 for any cell with a number format. As a result, tables couldn't right-align figures and chart formatting was inferred from strings. The adapter now reads raw values.
- **Inserting or deleting rows or columns left links pointing at the old cells.** A slide would quietly show whatever moved into those cells. Links now move with their cells, the way a formula's references do: insert above and the link moves down, insert inside and it grows, delete part and it shrinks. Undo works too.
  - If every linked cell is deleted, the source becomes `#REF!`, the object says its cells were deleted, and Go to source is disabled, so it never shows a neighbour's number.
- **Tables truncated row labels.** The label column now gets about 40% of the table's width.
- Negative numbers in the demo show in parentheses, the usual finance convention.

## Tests

- Unit: 87 passing. New: the demo's integrity (sheets and slides in spec order, every link points at a real sheet and back at its object, everything sits on its slide) and range shifting for row and column inserts and deletes, including `#REF!`.
- Browser (production build): 28 passing. New: the acceptance test, plus the row insert and delete behaviour on the demo.
- Live update latency: median 82 ms, max 115 ms.

## Known limits

- When a link's cells are deleted, the link stays at `#REF!` even after Undo brings the cells back. Delete the object and add it again.
- Tables don't carry the sheet's bold or borders; the header row and label column are styled automatically.
- The spec asks for the founder to dogfood the app on a real analysis. That still needs you, Abiy, and the feedback checklist in the README covers what to try.
