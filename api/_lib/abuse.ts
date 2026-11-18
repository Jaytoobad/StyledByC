import { and, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings } from '../../src/db/schema.js';
import { BOOKING_STATUS } from '../../src/lib/status.js';

function normPhone(p: string) {
  return (p || '').replace(/[\s\-()+]/g, '');
}

export async function hasBookingAbuse(phone: string, email: string): Promise<boolean> {
  try {
    const np = normPhone(phone);
    const ne = (email || '').toLowerCase().trim();
    const conditions = [];
    if (ne) conditions.push(sql`lower(trim(${bookings.email})) = ${ne}`);
    if (np) conditions.push(sql`regexp_replace(${bookings.phone}, '[^0-9]', '', 'g') = ${np}`);
    if (conditions.length === 0) return false;
    const rows = await db
      .select({ email: bookings.email, phone: bookings.phone })
      .from(bookings)
      .where(
        and(
          or(...conditions),
          inArray(bookings.status, [
            BOOKING_STATUS.pending_approval,
            BOOKING_STATUS.approved_awaiting_payment,
          ]),
        ),
      );
    const phoneCount = np ? rows.filter((row) => normPhone(row.phone) === np).length : 0;
    const emailCount = ne ? rows.filter((row) => row.email.trim().toLowerCase() === ne).length : 0;
    return phoneCount >= 3 || emailCount >= 3;
  } catch (e) {
    console.error('[abuse] booking abuse check failed:', e);
    return false;
  }
}
