# Frame (feasibility spike)

Spreadsheet (Univer OSS) on the left, live-bound chart on the right. See `docs/TECHNICAL_SPIKE_PLAN.md` and `docs/SPIKE_RESULTS.md`.

```
npm install
npm run dev          # http://localhost:5173 (slow dev build)
npm run build && npx vite preview   # production build, what latency numbers refer to
npm test             # unit tests
npm run e2e          # browser tests (builds + serves production build)
```

Try it: click A2, type a number, press Enter. The A2 bar, the A3 (=SUM) bar and the Total KPI update. Save snapshot, change something, Reload snapshot.
