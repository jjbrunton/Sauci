ALTER TABLE ai_config
ADD COLUMN default_temperature float,
ADD COLUMN temperature_generate float,
ADD COLUMN temperature_fix float,
ADD COLUMN temperature_polish float,
ADD COLUMN council_reviewer_temperature float,
ADD COLUMN classifier_temperature float;
