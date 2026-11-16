# Frame

One workspace for spreadsheet analysis and the presentation built from it, with slides live-linked to the model.

Status: bindings (Days 8–14), stacked on the shell (Days 4–7). See `docs/` for the spike plan, spike results and milestone notes.

```
npm install
npm run dev                          # http://localhost:5173 (slower dev build)
npm run build && npx vite preview    # production build, what latency numbers refer to
npm test                             # unit tests
npm run e2e                          # browser tests (builds and serves the production build)
```

Try it: select C1:F4 in the sheet and click Chart (or Table) in the bar above the slide. Then change E2 from 70 to 65: the chart, table and slide thumbnail update. Select E2 to see which slide objects read it; click an object, then Go to source.
