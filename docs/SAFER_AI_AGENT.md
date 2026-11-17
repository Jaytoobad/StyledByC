# Safer AI Agent Approach (Assist, Not Autonomous Production Remediation)

## Recommendation
**Do not embed an autonomous AI agent in the live site that edits production code, deploys, or mutates production data.** For this stack (bookings, payments, private photos, admin auth), the risk of incorrect automated changes, prompt injection, secret/PII exposure, and unreviewed incidents is too high.

Use AI as an **assistive operator** in a controlled pipeline: detect → triage → propose → verify → human approve → deploy.

## Target architecture: `alert → issue → PR → CI → human approve`

### 1) Detect & alert (production signals)
- **Sources:** Vercel function/runtime logs, client error tracking (Sentry or equivalent), uptime/health checks, Paystack webhook/verify failures, SMS failures, photo upload/storage failures, cron/expiry anomalies.
- **Alerts:** route high-severity signals (payment/photo/auth/data integrity) to on-call/owner channels (email/Slack) with `bookingRef`/count, route, timestamp, and sanitized error context. No PII/secrets.
- **Automation boundary:** detection can be automated; remediation cannot run against prod.

### 2) Triage to a tracked issue
- Create/update a GitHub issue from alert payloads using a redacted template.
- Include: environment, affected area, reproduction hints, log excerpts (redacted), frequency/impact, and suspected component.
- Deduplicate by fingerprint (route + error class + key message) to avoid noise.
- **AI assist (safe):** summarize logs, classify severity, suggest likely files/owners, draft issue text. Human confirms priority.

### 3) Propose a fix as a PR (never direct prod changes)
- Agent runs in **sandbox/staging context** with repo access and read-only/non-prod diagnostics.
- Agent tasks allowed: reproduce in tests, add/adjust unit/E2E tests, propose minimal code/doc changes, update runbooks/checklists.
- Agent tasks **not** allowed: access production secrets, modify production DB/Blob records, send real SMS/Paystack calls, push to `main`, deploy, rotate secrets.
- PR must include: root-cause hypothesis, changed files, risk assessment, verification steps/results, and manual QA notes.

### 4) Verify in CI and preview
- CI gates: lint, format, `tsc -b`, `typecheck:api`, `check:api-limit`, tests, build, audit, Playwright smoke/E2E as applicable (`.github/workflows/ci.yml`).
- Run in Vercel preview with safe env/config (stub SMS, test keys/sandbox where available, isolated data).
- Require human review of diffs, especially `api/`, payment, auth/session, photo/storage, and booking validation logic.

### 5) Human approval and controlled deploy
- Require PR approval + passing checks + branch protection on `main`.
- Deploy via normal Vercel flow from reviewed commit; perform targeted manual verification for impacted path.
- Post-deploy: monitor alerts/dashboards; rollback/revert quickly if regression detected.

## Guardrails for any AI-assisted workflow
- **Least privilege:** separate credentials for CI/staging/prod; agent has no prod write/deploy credentials.
- **Data safety:** redact PII/secrets/tokens from prompts, logs, issues, and artifacts.
- **Deterministic first:** prefer schema/validation/tests/feature flags over heuristic auto-fixes.
- **Bounded scope:** allowlisted repos/paths/actions; rate/time limits; require explicit human approval for merge/deploy.
- **Auditability:** keep issue/PR/CI/deploy trail; record who approved and what was verified.

## What is implemented in this repo
1. **Monitoring hooks (client):** `src/lib/observability.ts` and `src/components/ErrorBoundary.tsx` capture/report client errors to `VITE_CLIENT_LOG_ENDPOINT` (POST/beacon) when configured, with console fallback.
2. **Issue intake template:** `.github/ISSUE_TEMPLATE/bug_report.md` and PR template `.github/PULL_REQUEST_TEMPLATE.md` for structured, redacted reporting.
3. **Sanitized alert intake workflow:** `.github/workflows/alert-to-issue.yml` (manual `workflow_dispatch`) creates a redacted issue scaffold (no PII/secrets).
4. **AI draft PR scaffold workflow (sandbox/assist-only):** `.github/workflows/ai-draft-pr.yml` (manual `workflow_dispatch`) creates a draft branch/PR scaffold for investigation; it does **not** deploy, merge, or access production systems.
5. **Redaction helper:** `scripts/redact-log.mjs` redacts common secrets/PII patterns from logs before sharing/issue filing.
6. **Quality/verification gates:** `.github/workflows/ci.yml`, `docs/PREVENTING_ISSUES.md`, lint/format/hooks, and Playwright smoke scaffolding.

## Manual setup still required
- Configure production error/log monitoring and alert routing (Vercel/Sentry/collector) with redaction and deduplication.
- Set `VITE_CLIENT_LOG_ENDPOINT` if using client log ingestion.
- Enable GitHub branch protection on `main` requiring PR + passing `verify` (and `e2e`) + review.
- Optionally add an external alerting integration to trigger sanitized issue creation/draft PR workflows (never with prod credentials exposed to untrusted prompts).
- Keep `LAUNCH_CHECKLIST.md` and runbooks current; perform human review and manual QA before deploys.

## Optional in-site "assistant" (user-facing, safe scope)
If you want an AI feature embedded in the site for users/admins, limit it to **read/help** use cases (FAQ, booking guidance, status explanations) with:
- no access to secrets or privileged admin actions,
- no direct DB/payment/photo mutation tools,
- strict prompt/output filtering and logging redaction,
- clear fallback to human/studio contact.
This is separate from and safer than autonomous bug-fixing.
