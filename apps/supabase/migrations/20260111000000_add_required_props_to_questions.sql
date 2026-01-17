ALTER TABLE public.questions
ADD COLUMN required_props TEXT[];
COMMENT ON COLUMN public.questions.required_props IS
'Array of props/accessories required to perform the activity.';
