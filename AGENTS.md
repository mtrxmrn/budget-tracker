# Agent Workflow

Future agents working in this repository must read `AI_REFERENCE.md` and `FIX_LOG.md` before changing code.

## Required Workflow

1. Read `AI_REFERENCE.md`.
2. Read `FIX_LOG.md`.
3. If the task changes behavior, storage, presets, import/export, reset flows, or filtering, inspect the relevant code path before editing.

## Required Updates

If you ship a fix:

1. Append the fix to `FIX_LOG.md`.
2. Include the date, problem, root cause, files changed, and final behavior.
3. Update `AI_REFERENCE.md` if the fix changes storage rules, data shape, or project guidance.

## Intent

Use the markdown files as project memory so resolved issues do not get reintroduced through repetitive fixes.
