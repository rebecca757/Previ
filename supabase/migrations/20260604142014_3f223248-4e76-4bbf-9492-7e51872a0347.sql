
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage policies: users can manage objects under their own user-id folder
CREATE POLICY "users read own health docs" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users upload own health docs" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users update own health docs" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users delete own health docs" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'health-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
