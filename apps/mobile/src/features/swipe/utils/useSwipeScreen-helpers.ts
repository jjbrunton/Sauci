import { getCategoryColor } from "../../../theme";
import type { Category } from "../../../types";
import type { DailyLimitInfo, PackInfo, ResponseData } from "../types";

const supportedQuestionTypes = ["swipe", "text_answer", "photo", "audio", "who_likely"];

interface GapInfoInput {
    unanswered: number;
    threshold: number;
}

interface CountdownState {
    expired: boolean;
    text: string;
}

interface PackLike {
    id: string;
    name: string;
    icon?: string | null;
    category?: Category;
}

interface UploadResponseParams {
    responseData?: ResponseData;
    questionId: string;
    userId?: string;
    setIsUploading: (value: boolean) => void;
    uploadResponseMedia: (mediaPath: string, questionId: string, mediaType: "photo" | "audio", userId: string) => Promise<string | null | undefined>;
}

export const filterSupportedQuestions = (questions: any[]) =>
    questions.filter(question => !question.question_type || supportedQuestionTypes.includes(question.question_type));

export const calculateEffectiveTotal = (
    totalQuestions: number,
    gapInfo: GapInfoInput | null,
    dailyLimitInfo: DailyLimitInfo | null,
    currentIndex: number
) => {
    let total = totalQuestions;

    if (gapInfo && gapInfo.threshold > 0) {
        const remaining = gapInfo.threshold - gapInfo.unanswered;
        total = Math.min(total, currentIndex + Math.max(0, remaining));
    }

    if (dailyLimitInfo && dailyLimitInfo.limit_value > 0 && !dailyLimitInfo.is_blocked) {
        total = Math.min(total, currentIndex + dailyLimitInfo.remaining);
    }

    return total;
};

export const getCountdownState = (resetAt: string): CountdownState => {
    const now = new Date();
    const reset = new Date(resetAt);
    const diff = reset.getTime() - now.getTime();

    if (diff <= 0) {
        return { expired: true, text: "00:00:00" };
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return {
        expired: false,
        text: `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`,
    };
};

export const buildPackInfo = (params: {
    packId?: string;
    packContext: { name: string; icon: string } | null;
    packs: PackLike[];
    question: any;
}): PackInfo | null => {
    const { packId, packContext, packs, question } = params;

    if (packId) {
        const pack = packs.find(item => item.id === packId);
        const categoryColor = pack ? getCategoryColor(pack.category) : undefined;

        if (packContext) {
            return { ...packContext, color: categoryColor };
        }
        if (pack) {
            return { name: pack.name, icon: pack.icon || "layers", color: categoryColor };
        }
    }

    if (question.pack_id) {
        const pack = packs.find(item => item.id === question.pack_id);
        const categoryColor = pack ? getCategoryColor(pack.category) : undefined;

        if (question.pack_name) {
            return {
                name: question.pack_name,
                icon: question.pack_icon || "layers",
                color: categoryColor,
            };
        }

        if (pack) {
            return { name: pack.name, icon: pack.icon || "layers", color: categoryColor };
        }
    }

    return null;
};

export const resolveResponseData = async ({
    responseData,
    questionId,
    userId,
    setIsUploading,
    uploadResponseMedia,
}: UploadResponseParams): Promise<ResponseData | undefined> => {
    if (!responseData || !userId) {
        return responseData;
    }

    if (responseData.type !== "photo" && responseData.type !== "audio") {
        return responseData;
    }

    if (!responseData.media_path) {
        return responseData;
    }

    setIsUploading(true);
    try {
        const uploadedPath = await uploadResponseMedia(responseData.media_path, questionId, responseData.type, userId);
        if (uploadedPath) {
            return { ...responseData, media_path: uploadedPath };
        }
        console.error(`${responseData.type === "photo" ? "Photo" : "Audio"} upload failed, skipping response_data`);
        return undefined;
    } finally {
        setIsUploading(false);
    }
};
