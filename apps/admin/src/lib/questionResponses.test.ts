import { describe, expect, it } from 'vitest';
import { formatAdminResponse, MATCH_TYPE_LABELS, resolveQuestionType } from './questionResponses';

describe('admin question response formatting', () => {
    it('keeps legacy questions compatible with swipe answers', () => {
        expect(resolveQuestionType(null)).toBe('swipe');
        expect(formatAdminResponse(null, 'maybe', null)).toEqual({ label: 'Maybe', detail: null });
    });

    it('shows typed response details without exposing media storage paths', () => {
        expect(formatAdminResponse('text_answer', 'yes', { type: 'text_answer', text: '  My answer  ' }))
            .toEqual({ label: 'Text submitted', detail: 'My answer' });
        expect(formatAdminResponse('audio', 'yes', {
            type: 'audio',
            media_path: 'private/user/audio.m4a',
            duration_seconds: 12.6,
        })).toEqual({ label: 'Audio submitted', detail: '13s recording' });
        expect(formatAdminResponse('photo', 'yes', {
            type: 'photo',
            media_path: 'private/user/photo.jpg',
        })).toEqual({ label: 'Photo submitted', detail: null });
    });

    it('labels non-swipe matches', () => {
        expect(MATCH_TYPE_LABELS.both_answered).toBe('Both Answered');
    });

    it('shows who was chosen without exposing user identifiers', () => {
        expect(formatAdminResponse(
            'who_likely',
            'yes',
            { type: 'who_likely', chosen_user_id: 'user-1' },
            { responderId: 'user-1', responderName: 'Alex' },
        )).toEqual({ label: 'Chose themselves', detail: 'Alex chose themselves' });

        expect(formatAdminResponse(
            'who_likely',
            'yes',
            { type: 'who_likely', chosen_user_id: 'user-2' },
            { responderId: 'user-1', responderName: 'Alex' },
        )).toEqual({ label: 'Chose their partner', detail: 'Alex chose their partner' });
    });
});
