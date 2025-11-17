-- IMPORTANT: Run this SQL in your Supabase SQL Editor
-- Go to: https://app.supabase.com/project/tqtkubrubvingbfoegxu/sql/new
-- Paste and execute this SQL to enable email validation for list sharing

-- Create a function to check if users exist by email
CREATE OR REPLACE FUNCTION check_users_exist(emails text[])
RETURNS TABLE(email text, user_exists boolean)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.email,
    EXISTS(
      SELECT 1 
      FROM auth.users u 
      WHERE LOWER(u.email) = LOWER(e.email)
    ) as user_exists
  FROM unnest(emails) as e(email);
END;
$$;