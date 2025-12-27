-- Add a new pack for two-part questions
INSERT INTO public.question_packs (id, name, description, icon, is_premium, is_public, sort_order)
VALUES (
  'd4e5f6f7-8901-2345-defa-456789012345',
  'Giving & Receiving',
  'Explore different roles and dynamics with these two-part questions.',
  '🌓',
  FALSE,
  TRUE,
  4
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.questions (pack_id, text, partner_text, intensity) VALUES
  ('d4e5f6f7-8901-2345-defa-456789012345', 'Finish on your partner''s face', 'Have your partner finish on your face', 4),
  ('d4e5f6f7-8901-2345-defa-456789012345', 'Give your partner a full body massage', 'Receive a full body massage from your partner', 2),
  ('d4e5f6f7-8901-2345-defa-456789012345', 'Tie your partner up', 'Be tied up by your partner', 4),
  ('d4e5f6f7-8901-2345-defa-456789012345', 'Blindfold your partner', 'Be blindfolded by your partner', 3),
  ('d4e5f6f7-8901-2345-defa-456789012345', 'Feed your partner while they are blindfolded', 'Be fed by your partner while blindfolded', 2);
