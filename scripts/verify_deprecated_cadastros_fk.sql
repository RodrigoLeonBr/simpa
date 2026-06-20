-- SIMPA — Verify no active FK references to deprecated cadastro tables
-- Run before dropping _deprecated_* tables (TechSpec: keep renamed for one release).
-- Expected: zero rows in fk_check; safe to DROP when migration is fully verified.

SELECT
    tc.table_name AS referencing_table,
    kcu.column_name AS referencing_column,
    ccu.table_name AS referenced_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN (
    '_deprecated_unidades_saude',
    '_deprecated_prestadores_mac',
    '_deprecated_hospitais',
    'unidades_saude',
    'prestadores_mac',
    'hospitais'
  )
ORDER BY referencing_table, referencing_column;
