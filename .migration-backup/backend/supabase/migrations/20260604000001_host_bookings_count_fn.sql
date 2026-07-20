-- SQL Migration: Add get_host_bookings_count security definer function
-- Allows public profiles to fetch the aggregated bookings count of a host securely without bypassing RLS for details

CREATE OR REPLACE FUNCTION public.get_host_bookings_count(host_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    bookings_count BIGINT;
BEGIN
    SELECT COUNT(b.id) INTO bookings_count
    FROM public.bookings b
    JOIN public.experiences e ON b.experience_id = e.id
    WHERE e.user_id = host_id;
    
    RETURN bookings_count;
END;
$$;

-- Grant execution to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_host_bookings_count(UUID) TO anon, authenticated, service_role;
