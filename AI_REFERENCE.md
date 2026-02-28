# Budget v2 — AI Reference

This file is a concise reference intended for future AI agents and human contributors who will work on the "Budget v2" web project. It documents the project's purpose, file map, inferred data shapes, run steps, edge cases, testing suggestions, and useful AI prompts.

## Purpose

A small single-page web app for tracking budget items (income/expenses). The UI is delivered by `index.html` with styling in `styles.css` and behavior in `script.js`.

## Project snapshot (files)

- `index.html` — main HTML file and entry point
- `script.js` — frontend JavaScript logic
- `styles.css` — visual styles

If you add new files, update this reference.

## Contract (for AI/future contributors)

Inputs:
- User actions from the UI (add, edit, delete budget entries; filter; sort)

Outputs:
- Rendered list/table of budget items
- Summary values (totals, balances)
- Persistent state (localStorage or equivalent)

Data shape (inferred — please confirm in `script.js`):

- Top-level: an array of budget entry objects
- Budget entry (example):

  - `id` (string|number) — unique identifier
  - `date` (ISO string) — date of the entry
  - `description` (string) — short text
  - `amount` (number) — positive for income, negative for expense (or `type` + `amount`)
  - `category` (string, optional)

Error modes:
- Invalid or missing input fields
- Non-numeric amount values
- Corrupt/missing persisted state in localStorage

Success criteria for changes/features:

- No console errors on basic flows (add, delete, display)
- Data persists across page reloads (if persistence is intended)
- UI accessible and usable on small screens

## How to run (quick)

Open `index.html` in a browser. For a local HTTP server (recommended for some browser APIs) run from the project folder:

PowerShell (if you have Python installed):

```powershell
python -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Key areas to inspect in code

- `index.html`: DOM structure, form elements, container elements where `script.js` injects content.
- `script.js`: data model, event listeners, storage mechanism (localStorage?), render logic, and input validation.
- `styles.css`: layout, responsive breakpoints, accessible color contrast.

If you plan to modify behavior, first search `script.js` for the words `localStorage`, `addEventListener`, `render`, and `document.getElementById` to find entry points.

## Edge cases to handle

- Empty input submission — validate required fields.
- Extremely large or small numbers (use Number parsing and safe checks).
- Duplicate IDs — ensure unique ID generation on add.
- Timezone handling for dates (store as ISO strings or timestamps).
- Corrupt persisted data (handle JSON.parse failures with safe fallback).

## Recommended tests

Manual smoke tests:

1. Add an income entry, reload page, confirm it persists and totals update.
2. Add an expense entry, confirm negative impact on totals.
3. Delete an entry, confirm removal and totals update.
4. Enter invalid amount (letters), check validation and error shown/blocked.

Automated tests (suggestion):

- Small unit tests for pure functions (e.g., total calculation, formatters). Use a lightweight runner (Jest, Vitest) if you expand the project.

## Small, low-risk improvements (proactive)

- Add safe localStorage wrapper with try/catch + migration/version key.
- Add simple unit tests for data aggregation functions.
- Add keyboard accessibility and form ARIA labels.
- Add ESLint / Prettier configuration for consistent style.

## Useful example prompts for future AI agents

Use these prompts when asking an AI to modify or extend the project:

- "Refactor `script.js` to extract DOM rendering into a pure `render(items)` function and add unit tests for the total calculation."
- "Add validation to the add-entry form to prevent empty descriptions and non-numeric amounts; show inline error messages." 
- "Implement persistence versioning: if localStorage contains malformed data, migrate to an empty array and log a single warning to console." 
- "Add a lightweight sort/filter UI (by date, category) and update `render` accordingly." 

When asking for code changes, include the exact filename(s) and the desired behavior, the expected input/output, and any constraints (browser support, no external libraries, etc.).

## Quality gates (quick)

- Build: Not applicable — static frontend. (Done)
- Lint/Typecheck: Not present — consider adding ESLint/TypeScript. (Deferred)
- Unit tests: None currently. (Deferred)
- Smoke test: Manual steps above. (Done)

## Assumptions made (please confirm)

- The app is a static single-page frontend that uses localStorage for persistence.
- Budget entries follow the generic shape listed above.

If any assumption is wrong, update this file and annotate the actual data structure found in `script.js`.

## Next steps (for a follow-up change)

1. Inspect `script.js` to confirm the storage key and exact data shape.
2. Add a safe storage helper and update code paths to use it.
3. Add one unit test for total calculations and run locally.

---

If you want, I can: inspect `script.js` and update this file with concrete data shapes and storage keys, or create a small test harness for totals. Which would you like me to do next?
