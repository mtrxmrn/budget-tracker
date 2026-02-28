# Budget Tracker Pro

A local-first, browser-based budget planner for managing two monthly payroll cut-offs, tracking expense breakdowns, and monitoring practical finance KPIs in one dashboard.

## Features

- Two-cutoff budgeting (`1st` and `2nd`) with category-level budgets and expense tracking
- Monthly filtering plus `Show All` view for cross-month visibility
- Financial summary cards and KPI panel (savings rate, essentials ratio, debt ratio, budget accuracy, rollover)
- Preset system (5 slots) to quickly load and save recurring category plans
- CSV import/export for backup and migration
- Drag-and-drop category ordering
- Dark mode with saved preference
- Local persistence via `localStorage` (no backend required)

## Quick Start

1. Clone or download this repository.
2. Open `index.html` in a modern browser.

Optional local server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript
- [SortableJS](https://sortablejs.github.io/Sortable/) (CDN)
- [Font Awesome](https://fontawesome.com/) (CDN)

## Project Structure

- `index.html` - App layout and UI markup
- `styles.css` - Styling and responsive behavior
- `script.js` - Budget logic, persistence, filters, presets, and CSV handling

## Data & Privacy

All budget data is stored locally in your browser using `localStorage`. Nothing is sent to a server by this app.

