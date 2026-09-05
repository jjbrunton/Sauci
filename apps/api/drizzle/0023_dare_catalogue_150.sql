-- Initial editorial dare catalogue. Catalogue IDs are deterministic so the seed
-- is replay-safe. Only rows that passed the universal store-safety review are
-- public and `allowed`; all other editorial inventory remains fail-closed.

WITH seed (
  id, name, description, icon, is_premium, is_public, is_explicit, sort_order,
  min_intensity, max_intensity, avg_intensity, content_status, content_review_reason
) AS (VALUES
  ('1f5e0000-0000-4000-8000-100000000001', 'Little Things', 'Small gestures that make your partner feel seen.', '💌', false, true, false, 10, 1, 1, 1.00, 'allowed', 'Reviewed as non-sexual relationship content'),
  ('1f5e0000-0000-4000-8000-100000000002', 'Make Me Laugh', 'Silly challenges for a shared laugh.', '😄', false, true, false, 20, 1, 2, 1.33, 'allowed', 'Reviewed as non-sexual relationship content'),
  ('1f5e0000-0000-4000-8000-100000000003', 'Sweet & Romantic', 'Thoughtful dares for feeling close.', '💕', false, true, false, 30, 1, 2, 1.80, 'allowed', 'Reviewed as non-sexual romantic content'),
  ('1f5e0000-0000-4000-8000-100000000004', 'Surprise Me', 'Plan a little surprise for your partner.', '🎁', true, true, false, 40, 1, 2, 1.80, 'allowed', 'Reviewed as non-sexual relationship content'),
  ('1f5e0000-0000-4000-8000-100000000005', 'Flirty Messages', 'Private messages with a little spark.', '💬', true, false, false, 50, 2, 3, 2.47, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-100000000006', 'Long-Distance Heat', 'Private dares for partners apart.', '📱', true, false, true, 60, 2, 3, 2.67, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-100000000007', 'Risky Photos & Audio', 'Private photo and audio dares.', '📸', true, false, true, 70, 3, 4, 3.53, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-100000000008', 'Hands On', 'Private in-person intimacy dares.', '🫶', true, false, true, 80, 3, 4, 3.40, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-100000000009', 'After Dark', 'Private adult intimacy dares.', '🌙', true, false, true, 90, 4, 4, 4.00, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-100000000010', 'Power Play', 'Private adult power-play dares.', '🔒', true, false, true, 100, 5, 5, 5.00, 'unreviewed', 'Private mature editorial inventory')
), upsert AS (
  INSERT INTO dare_packs (
    id, name, description, icon, is_premium, is_public, is_explicit, sort_order,
    min_intensity, max_intensity, avg_intensity, content_status, content_review_reason,
    content_reviewed_at
  )
  SELECT id::uuid, name, description, icon, is_premium, is_public, is_explicit, sort_order,
         min_intensity, max_intensity, avg_intensity::numeric(3, 2),
         content_status::content_review_status, content_review_reason,
         CASE WHEN content_status = 'allowed' THEN '2026-09-05T16:00:00Z'::timestamptz END
    FROM seed
  ON CONFLICT (id) DO UPDATE SET id = dare_packs.id
    WHERE (dare_packs.name, dare_packs.description, dare_packs.icon,
           dare_packs.is_premium, dare_packs.is_public, dare_packs.is_explicit,
           dare_packs.sort_order, dare_packs.category_id, dare_packs.min_intensity,
           dare_packs.max_intensity, dare_packs.avg_intensity, dare_packs.content_status,
           dare_packs.content_review_reason, dare_packs.content_reviewed_at,
           dare_packs.content_reviewed_by)
      IS NOT DISTINCT FROM
          (EXCLUDED.name, EXCLUDED.description, EXCLUDED.icon, EXCLUDED.is_premium,
           EXCLUDED.is_public, EXCLUDED.is_explicit, EXCLUDED.sort_order,
           EXCLUDED.category_id, EXCLUDED.min_intensity, EXCLUDED.max_intensity,
           EXCLUDED.avg_intensity, EXCLUDED.content_status,
           EXCLUDED.content_review_reason, EXCLUDED.content_reviewed_at,
           EXCLUDED.content_reviewed_by)
  RETURNING id
)
SELECT CASE WHEN (SELECT count(*) FROM upsert) = (SELECT count(*) FROM seed)
            THEN 1 ELSE (SELECT 1 / (count(*) - count(*)) FROM upsert) END;
--> statement-breakpoint

WITH seed (id, pack_id, text, intensity, content_status, content_review_reason) AS (VALUES
  -- Little Things
  ('1f5e0000-0000-4000-8000-000000000001', '1f5e0000-0000-4000-8000-100000000001', 'Send your partner a photo of something that reminded you of them.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000002', '1f5e0000-0000-4000-8000-100000000001', 'Hide a short note somewhere your partner will unexpectedly find it.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000003', '1f5e0000-0000-4000-8000-100000000001', 'Bring your partner their favourite snack without asking what they want.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000004', '1f5e0000-0000-4000-8000-100000000001', 'Take over the household job your partner hates most.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000005', '1f5e0000-0000-4000-8000-100000000001', 'Make your partner a drink exactly how they like it.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000006', '1f5e0000-0000-4000-8000-100000000001', 'Send your partner a compliment that has nothing to do with their appearance.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000007', '1f5e0000-0000-4000-8000-100000000001', 'Give your partner a proper uninterrupted hug.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000008', '1f5e0000-0000-4000-8000-100000000001', 'Choose a shared photo and tell your partner why you still love that moment.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000009', '1f5e0000-0000-4000-8000-100000000001', 'Make your partner a three-song playlist for their current mood.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000010', '1f5e0000-0000-4000-8000-100000000001', 'Leave your partner a voice note they can replay when they are having a bad day.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000011', '1f5e0000-0000-4000-8000-100000000001', 'Give your partner a homemade voucher for one chore-free evening.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000012', '1f5e0000-0000-4000-8000-100000000001', 'Put your phone away and give your partner your full attention for thirty minutes.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000013', '1f5e0000-0000-4000-8000-100000000001', 'Tell your partner about the first moment you realised they were special.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000014', '1f5e0000-0000-4000-8000-100000000001', 'Fix one small annoyance your partner has been putting off.', 1, 'allowed', 'Reviewed with Little Things pack'),
  ('1f5e0000-0000-4000-8000-000000000015', '1f5e0000-0000-4000-8000-100000000001', 'Let your partner choose what you watch, play, or listen to together.', 1, 'allowed', 'Reviewed with Little Things pack'),
  -- Make Me Laugh
  ('1f5e0000-0000-4000-8000-000000000016', '1f5e0000-0000-4000-8000-100000000002', 'Send your partner the worst selfie you can take.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000017', '1f5e0000-0000-4000-8000-100000000002', 'Record a ten-second impression of your partner.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000018', '1f5e0000-0000-4000-8000-100000000002', 'Draw your partner from memory and send them the result.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000019', '1f5e0000-0000-4000-8000-100000000002', 'Make a meme about your relationship.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000020', '1f5e0000-0000-4000-8000-100000000002', 'Send your partner your cheesiest pickup line.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000021', '1f5e0000-0000-4000-8000-100000000002', 'Invent a ridiculous new nickname for your partner and use it until the dare expires.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000022', '1f5e0000-0000-4000-8000-100000000002', 'Record a dramatic advert explaining why someone should date your partner.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000023', '1f5e0000-0000-4000-8000-100000000002', 'Tell your partner a painfully bad joke without laughing.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000024', '1f5e0000-0000-4000-8000-100000000002', 'Recreate one of your partner''s photos as badly as possible.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000025', '1f5e0000-0000-4000-8000-100000000002', 'Describe your relationship using only five emojis.', 1, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000026', '1f5e0000-0000-4000-8000-100000000002', 'Perform a thirty-second dance chosen by your partner.', 2, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000027', '1f5e0000-0000-4000-8000-100000000002', 'Wear a ridiculous accessory until your partner releases you from the dare.', 2, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000028', '1f5e0000-0000-4000-8000-100000000002', 'Serenade your partner with the least romantic song you can find.', 2, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000029', '1f5e0000-0000-4000-8000-100000000002', 'Send your partner an embarrassing but harmless confession.', 2, 'allowed', 'Reviewed with Make Me Laugh pack'),
  ('1f5e0000-0000-4000-8000-000000000030', '1f5e0000-0000-4000-8000-100000000002', 'Act out how you behaved on your first date.', 2, 'allowed', 'Reviewed with Make Me Laugh pack'),
  -- Sweet & Romantic
  ('1f5e0000-0000-4000-8000-000000000031', '1f5e0000-0000-4000-8000-100000000003', 'Write your partner a love note by hand.', 1, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000032', '1f5e0000-0000-4000-8000-100000000003', 'Send your partner a song that says what you struggle to put into words.', 1, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000033', '1f5e0000-0000-4000-8000-100000000003', 'Tell your partner three small things they do that make your life better.', 1, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000034', '1f5e0000-0000-4000-8000-100000000003', 'Plan an at-home date and keep the details secret.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000035', '1f5e0000-0000-4000-8000-100000000003', 'Give your partner a slow dance without waiting for the perfect song.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000036', '1f5e0000-0000-4000-8000-100000000003', 'Recreate one detail from your first date together.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000037', '1f5e0000-0000-4000-8000-100000000003', 'Kiss your partner like you have not seen them for a month.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000038', '1f5e0000-0000-4000-8000-100000000003', 'Send your partner a voice note describing your favourite memory of them.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000039', '1f5e0000-0000-4000-8000-100000000003', 'Prepare your partner''s side of the bed exactly how they like it.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000040', '1f5e0000-0000-4000-8000-100000000003', 'Give your partner five kisses, each in a different place.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000041', '1f5e0000-0000-4000-8000-100000000003', 'Tell your partner the quality you find most attractive in them.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000042', '1f5e0000-0000-4000-8000-100000000003', 'Plan a mystery date and give your partner only one clue.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000043', '1f5e0000-0000-4000-8000-100000000003', 'Give your partner a compliment they will still remember next week.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000044', '1f5e0000-0000-4000-8000-100000000003', 'Read your partner a message you sent during the early days of your relationship.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  ('1f5e0000-0000-4000-8000-000000000045', '1f5e0000-0000-4000-8000-100000000003', 'Give your partner ten minutes of affection without looking at either of your phones.', 2, 'allowed', 'Reviewed with Sweet & Romantic pack'),
  -- Surprise Me
  ('1f5e0000-0000-4000-8000-000000000046', '1f5e0000-0000-4000-8000-100000000004', 'Leave your partner''s favourite treat somewhere they will discover it.', 1, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000047', '1f5e0000-0000-4000-8000-100000000004', 'Complete one job your partner expects to do themselves.', 1, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000048', '1f5e0000-0000-4000-8000-100000000004', 'Send your partner an unexpected food delivery.', 1, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000049', '1f5e0000-0000-4000-8000-100000000004', 'Arrange a mystery date and tell your partner only when to be ready.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000050', '1f5e0000-0000-4000-8000-100000000004', 'Hide three clues leading your partner to a small surprise.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000051', '1f5e0000-0000-4000-8000-100000000004', 'Take your partner somewhere neither of you has visited before.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000052', '1f5e0000-0000-4000-8000-100000000004', 'Give your partner flowers or their preferred equivalent for no particular reason.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000053', '1f5e0000-0000-4000-8000-100000000004', 'Send your partner coordinates and ask them to meet you there.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000054', '1f5e0000-0000-4000-8000-100000000004', 'Create a playlist that reveals what you have planned.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000055', '1f5e0000-0000-4000-8000-100000000004', 'Recreate your partner''s ideal lazy morning.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000056', '1f5e0000-0000-4000-8000-100000000004', 'Put together a date using only things already in your home.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000057', '1f5e0000-0000-4000-8000-100000000004', 'Choose an outfit for your partner from clothes they already own.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000058', '1f5e0000-0000-4000-8000-100000000004', 'Give your partner an envelope they are not allowed to open until the dare expires.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000059', '1f5e0000-0000-4000-8000-100000000004', 'Arrange a surprise based on something your partner mentioned weeks ago.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  ('1f5e0000-0000-4000-8000-000000000060', '1f5e0000-0000-4000-8000-100000000004', 'Turn an ordinary meal into a date without warning your partner first.', 2, 'allowed', 'Reviewed with Surprise Me pack'),
  -- Flirty Messages
  ('1f5e0000-0000-4000-8000-000000000061', '1f5e0000-0000-4000-8000-100000000005', 'Send your partner three messages that become progressively flirtier.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000062', '1f5e0000-0000-4000-8000-100000000005', 'Record yourself saying your partner''s name in the most seductive way you can.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000063', '1f5e0000-0000-4000-8000-100000000005', 'Send your partner a selfie wearing something you know they like.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000064', '1f5e0000-0000-4000-8000-100000000005', 'Tell your partner where you want them to kiss you.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000065', '1f5e0000-0000-4000-8000-100000000005', 'Describe the first thing you notice when your partner enters a room.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000066', '1f5e0000-0000-4000-8000-100000000005', 'Send your partner a compliment you would not say in front of anyone else.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000067', '1f5e0000-0000-4000-8000-100000000005', 'Invent a secret phrase that means you want your partner.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000068', '1f5e0000-0000-4000-8000-100000000005', 'Send your partner a message designed to make them blush.', 2, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000069', '1f5e0000-0000-4000-8000-100000000005', 'Tell your partner what you would do if you were alone together.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000070', '1f5e0000-0000-4000-8000-100000000005', 'Send your partner three words designed to distract them.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000071', '1f5e0000-0000-4000-8000-100000000005', 'Record a voice note telling your partner what you want later.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000072', '1f5e0000-0000-4000-8000-100000000005', 'Send a close-up photo and make your partner guess what they are looking at.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000073', '1f5e0000-0000-4000-8000-100000000005', 'Tell your partner which item of their clothing you most want to remove.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000074', '1f5e0000-0000-4000-8000-100000000005', 'Send your partner one instruction to follow when you next meet.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  ('1f5e0000-0000-4000-8000-000000000075', '1f5e0000-0000-4000-8000-100000000005', 'Describe one fantasy in a single sentence without using vague words.', 3, 'unreviewed', 'Requires line-by-line universal catalogue review'),
  -- Long-Distance Heat
  ('1f5e0000-0000-4000-8000-000000000076', '1f5e0000-0000-4000-8000-100000000006', 'Send your partner a photo showing exactly what you are doing.', 2, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000077', '1f5e0000-0000-4000-8000-100000000006', 'Record a goodnight message your partner will want to replay.', 2, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000078', '1f5e0000-0000-4000-8000-100000000006', 'Plan a video-call date and send your partner a dress code.', 2, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000079', '1f5e0000-0000-4000-8000-100000000006', 'Send your partner a photo of the empty space where you wish they were.', 2, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000080', '1f5e0000-0000-4000-8000-100000000006', 'Order your partner a surprise they can enjoy during your next call.', 2, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000081', '1f5e0000-0000-4000-8000-100000000006', 'Send your partner a risky selfie within the next hour.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000082', '1f5e0000-0000-4000-8000-100000000006', 'Record a voice note telling your partner exactly how much you miss their touch.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000083', '1f5e0000-0000-4000-8000-100000000006', 'Send your partner a photo from bed without adding any explanation.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000084', '1f5e0000-0000-4000-8000-100000000006', 'Describe what you would do if your partner appeared beside you.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000085', '1f5e0000-0000-4000-8000-100000000006', 'Give your partner a private fashion show over video.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000086', '1f5e0000-0000-4000-8000-100000000006', 'Send your partner a sequence of photos that gradually reveal more.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000087', '1f5e0000-0000-4000-8000-100000000006', 'Record yourself whispering what you want your partner to do when you reunite.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000088', '1f5e0000-0000-4000-8000-100000000006', 'Let your partner choose what you wear during your next private call.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000089', '1f5e0000-0000-4000-8000-100000000006', 'Send your partner a photo they can use as their private wallpaper.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000090', '1f5e0000-0000-4000-8000-100000000006', 'End your next call with a promise your partner can hold you to.', 3, 'unreviewed', 'Private mature editorial inventory'),
  -- Risky Photos & Audio
  ('1f5e0000-0000-4000-8000-000000000091', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner a photo captioned "Only for you."', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000092', '1f5e0000-0000-4000-8000-100000000007', 'Take a silhouette photo that leaves your partner guessing.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000093', '1f5e0000-0000-4000-8000-100000000007', 'Record a voice note describing what you are wearing.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000094', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner a photo that reveals just enough to make them curious.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000095', '1f5e0000-0000-4000-8000-100000000007', 'Take a photo from your partner''s favourite angle.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000096', '1f5e0000-0000-4000-8000-100000000007', 'Record a risky audio clip for your partner within the next hour.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000097', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner a photo showing what you plan to wear underneath your clothes.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000098', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner a topless photo they have not seen before.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000099', '1f5e0000-0000-4000-8000-100000000007', 'Record yourself describing exactly what you want your partner to do to you.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000100', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner a nude using lighting or shadows creatively.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000101', '1f5e0000-0000-4000-8000-100000000007', 'Record the sound you make when your partner touches you properly.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000102', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner a short striptease video.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000103', '1f5e0000-0000-4000-8000-100000000007', 'Take a nude photo without showing your face.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000104', '1f5e0000-0000-4000-8000-100000000007', 'Record a video showing your partner how badly you want them.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000105', '1f5e0000-0000-4000-8000-100000000007', 'Send your partner the most explicit photo you are both comfortable keeping.', 4, 'unreviewed', 'Private mature editorial inventory'),
  -- Hands On
  ('1f5e0000-0000-4000-8000-000000000106', '1f5e0000-0000-4000-8000-100000000008', 'Give your partner a ten-minute massage.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000107', '1f5e0000-0000-4000-8000-100000000008', 'Kiss your partner in five places without kissing their lips.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000108', '1f5e0000-0000-4000-8000-100000000008', 'Trace your fingertips over your partner''s body for five minutes.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000109', '1f5e0000-0000-4000-8000-100000000008', 'Sit on your partner''s lap and kiss them slowly.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000110', '1f5e0000-0000-4000-8000-100000000008', 'Blindfold your partner and feed them something they enjoy.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000111', '1f5e0000-0000-4000-8000-100000000008', 'Let your partner choose where you kiss them.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000112', '1f5e0000-0000-4000-8000-100000000008', 'Tease your partner for ten minutes without touching beneath their clothes.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000113', '1f5e0000-0000-4000-8000-100000000008', 'Give your partner a massage and stop exactly when they want more.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000114', '1f5e0000-0000-4000-8000-100000000008', 'Kiss your partner''s neck until they ask you to stop.', 3, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000115', '1f5e0000-0000-4000-8000-100000000008', 'Remove one item of your partner''s clothing using only one hand.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000116', '1f5e0000-0000-4000-8000-100000000008', 'Guide your partner''s hand to where you want it.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000117', '1f5e0000-0000-4000-8000-100000000008', 'Undress your partner as slowly as possible.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000118', '1f5e0000-0000-4000-8000-100000000008', 'Join your partner in the shower.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000119', '1f5e0000-0000-4000-8000-100000000008', 'Kiss your way down your partner''s body and stop just before reaching their most sensitive spot.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000120', '1f5e0000-0000-4000-8000-100000000008', 'Pleasure your partner for ten minutes without letting them return the favour.', 4, 'unreviewed', 'Private mature editorial inventory'),
  -- After Dark
  ('1f5e0000-0000-4000-8000-000000000121', '1f5e0000-0000-4000-8000-100000000009', 'Tell your partner exactly what you want, then do it together if they want it too.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000122', '1f5e0000-0000-4000-8000-100000000009', 'Give your partner oral sex.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000123', '1f5e0000-0000-4000-8000-100000000009', 'Have sex in a position chosen by your partner.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000124', '1f5e0000-0000-4000-8000-100000000009', 'Masturbate while your partner watches.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000125', '1f5e0000-0000-4000-8000-100000000009', 'Watch your partner masturbate without touching them.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000126', '1f5e0000-0000-4000-8000-100000000009', 'Use a sex toy on your partner.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000127', '1f5e0000-0000-4000-8000-100000000009', 'Let your partner use a sex toy on you.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000128', '1f5e0000-0000-4000-8000-100000000009', 'Masturbate together while watching each other.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000129', '1f5e0000-0000-4000-8000-100000000009', 'Blindfold your partner and pleasure them.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000130', '1f5e0000-0000-4000-8000-100000000009', 'Have sex without completely removing your clothes.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000131', '1f5e0000-0000-4000-8000-100000000009', 'Take your partner somewhere private for a quickie.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000132', '1f5e0000-0000-4000-8000-100000000009', 'Act out a fantasy your partner has previously shared with you.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000133', '1f5e0000-0000-4000-8000-100000000009', 'Tell your partner exactly how to touch you while they do it.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000134', '1f5e0000-0000-4000-8000-100000000009', 'Spend twenty minutes pleasuring each other without penetration.', 4, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000135', '1f5e0000-0000-4000-8000-100000000009', 'Make your partner orgasm without using your hands.', 4, 'unreviewed', 'Private mature editorial inventory'),
  -- Power Play
  ('1f5e0000-0000-4000-8000-000000000136', '1f5e0000-0000-4000-8000-100000000010', 'Give your partner three rules to follow until the dare expires.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000137', '1f5e0000-0000-4000-8000-100000000010', 'Kneel in front of your partner and wait for their first instruction.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000138', '1f5e0000-0000-4000-8000-100000000010', 'Let your partner restrain your wrists using an agreed quick-release restraint.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000139', '1f5e0000-0000-4000-8000-100000000010', 'Wear a blindfold and follow three instructions from your partner.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000140', '1f5e0000-0000-4000-8000-100000000010', 'Give your partner an agreed number of strikes using an agreed implement and intensity.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000141', '1f5e0000-0000-4000-8000-100000000010', 'Act as your partner''s submissive for thirty minutes.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000142', '1f5e0000-0000-4000-8000-100000000010', 'Take control of your partner for thirty minutes.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000143', '1f5e0000-0000-4000-8000-100000000010', 'Let your partner choose your outfit, position, and posture.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000144', '1f5e0000-0000-4000-8000-100000000010', 'Send your partner a voice note promising to obey one agreed instruction.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000145', '1f5e0000-0000-4000-8000-100000000010', 'Edge your partner and stop before they orgasm.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000146', '1f5e0000-0000-4000-8000-100000000010', 'Let your partner decide when you are allowed to orgasm.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000147', '1f5e0000-0000-4000-8000-100000000010', 'Wear a collar or agreed symbol of submission for your partner.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000148', '1f5e0000-0000-4000-8000-100000000010', 'Serve your partner without speaking for thirty minutes.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000149', '1f5e0000-0000-4000-8000-100000000010', 'Let your partner control a remote toy while you remain somewhere private.', 5, 'unreviewed', 'Private mature editorial inventory'),
  ('1f5e0000-0000-4000-8000-000000000150', '1f5e0000-0000-4000-8000-100000000010', 'Finish the dare by giving your partner the aftercare they ask for.', 5, 'unreviewed', 'Private mature editorial inventory')
), upsert AS (
  INSERT INTO dares (
    id, pack_id, text, intensity, content_status, content_review_reason,
    content_reviewed_at
  )
  SELECT id::uuid, pack_id::uuid, text, intensity,
         content_status::content_review_status, content_review_reason,
         CASE WHEN content_status = 'allowed' THEN '2026-09-05T16:00:00Z'::timestamptz END
    FROM seed
  ON CONFLICT (id) DO UPDATE SET id = dares.id
    WHERE (dares.pack_id, dares.text, dares.intensity, dares.suggested_duration_hours,
           dares.content_status, dares.content_review_reason, dares.content_reviewed_at,
           dares.content_reviewed_by)
      IS NOT DISTINCT FROM
          (EXCLUDED.pack_id, EXCLUDED.text, EXCLUDED.intensity,
           EXCLUDED.suggested_duration_hours, EXCLUDED.content_status,
           EXCLUDED.content_review_reason, EXCLUDED.content_reviewed_at,
           EXCLUDED.content_reviewed_by)
  RETURNING id
)
SELECT CASE WHEN (SELECT count(*) FROM upsert) = (SELECT count(*) FROM seed)
            THEN 1 ELSE (SELECT 1 / (count(*) - count(*)) FROM upsert) END;
--> statement-breakpoint

-- A migration has no authenticated human reviewer. Record the system seed as the
-- actor-less, timestamped review decision the schema explicitly permits rather than
-- fabricating a profile UUID. The entries remain durable audit provenance.
WITH seed (id, entity_type, entity_id, previous_status, new_status, reason, created_at) AS (
  SELECT ('2f5e0000-0000-4000-8000-' || right(id::text, 12))::uuid,
         'dare_packs'::content_entity_type, id, 'unreviewed'::content_review_status,
         'allowed'::content_review_status, content_review_reason,
         '2026-09-05T16:00:00Z'::timestamptz
    FROM dare_packs
   WHERE id BETWEEN '1f5e0000-0000-4000-8000-100000000001'::uuid
                AND '1f5e0000-0000-4000-8000-100000000004'::uuid
  UNION ALL
  SELECT ('2f5e0000-0000-4000-8000-' || right(id::text, 12))::uuid,
         'dares'::content_entity_type, id, 'unreviewed'::content_review_status,
         'allowed'::content_review_status, content_review_reason,
         '2026-09-05T16:00:00Z'::timestamptz
    FROM dares
   WHERE id BETWEEN '1f5e0000-0000-4000-8000-000000000001'::uuid
                AND '1f5e0000-0000-4000-8000-000000000060'::uuid
), upsert AS (
  INSERT INTO content_reviews (
    id, entity_type, entity_id, previous_status, new_status, reason, changed_by, created_at
  )
  SELECT id::uuid, entity_type::content_entity_type, entity_id::uuid,
         previous_status::content_review_status, new_status::content_review_status,
         reason, null::uuid, created_at::timestamptz
    FROM seed
  ON CONFLICT (id) DO UPDATE SET id = content_reviews.id
    WHERE (content_reviews.entity_type, content_reviews.entity_id,
           content_reviews.previous_status, content_reviews.new_status,
           content_reviews.reason, content_reviews.changed_by,
           content_reviews.created_at)
      IS NOT DISTINCT FROM
          (EXCLUDED.entity_type, EXCLUDED.entity_id, EXCLUDED.previous_status,
           EXCLUDED.new_status, EXCLUDED.reason, EXCLUDED.changed_by,
           EXCLUDED.created_at)
  RETURNING id
)
SELECT CASE WHEN (SELECT count(*) FROM upsert) = (SELECT count(*) FROM seed)
            THEN 1 ELSE (SELECT 1 / (count(*) - count(*)) FROM upsert) END;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM content_reviews r
     WHERE (r.entity_type = 'dare_packs' AND r.entity_id BETWEEN '1f5e0000-0000-4000-8000-100000000001'::uuid AND '1f5e0000-0000-4000-8000-100000000004'::uuid)
        OR (r.entity_type = 'dares' AND r.entity_id BETWEEN '1f5e0000-0000-4000-8000-000000000001'::uuid AND '1f5e0000-0000-4000-8000-000000000060'::uuid)
     GROUP BY r.entity_type, r.entity_id
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'catalogue seed review provenance is not one-to-one';
  END IF;

  IF EXISTS (
    WITH expected (id, entity_type, entity_id, reason) AS (
      SELECT ('2f5e0000-0000-4000-8000-' || right(id::text, 12))::uuid,
             'dare_packs'::content_entity_type, id, content_review_reason
        FROM dare_packs
       WHERE id BETWEEN '1f5e0000-0000-4000-8000-100000000001'::uuid
                    AND '1f5e0000-0000-4000-8000-100000000004'::uuid
      UNION ALL
      SELECT ('2f5e0000-0000-4000-8000-' || right(id::text, 12))::uuid,
             'dares'::content_entity_type, id, content_review_reason
        FROM dares
       WHERE id BETWEEN '1f5e0000-0000-4000-8000-000000000001'::uuid
                    AND '1f5e0000-0000-4000-8000-000000000060'::uuid
    )
    SELECT 1
      FROM expected e
      LEFT JOIN content_reviews r
        ON r.entity_type = e.entity_type AND r.entity_id = e.entity_id
     WHERE (r.id, r.previous_status, r.new_status, r.reason, r.changed_by,
            r.created_at)
       IS DISTINCT FROM
           (e.id, 'unreviewed'::content_review_status,
            'allowed'::content_review_status, e.reason, null::uuid,
            '2026-09-05T16:00:00Z'::timestamptz)
  ) THEN
    RAISE EXCEPTION 'catalogue seed review provenance does not match the system seed';
  END IF;
END $$;
