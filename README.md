# Lash & Brow Booking Website

A React + TypeScript + Vite responsive demo for an independent lash and brow artist.

## Run locally
1. Install Node.js LTS from https://nodejs.org.
2. Extract this ZIP and open the `velvet-brow-booking` folder in VS Code.
3. Open Terminal > New Terminal and run:

   ```bash
   npm install
   npm run dev
   ```
4. Open the local URL Vite prints, usually `http://localhost:5173`.

## Included
- Premium black/grey responsive design
- Services catalogue and multi-step appointment booking
- Date/time sample availability
- Conditional brow photo picker with preview
- Hybrid tint preparation guide and required acknowledgement
- Sample reservation fee calculation
- Clearly labelled simulated checkout
- Demo booking list saved in this browser

## Important limitations
This is a presentation prototype, not a production booking system. It does not charge money, verify Paystack payments, send emails, sync Google Sheets, securely upload photos, or prevent double-booking across devices. Demo data is saved in localStorage on the current browser. Do not use it for live customer bookings.

Before launch, connect a secure backend/database, availability locking, Paystack server-side verification and webhooks, private image storage, Google Sheets integration and email notifications. Keep secret credentials on the server. Confirm business name, actual services/prices, working hours and cancellation/refund policy with the client.
