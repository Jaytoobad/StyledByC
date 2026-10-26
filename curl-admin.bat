@echo off
setlocal
set "TOK=iUgL7OE9DU2rbpKHhASF42w5nw2eSjrr"
set "URL=https://styled-by-c-gtv0r5qhi-code-com1.vercel.app/api/admin/bookings"
curl -sL -m 30 %URL% -H "Content-Type: application/json" -H "x-vercel-protection-bypass: %TOK%" -d @payload.json -w "HTTP:%{http_code}"
echo.