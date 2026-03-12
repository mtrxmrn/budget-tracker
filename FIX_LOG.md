# Fix Log

Persistent record of bugs, root causes, and corrections. Read this before modifying storage, presets, restore, reset, or month-filter logic.

## 2026-03-12

### Filtered preset/month saves deleting other months

- Problem: Loading presets or making edits while filtered to one month could make other saved months disappear.
- Root cause: `saveData()` removed every `budgetTracker_YYYY-MM` key not present in the current in-memory dataset, but filtered views only load one month into memory.
- Files changed: `script.js`, `index.html`, `AI_REFERENCE.md`
- Final behavior: Saving while a month filter is active now updates or removes only that filtered month and preserves all other month payloads.

### Data persistence and restore hardening

- Problem: Deleted month data could reappear after reload.
- Root cause: `saveData()` wrote current month payloads but did not remove stale `budgetTracker_YYYY-MM` keys.
- Files changed: `script.js`
- Final behavior: Saving now removes obsolete month payload keys so deleted months stay deleted.

- Problem: Corrupt preset JSON could break tracker startup.
- Root cause: `initializePresets()` parsed `budgetTrackerPresets` without guarded fallback handling.
- Files changed: `script.js`
- Final behavior: Preset loading now falls back to defaults when stored preset JSON is malformed.

- Problem: Backup restore merged into existing tracker data instead of replacing it.
- Root cause: `importJSON()` restored keys without clearing existing `budgetTracker*` keys first.
- Files changed: `script.js`
- Final behavior: Restore now clears existing tracker keys before applying the backup.

- Problem: Demo data could appear when saved month data existed but failed to load cleanly.
- Root cause: Demo seeding checked only in-memory arrays and ignored whether month storage keys already existed.
- Files changed: `script.js`
- Final behavior: Demo data now seeds only on a truly empty install with no saved month keys.

- Problem: Full reset left tracker-related keys behind.
- Root cause: `clearAllData()` used a partial hardcoded deletion list.
- Files changed: `script.js`
- Final behavior: Full reset now removes all `budgetTracker*` keys consistently.

- Problem: Rollover calculation could fail on malformed salary JSON.
- Root cause: `calculateMonthRollover()` parsed month salary storage without guarded fallback.
- Files changed: `script.js`
- Final behavior: Rollover now safely falls back to zero salary when salary storage is malformed.
