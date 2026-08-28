import { uploadMedia } from "../../../lib/mediaApi";
import { apiClient } from "../../../lib/apiClient";
import { appDataApi } from "../../../lib/appDataApi";
import type { DailyLimitInfo } from "../types";

export const fetchPackContext = async (packId: string) => {
    const { pack } = await appDataApi.packContext(packId);
    return { name: pack.name, icon: pack.icon || 'layers' };
};

export const fetchRecommendedQuestions = async (packId?: string) => {
    const query = packId ? `?packId=${encodeURIComponent(packId)}` : "";
    const data = await apiClient.get<{ questions: any[] }>(`/v1/questions/recommended${query}`);
    return data.questions;
};

export const fetchPendingQuestions = async ({
    userId,
    coupleId,
    startQuestionId,
}: {
    userId: string;
    coupleId: string;
    startQuestionId?: string;
}) => {
    void userId; void coupleId;
    const query = startQuestionId ? `?startQuestionId=${encodeURIComponent(startQuestionId)}` : "";
    const data = await apiClient.get<{ questions: Array<{ question: any }> }>(`/v1/questions/pending${query}`);
    return data.questions.map(({ question }) => ({ ...question, pack_name: question.pack?.name, pack_icon: question.pack?.icon }));
};

export const fetchAnswerGapStatus = async () => {
    return apiClient.get<{ unanswered_by_partner: number; threshold: number; is_blocked: boolean }>('/v1/me/answer-gap');
};

export const fetchDailyLimitStatus = async () => {
    return apiClient.get<DailyLimitInfo>('/v1/me/daily-limit');
};

export const uploadResponseMedia = async (
    localUri: string,
    questionId: string,
    mediaType: 'photo' | 'audio',
    userId: string
): Promise<string | null> => {
    try {
        const extMatch = localUri.match(/\.(\w+)$/);
        const ext = extMatch ? extMatch[1] : (mediaType === 'photo' ? 'jpg' : 'm4a');
        const contentType = mediaType === 'photo'
            ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
            : `audio/${ext}`;

        void userId;
        return (await uploadMedia(localUri, { kind: 'response', mimeType: contentType, questionId })).reference;
    } catch (error) {
        console.error('Media upload failed:', error);
        return null;
    }
};
