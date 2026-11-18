# StyledByC – Prevention & Operations Guide

This document turns the "prevent more issues" actions into concrete, repo-specific practices.

## 1) CI gating and branch protection

**In repo (enforced by CI):** `.github/workflows/ci.yml`

- `verify` job: `npm ci`, lint, format check, `tsc -b`, `typecheck:api`, `check:api-limit`, tests, build, `npm audit --omit=dev`
- `e2e` job: Playwright Chromium smoke tests on PRs/main/prelaunch-fixes, uploads report on failure

**Required GitHub settings (manual):**

1. Settings → Branches → add/update rule for `main`.
2. Require a pull request before merging (recommended; avoid direct pushes).
3. Require status checks to pass: `verify` (and `e2e` when applicable).
4. Require branches to be up to date before merging.
5. Require conversation resolution; optionally require CODEOWNERS/review approvals.
6. Restrict who can push/bypass (limit emergency bypass).

## 2) Automated E2E/smoke tests (Playwright)

**In repo:** `playwright.config.ts`, `e2e/*.spec.ts`, scripts `npm run test:e2e` / `test:e2e:ui`.

- `e2e/smoke.spec.ts`: public pages load/navigation basics.
- `e2e/booking-photos.spec.ts`: mocked booking flow including questionnaire "none apply" path and required photo step/submit payload.
- `e2e/pay.spec.ts`: mocked pay page + invalid link state.
- `e2e/admin-smoke.spec.ts`: admin route renders login/shell.

**How to extend (recommended):**

- Mock `/api/*` for deterministic UI coverage; add fixtures for condition-selected questionnaire, upload/camera failure states, and submit error handling.
- Add admin login + CSRF + booking details/photo view tests against a safe test/staging backend (never production). Seed isolated test data only.
- Add `/pay/:ref` verify/callback states with mocked `getPayPage`/`verifyPayment` responses.
- Keep E2E fast and stable; run full critical-path suite in CI, deeper flows nightly or pre-release.

## 3) Observability & alerts

**In repo:** `src/lib/observability.ts`, `src/components/ErrorBoundary.tsx`, `src/main.tsx`.

- Global handlers for `window.error` and `unhandledrejection`; React `ErrorBoundary` for render crashes.
- Client logs go to `VITE_CLIENT_LOG_ENDPOINT` (POST/beacon) when set; otherwise console-prefixed.
- Server/API logging already uses prefixed console errors (e.g. `[bookings]`, `[paystack]`, `[sms]`, `[cron]`) with refs/counts — preserve this pattern.

**Recommended production setup (manual):**

1. **Error tracking:** add Sentry (or equivalent) for frontend + Vercel functions; alert on new/regressed/high-volume issues.
2. **Log alerts:** Vercel/observability alerts for `[bookings] photo upload failed`, `photo references could not be saved`, Paystack verify/webhook failures, SMS failures, cron/expiry/reminder failures.
3. **Metrics:** monitor booking submit success rate, photo upload success, Paystack verify success, SMS delivery/stub rates, API 4xx/5xx, and function duration/errors.
4. **Privacy:** never log secrets, tokens, or customer PII; use `bookingRef`, counts, event names, and sanitized error codes/messages.
5. **Dashboards/runbook links:** include `bookingRef`, route, and event prefix in alerts; link to `docs/SAFER_AI_AGENT.md` and this guide.

## 4) Release/ops discipline

- **Small, reversible changes:** prefer PRs scoped to one risk area (photos/payment/auth/admin).
- **Preview/staging verification:** test Vercel previews for UI/API behavior; use isolated DB/Blob/SMS stub for risky flows.
- **Real-device checks after risky changes:** mobile camera/gallery upload, Paystack checkout/return, admin session/auth, photo viewing.
- **Env parity:** keep required env vars documented (`LAUNCH_CHECKLIST.md`, `README.md`); `SESSION_TOKEN_SALT` rotation invalidates sessions and requires redeploy + re-login.
- **Rollback:** keep deploys traceable to commits; revert PR or redeploy previous known-good commit if incidents occur.
- **No prod data/secrets in dev:** follow `.github/copilot-instructions.md` safety rules.

## 5) Quality guardrails

**In repo:** `eslint.config.js`, `.prettierrc`, `.prettierignore`, Husky hooks (`.husky/pre-commit`, `.husky/pre-push`), `lint-staged` in `package.json`.

- Pre-commit: `npm test` (fast unit tests). Pre-push: lint, format check, `tsc -b`, `typecheck:api`.
- CI is the source of truth; hooks improve local feedback.

**Dependency/update cadence:**

- `.github/dependabot.yml`: weekly npm and GitHub Actions updates (grouped minor/patch where safe).
- Review updates promptly; run CI/E2E and check changelogs for payment/storage/auth deps.
- Keep `npm audit --omit=dev` clean; triage high/critical findings immediately.

**Feature flags / safe rollout:**

- For risky behavior (booking/photo/payment flow), gate with env/config flags or gradual rollout where possible.
- Prefer additive changes + server-side validation; keep client and API rules consistent.

**Lighthouse/perf audits:**

- Run in incognito without extensions; compare before/after.
- Separate app-fixable issues from third-party/platform constraints (Paystack hosted assets, Vercel Toolbar/Live feedback cookies, required CSP allowances).

## 6) Runbook quick checks

- Booking/photo issue: check `[bookings]` logs, `photosFailed`/`ownerNote`, Vercel Blob config, admin photo endpoint.
- Payment issue: check `/api/pay/*`, Paystack verify/webhook logs, booking status/payment refs.
- Admin auth issue: check `SESSION_TOKEN_SALT`, CSRF/session cookies, login/logout/me responses.
- Cron/expiry: check `/api/cron/expire` auth/schedule and lazy-expiry paths.
- SMS: verify `SMS_MODE`, sender/config, and notification statuses (use stub in tests).
