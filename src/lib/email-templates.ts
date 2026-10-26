/**
 * StyledByC — Email templates.
 *
 * Plain-text, mobile-friendly messages for every lifecycle event. All values
 * come from the booking record; nothing is hardcoded except business copy.
 */

import { money } from './money';

type Booking = {
  ref: string;
  name: string;
  email: string;
  serviceName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  price: number;
  amountPaid?: number;
  balanceDue?: number;
  payLink?: string;
  deadline?: string; // ISO
};

function dateLabel(s: string) {
  const d = new Date(s + 'T12:00:00');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function timeLabel(s: string) {
  const [h, m] = s.split(':').map(Number);
  const d = new Date(2000, 0, 1, h || 0, m || 0);
  return d.toLocaleTimeString('en-GH', { hour: 'numeric', minute: '2-digit' });
}

export function newRequestOwner(b: Booking) {
  return {
    subject: `New booking request ${b.ref} — ${b.serviceName}`,
    text: [
      `A new booking request has been submitted and is awaiting review.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      `Name: ${b.name}`,
      `Email: ${b.email}`,
      ``,
      `Log in to the admin dashboard to review, approve or reject this request.`,
      ``,
      `— StyledByC`,
    ].join('\n'),
  };
}

export function approvalCustomer(b: Booking) {
  return {
    subject: `Your appointment is confirmed — pay now (${b.ref})`,
    text: [
      `Hi ${b.name},`,
      ``,
      `Your request has been approved by the studio.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      ``,
      `To secure your slot, please pay the GH₵100 reservation fee within the next 30 minutes:`,
      ``,
      b.payLink ? `Pay now: ${b.payLink}` : 'Contact the studio to pay.',
      b.deadline ? `Payment deadline: ${b.deadline}` : '',
      ``,
      `After payment you will receive a confirmation email with your balance due (if any).`,
      `Late payments are non-refundable and your slot may be released.`,
      ``,
      `— StyledByC`,
    ].filter(Boolean).join('\n'),
  };
}

export function receiptCustomer(b: Booking) {
  return {
    subject: `Payment received — ${b.ref}`,
    text: [
      `Hi ${b.name},`,
      ``,
      `Thank you — your reservation fee has been received.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      `Paid: ${money(b.amountPaid ?? 0)}`,
      `Balance due: ${money(b.balanceDue ?? 0)}`,
      ``,
      `Your appointment is now confirmed. We look forward to seeing you.`,
      ``,
      `— StyledByC`,
    ].join('\n'),
  };
}

export function confirmedCustomer(b: Booking) {
  return {
    subject: `Appointment confirmed — ${b.ref}`,
    text: [
      `Hi ${b.name},`,
      ``,
      `Your appointment is now fully confirmed.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      `Amount paid: ${money(b.amountPaid ?? 0)}`,
      `Balance due: ${money(b.balanceDue ?? 0)}`,
      ``,
      `Please arrive on time. Contact us if you need to reschedule.`,
      ``,
      `— StyledByC`,
    ].join('\n'),
  };
}

export function needsInfoCustomer(b: Booking) {
  return {
    subject: `We need more info — ${b.ref}`,
    text: [
      `Hi ${b.name},`,
      ``,
      `We need a little more information before we can confirm your booking.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      ``,
      `Please reply to this email or contact the studio directly.`,
      ``,
      `— StyledByC`,
    ].join('\n'),
  };
}

export function rejectionCustomer(b: Booking) {
  return {
    subject: `Update on your booking request ${b.ref}`,
    text: [
      `Hi ${b.name},`,
      ``,
      `Unfortunately your booking request could not be accommodated at this time.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      ``,
      `Please contact the studio to discuss alternative options.`,
      ``,
      `— StyledByC`,
    ].join('\n'),
  };
}

export function paidNeedsAttentionOwner(b: Booking) {
  return {
    subject: `Payment received but needs attention — ${b.ref}`,
    text: [
      `Money was received for a booking but the slot could not be confirmed.`,
      ``,
      `Reference: ${b.ref}`,
      `Service: ${b.serviceName}`,
      `Date: ${dateLabel(b.date)}`,
      `Time: ${timeLabel(b.time)}`,
      `Customer: ${b.name} (${b.email})`,
      `Paid: ${money(b.amountPaid ?? 0)}`,
      ``,
      `Likely cause: payment arrived after the deadline or the slot was taken.`,
      `Please review in the admin dashboard and contact the customer.`,
      ``,
      `— StyledByC`,
    ].join('\n'),
  };
}