import { sendSms } from '../api/_lib/sms.js';

const to = process.argv[2];
const message = process.argv[3] || 'Test SMS from StyledByC';

if (!to) {
  console.error('Usage: tsx scripts/test-sms.ts <phone> [message]');
  process.exit(1);
}

(async () => {
  try {
    await sendSms(to, message, { bookingId: null, event: 'test' });
    console.log('done');
  } catch (e) {
    console.error('error', e);
  }
})();
