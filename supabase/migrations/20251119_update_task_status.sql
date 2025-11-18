-- First, drop any existing check constraints on the status column
DO $$ 
BEGIN
    -- Find and drop all constraints that involve the status column
    FOR r IN (
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = 'items'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%status%'
    ) LOOP
        EXECUTE 'ALTER TABLE items DROP CONSTRAINT ' || quote_ident(r.conname);
    END LOOP;
END $$;

-- Now update all tasks with 'waiting' status to 'in-progress'
UPDATE items
SET status = 'in-progress'
WHERE status = 'waiting' AND type = 'task';

-- Add new constraint that includes both task and reminder statuses
ALTER TABLE items
ADD CONSTRAINT items_status_check CHECK (
  (type = 'task' AND status IN ('start', 'in-progress', 'complete')) OR
  (type = 'reminder' AND status IN ('today', 'within7', '7plus', 'complete'))
);