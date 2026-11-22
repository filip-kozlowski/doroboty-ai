# Employer candidate profile in the "Lawenda" direction

Revised 2026-11-21 to Filip's specification: tabs Podsumowanie (renamed from Odpowiedź) / CV / Zadanie; the task tab holds what we asked, the evaluation and the candidate's answer as a mock PDF; "Notatka rekrutacyjna" became suggested questions that the recruiter can add, move, remove and annotate; the free-text stage note was removed. Second revision: workspace shell (sidebar, top bar, mobile header) in Lawenda for all `/#/app` screens; edit/remove as icons; drag-and-drop reordering with a keyboard alternative instead of arrow buttons; strong/weak hints stacked with + and − marks.

## Intent

Rebuild only the employer candidate profile (`/#/app/kandydaci/:id`) for experiment E1: the shortlisted candidate solves a 10–15 minute task with AI allowed (sent by e-mail outside the portal), and the recruiter sees the result plus a one-page interview cheat sheet. Visual direction "Lawenda" (doroboty-lavender-ui skill) replaces Poster People for this screen only; the shell stays unchanged.

## Acceptance criteria

- Header with name, headline, stage, task status, Match Score and application date; one existing plasticine robot illustration (hidden below 600px).
- One highlighted panel with the task result (mock data), or an empty state when no result exists.
- Cheat sheet: claims / task evidence / unknowns, numbered questions with strong/weak hints, per-question verdict and note; edit, remove with undo, add own questions; saved in the local scenario (Zod-validated `briefing` on the application, employer of the hiring company only).
- Answer/CV tabs keep the CV snapshot and PDF preview; stage actions, history note, focus on the updated stage and process history keep working.
- At most two bordered blocks (task panel, decision card); desktop 1440px and mobile 390px without horizontal scroll.

## Evidence (2026-11-21)

- format:check, lint, typecheck, unit tests (28, incl. new briefing test) and build pass.
- E2E (updated for the new tabs and questions) run with system Chrome (`channel: "chrome"`, Playwright Chromium is not provisioned on this Mac): 32 passed, 2 failed in the PDF tests because Chrome's built-in PDF viewer issues `chrome-extension://` requests counted as external; unrelated to this change, must be re-run with the provisioned Chromium.
- Manual Playwright script: verdicts, notes, question edit, empty-question validation, add, remove/undo persist after reload; stage change moves focus to the stage chip; no console errors.
