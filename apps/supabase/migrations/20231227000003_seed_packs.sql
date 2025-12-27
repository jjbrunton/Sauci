-- Seed data: Initial question packs for testing

-- Starter Pack (free)
INSERT INTO public.question_packs (id, name, description, icon, is_premium, is_public, sort_order)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Starter Pack',
  'Perfect for couples just getting started. Light and playful questions to break the ice.',
  '🌟',
  FALSE,
  TRUE,
  1
);

INSERT INTO public.questions (pack_id, text, intensity) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Would you like to try a couples massage together?', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Would you enjoy a candlelit dinner at home?', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Would you like to slow dance in the living room?', 1),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Would you enjoy a bath or shower together?', 2),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Would you like to give your partner a back rub?', 1);

-- Date Night Pack (free)
INSERT INTO public.question_packs (id, name, description, icon, is_premium, is_public, sort_order)
VALUES (
  'b2c3d4e5-f678-9012-bcde-f23456789012',
  'Date Night',
  'Spice up your date nights with these romantic suggestions.',
  '🌹',
  FALSE,
  TRUE,
  2
);

INSERT INTO public.questions (pack_id, text, intensity) VALUES
  ('b2c3d4e5-f678-9012-bcde-f23456789012', 'Would you enjoy stargazing together?', 1),
  ('b2c3d4e5-f678-9012-bcde-f23456789012', 'Would you like to cook a meal together?', 1),
  ('b2c3d4e5-f678-9012-bcde-f23456789012', 'Would you enjoy a picnic in the park?', 1),
  ('b2c3d4e5-f678-9012-bcde-f23456789012', 'Would you like to watch a romantic movie together?', 1),
  ('b2c3d4e5-f678-9012-bcde-f23456789012', 'Would you enjoy a weekend getaway?', 2);

-- Adventure Pack (premium)
INSERT INTO public.question_packs (id, name, description, icon, is_premium, is_public, sort_order)
VALUES (
  'c3d4e5f6-7890-1234-cdef-345678901234',
  'Adventure',
  'For couples ready to explore more adventurous activities together.',
  '🔥',
  TRUE,
  TRUE,
  3
);

INSERT INTO public.questions (pack_id, text, intensity) VALUES
  ('c3d4e5f6-7890-1234-cdef-345678901234', 'Would you like to try role-playing scenarios?', 3),
  ('c3d4e5f6-7890-1234-cdef-345678901234', 'Would you enjoy using massage oils?', 2),
  ('c3d4e5f6-7890-1234-cdef-345678901234', 'Would you like to write love letters to each other?', 2),
  ('c3d4e5f6-7890-1234-cdef-345678901234', 'Would you enjoy a blindfolded experience?', 3),
  ('c3d4e5f6-7890-1234-cdef-345678901234', 'Would you like to plan a surprise for your partner?', 2);
