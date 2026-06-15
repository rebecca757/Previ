
-- 1) Family links: prevent self-appointment as another user's caregiver
DROP POLICY IF EXISTS "insert own family links" ON public.family_links;
CREATE POLICY "insert own family links"
ON public.family_links
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = managed_user_id);

-- 2) Profiles: scope SELECT to self or active caregiver only
DROP POLICY IF EXISTS "profiles select self caregiver or linked" ON public.profiles;
CREATE POLICY "profiles select self or caregiver"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_active_caregiver(auth.uid(), id));
