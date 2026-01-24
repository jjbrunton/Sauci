-- Sync production content to non-production
-- Generated from production database

BEGIN;

-- Clear existing content (in reverse dependency order)
DELETE FROM pack_topics;
DELETE FROM questions;
DELETE FROM dares;
DELETE FROM question_packs;
DELETE FROM dare_packs;
DELETE FROM topics;
DELETE FROM categories;

-- Insert categories
INSERT INTO categories (id, name, description, icon, sort_order, created_at, is_public) VALUES
('c1000000-0000-0000-0000-000000000002', 'Adventure & Travel', 'Explore the world together and create unforgettable memories', 'map-outline', 0, '2025-12-30 20:03:27.663523+00', true),
('fcb36b61-6081-4bf6-9267-1ba9ba75fc08', 'Quality Time', NULL, 'chatbubbles-outline', 1, '2026-01-10 13:27:22.867947+00', true),
('ef425e8d-9fc4-40c2-a5e7-5fc4cb6b64da', 'Social Life', 'Figure out how you both like to spend time with others. From quiet dinners to big parties.', 'people-outline', 2, '2026-01-10 18:11:08.278631+00', true),
('ecabc509-9fed-48cb-bd60-c5d830d2491d', 'Long Distance', 'Stay connected and build intimacy when you''re miles apart.', 'airplane-outline', 3, '2026-01-10 16:23:37.389445+00', true),
('9eb47dce-d343-4e24-8402-252f188db2f2', 'Getting Started', 'Discover your compatibility and establish boundaries together', 'flag-outline', 4, '2026-01-10 20:59:35.817421+00', true),
('c1000000-0000-0000-0000-000000000004', 'Romance & Sensuality', 'Deepen your romantic and sensual connection', 'heart-outline', 5, '2025-12-30 20:03:27.663523+00', true),
('1e52e0b2-f853-4b99-9ca8-7231adbc639e', 'Sensual Discovery', 'Discover playful touch and tender moments of connection.', 'compass-outline', 6, '2026-01-10 14:11:33.114458+00', true),
('c1000000-0000-0000-0000-000000000005', 'Fantasy Exploration', 'Discover and share your secret desires', 'moon-outline', 7, '2025-12-30 20:03:27.663523+00', false),
('c1000000-0000-0000-0000-000000000007', 'Bedroom Adventures', 'Explore new ways to connect intimately', 'bed-outline', 8, '2025-12-30 20:03:27.663523+00', false),
('c1000000-0000-0000-0000-000000000006', 'Spicy Challenges', 'Push boundaries with exciting dares and activities', 'flame-outline', 9, '2025-12-30 20:03:27.663523+00', false),
('fc86d5e1-5fd2-4f21-9d59-1a3e701aab02', 'Toy Time', 'Discover playful accessories to spice up your romance.', 'gift-outline', 10, '2026-01-10 14:12:04.292251+00', false),
('d1000000-0000-0000-0000-000000000001', 'Roleplay', 'Step into character and explore fantasies together', 'color-wand-outline', 11, '2026-01-10 22:35:42.743811+00', true),
('46dc3730-703b-4f79-82e5-3e23d0a778d7', 'The Kink Lab', 'A curious, judgment-free space to experiment with new kinks, toys, and physical sensations.', 'flask-outline', 12, '2026-01-01 10:20:07.042855+00', true),
('57da058a-da7f-48d7-9738-30573ad9cb5d', 'Public Thrills', 'Take the excitement outside the bedroom. From subtle touches to risky adventures.', 'eye-outline', 13, '2026-01-10 16:32:50.303497+00', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_public = EXCLUDED.is_public;

-- Insert topics
INSERT INTO topics (id, name, description, icon, sort_order, created_at) VALUES
('d62fe605-7cc7-4df1-803f-dc3c49ed389c', 'Oral', NULL, NULL, 0, '2025-12-31 15:48:27.666812+00'),
('f0c04e96-7d0e-4e11-8a04-fd81a458ed0f', 'Exhibitionism', NULL, NULL, 0, '2025-12-31 15:48:27.666812+00'),
('8b7c6e32-22bc-4218-b0c8-10cc24357be4', 'Power Play', NULL, NULL, 0, '2025-12-31 15:48:27.666812+00'),
('1e9d6cf6-897f-47e6-acd7-50198872cee7', 'Teasing', NULL, NULL, 0, '2025-12-31 15:48:27.666812+00'),
('02df8c3f-2db4-4be6-bcc2-d83b319c80b1', 'Adventure', NULL, NULL, 0, '2025-12-31 15:48:27.666812+00'),
('92490542-9e98-4f23-ad17-775ead57c4c5', 'Sensory Play', NULL, NULL, 0, '2026-01-01 09:26:13.984335+00'),
('e832c389-8ed7-4807-8942-2a7aca979aca', 'Denial', NULL, NULL, 0, '2026-01-01 09:26:13.984335+00'),
('e9cce268-e378-4a62-accf-1d719a574ba2', 'Public Play', NULL, NULL, 0, '2026-01-10 14:34:39.115419+00'),
('10a437f9-103b-404f-8af0-f578adbe3eb3', 'Toys', NULL, NULL, 0, '2026-01-10 16:03:38.586861+00'),
('70dac37c-93e2-43d7-9ea8-14c4a88fbbdd', 'Bondage', NULL, NULL, 0, '2026-01-10 16:05:40.363422+00'),
('d6bc3fcb-d095-4eac-b28b-dbd45fb769c3', 'Long Distance', NULL, NULL, 0, '2026-01-10 16:27:19.423618+00'),
('9fe84cc4-1826-4920-8d67-9f4ae8692e2b', 'Romance', NULL, NULL, 0, '2026-01-10 16:27:19.423618+00'),
('28cef553-ea0d-4dfa-8515-ddc29e003e73', 'Communication', NULL, NULL, 0, '2026-01-10 16:27:19.423618+00'),
('a4fe63e3-efb8-4351-89a8-3f4bfb531a45', 'Voyeurism', NULL, NULL, 0, '2026-01-10 16:27:46.907948+00'),
('66932305-7888-4272-8b53-7c550e96429a', 'Socializing', NULL, NULL, 0, '2026-01-10 18:12:45.879724+00'),
('2386f22d-5d13-444a-add1-5d7c21fb6fd2', 'Lifestyle', NULL, NULL, 0, '2026-01-10 18:12:45.879724+00'),
('fa537922-46b0-4e64-a69a-174a83898983', 'Role Play', NULL, NULL, 0, '2026-01-10 18:36:50.496586+00'),
('1e2fad8b-0543-4d30-bee2-59478d2872c0', 'Dirty Talk', NULL, NULL, 0, '2026-01-10 18:37:09.687791+00'),
('22eefbc4-49f4-40b5-bf4b-532116678fbd', 'Anal', NULL, NULL, 0, '2026-01-10 18:37:18.866239+00'),
('a3aabe8d-d7b4-4b01-bb45-425a1187dbe5', 'Sex Positions', NULL, NULL, 0, '2026-01-10 18:37:21.669201+00'),
('b001c5f4-50a5-42d4-bbf8-17ba325da5c3', 'Massage', NULL, NULL, 0, '2026-01-10 18:37:44.145124+00'),
('ac37e45d-ed51-4205-ab02-c2632824022f', 'Acts of Service', NULL, NULL, 0, '2026-01-10 21:54:22.972186+00'),
('1618b36a-9130-4e95-b4e5-ac8f3da2ed17', 'Medical Play', NULL, NULL, 0, '2026-01-11 16:15:47.190027+00'),
('4ccfd2d4-d670-42da-91e0-c7681099d9d3', 'Breeding', NULL, NULL, 0, '2026-01-11 16:15:47.190027+00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order;

-- Insert question_packs
INSERT INTO question_packs (id, name, description, icon, is_premium, is_public, sort_order, created_at, category_id, is_explicit, min_intensity, max_intensity, avg_intensity, scheduled_release_at, release_notified) VALUES
('44295bd5-fda3-4ed6-8aa6-d5c7e811348e', 'Intimate Games', 'Playful activities for the bedroom', 'dice-outline', false, true, 0, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000007', true, 3, 5, 3.79, NULL, false),
('42c00d6c-ab1f-42ce-afb0-00839064263b', 'Romantic Gestures', 'Sweet and intimate ways to show love', 'flower-outline', false, true, 0, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000004', false, 2, 4, 2.63, NULL, false),
('d18f6d4a-4a32-4687-8938-2a53a7d82739', 'Starting Out', 'Perfect for beginners, this playful pack introduces simple, romantic ways to explore with toys.', 'rocket-outline', false, true, 0, '2026-01-10 14:12:51.542066+00', 'fc86d5e1-5fd2-4f21-9d59-1a3e701aab02', true, 3, 5, 3.42, NULL, false),
('8edf2abc-dbb5-4a11-ac5c-15ee60aef3b4', 'Forbidden Fantasy Dates', 'Act out bold scenarios like doctor/patient or boss/assistant in immersive, role-play evenings. Dive into uninhibited storytelling for unforgettable nights.', 'color-wand-outline', false, false, 0, '2026-01-01 22:05:09.528276+00', '46dc3730-703b-4f79-82e5-3e23d0a778d7', true, 2, 5, 4.13, NULL, false),
('fd6f2a49-1057-4f30-aab4-7cd185764f7e', 'Staying Close', 'Real daily connection for when you''re apart. Video calls, voice notes, and shared moments.', 'link-outline', false, true, 0, '2026-01-10 16:23:43.207456+00', 'ecabc509-9fed-48cb-bd60-c5d830d2491d', false, 1, 1, 1.00, NULL, false),
('877d8a39-5229-4263-bffc-d3043015603f', 'Finding Your Vibe', 'Discover what social activities you both enjoy - from quiet nights to big parties.', 'musical-notes-outline', false, true, 0, '2026-01-10 18:11:18.16816+00', 'ef425e8d-9fc4-40c2-a5e7-5fc4cb6b64da', false, 1, 1, 1.00, NULL, false),
('91dacfed-46ae-462d-aae3-5e540fe4a973', 'Weekend Warriors', 'Local adventures for your days off', 'car-outline', false, true, 0, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000002', false, 1, 2, 1.02, NULL, false),
('d2000000-0000-0000-0000-000000000001', 'First Impressions', 'Light roleplay scenarios: strangers, flirty encounters, and playful power dynamics', 'sparkles-outline', false, true, 0, '2026-01-10 22:35:42.743811+00', 'd1000000-0000-0000-0000-000000000001', false, 2, 3, 2.77, NULL, false),
('8da8dcb1-0b9b-4828-9a30-199758b8ade5', 'Date Night Ideas', NULL, 'wine-outline', false, true, 0, '2026-01-10 13:28:59.92781+00', 'fcb36b61-6081-4bf6-9267-1ba9ba75fc08', false, 1, 2, 1.05, NULL, false),
('dd143c55-c0a4-4884-a704-1d4d1325cbc2', 'Pleasure Experiments', 'Try something new together', 'flask-outline', false, true, 0, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000006', true, 2, 5, 3.33, NULL, false),
('f0f597b1-889c-4537-beeb-d0f459bb7907', 'Body Mapping', 'Discover where your partner loves to be touched', 'body-outline', false, true, 0, '2026-01-10 19:55:02.290269+00', '1e52e0b2-f853-4b99-9ca8-7231adbc639e', false, 2, 3, 2.18, NULL, false),
('3c17764d-dd11-4103-8a4f-ce6561fd2a1a', 'Boundary Discovery', 'Safely explore new territory together', 'key-outline', false, true, 0, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000005', true, 2, 5, 3.40, NULL, false),
('d5d1b8d2-a868-4150-86bc-da3f8e3e8b00', 'Testing the Waters', 'Subtle thrills in public. Whispered words, secret touches, and hidden tension.', 'water-outline', false, true, 0, '2026-01-10 16:32:57.111957+00', '57da058a-da7f-48d7-9738-30573ad9cb5d', true, 2, 3, 2.27, NULL, false),
('c7244576-f40d-4cdf-804a-788d2b9c1fce', 'Kink Discovery', 'Figure out what you''re both into. Match on interests, then explore the ones that excite you both.', 'compass-outline', true, true, 1, '2026-01-10 18:28:28.212356+00', '46dc3730-703b-4f79-82e5-3e23d0a778d7', true, 2, 5, 4.22, NULL, false),
('bed94ed6-c065-4ff9-9d7f-02de6cade971', 'Sensory Play', 'Heighten your senses and sensations', 'eye-outline', false, true, 1, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000007', true, 3, 5, 3.73, NULL, false),
('1d2ed912-1429-4045-a608-35b8db63f9b4', 'Food & Culture', 'Culinary adventures and cultural experiences', 'restaurant-outline', false, true, 1, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000002', false, 1, 1, 1.00, NULL, false),
('40838dee-0af4-43c7-9d6c-6228d09f91bc', 'Dream Scenarios', 'The wildest what-ifs you can imagine', 'cloudy-outline', true, true, 1, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000005', true, 3, 5, 4.10, NULL, false),
('eb3cbe67-23d8-4c0e-9c6f-dc1583609a26', 'Sensual Touch', 'Explore physical connection and intimacy', 'sparkles-outline', false, true, 1, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000004', true, 2, 4, 2.94, NULL, false),
('374e10a6-6ae9-45c6-bee4-b8be0e617b79', 'Leveling Up Together', 'Take your toy play to the next level with remote-controlled fun, edging, temperature play, and creative combinations.', 'trending-up-outline', true, true, 1, '2026-01-10 16:02:28.36573+00', 'fc86d5e1-5fd2-4f21-9d59-1a3e701aab02', true, 3, 5, 4.12, NULL, false),
('8a1e8650-a192-4f2e-86b0-0ec7bf6fb61c', 'Sensual Massage', 'Learn to relax and arouse your partner through intentional touch', 'hand-left-outline', false, true, 1, '2026-01-10 19:55:02.290269+00', '1e52e0b2-f853-4b99-9ca8-7231adbc639e', false, 2, 3, 2.67, NULL, false),
('19e4ddbd-a4aa-4b26-80bb-53b7187f0eba', 'Missing You', 'Flirty messages, longing, and keeping the spark alive from afar.', 'airplane-outline', false, true, 1, '2026-01-10 16:24:07.455539+00', 'ecabc509-9fed-48cb-bd60-c5d830d2491d', false, 1, 3, 1.92, NULL, false),
('e11bdfea-ab07-46a9-952d-5c00c8b4ddbb', 'Everyday Moments', 'Small daily rituals and micro-moments that strengthen your bond.', 'sunny-outline', false, true, 1, '2026-01-10 20:21:32.792634+00', 'fcb36b61-6081-4bf6-9267-1ba9ba75fc08', false, 1, 1, 1.00, NULL, false),
('d6128ed8-e209-43db-88eb-e9d0115ba8d7', 'Hosting', 'Find your style for having people over - from casual hangs to dinner parties.', 'home-outline', false, true, 1, '2026-01-10 18:16:36.025997+00', 'ef425e8d-9fc4-40c2-a5e7-5fc4cb6b64da', false, 1, 1, 1.00, NULL, false),
('7eabdfae-e70d-4be8-9b10-b43fee955312', 'Know Your Limits', 'Discover where you both stand on the basics - from oral to anal to toys and beyond', 'shield-outline', false, true, 1, '2026-01-10 20:59:45.895706+00', '9eb47dce-d343-4e24-8402-252f188db2f2', true, 3, 5, 3.74, NULL, false),
('b2df6b3b-4bb5-4baa-a29c-a3955187511c', 'Tease & Tension', 'Build anticipation and desire', 'flame-outline', false, true, 1, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000006', true, 2, 5, 3.43, NULL, false),
('d2000000-0000-0000-0000-000000000002', 'Fantasy Scenarios', 'Classic fantasy roleplay: professional encounters with a sexy twist', 'cloud-outline', false, true, 1, '2026-01-10 22:35:42.743811+00', 'd1000000-0000-0000-0000-000000000001', true, 3, 4, 3.63, NULL, false),
('42331f68-60f5-4768-af26-b42c4e96c867', 'Pushing Limits', 'Getting bolder. Hidden touches, risky locations, and the thrill of almost getting caught.', 'fitness-outline', false, true, 1, '2026-01-10 16:33:31.946182+00', '57da058a-da7f-48d7-9738-30573ad9cb5d', true, 2, 4, 3.40, NULL, false),
('8bf628d0-2a83-4a12-a66b-39b0d6ff1e86', 'Private Line', 'When the late night calls get explicit. Sexting, phone sex, and video intimacy.', 'chatbubble-outline', true, true, 2, '2026-01-10 16:26:51.369772+00', 'ecabc509-9fed-48cb-bd60-c5d830d2491d', true, 2, 4, 3.38, NULL, false),
('0f2b3400-05d4-40db-b8fa-41c92ab877eb', 'Outdoor Explorers', 'Nature adventures and outdoor activities', 'map-outline', false, true, 2, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000002', false, 1, 1, 1.00, NULL, false),
('f0a2e7e5-554c-49c4-aa15-42d83b016349', 'Dare to Play', 'Bold intimate dares for adventurous couples', 'dice-outline', true, true, 2, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000006', true, 2, 5, 3.87, NULL, false),
('035c47a6-858c-46fb-8ee3-84889399dca0', 'Position Exploration', 'New ways to connect physically', 'sync-outline', true, true, 2, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000007', true, 3, 5, 3.82, NULL, false),
('9049a67a-a103-4ea3-8405-87dcaefc57ab', 'All Eyes On Us', 'High risk, high reward. Sex in risky places and the thrill of being caught.', 'glasses-outline', true, true, 2, '2026-01-10 16:34:06.362741+00', '57da058a-da7f-48d7-9738-30573ad9cb5d', true, 4, 5, 4.66, NULL, false),
('379d6a44-60a3-4ec9-98cc-eda46547cb23', 'Role Play Ideas', 'Characters and scenarios to explore together', 'color-wand-outline', true, true, 2, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000005', true, 2, 5, 4.13, NULL, false),
('46288aa4-271c-44cf-bfe2-d25662d3f9f8', 'Date Night Sparks', 'Turn up the heat on your evenings out', 'wine-outline', false, true, 2, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000004', true, 2, 4, 2.76, NULL, false),
('f9a59905-50d3-442d-b799-ff64f5b6fd40', 'BDSM', 'A playful guide to exploring your BDSM curiosities together.', 'lock-closed-outline', false, false, 2, '2026-01-10 14:59:13.196109+00', '46dc3730-703b-4f79-82e5-3e23d0a778d7', true, 4, 5, 4.80, NULL, false),
('d2000000-0000-0000-0000-000000000003', 'Deep in Character', 'Advanced power dynamics and intense roleplay scenarios for experienced couples', 'people-outline', true, true, 2, '2026-01-10 22:35:42.743811+00', 'd1000000-0000-0000-0000-000000000001', true, 4, 5, 4.43, NULL, false),
('48150d71-bf95-49b0-924f-e9bcff63fc03', 'Relationship Essentials', 'The foundation of us: exploring the essentials of a healthy, happy relationship.', 'heart-half-outline', false, true, 2, '2026-01-04 14:10:46.042555+00', 'fcb36b61-6081-4bf6-9267-1ba9ba75fc08', false, 1, 1, 1.00, NULL, false),
('d73e9818-4faa-4276-9a93-7c60cff9cdb1', 'The Deep End', 'Advanced toy play for experienced couples: bondage furniture, electro-stim, machines, extended edging, and intense power dynamics.', 'water-outline', true, true, 2, '2026-01-10 16:09:27.096652+00', 'fc86d5e1-5fd2-4f21-9d59-1a3e701aab02', true, 4, 5, 4.82, NULL, false),
('e5aefe29-1ada-4fe5-a4ee-25342917f02c', 'Secret Desires', 'Share your hidden fantasies with your partner', 'eye-off-outline', true, true, 3, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000005', true, 2, 4, 3.09, NULL, false),
('aea8bb8f-de02-41ad-bd1f-7616780dde30', 'Weekend Adventures', 'A playful weekend getaway with fun activities for two.', 'walk-outline', false, false, 3, '2026-01-10 14:09:45.123904+00', 'fcb36b61-6081-4bf6-9267-1ba9ba75fc08', false, NULL, NULL, NULL, NULL, false),
('07f0da41-8ef7-4a48-8ec9-cef2dabaee73', 'Love Notes', 'Express your deepest feelings', 'mail-outline', false, true, 3, '2025-12-30 20:04:38.43756+00', 'c1000000-0000-0000-0000-000000000004', true, 2, 4, 2.80, NULL, false),
('7951e8c4-c7d4-4460-a3f5-495ccf5ca0cb', 'Total Control', 'Remote toys, edging, and power dynamics from miles away.', 'hand-right-outline', true, true, 3, '2026-01-10 16:28:54.328298+00', 'ecabc509-9fed-48cb-bd60-c5d830d2491d', true, 4, 5, 4.76, NULL, false),
('1a138cfd-a8be-46c3-b5da-41e7b57e5ace', 'Language Exploration', 'Explore the power of words and how you express your affection, both in quiet moments and your most intimate moments.', 'chatbubbles-outline', true, false, 4, '2026-01-10 15:34:18.481318+00', 'c1000000-0000-0000-0000-000000000005', true, 3, 5, 3.93, NULL, false)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_premium = EXCLUDED.is_premium,
  is_public = EXCLUDED.is_public,
  sort_order = EXCLUDED.sort_order,
  category_id = EXCLUDED.category_id,
  is_explicit = EXCLUDED.is_explicit,
  min_intensity = EXCLUDED.min_intensity,
  max_intensity = EXCLUDED.max_intensity,
  avg_intensity = EXCLUDED.avg_intensity;

-- Insert dare_packs
INSERT INTO dare_packs (id, name, description, icon, is_premium, is_public, is_explicit, sort_order, category_id, min_intensity, max_intensity, avg_intensity, created_at) VALUES
('a1b2c3d4-1111-1111-1111-111111111111', 'Romantic Gestures', 'Sweet and thoughtful dares to show your love', '💕', false, true, false, 1, NULL, 1, 3, 2.00, '2026-01-20 21:05:55.039767+00'),
('a1b2c3d4-2222-2222-2222-222222222222', 'Playful Teasing', 'Fun and flirty dares to keep things exciting', '😏', false, true, false, 2, NULL, 2, 4, 2.71, '2026-01-20 21:05:55.039767+00'),
('a1b2c3d4-3333-3333-3333-333333333333', 'Adventure Time', 'Push your boundaries with exciting challenges', '🔥', true, true, false, 3, NULL, 3, 5, 3.71, '2026-01-20 21:05:55.039767+00'),
('a1b2c3d4-4444-4444-4444-444444444444', 'Intimate Moments', 'Sensual dares for close connection', '🌙', true, true, true, 4, NULL, 3, 5, 4.00, '2026-01-20 21:05:55.039767+00')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  is_premium = EXCLUDED.is_premium,
  is_public = EXCLUDED.is_public,
  is_explicit = EXCLUDED.is_explicit,
  sort_order = EXCLUDED.sort_order,
  min_intensity = EXCLUDED.min_intensity,
  max_intensity = EXCLUDED.max_intensity,
  avg_intensity = EXCLUDED.avg_intensity;

-- Insert dares
INSERT INTO dares (id, pack_id, text, intensity, suggested_duration_hours, created_at) VALUES
('267ba4d9-f5cb-4f9c-9529-bb8a5a169634', 'a1b2c3d4-1111-1111-1111-111111111111', 'Write a love note and hide it somewhere your partner will find it', 1, 24, '2026-01-20 21:06:03.390752+00'),
('3d104d0d-604f-4e1e-814d-20a9036db051', 'a1b2c3d4-1111-1111-1111-111111111111', 'Give your partner a 10-minute massage', 1, 2, '2026-01-20 21:06:03.390752+00'),
('0ba8c19d-190f-4a2c-8804-8b4138b6e94f', 'a1b2c3d4-1111-1111-1111-111111111111', 'Cook or order your partner''s favorite meal', 2, 24, '2026-01-20 21:06:03.390752+00'),
('8b2c1546-3053-4de3-a232-ce655c5f72ee', 'a1b2c3d4-1111-1111-1111-111111111111', 'Plan a surprise date night', 2, 48, '2026-01-20 21:06:03.390752+00'),
('ee9ee19a-de01-481d-bb13-288bd0b11b62', 'a1b2c3d4-1111-1111-1111-111111111111', 'Slow dance together to your favorite song', 2, 4, '2026-01-20 21:06:03.390752+00'),
('898aac6b-da8e-4477-85b8-73d99b77cfc7', 'a1b2c3d4-1111-1111-1111-111111111111', 'Create a playlist of songs that remind you of your relationship', 3, 24, '2026-01-20 21:06:03.390752+00'),
('cc64bd86-4c88-4cdc-890a-58cbaca32f25', 'a1b2c3d4-1111-1111-1111-111111111111', 'Recreate your first date', 3, 72, '2026-01-20 21:06:03.390752+00'),
('f08f5a35-2229-4c6c-a6d3-daff27297df2', 'a1b2c3d4-2222-2222-2222-222222222222', 'Send a flirty text every hour for the next 4 hours', 2, 4, '2026-01-20 21:06:10.980367+00'),
('849734a1-2b5d-4d4f-8065-c096ea096e44', 'a1b2c3d4-2222-2222-2222-222222222222', 'Whisper something naughty in your partner''s ear in public', 2, 2, '2026-01-20 21:06:10.980367+00'),
('c1e99ac6-1424-40e1-9288-1995ef8953e2', 'a1b2c3d4-2222-2222-2222-222222222222', 'Give your partner 3 compliments about their appearance', 2, 1, '2026-01-20 21:06:10.980367+00'),
('7c861f12-cb07-4460-b348-b38997ff5176', 'a1b2c3d4-2222-2222-2222-222222222222', 'Send a suggestive photo (keep it tasteful!)', 3, 4, '2026-01-20 21:06:10.980367+00'),
('547d4e7d-3977-4ef4-aa9e-2c24f30bd910', 'a1b2c3d4-2222-2222-2222-222222222222', 'Tease your partner for 10 minutes without letting them touch you', 3, 1, '2026-01-20 21:06:10.980367+00'),
('bf94334a-d9f3-4952-81ba-1d0e9693f0f1', 'a1b2c3d4-2222-2222-2222-222222222222', 'Wear something you know your partner finds irresistible', 3, 12, '2026-01-20 21:06:10.980367+00'),
('860a0377-0f41-4b8d-81d8-2fec35df6b92', 'a1b2c3d4-2222-2222-2222-222222222222', 'Blindfold your partner and feed them dessert', 4, 2, '2026-01-20 21:06:10.980367+00'),
('ca311842-a4c7-49e3-8836-5a423599f352', 'a1b2c3d4-3333-3333-3333-333333333333', 'Try a new activity together that neither of you has done before', 3, 72, '2026-01-20 21:06:18.466438+00'),
('9825ea49-4024-447e-86c9-af4e29d73ed0', 'a1b2c3d4-3333-3333-3333-333333333333', 'Have a spontaneous photoshoot together', 3, 4, '2026-01-20 21:06:18.466438+00'),
('eebb8795-7372-4014-a4cc-d30c2fed9f32', 'a1b2c3d4-3333-3333-3333-333333333333', 'Play truth or dare for 30 minutes', 3, 1, '2026-01-20 21:06:18.466438+00'),
('b99a8825-7c50-4152-bc7b-5b00fa7bf53d', 'a1b2c3d4-3333-3333-3333-333333333333', 'Role-play as strangers meeting for the first time at a bar', 4, 4, '2026-01-20 21:06:18.466438+00'),
('396cd465-f0fd-4f92-a9c5-4e9ce7225b2a', 'a1b2c3d4-3333-3333-3333-333333333333', 'Spend an entire evening without using your phones', 4, 6, '2026-01-20 21:06:18.466438+00'),
('fe7e7bd1-8b87-4859-aac7-5b788b2a54ee', 'a1b2c3d4-3333-3333-3333-333333333333', 'Let your partner pick your outfit for the entire day', 4, 24, '2026-01-20 21:06:18.466438+00'),
('72cba008-ff85-4edb-9d5f-882bca4ff84f', 'a1b2c3d4-3333-3333-3333-333333333333', 'Be your partner''s servant for an hour - do whatever they ask', 5, 1, '2026-01-20 21:06:18.466438+00'),
('860a6797-b4c6-4271-a327-2e26101f8479', 'a1b2c3d4-4444-4444-4444-444444444444', 'Give your partner a sensual full-body massage with oils', 3, 2, '2026-01-20 21:06:26.01169+00'),
('158f04d8-fc3f-448c-856e-369de6b9d98b', 'a1b2c3d4-4444-4444-4444-444444444444', 'Take a bath or shower together', 3, 1, '2026-01-20 21:06:26.01169+00'),
('681890fc-c29f-44a2-8885-1d59d5e24399', 'a1b2c3d4-4444-4444-4444-444444444444', 'Kiss every part of your partner''s body', 4, 1, '2026-01-20 21:06:26.01169+00'),
('4fce4684-5118-48a0-9353-de6320b625dd', 'a1b2c3d4-4444-4444-4444-444444444444', 'Try a new position tonight', 4, 4, '2026-01-20 21:06:26.01169+00'),
('056689e4-3f48-4c11-ae58-0fde6e2cb2a4', 'a1b2c3d4-4444-4444-4444-444444444444', 'Describe your deepest fantasy to your partner', 4, 2, '2026-01-20 21:06:26.01169+00'),
('858acf47-8a71-4f6a-a909-0c07ee2a03b6', 'a1b2c3d4-4444-4444-4444-444444444444', 'Spend 30 minutes on foreplay only', 5, 1, '2026-01-20 21:06:26.01169+00'),
('930ef187-09e5-47fd-ad88-3f4a10a10a74', 'a1b2c3d4-4444-4444-4444-444444444444', 'Let your partner be completely in control tonight', 5, 4, '2026-01-20 21:06:26.01169+00')
ON CONFLICT (id) DO UPDATE SET
  pack_id = EXCLUDED.pack_id,
  text = EXCLUDED.text,
  intensity = EXCLUDED.intensity,
  suggested_duration_hours = EXCLUDED.suggested_duration_hours;

COMMIT;

-- Questions will be loaded separately due to large size
-- Run: supabase db execute --file seed-questions.sql
