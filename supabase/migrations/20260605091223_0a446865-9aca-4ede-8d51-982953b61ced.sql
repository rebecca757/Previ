REVOKE EXECUTE ON FUNCTION public.is_active_caregiver(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_family_linked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_caregiver(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_family_linked(uuid, uuid) TO authenticated, service_role;