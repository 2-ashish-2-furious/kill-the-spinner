-- =============================================================================
--  LIVE SYNC — write straight into Postgres, watch the browser update
-- =============================================================================
--  For the talk. Bypasses the app entirely: no tRPC, no HTTP, no client code.
--  The only path from here to the screen is Postgres logical replication ->
--  the sync engine -> the local replica -> a live query.
--
--  Run it:
--     set -a && . ./.env && set +a
--     psql "$DATABASE_URL" -f talk/demos/sql/live-sync.sql
--
--  Or better on stage, stay interactive so you can pick statements by hand:
--     psql "$DATABASE_URL"
--     \i talk/demos/sql/live-sync.sql
--
--  The demo view sorts by id DESC, so anything inserted here appears at the
--  TOP of the list — no scrolling needed.
-- =============================================================================

-- Which demo project? Resolved from the email you are logged in as in the
-- browser, so the shape's server-side filter matches what you're looking at.
\set demo_email 'verify-1788798166@test.com'

SELECT p.id AS demo_project
FROM projects p
JOIN users u ON u.id = p.owner_id
WHERE p.name = 'Demo: 500k Issues' AND u.email = :'demo_email'
\gset

\echo '  using project id:' :demo_project


-- ── 1. ONE ROW ───────────────────────────────────────────────────────────────
--  Say: "no application code is involved in this at all."
INSERT INTO todos (text, completed, created_at, user_id, project_id, user_ids)
SELECT 'LIVE ' || to_char(now(), 'HH24:MI:SS')
         || ' — inserted straight into Postgres',
       false, now(), p.owner_id, p.id, '{}'
FROM projects p WHERE p.id = :demo_project;


-- ── 2. UPDATE AN EXISTING ROW ────────────────────────────────────────────────
--  Tick the newest issue. The checkbox moves in the browser.
UPDATE todos SET completed = NOT completed
WHERE id = (SELECT max(id) FROM todos WHERE project_id = :demo_project);


-- ── 3. STREAM ────────────────────────────────────────────────────────────────
--  The one that gets the reaction. Each \watch tick is its own transaction,
--  so rows arrive one at a time instead of in a single batch.
--  Ctrl-C to stop.
--
--    INSERT INTO todos (text, completed, created_at, user_id, project_id, user_ids)
--    SELECT 'STREAM ' || to_char(clock_timestamp(), 'HH24:MI:SS.MS'),
--           false, now(), p.owner_id, p.id, '{}'
--    FROM projects p WHERE p.id = :demo_project;
--    \watch 1


-- ── 4. TIDY UP AFTER THE TALK ────────────────────────────────────────────────
--  Removes only the rows this script created, only in the demo project.
--
--    DELETE FROM todos
--    WHERE project_id = :demo_project
--      AND (text LIKE 'LIVE %' OR text LIKE 'STREAM %');
