// User profile (extends Supabase auth.users)
export interface Profile {
    id: string;
    name: string | null;
    avatar_url: string | null;
    push_token: string | null;
    is_premium: boolean;
    couple_id: string | null;
    created_at: string;
    updated_at: string;
}

// Couple pairing
export interface Couple {
    id: string;
    invite_code: string;
    created_at: string;
}

// Question pack
export interface QuestionPack {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    is_premium: boolean;
    is_public: boolean;
    sort_order: number;
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
}

// Extended match with question details
export interface MatchWithQuestion extends Match {
    question: Question;
}

// Pack with progress info
export interface PackProgress {
    pack: QuestionPack;
    total_questions: number;
    answered_questions: number;
    matches_count: number;
}
