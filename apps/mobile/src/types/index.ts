// User profile (extends Supabase auth.users)
export type Gender = 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
export type IntensityLevel = 1 | 2 | 3 | 4 | 5;

export interface Profile {
    id: string;
    name: string | null;
    email: string | null;
    avatar_url: string | null;
    push_token: string | null;
    is_premium: boolean;
    couple_id: string | null;
    gender: Gender | null;
    show_explicit_content: boolean;
    max_intensity: IntensityLevel;
    onboarding_completed: boolean;
    created_at: string;
    updated_at: string;
    /** RSA public key for E2EE (JWK format) */
    public_key_jwk?: Record<string, unknown> | null;
}

// Couple pairing
export interface Couple {
    id: string;
    invite_code: string;
    created_at: string;
}

// Category for grouping packs
export interface Category {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    sort_order: number;
    created_at: string;
    is_public: boolean;
}


// Question pack
export interface QuestionPack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_premium: boolean;
    is_public: boolean;
    is_explicit: boolean;
    min_intensity?: number;
    max_intensity?: number;
    avg_intensity?: number;
    sort_order: number;
    category_id: string | null;
    category?: Category;
    questions?: { count: number }[];
    created_at: string;
}

// Individual question
export interface Question {
    id: string;
    pack_id: string;
    text: string;
    partner_text?: string | null;
    intensity: 1 | 2 | 3 | 4 | 5;
    allowed_couple_genders?: string[] | null;
    target_user_genders?: string[] | null;
    created_at: string;
}

// User's answer type
export type AnswerType = 'yes' | 'no' | 'maybe';

// Match type when both partners agree
export type MatchType = 'yes_yes' | 'yes_maybe' | 'maybe_maybe';

// User response to a question
export interface Response {
    id: string;
    user_id: string;
    question_id: string;
    couple_id: string;
    answer: AnswerType;
    created_at: string;
}

// Match between partners
export interface Match {
    id: string;
    couple_id: string;
    question_id: string;
    match_type: MatchType;
    is_new: boolean;
    created_at: string;
    unreadCount?: number;
}

// Extended match with question details
export interface MatchWithQuestion extends Match {
    question: Question;
}

// Match archive (per-user)
export interface MatchArchive {
    id: string;
    match_id: string;
    user_id: string;
    archived_at: string;
}

// Pack with progress info
export interface PackProgress {
    pack: QuestionPack;
    total_questions: number;
    answered_questions: number;
    matches_count: number;
}

// Feedback types
export type FeedbackType = 'bug' | 'feature_request' | 'general' | 'question';
export type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'closed';

export interface DeviceInfo {
    platform: 'ios' | 'android' | 'web';
    osVersion: string;
    appVersion: string;
    buildNumber?: string;
    deviceModel?: string;
    screenWidth: number;
    screenHeight: number;
}

export interface Feedback {
    id: string;
    user_id: string;
    type: FeedbackType;
    title: string;
    description: string;
    screenshot_url: string | null;
    device_info: DeviceInfo;
    status: FeedbackStatus;
    admin_notes: string | null;
    question_id: string | null;
    created_at: string;
    updated_at: string;
}

// Subscription types
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'billing_issue' | 'paused';

export interface Subscription {
    id: string;
    user_id: string;
    revenuecat_app_user_id: string;
    product_id: string;
    status: SubscriptionStatus;
    entitlement_ids: string[];
    purchased_at: string;
    expires_at: string | null;
    original_transaction_id: string;
    store: string;
    is_sandbox: boolean;
    cancel_reason: string | null;
    grace_period_expires_at: string | null;
    created_at: string;
    updated_at: string;
}
