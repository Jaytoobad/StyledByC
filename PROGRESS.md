# PROGRESS

## Completed
- 8a8ae2e: services refactor unblock
- 5a88964: webhook atomic idempotency
- c3dffb6: journal timestamp fix
- 3115a96: SMS stub driver
- 884f3d0: held_slot partial unique index (applied to Neon branch)
- 8744b16: SMS fail-closed outside production
- 114b677: service tests
- dd47abc: expiry at point of use on approve (lapsed approved expired before slot check)

## Remaining MUST items
2. Cron auth + remove reminders cron from vercel.json.
3. Rate limiting DB-backed (5/hr IP, 3/hr phone).
4. Admin auth audit all routes/actions; unguessable booking tokens.
5. Migration 0008 on branch: seed services, backfill price, booking tokens, rate-limit table, SMS failure log, restore site_images slot_key unique.
6. Non-destructive SMS failures.
7. Full gate: tests, typecheck, build, lint, drizzle-kit check.

## Blocker
No disposable DB beyond Neon branch; branch available.
