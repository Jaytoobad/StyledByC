# PROGRESS

## Completed
- 8a8ae2e: services refactor unblock
- 5a88964: webhook atomic idempotency
- c3dffb6: journal timestamp fix
- 3115a96: SMS stub driver
- 884f3d0: held_slot partial unique index (applied to Neon branch)
- 8744b16: SMS fail-closed outside production
- 114b677: service tests
- dd47abc: expiry at point of use on approve
- fc37626: progress update
- c3fb897: remove reminders cron from vercel.json

## Skipped this turn
- Rate limiting: requires 0008 migration (rate_limits table) not yet created.
- Admin auth audit / unguessable tokens: requires 0008 migration (booking_tokens column) not yet created.

## Remaining
5. Migration 0008 on branch.
6. Non-destructive SMS failures.
7. Full gate.

## Blocker
Migration 0008 not yet generated/applied.
