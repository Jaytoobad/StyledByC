export function createWhatsAppUrl(phone: string, message: string): string {
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    throw new Error('The studio WhatsApp phone number is invalid.');
  }

  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`;
}
