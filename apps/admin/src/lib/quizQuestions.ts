// Quiz question options are constrained by the database check
// `array_length(options, 1) between 2 and 4` (see
// apps/api/drizzle/0019_quiz.sql). These helpers keep the admin form
// validation consistent with that constraint.

export const MIN_QUIZ_OPTIONS = 2;
export const MAX_QUIZ_OPTIONS = 4;

export interface QuizQuestionFormValues {
    prompt_self: string;
    prompt_guess: string;
    options: string[];
}

/** Trim options and drop any that are empty. */
export function sanitizeQuizOptions(options: string[]): string[] {
    return options.map((option) => option.trim()).filter(Boolean);
}

/**
 * Validate a quiz question form. Returns an error message, or null when the
 * form is valid.
 */
export function validateQuizQuestionForm(form: QuizQuestionFormValues): string | null {
    if (!form.prompt_self.trim()) return 'The "about yourself" prompt is required';
    if (!form.prompt_guess.trim()) return 'The "about your partner" prompt is required';
    const cleanedOptions = sanitizeQuizOptions(form.options);
    if (cleanedOptions.length < MIN_QUIZ_OPTIONS) return `At least ${MIN_QUIZ_OPTIONS} options are required`;
    if (cleanedOptions.length > MAX_QUIZ_OPTIONS) return `At most ${MAX_QUIZ_OPTIONS} options are allowed`;
    return null;
}
