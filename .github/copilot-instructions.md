# StyledByC: rules for Copilot

Project: booking site for a brow artist. Vite + React + TypeScript frontend,
Vercel serverless functions in api/, Neon Postgres with Drizzle
(drizzle-orm/neon-http), Paystack (GHS), SMS via sms.sasusync.com.

## Hard rules

- Never git push, deploy, or merge to main. Work on branch prelaunch-fixes.
- Never run migrations. Never write to or delete data in any database.
- Never print secrets, API keys, DATABASE_URL, or customer names, phones,
  emails. Use counts and booking refs only.
- Never send a real SMS (SMS_MODE must be stub when testing) and never call
  the live Paystack API.
- Do not use git add . or git add -A. Commit by explicit file names only.
- Do not change the GH100 reservation fee, Paystack, or SMS-over-email.

## Platform limits

- Vercel Hobby: at most 12 files in api/ outside underscore-prefixed
  folders or files. Put shared code in api/_lib/ or src/lib/.
- Hobby cron runs at most once per day, so time-sensitive logic (the
  30-minute payment window) must not depend on cron.
- neon-http does NOT support db.transaction(). Use atomic conditional
  UPDATE ... WHERE ... RETURNING, or db.batch([...]).
- Request bodies over about 4.5 MB fail on Vercel.

## Conventions

- Amounts are integers. Pesewas to cedis conversion uses Math.round.
- The held_slot unique index covers statuses approved_awaiting_payment,
  confirmed and paid_needs_attention on (approved_slot_date,
  approved_slot_time).
- ASCII only in comments, owner notes and SMS text. UTF-8 without BOM.
- No empty catch blocks. Log with a prefix such as [paystack], [sms].

## How to report

- A task is done only when you ran the verification commands and showed
  their output. If you could not verify something, say NOT VERIFIED.
- Run npx tsc -b and npm run build before saying any code change is done.
