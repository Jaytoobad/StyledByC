import { pgTable, uuid, text, timestamp, boolean, jsonb, integer, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const bookingStatusEnum = pgEnum('booking_status', ['pending_approval','needs_info','approved_awaiting_payment','confirmed','rejected','cancelled','expired','paid_needs_attention']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid','paid']);
export const notificationStatusEnum = pgEnum('notification_status', ['sent','failed','unknown']);

export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  ref: text('ref').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  status: bookingStatusEnum('status').default('pending_approval').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  serviceId: text('service_id').notNull(),
  serviceName: text('service_name').notNull(),
  servicePriceGhs: integer('service_price_ghs').notNull(),
  requestedDate: timestamp('requested_date', { withTimezone: true }).notNull(),
  requestedTime: text('requested_time').notNull(),
  questionnaire: jsonb('questionnaire'),
  policyAccepted: boolean('policy_accepted').default(false).notNull(),
  policyVersion: text('policy_version'),
  policyAcceptedAt: timestamp('policy_accepted_at', { withTimezone: true }),
  approvedSlotDate: timestamp('approved_slot_date', { withTimezone: true }),
  approvedSlotTime: text('approved_slot_time'),
  paymentDeadline: timestamp('payment_deadline', { withTimezone: true }),
  payToken: text('pay_token').notNull().unique(),
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),
  amountPaid: integer('amount_paid').default(0).notNull(),
  balanceDue: integer('balance_due').default(0).notNull(),
  paymentReference: text('payment_reference').unique(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  ownerNote: text('owner_note'),
  internalNotes: text('internal_notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  heldSlot: uniqueIndex('held_slot').on(t.approvedSlotDate, t.approvedSlotTime).where(sql`status IN ('approved_awaiting_payment','confirmed','paid_needs_attention')`),
}));

export const bookingPhotos = pgTable('booking_photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  blobUrl: text('blob_url').notNull(),
  mimeType: text('mime_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  event: text('event').notNull(),
  toNumber: text('to_number').notNull(),
  status: notificationStatusEnum('status').notNull(),
  jobId: text('job_id'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  bookingEventUnique: uniqueIndex('notifications_booking_id_event_unique').on(t.bookingId, t.event),
}));
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const availability = pgTable('availability', {
  id: uuid('id').defaultRandom().primaryKey(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isOpen: boolean('is_open').default(true).notNull(),
});

export const siteImages = pgTable('site_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  slotKey: text('slot_key').notNull(),
  blobUrl: text('blob_url').notNull(),
  altText: text('alt_text'),
  mimeType: text('mime_type').notNull(),
  position: integer('position').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: uuid('actor_id').notNull().references(() => adminUsers.id, { onDelete: 'cascade' }),
  actorEmail: text('actor_email').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetRef: text('target_ref'),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  price: integer('price').notNull(),
  duration: integer('duration').notNull(),
  photoRequired: boolean('photo_required').default(false).notNull(),
  tintGuideRequired: boolean('tint_guide_required').default(false).notNull(),
  image: text('image').notNull(),
  gallery: jsonb('gallery').default([]).notNull(),
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

