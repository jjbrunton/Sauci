export interface TextResponseData {
    type: 'text_answer';
    text: string;
}

export interface PhotoResponseData {
    type: 'photo';
    media_path: string;
}

export interface AudioResponseData {
    type: 'audio';
    media_path: string;
    duration_seconds: number;
}

export interface WhoLikelyResponseData {
    type: 'who_likely';
    chosen_user_id: string;
}

export type ResponseData = TextResponseData | PhotoResponseData | AudioResponseData | WhoLikelyResponseData;

export interface DailyLimitInfo {
    responses_today: number;
    limit_value: number;
    remaining: number;
    reset_at: string;
    is_blocked: boolean;
}

export interface PackInfo {
    name: string;
    icon: string;
    color?: string;
}
