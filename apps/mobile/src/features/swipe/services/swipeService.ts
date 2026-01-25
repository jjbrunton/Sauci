import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";

import { supabase } from "../../../lib/supabase";
import type { DailyLimitInfo } from "../types";

export const fetchPackContext = async (packId: string) => {
    const { data, error } = await supabase
        .from('question_packs')
        .select('name, icon')
        .eq('id', packId)
        .single();

    if (error) {
        throw error;
    }

    return data ? { name: data.name, icon: data.icon || 'layers' } : null;
};

export const fetchRecommendedQuestions = async (packId?: string) => {
    const { data, error } = await supabase.rpc("get_recommended_questions", {
        target_pack_id: packId || null,
    });

    if (error) {
        throw error;
    }

    return data ?? [];
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
    const { data: coupleProfiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("couple_id", coupleId)
        .neq("id", userId);

    const partnerId = coupleProfiles?.[0]?.id;
    if (!partnerId) {
        return [];
    }

    const { data: userResponses } = await supabase
        .from("responses")
        .select("question_id")
        .eq("user_id", userId)
        .eq("couple_id", coupleId);

    const answeredQuestionIds = new Set(userResponses?.map(r => r.question_id) ?? []);

    const { data: partnerResponses, error } = await supabase
        .from("responses")
        .select(`
            id,
            question_id,
            created_at,
            question:questions(
                *,
                pack:question_packs(id, name, icon)
            )
        `)
        .eq("user_id", partnerId)
        .eq("couple_id", coupleId)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    const pendingQuestions = (partnerResponses ?? [])
        .filter(r => {
            const question = r.question as any;
            return !answeredQuestionIds.has(r.question_id) && question && !question.deleted_at;
        })
        .map(r => {
            const question = r.question as any;
            return {
                ...question,
                pack_id: question.pack?.id,
                pack_name: question.pack?.name,
                pack_icon: question.pack?.icon,
            };
        });

    if (startQuestionId && pendingQuestions.length > 0) {
        const startIndex = pendingQuestions.findIndex(q => q.id === startQuestionId);
        if (startIndex !== -1) {
            const tappedQuestion = pendingQuestions[startIndex];
            const rest = pendingQuestions.filter((_, i) => i !== startIndex);
            return [tappedQuestion, ...rest];
        }
    }

    return pendingQuestions;
};

export const fetchAnswerGapStatus = async () => {
    const { data, error } = await supabase.rpc('get_answer_gap_status');

    if (error) {
        throw error;
    }

    return data?.[0] ?? null;
};

export const fetchDailyLimitStatus = async () => {
    const { data, error } = await supabase.rpc('get_daily_response_limit_status');

    if (error) {
        throw error;
    }

    return data?.[0] as DailyLimitInfo | undefined;
};

export const uploadResponseMedia = async (
    localUri: string,
    questionId: string,
    mediaType: 'photo' | 'audio',
    userId: string
): Promise<string | null> => {
    try {
        const timestamp = Date.now();
        const extMatch = localUri.match(/\.(\w+)$/);
        const ext = extMatch ? extMatch[1] : (mediaType === 'photo' ? 'jpg' : 'm4a');
        const fileName = `${userId}/${questionId}_${timestamp}.${ext}`;
        const contentType = mediaType === 'photo'
            ? `image/${ext === 'jpg' ? 'jpeg' : ext}`
            : `audio/${ext}`;

        let fileBody: ArrayBuffer | Blob;

        if (Platform.OS === 'web') {
            const response = await fetch(localUri);
            fileBody = await response.blob();
        } else {
            const base64 = await FileSystem.readAsStringAsync(localUri, {
                encoding: FileSystem.EncodingType.Base64,
            });
            fileBody = decode(base64);
        }

        const { error } = await supabase.storage
            .from('response-media')
            .upload(fileName, fileBody, { contentType });

        if (error) {
            console.error('Media upload error:', error);
            return null;
        }

        return fileName;
    } catch (error) {
        console.error('Media upload failed:', error);
        return null;
    }
};
