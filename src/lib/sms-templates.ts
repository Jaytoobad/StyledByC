/**
 * StyledByC Â SMS templates (GSM-7 only, use GHS not cedi sign).
 */

import { RESERVATION_FEE_GHS, PAYMENT_WINDOW_MINUTES } from '../config/booking.js';

export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[0] || name.trim();
}

export function requestReceived(opts: {
  firstName: string;
  service: string;
  ref: string;
}): string {
  return `Styled By C: Hi ${opts.firstName}, we got your ${opts.service} request (${opts.ref}). We will review your photos and reply soon. Not yet confirmed.`;
}

export function approved(opts: {
  firstName: string;
  service: string;
  date: string;
  time: string;
  payUrl: string;
}): string {
  const fee = RESERVATION_FEE_GHS;
  const window = PAYMENT_WINDOW_MINUTES;
  return `Styled By C: Approved! ${opts.service} on ${opts.date} at ${opts.time}. Pay the GHS ${fee} reservation fee within ${window} mins to secure it: ${opts.payUrl}`;
}

export function needsMoreInfo(opts: {
  ref: string;
  message: string;
  studioPhone: string;
}): string {
  return `Styled By C: We need a little more info for ${opts.ref}: ${opts.message} Please call or WhatsApp ${opts.studioPhone}.`;
}

export function rejected(opts: {
  ref: string;
  reason: string;
  studioPhone: string;
}): string {
  return `Styled By C: Sorry, we cannot go ahead with ${opts.ref}. ${opts.reason} Questions? Call ${opts.studioPhone}.`;
}

export function confirmedAfterPayment(opts: {
  service: string;
  date: string;
  time: string;
  balance: number;
}): string {
  return `Styled By C: Confirmed! ${opts.service}, ${opts.date} at ${opts.time}. Balance at the studio: GHS ${opts.balance}. Please arrive on time.`;
}

export function cancelled(opts: {
  service: string;
  studioPhone: string;
}): string {
  return `Styled By C: Your ${opts.service} appointment has been cancelled. Questions? Call ${opts.studioPhone}.`;
}

export function expired(opts: {
  ref: string;
  studioPhone: string;
}): string {
  return `Styled By C: Your booking ${opts.ref} has expired. Call ${opts.studioPhone} to rebook.`;
}
export function newRequestOwner(opts: {
  ref: string;
  name: string;
  service: string;
  date: string;
  time: string;
}): string {
  const fn = firstName(opts.name);
  return `New request ${opts.ref}: ${fn}, ${opts.service}, ${opts.date} ${opts.time}. Open the admin panel to review.`;
}

export function paidNeedsAttentionOwner(opts: {
  ref: string;
}): string {
  return `ATTENTION ${opts.ref}: payment received but the slot needs review. Open admin.`;
}

export function reminderDayBefore(opts: {
  service: string;
  time: string;
  studioPhone: string;
}): string {
  return `Styled By C reminder: ${opts.service} tomorrow at ${opts.time}. Arrive on time. Questions? Call ${opts.studioPhone}.`;
}
export function approvedAwaitingPayment(opts: {
  service: string;
  date: string;
  time: string;
  price?: number;
  fee?: number;
  payLink?: string;
  deadline?: string;
  studioPhone?: string;
}): string {
  const fee = opts.fee ?? RESERVATION_FEE_GHS;
  const window = PAYMENT_WINDOW_MINUTES;
  const payUrl = opts.payLink || "";
  return "Styled By C: Approved! " + opts.service + " on " + opts.date + " at " + opts.time + ". Pay the GHS " + fee + " reservation fee within " + window + " mins to secure it: " + payUrl;
}
