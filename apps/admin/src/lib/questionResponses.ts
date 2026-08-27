import type { AnswerType, QuestionType } from '@sauci/shared';

export type AdminResponseData =
    | { type: 'text_answer'; text: string }
    | { type: 'audio'; media_path: string; duration_seconds: number }
    | { type: 'photo'; media_path: string }
    | { type: 'who_likely'; chosen_user_id: string }
    | Record<string, unknown>
    | null;

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
    swipe: 'Swipe',
    text_answer: 'Text answer',
    audio: 'Audio',
    photo: 'Photo',
    who_likely: 'Who is more likely',
};

export const MATCH_TYPE_LABELS = {
    yes_yes: 'Both Yes!',
    yes_maybe: 'Yes + Maybe',
    maybe_maybe: 'Both Maybe',
    both_answered: 'Both Answered',
} as const;

export function resolveQuestionType(questionType?: QuestionType | null): QuestionType {
    return questionType ?? 'swipe';
}

export function formatAdminResponse(
    questionType: QuestionType | null | undefined,
    answer: AnswerType,
    responseData: AdminResponseData,
    context?: { responderId?: string; responderName?: string | null },
): { label: string; detail: string | null } {
    const resolvedType = resolveQuestionType(questionType);

    if (resolvedType === 'swipe') {
        return {
            label: answer.charAt(0).toUpperCase() + answer.slice(1),
            detail: null,
        };
    }

    if (resolvedType === 'text_answer') {
        const text = responseData && 'text' in responseData && typeof responseData.text === 'string'
            ? responseData.text.trim()
            : '';
        return { label: 'Text submitted', detail: text || null };
    }

    if (resolvedType === 'audio') {
        const duration = responseData && 'duration_seconds' in responseData
            && typeof responseData.duration_seconds === 'number'
            ? Math.max(0, Math.round(responseData.duration_seconds))
            : null;
        return {
            label: 'Audio submitted',
            detail: duration === null ? null : `${duration}s recording`,
        };
    }

    if (resolvedType === 'photo') {
        return { label: 'Photo submitted', detail: null };
    }

    const chosenUserId = responseData && 'chosen_user_id' in responseData
        && typeof responseData.chosen_user_id === 'string'
        ? responseData.chosen_user_id
        : null;
    const choseSelf = chosenUserId && context?.responderId
        ? chosenUserId === context.responderId
        : null;

    if (choseSelf === true) {
        return {
            label: 'Chose themselves',
            detail: context?.responderName ? `${context.responderName} chose themselves` : null,
        };
    }

    if (choseSelf === false) {
        return {
            label: 'Chose their partner',
            detail: context?.responderName ? `${context.responderName} chose their partner` : null,
        };
    }

    return { label: 'Choice submitted', detail: null };
}
