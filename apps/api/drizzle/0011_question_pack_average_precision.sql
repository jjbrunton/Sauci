ALTER TABLE "question_packs"
  ALTER COLUMN "avg_intensity" TYPE numeric(3,2)
  USING "avg_intensity"::numeric(3,2);
