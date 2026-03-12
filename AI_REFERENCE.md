# Budget Tracker - AI Reference

This file is a working reference for future AI agents and human contributors. Read this file together with `FIX_LOG.md` before making changes. If you ship a bug fix or change data behavior, update `FIX_LOG.md` in the same change.

## Purpose

A local-first browser budget tracker for two payroll cut-offs. The UI lives in `index.html`, styling in `styles.css`, and behavior in `script.js`.

## Project Snapshot

- `index.html` - main tracker UI and DOM hooks
- `script.js` - tracker logic, rendering, storage, presets, dashboard, import/export
- `styles.css` - shared styling and responsive layout
- `advisor-settings.html` - advisor target configuration page
- `manage-presets.html` - preset editor page
- `preset-manager.js` - preset editor behavior
- `AGENTS.md` - repo instructions for future agents
- `FIX_LOG.md` - persistent bug/fix memory

## Agent Rules

- Read `FIX_LOG.md` before editing storage, presets, restore, reset, or filtering logic.
- If you fix a bug, append it to `FIX_LOG.md`.
- If you change data shape, storage keys, or process rules, update this file too.
- Keep `index.html` version text and `script.js?v=...` in sync when shipping behavior changes.

## Data Model

Month payload storage:

- Key: `budgetTracker_YYYY-MM`
- Shape:

```json
{
  "version": 3,
  "data": {
    "first": [],
    "second": []
  }
}
```

Category item shape:

- `id` - string
- `category` - string
- `date` - `YYYY-MM-DD`
- `budget` - number
- `type` - `essential|lifestyle|sinking|savings|investing|debt`
- `expenses` - array of expense items
- optional: `paid`, `paidAt`, `prePaidExpenses`, `advancedSourceCutoff`, `advancedFromCategory`, `advancedAmount`, `advancedAt`

Expense item shape:

- `description` - string
- `date` - `MM/DD/YYYY`
- `amount` - number

## Storage Keys

- `budgetTracker_YYYY-MM` - per-month category payload
- `budgetTrackerSalary_YYYY-MM` - per-month salary payload
- `budgetTrackerPresets` - reusable preset definitions
- `budgetTrackerSettings` - current month filter state
- `budgetTrackerAdvisorConfig` - advisor allocation targets and caps
- `budgetTrackerPresetAverageNetPayPerCutoff` - preset planning helper
- `budgetTrackerPreviousBalance` - auxiliary/legacy previous balance storage
- `darkMode` - theme preference

## Behavior Notes

- All data is stored in `localStorage`.
- Restore semantics are replacement, not merge.
- Demo/sample data should only seed on a truly empty install.
- Storage code should tolerate malformed JSON and fail safely.
- When showing all months, budget and salary totals aggregate across month keys.

## Key Areas To Inspect

- `script.js`: search for `localStorage`, `saveData`, `loadData`, `importJSON`, `initializePresets`
- `preset-manager.js`: preset normalization and storage sync
- `index.html`: version text and script query string

## Edge Cases

- Corrupt JSON in any `budgetTracker*` key
- Deleting the last category in a month
- Restoring an older backup over newer local data
- Filtering to a month with missing or malformed saved data
- Cross-tab changes to presets or advisor config

## Recommended Smoke Tests

1. Add categories and expenses in one month, reload, and verify persistence.
2. Delete the last category for a month, reload, and verify it stays deleted.
3. Export a backup, clear data, restore the backup, and verify exact replacement.
4. Corrupt `budgetTrackerPresets` manually in devtools, reload, and verify default fallback.
5. Toggle between a filtered month and all months, then verify totals remain consistent.

## Current Baseline

- Version baseline: `4.6`
- Expense date input defaults to UTC+8 date
- Category edit modal manages category, budget, and type
- Sidebar was removed from `index.html`; the main tracker now focuses on the two cutoff tables and top stats strip
