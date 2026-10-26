$tok = "iUgL7OE9DU2rbpKHhASF42w5nw2eSjrr"
$url = "https://styled-by-c-gtv0r5qhi-code-com1.vercel.app/api/admin/bookings"
$body = '{"action":"list","token":"b336bcdaacb05c49ff9031a6296cf3b02076e8c599deb2dfcbfe9da621548406"}'
& "C:\Windows\System32\curl.exe" -sL -m 30 $url -H "Content-Type: application/json" -H "x-vercel-protection-bypass: $tok" -d (Get-Content payload.json -Raw) -w "`nHTTP:%{http_code}`n"