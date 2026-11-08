# Expected failure: observe unchanged count 3 with FAIL, then time out waiting for PASS.
Set WaitTimeout 5s
Set TypingSpeed 1ms
Enter
Wait+Line /CATALOG_READY> *$/
Ctrl+L
Wait+Screen /^CATALOG_READY>[ \t\r\n]*$/
Type "BEGIN READ ONLY;"
Enter
Wait+Line /CATALOG_READY> *$/
Type "SELECT concat('FIELD','_','NOTES','_','CATALOG','_',CASE WHEN current_database()='catalogdb' AND count(*)=3 AND array_agg(sku ORDER BY sku)=ARRAY['mug','notebook','sticker']::text[] THEN concat('catalogdb_','mug,notebook,sticker_','3_',CASE WHEN count(*)=4 THEN 'PASS' ELSE 'FAIL' END) ELSE 'UNEXPECTED_DATABASE_OR_ROWS_FAIL' END) FROM catalog_items;"
Enter
Wait+Line /CATALOG_READY> *$/
Type "ROLLBACK;"
Enter
Wait+Line /CATALOG_READY> *$/
Wait+Screen@5s /(?m)^FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_FAIL[ \t]*\r?$/
Wait+Screen@5s /(?m)^FIELD_NOTES_CATALOG_catalogdb_mug,notebook,sticker_3_PASS[ \t]*\r?$/
