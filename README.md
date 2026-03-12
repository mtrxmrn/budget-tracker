# Budget Tracker Pro

A local-first budget planner for managing two monthly payroll cut-offs, tracking category-level expenses, and reviewing practical finance KPIs in a single browser-based workspace.

## What It Does

- Plans budgets across `1st` and `2nd` cut-offs
- Tracks category budgets, actual expenses, and remaining balance
- Persists data in `localStorage` with month-based storage keys
- Supports five reusable presets for recurring budget setups
- Shows advisor KPIs for savings, essentials, debt, budget accuracy, and rollover
- Includes a companion advisor-targets page for allocation percentages and warning caps
- Offers drag-and-drop ordering, dark mode, and CSV import/export helpers

## Project Map

- `index.html` - Main tracker UI, modal markup, and all JavaScript-facing DOM hooks
- `advisor-settings.html` - Advisor target configuration page and inline settings logic
- `styles.css` - Shared design tokens, layout components, table styling, modal styling, dark mode, and settings page styles
- `script.js` - Tracker logic for rendering, storage, filters, presets, dashboards, and table interactions
- `README.md` - Project overview and developer navigation notes
- `AI_REFERENCE.md` - Supplemental implementation notes kept with the project
- `AGENTS.md` - instructions for future AI agents working in this repo
- `FIX_LOG.md` - persistent bug/fix memory for future maintenance

## Frontend Structure

### Main tracker

`index.html` is organized into four major regions:

1. `topbar`: app identity, version badge, and theme toggle
2. `control-panel`: month filters, preset controls, summary cards, and advisor KPIs
3. `tables-flex`: first and second cut-off tables with totals and remaining balance
4. modal layer: expense breakdown, category edit, and preset manager dialogs

### Styling system

`styles.css` is grouped by purpose so it is easier to navigate:

1. design tokens and base rules
2. shared layout primitives and buttons
3. tracker shell and dashboard sections
4. tables and table-state styling
5. modal and preset-manager components
6. advisor-settings page styles
7. dark mode overrides
8. responsive rules

### Behavior boundaries

`script.js` remains the source of truth for application behavior. It is now sectioned by responsibility:

1. global state
2. shared formatting and normalization
3. application lifecycle
4. date handling
5. table rendering
6. category and expense management
7. dashboard calculations
8. storage and filtering
9. CSV helpers
10. preset management
11. theme handling

If you are making a visual-only change, prefer `index.html`, `advisor-settings.html`, or `styles.css` first. If you are changing data flow or calculations, start in `script.js`.

## Local Run

Open `index.html` directly in a modern browser.

Optional local server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Data and Privacy

All tracker data is stored locally in the browser using `localStorage`. The app does not require a backend.
