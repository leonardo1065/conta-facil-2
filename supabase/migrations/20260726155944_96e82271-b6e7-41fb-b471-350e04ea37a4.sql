CREATE POLICY "Users can update their own anexos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'anexos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'anexos' AND auth.uid()::text = (storage.foldername(name))[1]);