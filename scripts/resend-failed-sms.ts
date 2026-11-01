#!/usr/bin/env ts-node
/**
 * StyledByC - Resend failed SMS (dry-run by default).
 *
 * Selects notifications with status failed/unknown whose booking is still
 * relevant (not expired/cancelled/rejected) and prints booking refs + counts.
 * Pass --apply to actually send via sendSms.
 */

import { db } from '../src/db/index.js';
import { notifications, bookings } from '../src/db/schema.js';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { sendSms } from '../api/_lib/sms.js';
import * as templates from '../src/lib/sms-templates.js';

const APPLY = process.argv.includes('--apply');
const IRRELEVANT = ['expired', 'cancelled', 'rejected'];

async function main() {
  const rows = await db
    .select()
    .from(notifications)
    .where(inArray(notifications.status, ['failed', 'unknown']));

  const relevant = [];
  for (const n of rows) {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, (n as any).bookingId)).limit(1);
    if (!b) continue;
    if (IRRELEVANT.includes(b.status)) continue;
    relevant.push({ n, booking: b });
  }

  console.log('DRY-RUN (pass --apply to send)');
  console.log('candidates:', relevant.length);

  if (!APPLY) return;

  for (const { n, booking } of relevant) {
    const event = (n as any).event;
    const to = (n as any).toNumber;
    const ref = booking.ref;
    try {
      const fn = (templates as any)[`${event}AfterPayment`];
      const msg = typeof fn === 'function' ? fn({}) : 'StyledByC - please contact us.';
      await sendSms(to, String(msg), { bookingId: booking.id, event });
      console.log('sent', ref, event);
    } catch (e) {
      console.error('failed', ref, event, e);
    }
  }
}

main().catch((e) => {
  console.error('resend failed:', e);
  process.exit(1);
});