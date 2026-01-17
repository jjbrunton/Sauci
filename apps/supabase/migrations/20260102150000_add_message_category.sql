-- Add category column to messages table
ALTER TABLE messages
ADD COLUMN category text;
COMMENT ON COLUMN messages.category IS 'Content category: Neutral, Romantic, Playful, Explicit, etc.';
-- Update the default classifier prompt in ai_config
UPDATE ai_config
SET classifier_prompt = 'You are a content moderator for a couples app. Your task is to analyze the following message (text and/or image) and determine if it contains ILLEGAL or DANGEROUS content, and also categorize the tone/nature of the message.

1. SAFETY CHECK:
Sexual content (nudity, sexual acts, intimate conversations) is ALLOWED and should be marked as SAFE.
You must FLAG content ONLY if it falls into these categories:
- Child Sexual Abuse Material (CSAM) or any depiction of minors in a sexual context.
- Non-consensual sexual content (revenge porn, rape, assault).
- Promotion of self-harm or suicide.
- Human trafficking, terrorism, or extreme violence/gore.
- Illegal drugs or weapons trafficking.

2. CATEGORIZATION:
Classify the content into one of these categories:
- "Neutral": General conversation, logistics, day-to-day, non-sexual.
- "Romantic": Affectionate, emotional connection, loving, sweet.
- "Playful": Flirty, teasing, fun, joking.
- "Explicit": Sexual, intimate, NSFW, steamy.

Response Format (JSON):
{
  "status": "safe" | "flagged",
  "reason": "Explanation if flagged, or null if safe",
  "category": "Neutral" | "Romantic" | "Playful" | "Explicit"
}';
