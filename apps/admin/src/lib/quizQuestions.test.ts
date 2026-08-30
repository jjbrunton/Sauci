import { describe, expect, it } from 'vitest';
import { sanitizeQuizOptions, validateQuizQuestionForm } from './quizQuestions';

describe('sanitizeQuizOptions', () => {
    it('trims and drops empty options', () => {
        expect(sanitizeQuizOptions([' A ', '', '  ', 'B'])).toEqual(['A', 'B']);
    });
});

describe('validateQuizQuestionForm', () => {
    const base = {
        prompt_self: 'What is your favourite season?',
        prompt_guess: "What is your partner's favourite season?",
        options: ['Spring', 'Summer'],
    };

    it('accepts a valid form', () => {
        expect(validateQuizQuestionForm(base)).toBeNull();
    });

    it('requires the self prompt', () => {
        expect(validateQuizQuestionForm({ ...base, prompt_self: '  ' })).toMatch(/about yourself/);
    });

    it('requires the guess prompt', () => {
        expect(validateQuizQuestionForm({ ...base, prompt_guess: '' })).toMatch(/about your partner/);
    });

    it('requires at least two options', () => {
        expect(validateQuizQuestionForm({ ...base, options: ['Only one'] })).toMatch(/At least 2 options/);
    });

    it('allows at most four options', () => {
        expect(validateQuizQuestionForm({ ...base, options: ['A', 'B', 'C', 'D', 'E'] })).toMatch(/At most 4 options/);
    });

    it('ignores blank options when counting', () => {
        expect(validateQuizQuestionForm({ ...base, options: ['Spring', 'Summer', '', ''] })).toBeNull();
    });
});
