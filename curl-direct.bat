@echo off
setlocal
set "TOK=iUgL7OE9DU2rbpKHhASF42w5nw2eSjrr"
set "URL=https://script.google.com/macros/s/AKfycbzGjE6oQwKURpWDf9h8dpE0el7LHput9in5Iwwf8nd_4ZxnHZhHyMfK7Jv0IEJM0vHY/exec"
curl -sL -m 30 %URL% -H "Content-Type: application/json" --data-binary @payload.json -w "`nHTTP:%{http_code}`n"
echo.