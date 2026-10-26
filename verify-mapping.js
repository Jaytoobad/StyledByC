// Local simulation of the fixed Code.gs logic against the REAL sheet headers
// and data captured from the live endpoint. Run: node verify-mapping.js

const headers = [
  " Booking Reference", "      Created At ", "       Customer Name ",
  "         Customer Email", "   Customer Phone", "Service",
  "       Appointment Date ", "     Appointment Time", "Price (GHS)",
  "      Status", "REF", "CREATED_AT", "NAME", "EMAIL", "PHONE",
  "DATE", "TIME", "PRICE", "PAYMENT_STATUS",
];

// Row 2 (first data row) as captured live: service holds a Date object string,
// everything else empty. Row 16 (Thu Nov 05) is the one the user complained about.
const rows = [
  ["", new Date("2026-11-04T00:00:00Z"), "", "", "", "Wed Nov 04 2026 00:00:00 GMT+0000 (Greenwich Mean Time)", "", "", null, "", ""],
  ["", new Date("2026-11-05T00:00:00Z"), "", "", "", "Thu Nov 05 2026 00:00:00 GMT+0000 (Greenwich Mean Time)", "", "", null, "", ""],
];

function indexByHeader(headers) {
  const ALIASES = {
    REF: ['BOOKING REFERENCE', 'REFERENCE', 'BOOKING REF', 'REF NO', 'REF'],
    CREATED_AT: ['CREATED AT', 'CREATED', 'SUBMITTED', 'SUBMITTED AT', 'TIMESTAMP', 'CREATED_AT'],
    NAME: ['CUSTOMER NAME', 'CUSTOMER', 'CLIENT', 'FULL NAME', 'NAME'],
    EMAIL: ['CUSTOMER EMAIL', 'E-MAIL', 'MAIL', 'EMAIL'],
    PHONE: ['CUSTOMER PHONE', 'MOBILE', 'TEL', 'TELEPHONE', 'PHONE'],
    SERVICE: ['SERVICE', 'TREATMENT', 'SERVICE NAME', 'APPOINTMENT SERVICE'],
    DATE: ['APPOINTMENT DATE', 'APT DATE', 'BOOKING DATE', 'APPT DATE', 'DATE'],
    TIME: ['APPOINTMENT TIME', 'APT TIME', 'BOOKING TIME', 'APPT TIME', 'TIME'],
    PRICE: ['PRICE (GHS)', 'PRICE GH', 'COST', 'TOTAL', 'PRICE GHS', 'PRICE'],
    PAYMENT_STATUS: ['PAYMENT STATUS', 'PAYMENT', 'PAYMENT_STATE', 'PAYMENT_STATUS'],
    STATUS: ['BOOKING STATUS', 'STATE', 'STATUS'],
  };
  // Keep the FIRST column that matches each name (friendly headers are written
  // before the canonical ones, so they win).
  const map = {};
  headers.forEach((h, i) => {
    const k = String(h || '').toUpperCase().trim();
    if (k && !map[k]) map[k] = i + 1;
  });
  const hasAny = headers.some(h => String(h || '').trim() !== '');
  const resolve = (names) => { for (const n of names) { const k = n.toUpperCase().trim(); if (map[k]) return map[k]; } return 0; };
  if (!hasAny) return { REF:1,CREATED_AT:2,NAME:3,EMAIL:4,PHONE:5,SERVICE:6,DATE:7,TIME:8,PRICE:9,PAYMENT_STATUS:10,STATUS:11 };
  return {
    REF: resolve(ALIASES.REF), CREATED_AT: resolve(ALIASES.CREATED_AT), NAME: resolve(ALIASES.NAME),
    EMAIL: resolve(ALIASES.EMAIL), PHONE: resolve(ALIASES.PHONE), SERVICE: resolve(ALIASES.SERVICE),
    DATE: resolve(ALIASES.DATE), TIME: resolve(ALIASES.TIME), PRICE: resolve(ALIASES.PRICE),
    PAYMENT_STATUS: resolve(ALIASES.PAYMENT_STATUS), STATUS: resolve(ALIASES.STATUS),
  };
}

