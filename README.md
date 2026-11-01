# Styled By C

## Run

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
```

Type-check:

```bash
npm run typecheck   # npx tsc -b
```

## Migrate DB

```bash
npm run db:migrate
```

## Create owner

Set `OWNER_EMAIL` and `OWNER_PASSWORD` in `.env.local`, then:

```bash
npx tsx scripts/create-owner.ts
```

Delete `OWNER_PASSWORD` from `.env.local` afterwards.

## Reset owner password

```bash
npx tsx scripts/create-owner.ts   # upserts by email
```

## Required Production env vars (names only)

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `PAYSTACK_SECRET_KEY` | Paystack secret key (server-only) |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key (also `VITE_PAYSTACK_PUBLIC_KEY` for the frontend) |
| `CRON_SECRET` | Bearer token for `/api/cron/expire` |
| `SMS_MODE` | `live` or `stub` (never unset in production) |
| `SMS_API_KEY` / `SASUSYNC_API_KEY` | SasuSync API key |
| `SMS_SENDER_ID` | Registered sender ID |
| `SMS_API_URL` | Live API URL (`https://sms.sasusync.com/api/v1/send`) |
| `SMS_AUTH_HEADER` | Optional auth header name (default `X-API-Key`) |
| `SMS_SANDBOX_URL` | Optional sandbox URL (only used when `SMS_MODE=sandbox`) |
| `STUDIO_PHONE` | Studio phone (Ghana format) for customer SMS |
| `OWNER_PHONE` | Owner phone for payment-needs-attention alerts |
| `OWNER_EMAIL` | Owner email for seed / password reset |

## 12-function limit warning

`api/` must stay at **12 or fewer** serverless functions (excluding
underscore-prefixed shared files under `api/_lib/`). Add shared code to
`api/_lib/` or `src/lib/`; never add a new top-level function file under
`api/` without deleting or merging another one.

## Deploy checklist

- [ ] All required Production env vars set (see above).
- [ ] `npm run build` passes.
- [ ] `npx tsc -b` passes.
- [ ] `npm run db:migrate` applied.
- [ ] `CRON_SECRET` matches the Vercel Cron schedule.
- [ ] Paystack webhook URL points to production and keys are rotated.
- [ ] `SMS_MODE=live` and `SMS_API_URL` confirmed.
- [ ] Admin user exists and login works.
- [ ] Availability seeded for the next 30 days.
- [ ] Vercel Blob access set to `private` for customer photos.
- [ ] `vercel.json` headers applied (no CSP — it can break Paystack checkout).