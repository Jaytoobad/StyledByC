# Launch checklist

This checklist is based on repository code and local build checks. No production
database, live payment provider, SMS provider, deployment, or Blob storage was
accessed during this audit.

## Environment variables

Required means the production application or a production feature depends on it.
Optional includes platform-provided values, conditional settings, and scripts.
Names only are listed; do not put values in this file.

| Name | Production | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Required | Neon Postgres used by API routes and scripts. |
| `PAYSTACK_SECRET_KEY` | Required | Server-side Paystack transaction verification and webhook signature validation. |
| `PAYSTACK_PUBLIC_KEY` | Required | Validated by `api/_lib/env.ts`; browser checkout uses the Vite key below. |
| `CRON_SECRET` | Required for cron | Authorizes the expiry and reminder cron endpoint. Lazy expiry also runs during booking, availability, and pay-page requests. |
| `SMS_MODE` | Required | Selects live, sandbox, or stub behavior; production must be configured deliberately. |
| `SMS_API_URL` | Required by env validation | SasuSync API endpoint; the SMS helper has a live endpoint default. |
| `SMS_API_KEY` | Required for live SMS | SasuSync authentication key. |
| `SASUSYNC_API_KEY` | Optional alias | Fallback key accepted by the SMS helper when `SMS_API_KEY` is absent. |
| `SMS_SENDER_ID` | Required for live SMS | Registered sender identity. |
| `SMS_AUTH_HEADER` | Optional | SMS authentication header; defaults to the provider's expected header. |
| `SMS_SANDBOX_URL` | Optional; required for sandbox mode | Sandbox SMS endpoint. |
| `STUDIO_PHONE` | Required by env validation | Studio contact included in customer SMS and reminders. |
| `OWNER_PHONE` | Required by env validation | Owner alerts for payment review and photo-storage issues. |
| `OWNER_EMAIL` | Required by env validation | Owner contact and owner-account setup/reset scripts. |
| `VERCEL_ENV` | Optional/platform-provided | Distinguishes production behavior in the SMS helper. |
| `OWNER_PASSWORD` | Optional; scripts only | Initial owner creation or password reset; never needed as a deployed runtime variable. |
| `ALLOW_TEST_DB` | Optional; test helper only | Explicit safety gate in the untracked payment test script. |
| `APPS_SCRIPT_URL` | Optional; archived code only | Read by old `api.before-admin/`, `api.admin-complete/`, and `api.with-admin-final/` copies, not the deployed `api/` routes. |
| `ADMIN_API_TOKEN` | Optional; archived code only | Read by old archived admin endpoint copies, not the deployed cookie-authenticated routes. |

### Frontend build-time settings (not `process.env`)

| Name | Production | Purpose |
| --- | --- | --- |
| `VITE_PAYSTACK_PUBLIC_KEY` | Required | Paystack checkout key exposed to the browser. |
| `VITE_SENTRY_DSN` | Optional | Frontend error reporting destination. |

The test payment script dynamically loads names from a local env file; those
names are not statically enumerable. Do not run that script against any
database. The repository's `api/_lib/env.ts` also validates required names
listed above and logs missing names, never values.

## Must be supplied or confirmed by the owner

- [ ] Real service catalogue: names, descriptions, prices in GHS, durations, active state, ordering, and required photos/questionnaires.
- [ ] Owner alert phone (`OWNER_PHONE`) and studio/customer SMS phone (`STUDIO_PHONE`); confirm the owner can receive alerts.
- [ ] Final booking policy text, consent wording, and policy version.
- [ ] Public contact details: owner email, business email/phone, location, and any contact links shown by the site.
- [ ] Open appointment dates and slots in the availability table, plus the studio's actual hours and closure dates.
- [ ] Admin owner account and production service/image content.

## Not verified without live services or a browser

- [ ] Production Neon schema, indexes, constraints, applied migrations, and database branch contents; no database was queried or changed.
- [ ] Empty-table and populated-table service behavior, admin service creation/editing, booking price snapshots, and balance calculations against a real database.
- [ ] Paystack checkout, live verification, webhook delivery/signature, retries, delayed/duplicate charges, and production credentials; no Paystack request was made.
- [ ] SMS provider configuration, delivery, sender registration, quotas, deduplication, and owner/customer receipt; no SMS was sent.
- [ ] Vercel deployment, function routing/limits, production environment configuration, webhook URL, cron execution, and production headers.
- [ ] Vercel Blob uploads, private photo retrieval, and photo-row persistence/recovery.
- [ ] Admin login and every state-changing workflow end to end with a real session, CSRF cookie, and database records.
- [ ] Real expiry/availability races and the 30-minute payment window; only source paths and local builds were checked.
- [ ] Booking, pay, and admin layouts at 360 px in a browser; CSS was inspected, but no browser rendering test was run.
- [ ] Live customer-facing policy/contact content, future open dates, owner alerts, and real service data.

