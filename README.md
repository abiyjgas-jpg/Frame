# Frame

One workspace for spreadsheet analysis and the presentation built from it, with slides live-linked to the model.

Status: Frame shell (Days 4–7). See `docs/` for the spike plan, spike results and milestone notes.

```
npm install
npm run dev                          # http://localhost:5173 (slower dev build)
npm run build && npx vite preview    # production build, what latency numbers refer to
npm test                             # unit tests
npm run e2e                          # browser tests (builds and serves the production build)
```

Try it: open slide 2, click A2 in the sheet, type a number, press Enter. The chart, the Total KPI and the slide thumbnail update. Click the chart to see its source, then Go to source.
