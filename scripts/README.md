# Scripts

All scripts are **read-only or dry-run by default**. Never run them against
production without reading the code first.

## reconcile-paystack.ts

For every booking with a `payment_reference` that is **not** paid/confirmed,
calls Paystack's verify endpoint and prints:

```
booking_ref | paystack_status | amount | should_mark_paid
```

It **never** updates anything.

```bash
# Requires PAYSTACK_SECRET_KEY in the environment.
npx tsx scripts/reconcile-paystack.ts
```

A 300 ms delay is added between calls to avoid rate limits.

## resend-failed-sms.ts

Selects `notifications` rows with status `failed` or `unknown` whose booking is
still relevant (not `expired`, `cancelled`, or `rejected`) and prints booking
refs + counts.

- Dry-run by default.
- Pass `--apply` to actually send via `sendSms`.

```bash
# Safe dry-run (SMS_MODE must be stub for any test you run).
npx tsx scripts/resend-failed-sms.ts

# Apply (sends real SMS).
npx tsx scripts/resend-failed-sms.ts --apply
```

## test-sms.ts

Send a single test SMS through the shared `sendSms` helper.

```bash
npx tsx scripts/test-sms.ts <phone> [message]
```

## General safety rules

- `SMS_MODE` must be `stub` for any test you run; never send real SMS during
  testing.
- Never pass production `DATABASE_URL` values from anywhere except `.env.local`.
- Never print secrets, API keys, tokens, or customer names/phones/emails.
- Use counts and booking refs only.