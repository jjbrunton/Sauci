import { beforeEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();

vi.mock('@/hooks/useAiConfig', () => ({
    getCachedAiConfig: () => null,
    preloadAiConfig: vi.fn(),
}));

vi.mock('./client', () => ({
    getOpenAI: () => ({ chat: { completions: { create } } }),
    getModel: () => 'test-model',
    getTemperature: (_purpose?: string, fallback?: number) => fallback ?? 0,
}));

import { SYSTEM_MESSAGES, TONE_INSTRUCTIONS } from './config';
import { analyzeQuestionDeletions } from './analyzers/deletions';
import { describeImage } from './analyzers/media';
import { analyzeQuestionText } from './analyzers/text';
import { generateQuestions } from './generators/questions';
import { polishContent } from './tools/polish';

const prohibitedLegacyPhrases = [
    'adult content is allowed',
    'adult content is expected and acceptable',
    'do not over-sanitize',
    'keep explicit terms',
];

function serializedMessages(): string {
    const request = create.mock.calls[create.mock.calls.length - 1]?.[0];
    return JSON.stringify(request?.messages ?? []).toLowerCase();
}

describe('universal catalogue AI safety ceiling', () => {
    beforeEach(() => {
        create.mockReset();
        create.mockResolvedValue({
            choices: [{ message: { content: '{"polished":"safe","suggestions":[],"deletions":[]}' } }],
        });
    });

    it('keeps every generation level non-explicit', () => {
        for (const level of [1, 2, 3, 4, 5] as const) {
            const instructions = `${TONE_INSTRUCTIONS[level]} ${SYSTEM_MESSAGES[level]}`.toLowerCase();
            expect(instructions).toMatch(/no sexual|not sexual|never sexually explicit/);
        }
    });

    it('does not let the legacy explicit flag weaken polish safety', async () => {
        await polishContent('legacy explicit copy', 'question', true);

        const messages = serializedMessages();
        expect(messages).toContain('legacy explicit flag');
        expect(messages).toContain('universal catalogue safety ceiling');
        for (const phrase of prohibitedLegacyPhrases) expect(messages).not.toContain(phrase);
    });

    it('keeps daring generation and the legacy crude option below the same ceiling', async () => {
        await generateQuestions('Daring connection', 2, 5, undefined, undefined, true);

        const messages = serializedMessages();
        expect(messages).toContain('critical universal safety ceiling');
        expect(messages).toContain('legacy crude-language option');
        expect(messages).toContain('never more explicit content');
    });

    it('does not let the legacy explicit flag weaken text repair safety', async () => {
        await analyzeQuestionText([{ id: 'question-1', text: 'legacy explicit copy' }], true);

        const messages = serializedMessages();
        expect(messages).toContain('legacy explicit flag');
        expect(messages).toContain('universal catalogue safety ceiling');
        for (const phrase of prohibitedLegacyPhrases) expect(messages).not.toContain(phrase);
    });

    it('routes legacy explicit content toward deletion', async () => {
        await analyzeQuestionDeletions([{ id: 'question-1', text: 'legacy explicit copy' }], true);

        const messages = serializedMessages();
        expect(messages).toContain('legacy explicit flag');
        expect(messages).toContain('delete developer-authored sexual acts');
        for (const phrase of prohibitedLegacyPhrases) expect(messages).not.toContain(phrase);
    });

    it('classifies adult imagery as ineligible rather than acceptable', async () => {
        await describeImage('data:image/jpeg;base64,test');

        const messages = serializedMessages();
        expect(messages).toContain('adult_content');
        expect(messages).toContain('not appropriate for publication');
        for (const phrase of prohibitedLegacyPhrases) expect(messages).not.toContain(phrase);
    });
});
