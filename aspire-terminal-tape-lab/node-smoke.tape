# Use scripts/terminal-smoke.mjs to replace RUN_NONCE with a fresh nonce per run.
Set WaitTimeout 5s
Set TypingSpeed 1ms
Wait+Line /> *$/
Type "console.log(['FIELD','NOTES',6*7,'RUN_NONCE'].join('_'))"
Enter
Wait+Screen@5s /FIELD_NOTES_42_RUN_NONCE/
