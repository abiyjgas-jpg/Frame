# Frame test session checklist

**What we're testing:** do practitioners prefer doing spreadsheet analysis and building its presentation in one workspace, where the slides stay live-linked to the model?

Each session takes about 45 minutes. Watch what people do and ask why. Don't demo features unless a task stalls.

## Before the session

- [ ] Frame runs from `npm start` in Chrome or Edge, in a window of at least 1440 × 900.
- [ ] Click **Demo** so the participant starts from a fresh FY27 Operating Plan.
- [ ] Close other tabs and set zoom to 100%.
- [ ] Have a notes sheet ready: participant role, tools they use today, and timestamps.
- [ ] Check out of band: in Chrome, Save asks where to save once and then saves in place, and Open… reopens the file. Automated tests can't drive these browser dialogs.

## Warm-up (5 min)

- [ ] "Walk me through the last time you turned a model into a deck. Which tools did you use, and what was painful?"
- [ ] "When numbers changed late, what did you have to redo?" Note how they keep slides in step today: copy and paste, linked OLE objects, a plug-in, or a manual checklist.

## Tasks (25 min)

Give each task in words, without pointing at the UI. For each one, note whether they finished, how long it took, where they hesitated, and anything they said out loud.

1. [ ] **Orient.** "Take a minute to tell me what you're looking at."
   - Do they see that the slides come from the model?
2. [ ] **Late change.** "Leadership wants Enterprise growth at 8% instead of 12%. Update the plan and tell me what changed in the deck."
   - Do they look for a refresh or export step?
   - Do they notice the slides already updated?
   - Watch for the moment of surprise.
3. [ ] **Audit a number.** "Your CFO asks where the FY27 revenue on slide 2 comes from. Show them."
   - Do they find Go to source, or the outline when they select cells?
4. [ ] **Build a slide.** "Add a slide showing the P&L trend from FY26 to FY28 as a chart, with EBITDA margin as a headline number."
   - Do they discover Add to Presentation?
   - Watch range selection, KPI on a single cell, and placement and resizing.
5. [ ] **Change the model's shape.** "Add an 'Other' revenue line under SMB with 5, 6 and 7, and make the total include it."
   - Do they insert a row?
   - Do linked objects stay right?
   - Do they extend the chart's range, or expect it to grow by itself?
6. [ ] **Present.** "You're in the meeting now. Present the deck."
7. [ ] **Save and come back.** "Save this so you can pick it up tomorrow, then reopen it."

## Debrief (10 min)

- [ ] "Compared with how you work today, would this save you time? Where specifically?"
- [ ] "How much do you trust that the numbers on the slides are right? What would raise or lower that?"
- [ ] "What would stop you using this on a real deliverable next week?" Expect answers like Excel import or export, PowerPoint export, sharing, or company templates. Record them; don't promise them.
- [ ] "Which one thing would you add first?"
- [ ] "If this existed today, would you pay for it, or ask your team to? About how much?"
- [ ] On a scale of 1 to 10: how likely they are to want this for their next model-to-deck task, and why.

## After the session

- [ ] Note bugs, data that looked wrong, or anything that lost work. These are blockers, so report them first.
- [ ] Note the UX problems that stopped a task, with the task number.
- [ ] Record whether the participant confirmed or rejected the hypothesis, in their own words.
- [ ] Click **Demo** to reset for the next participant.

## Signals to tally across sessions

| Signal | Supports the hypothesis | Against it |
|---|---|---|
| Reaction to the 12% → 8% update | Unprompted surprise or relief | "I'd still export to PowerPoint" |
| Audit task | Uses Go to source unprompted | Checks numbers by hand |
| Building a slide | Finishes in under 2 minutes | Wants to build in PowerPoint |
| Blocker named | Something Frame could add | "It has to be Excel" |
| Willingness to pay or adopt | A named amount, or a team pilot | "Nice demo" |
