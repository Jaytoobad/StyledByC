import { and, eq, inArray, or } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings } from '../../src/db/schema.js';
import { BOOKING_STATUS } from '../../src/lib/status.js';

function normPhone(p: string) {
  return (p || '').replace(/[\s\-\(\)\+]/g, '');
}

export async function hasBookingAbuse(phone: string, email: string): Promise<boolean> {
  try {
    const np = normPhone(phone);
    const ne = (email || '').toLowerCase().trim();
    const conditions = [];
    if (ne) conditions.push(eq(bookings.email, ne));
    if (np) conditions.push(eq(bookings.phone, np));
    if (conditions.length === 0) return false;
    const rows = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(or(...conditions), inArray(bookings.status, [BOOKING_STATUS.pending_approval, BOOKING_STATUS.approved_awaiting_payment])));
    return rows.length >= 3;
  } catch (e) {
    console.error('[abuse] booking abuse check failed:', e);
    return false;
  }
}
