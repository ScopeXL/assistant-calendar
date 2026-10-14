# ADR 0032: The owner's fourth notes (M6, batch 4)

- **Status:** Accepted
- **Date:** 2026-10-14

## Context

- Sunroom 0.9.1 went on the owner's wall and phones, and the same day they sent a fourth set of
  notes: polish (the header, the theme, toasts, empty rooms, words), three questions (Coming Up,
  the update check, the end-to-end job on GitHub), the setup wizard, the wall's keyboard, and the
  time a batch takes to build. `docs/M6-batch-4.md` turns them into tasks, answers the questions
  and records every decision; this ADR keeps the ones that change an earlier decision or that a
  later session would otherwise have to rediscover (PLAN §15, M6 → 0.10.0).

## Decision

| Question | Decision |
|---|---|
| Verifying a batch | Two tiers, the owner's choice: each task passes the quick gate (`just quick`, its unit tests by path with `just test-fe` and `just test-py`, its one end-to-end spec on one project with `just e2e <spec> --project=<name>`), and the full gate (`just check`, the whole `just e2e`, the screenshots) runs once at the end of a batch and before any release. The recipes are terse, take arguments, and are on the command allowlist. Batch 3 ran the full gate after each of ten tasks and spent most of its two hours there. A failure found at the end is traced by running the failing spec at each task's commit; nothing is pushed before a release, and `just preflight` runs the full gate again |
| The fixture database | `just preflight` refuses a release whose newest migration has no `backend/tests/fixtures/db/<revision>.sql`. 0.9.0 shipped without its fixture, though `docs/RELEASING.md` said to build it, and the next migration's upgrade test would have failed; the 0.9.0 fixture was built before this batch's first task |
| Button case | Every button of up to five words is Title Case, a toast's action and a link that looks like a button included (Add Event, Save Changes, Check Now, Take It Back, Download Backup), the owner's choice; six words or more reads as a sentence and stays sentence case ("Type the household password here instead"). This narrows ADR 0028's rule, which kept action buttons in sentence case. Toasts, hints, labels, chips, segmented options, menu items, the choices in a list, empty-state copy and errors stay sentence case, and so does an icon-only button's screen-reader name. "from" joins the small words that stay lowercase ("Hide from Screensaver", "Code from another device" as a label), and the "in" of signing in may keep its capital ("Sign In Again"), while Google's Sign in with Google is written Google's way. The design-rules test reads every `<Button>`'s and header link's words, an `action` or `submit` prop's, and a toast's action through the TypeScript parser, each way a conditional or a template can come out, and fails on a label of two to five words that isn't Title Case; words a function returns (a sign-out label, a scope choice) are cased by hand |
| The zoom's order | **Fit the day · Zoom out · Zoom in**, left to right: the owner reads the whole day as the first of the three (their "Full"). Names, icons and when each is grey are unchanged; this changes ADR 0030's order |

## Consequences

- New recipes: `just quick`, `just test-fe`, `just test-py`, and `just e2e` with arguments;
  Playwright's local reporter is `line`. CLAUDE.md's definition of done and PLAN §14.7 are the
  two tiers.
- The design-rules test imports `typescript` to read the sources' JSX.
