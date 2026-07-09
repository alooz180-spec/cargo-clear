CREATE POLICY "Users can view own case files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload own case files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own case files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own case files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'case-files' AND (storage.foldername(name))[1] = auth.uid()::text);