const TZ = 'Africa/Accra';
function fmtDate(v){ if(v instanceof Date){ if(v.getFullYear()===1899) return ''; return Utilities_shim('EEE d MMM yyyy', v); } return String(v||'').trim(); }
function fmtTime(v){
  if(v instanceof Date){
    if(v.getFullYear()===1899){ const hh=v.getUTCHours(),mm=v.getUTCMinutes(); return Utilities_shim('h:mm a', new Date(Date.UTC(2000,0,1,hh,mm))); }
    return Utilities_shim('h:mm a', new Date(Date.UTC(v.getFullYear(),v.getMonth(),v.getDate(),v.getHours(),v.getMinutes())));
  }
  const s=String(v||'').trim();
  if(/^\d{1,2}:\d{2}$/.test(s)){ const [h,m]=s.split(':'); return Utilities_shim('h:mm a', new Date(Date.UTC(2000,0,1,Number(h),Number(m)))); }
  return s;
}
function fmtCreatedAt(v){ if(v instanceof Date){ if(v.getFullYear()===1899) return ''; return Utilities_shim('d MMM yyyy, h:mm a', v); } return String(v||'').trim(); }
function Utilities_shim(fmt, d){ // mimic Utilities.formatDate with Etc/GMT+00 (UTC wall clock)
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const pad = n => String(n).padStart(2,'0');
  const hh = d.getUTCHours();
  const h12 = h => h===0?12:(h>12?h-12:h); const ap = hh>=12?'PM':'AM';
  const parts = { EEE: wd[d.getUTCDay()], d: d.getUTCDate(), MMM: mn[d.getUTCMonth()], yyyy: d.getUTCFullYear(), h: h12(hh), mm: pad(d.getUTCMinutes()), a: ap };
  return fmt.replace(/h:mm a/g, `${parts.h}:${parts.mm} ${parts.a}`).replace(/EEE/g, parts.EEE).replace(/\bd\b/g, String(parts.d)).replace(/MMM/g, parts.MMM).replace(/yyyy/g, String(parts.yyyy));
}

function toBooking(row, headers){
  const idx = indexByHeader(headers);
  const pick = i => (i && i>0 && row && i-1 < row.length) ? row[i-1] : '';
  const priceRaw = pick(idx.PRICE);
  const price = (priceRaw===''||priceRaw===null||priceRaw===undefined)?null:Number(priceRaw);
  return {
    ref: String(pick(idx.REF)||'').trim(),
    createdAt: fmtCreatedAt(pick(idx.CREATED_AT)),
    name: String(pick(idx.NAME)||'').trim(),
    email: String(pick(idx.EMAIL)||'').trim(),
    phone: String(pick(idx.PHONE)||'').trim(),
    service: String(pick(idx.SERVICE)||'').trim(),
    date: fmtDate(pick(idx.DATE)),
    time: fmtTime(pick(idx.TIME)),
    price: price,
    paymentStatus: String(pick(idx.PAYMENT_STATUS)||'').trim() || 'Pending',
    status: String(pick(idx.STATUS)||'').trim(),
  };
}

console.log('INDEX MAP:', JSON.stringify(indexByHeader(headers), null, 0));
console.log('\n--- ROW 1 (headers) ---');
console.log(headers.map((h,i)=>`col${i+1}=${JSON.stringify(h)}`).join('  '));
rows.forEach((r, i) => {
  console.log(`\n--- ROW ${i+2} (raw) ---`);
  r.forEach((v,c)=>console.log(`  col${c+1} [${headers[c]||''}] = ${JSON.stringify(v)} (${Object.prototype.toString.call(v)})`));
  console.log('\n  MAPPED:', JSON.stringify(toBooking(r, headers)));
});