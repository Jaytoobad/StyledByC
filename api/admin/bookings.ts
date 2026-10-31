/**
 * StyledByC — Admin bookings API
 *
 * POST /api/admin/bookings
 * Body: { action: 'list'|'approve'|'reject'|'cancel'|'update-notes'|'stats', ref?, ... }
 *
 * GET /api/admin/bookings?action=details&ref=xxx
 * Returns booking details with photos (consolidated from bookings-details.ts).
 *
 * Authorized solely by the HttpOnly admin_session cookie. No bearer-token
 * header, body token, or ADMIN_API_TOKEN fallback is accepted.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { and, desc, eq, gte, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { bookings, bookingPhotos, adminAuditLogs } from '../../src/db/schema.js';
import { authorize, validateCsrf } from '../_lib/admin-auth.js';
import { sendSms } from '../_lib/sms.js';
import * as templates from '../../src/lib/sms-templates.js';

const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function mapRow(r: any) {
  return {
    ref: r.ref,
    createdAt: r.createdAt?.toISOString?.() || r.createdAt,
    name: r.name,
    email: r.email,
    phone: r.phone,
    service: r.serviceName,
    date: r.approvedSlotDate?.toISOString?.().slice(0, 10) || r.requestedDate?.toISOString?.().slice(0, 10) || '',
    time: r.approvedSlotTime || r.requestedTime || '',
    price: r.servicePriceGhs ?? null,
    paymentOption: r.paymentOption,
    amountPaid: r.amountPaid ?? null,
    balanceDue: r.balanceDue ?? null,
    paymentReference: r.paymentReference || undefined,
    paymentStatus: r.paymentStatus || undefined,
    paidAt: r.paidAt?.toISOString?.() || r.paidAt,
    status: r.status,
    questionnaire: r.questionnaire || undefined,
    internalNotes: r.internal_notes || r.internalNotes || undefined,
    ownerNote: r.ownerNote || undefined,
    approvedSlotDate: r.approvedSlotDate?.toISOString?.() || r.approvedSlotDate,
    approvedSlotTime: r.approvedSlotTime,
    paymentDeadline: r.paymentDeadline?.toISOString?.() || r.paymentDeadline,
    payToken: r.payToken,
  };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const method = (req.method || 'GET').toUpperCase();
  const url = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
  const action = (url.searchParams.get('action') || '').toLowerCase();

  // GET /api/admin/bookings?action=details&ref=xxx (consolidated from bookings-details.ts)
  if (method === 'GET' && action === 'details') {
    const auth = await authorize(req);
    if (!auth.authorized) {
      return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
    }
    const ref = url.searchParams.get('ref') || '';
    if (!ref) {
      return sendJson(res, 400, { ok: false, error: 'Missing ref.' });
    }
    try {
      const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
      if (!row) {
        return sendJson(res, 404, { ok: false, error: 'Booking not found.' });
      }
      const photos = await db.select().from(bookingPhotos).where(eq(bookingPhotos.bookingId, row.id));
      return sendJson(res, 200, { ok: true, booking: row, photos });
    } catch (e) {
      console.error('[admin/bookings] details error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to load booking.' });
    }
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
  }

  const auth = await authorize(req);
  if (!auth.authorized) {
    return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
  }

  const csrf = validateCsrf(req);
  if (csrf.ok === false) {
    return sendJson(res, 403, { ok: false, error: csrf.error });
  }

  const contentLength = Number(req.headers['content-length'] || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return sendJson(res, 413, { ok: false, error: 'Request is too large.' });
  }

  let input: any;
  try {
    const raw = await readBody(req);
    if (!raw) return sendJson(res, 400, { ok: false, error: 'The request body is empty.' });
    input = JSON.parse(raw);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'The request body could not be read.' });
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return sendJson(res, 400, { ok: false, error: 'The request body is invalid.' });
  }

  const postAction = String(input.action || '').trim();
  const ref = String(input.ref || '').trim();

  if (postAction === 'stats') {
    try {
      const now = new Date();
      const range = String((input as any).range || 'all').toLowerCase();
      const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart); todayEnd.setUTCDate(todayEnd.getUTCDate() + 1);

      const rowsByStatus = await db
        .select({ status: bookings.status, count: sql<number>`count(*)` })
        .from(bookings)
        .groupBy(bookings.status);

      const [todayRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(and(gte(bookings.requestedDate, todayStart), lt(bookings.requestedDate, todayEnd)));

      const [upcomingRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
          and(
            gte(bookings.requestedDate, todayStart),
            or(eq(bookings.status, 'pending_approval'), eq(bookings.status, 'approved_awaiting_payment')),
          ),
        );

      const [overdueRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, 'approved_awaiting_payment'),
            lt(bookings.paymentDeadline, now),
          ),
        );

      const counts: Record<string, number> = {};
      for (const r of rowsByStatus) counts[String(r.status)] = Number((r as any).count ?? 0);
      const [payRow] = await db.select({ count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(amount_paid),0)` }).from(bookings).where(eq(bookings.paymentStatus, 'paid'));
      const pendingPayRows = await db.select({ count: sql<number>`count(*)` }).from(bookings).where(eq(bookings.paymentStatus, 'unpaid'));
      const expiredPayRows = await db.select({ count: sql<number>`count(*)` }).from(bookings).where(eq(bookings.status, 'expired'));
      return sendJson(res, 200, {
        ok: true,
        stats: {
          total: Object.values(counts).reduce((a, b) => a + b, 0),
          pendingApproval: counts['pending_approval'] || 0,
          awaitingPayment: counts['approved_awaiting_payment'] || 0,
          confirmed: counts['confirmed'] || 0,
          rejected: counts['rejected'] || 0,
          cancelled: counts['cancelled'] || 0,
          expired: counts['expired'] || 0,
          paidNeedsAttention: counts['paid_needs_attention'] || 0,
          today: Number((todayRow as any).count ?? 0),
          upcoming: Number((upcomingRow as any).count ?? 0),
          overduePayments: Number((overdueRow as any).count ?? 0),
          successfulPayments: Number((payRow as any).count ?? 0),
          reservationFeesCollected: Number((payRow as any).total ?? 0),
          pendingPayments: Number((pendingPayRows as any)[0]?.count ?? 0),
          expiredPayments: Number((expiredPayRows as any)[0]?.count ?? 0),
        },
      });
    } catch (e) {
      console.error('[admin/bookings] stats error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to load dashboard stats.' });
    }
  }

  if (postAction === 'list') {
    try {
      const search = String(input.search || '').trim();
      const statusFilter = String(input.status || '').trim();
      const serviceFilter = String(input.service || '').trim();
      const dateFilter = String(input.date || '').trim();
      const page = Math.max(1, Number(input.page || 1) || 1);
      const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(input.pageSize || DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));

      const conditions: any[] = [];
      if (search) {
        conditions.push(or(
          ilike(bookings.ref, `%${search}%`),
          ilike(bookings.name, `%${search}%`),
          ilike(bookings.email, `%${search}%`),
          ilike(bookings.phone, `%${search}%`),
        ));
      }
      if (statusFilter) conditions.push(eq(bookings.status, statusFilter as 'pending_approval' | 'needs_info' | 'approved_awaiting_payment' | 'confirmed' | 'rejected' | 'cancelled' | 'expired' | 'paid_needs_attention'));
      if (serviceFilter) conditions.push(eq(bookings.serviceName, serviceFilter));
      if (dateFilter) {
        const startOfDay = new Date(`${dateFilter}T00:00:00`);
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        conditions.push(and(gte(bookings.requestedDate, startOfDay), lt(bookings.requestedDate, endOfDay)));
      }

      const where = conditions.length ? and(...conditions) : undefined;

      const [rows, countResult] = await Promise.all([
        db.select().from(bookings).where(where).orderBy(desc(bookings.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
        db.select({ count: sql<number>`count(*)` }).from(bookings).where(where),
      ]);

      const total = Number((countResult[0] as any).count ?? rows.length);
      return sendJson(res, 200, {
        ok: true,
        rows: rows.map(mapRow),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      });
    } catch (e) {
      console.error('[admin/bookings] list error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to load bookings.' });
    }
  }

  function mapRow(r: any) {
    return {
      ref: r.ref,
      createdAt: r.createdAt?.toISOString?.() || r.createdAt,
      name: r.name,
      email: r.email,
      phone: r.phone,
      service: r.serviceName,
      date: r.approvedSlotDate?.toISOString?.().slice(0, 10) || r.requestedDate?.toISOString?.().slice(0, 10) || '',
      time: r.approvedSlotTime || r.requestedTime || '',
      price: r.servicePriceGhs ?? null,
      paymentOption: r.paymentOption,
      amountPaid: r.amountPaid ?? null,
      balanceDue: r.balanceDue ?? null,
      paymentReference: r.paymentReference || undefined,
      paymentStatus: r.paymentStatus || undefined,
      paidAt: r.paidAt?.toISOString?.() || r.paidAt,
      status: r.status,
      questionnaire: r.questionnaire || undefined,
      internalNotes: r.internal_notes || undefined,
    };
  }

  async function recordAudit(action: string, targetRef: string, details: any) {
    try {
      await db.insert(adminAuditLogs).values({
        actorId: auth.userId!,
        actorEmail: auth.email!,
        action,
        targetType: 'booking',
        targetRef,
        details: details ?? null,
      });
    } catch (e) {
      console.error('[admin/bookings] audit error:', e);
    }
  }

  if (!ref) {
    return sendJson(res, 400, { ok: false, error: 'Missing booking reference.' });
  }

  const [row] = await db.select().from(bookings).where(eq(bookings.ref, ref)).limit(1);
  if (!row) {
    return sendJson(res, 404, { ok: false, error: 'Booking not found.' });
  }

  if (postAction === 'approve') {
    try {
      if (row.status !== 'pending_approval') {
        return sendJson(res, 200, { ok: true, booking: mapRow(row), status: row.status });
      }
      const now = new Date();
      const conflict = await db
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.requestedDate, row.requestedDate),
            eq(bookings.requestedTime, row.requestedTime),
            or(eq(bookings.status, 'confirmed'), eq(bookings.status, 'approved_awaiting_payment')),
            sql`${bookings.id} <> ${row.id}`,
          ),
        )
        .limit(1);
      if (conflict.length) {
        return sendJson(res, 409, { ok: false, error: 'That slot is already taken by another booking.' });
      }
      const [updated] = await db
        .update(bookings)
        .set({
          status: 'approved_awaiting_payment',
          approvedSlotDate: row.requestedDate,
          approvedSlotTime: row.requestedTime,
          paymentDeadline: new Date(now.getTime() + 30 * 60 * 1000),
          updatedAt: now,
        })
        .where(eq(bookings.id, row.id))
        .returning();
      const target = updated || row;
      const host = (req.headers.host || '').trim();
const proto = host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https';
const payLink = target.payToken ? `${proto}://${host}/pay/${encodeURIComponent(target.ref)}?t=${encodeURIComponent(target.payToken)}` : undefined;
      let notificationSent = false;
      try {
        const studioPhone = (process.env.STUDIO_PHONE || '').trim();
        const msg = templates.approvedAwaitingPayment({
          firstName: target.name || row.name,
          service: target.serviceName,
          date: target.approvedSlotDate ? new Date(target.approvedSlotDate).toISOString().slice(0, 10) : (row.requestedDate ? new Date(row.requestedDate).toISOString().slice(0, 10) : ''),
          time: target.approvedSlotTime || row.requestedTime || '',
          price: target.servicePriceGhs || row.servicePriceGhs || 0,
          fee: 100,
          payLink: payLink || '',
          deadline: target.paymentDeadline ? new Date(target.paymentDeadline).toISOString() : '',
          studioPhone,
        });
        await sendSms(target.phone, msg, { bookingId: target.id || row.id, event: 'approved_awaiting_payment' });
        notificationSent = true;
      } catch (e) {
        console.error('[admin/bookings] sms error:', e);
      }
      await recordAudit('approve', target.ref, { previousStatus: row.status, payLink });
      return sendJson(res, 200, { ok: true, booking: mapRow(target), status: target.status || 'approved_awaiting_payment', payLink, notificationSent });
    } catch (e) {
      console.error('[admin/bookings] approve error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to approve booking.' });
    }
  }

  if (postAction === 'reject') {
    try {
      if (row.status === 'confirmed' || row.status === 'cancelled' || row.status === 'expired' || row.status === 'rejected') {
        return sendJson(res, 400, { ok: false, error: 'Invalid status transition.' });
      }
      const now = new Date();
      const [updated] = await db
        .update(bookings)
        .set({ status: 'rejected', updatedAt: now })
        .where(eq(bookings.id, row.id))
        .returning();
      const target = updated || row;
      try {
        const studioPhone = (process.env.STUDIO_PHONE || '').trim();
        const msg = templates.rejected({ ref: target.ref, reason: 'Booking could not be confirmed.', studioPhone });
        await sendSms(target.phone, msg, { bookingId: target.id || row.id, event: 'rejected' });
      } catch (e) {
        console.error('[admin/bookings] reject error:', e);
      }
      await recordAudit('reject', target.ref, { previousStatus: row.status });
      return sendJson(res, 200, { ok: true, booking: mapRow(target), status: target.status || 'rejected' });
    } catch (e) {
      console.error('[admin/bookings] reject error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to reject booking.' });
    }
  }

  if (postAction === 'cancel') {
    try {
      if (row.status === 'confirmed' || row.status === 'cancelled' || row.status === 'expired' || row.status === 'rejected') {
        return sendJson(res, 400, { ok: false, error: 'Invalid status transition.' });
      }
      const now = new Date();
      const [updated] = await db
        .update(bookings)
        .set({ status: 'cancelled', updatedAt: now })
        .where(eq(bookings.id, row.id))
        .returning();
      const target = updated || row;
      try {
        const studioPhone = (process.env.STUDIO_PHONE || '').trim();
        const msg = templates.cancelled({ service: target.serviceName, studioPhone });
        await sendSms(target.phone, msg, { bookingId: target.id || row.id, event: 'cancelled' });
      } catch (e) {
        console.error('[admin/bookings] sms error:', e);
      }
      await recordAudit('cancel', target.ref, { previousStatus: row.status });
      return sendJson(res, 200, { ok: true, booking: mapRow(target), status: target.status || 'cancelled' });
    } catch (e) {
      console.error('[admin/bookings] cancel error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to cancel booking.' });
    }
  }

  if (postAction === 'update-notes') {
    try {
      const notes = String(input.notes || '');
      const [updated] = await db
        .update(bookings)
        .set({ internalNotes: notes || null, updatedAt: new Date() })
        .where(eq(bookings.id, row.id))
        .returning();
      const target = updated || row;
      await recordAudit('update-notes', target.ref, { previousNotes: row.internalNotes || null, newNotes: target.internalNotes || null });
      return sendJson(res, 200, { ok: true, booking: mapRow(target) });
    } catch (e) {
      console.error('[admin/bookings] update-notes error:', e);
      return sendJson(res, 500, { ok: false, error: 'Failed to save notes.' });
    }
  }

  return sendJson(res, 400, { ok: false, error: 'Invalid action.' });
}










