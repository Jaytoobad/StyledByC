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

Run all local checks used by CI:

```bash
npx tsc -b
npm run typecheck:api
npm run check:api-limit
npm test
npm run build
npm audit --omit=dev
```

Type-check:

```bash
npm run typecheck   # npx tsc -b
```

## Migrate DB

The Drizzle config loads `.env.local` automatically. Before migrating, create
a fresh Neon backup/branch and set `DATABASE_URL` in `.env.local` to that
branch's direct (unpooled) connection string. Never paste database URLs into
chat or commit `.env.local`. Verify the target branch in Neon before running
the migration command. The command requires an explicit host confirmation:

```powershell
$env:DRIZZLE_CONFIRM_DATABASE_HOST = "the-exact-direct-host-shown-by-Neon"
npm run db:migrate
Remove-Item Env:DRIZZLE_CONFIRM_DATABASE_HOST
```

Test migrations on the backup branch first. Only point `DATABASE_URL` at
Production after the backup migration has been reviewed and the production
target has been explicitly confirmed. The check compares the confirmation to
the host in the configured URL and stops before connecting if they differ.

## Seed the confirmed service catalogue

After migrations are complete, the owner-confirmed service catalogue can be
inserted only when the `services` table is empty. The seed command refuses to
overwrite an existing catalogue and requires explicit direct-host confirmation:

```powershell
$env:DRIZZLE_CONFIRM_DATABASE_HOST = "the-exact-direct-host-shown-by-Neon"
npm run db:seed-services
Remove-Item Env:DRIZZLE_CONFIRM_DATABASE_HOST
```

Verify the target branch in Neon before running this command. It copies service
names, descriptions, prices, durations, flags and image paths from
`src/config.ts`; it does not create availability slots or upload images.

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