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
    /** RSA public key in JWK format for E2EE */
    public_key_jwk?: Record<string, unknown> | null;
    /** When true, packs marked as is_explicit will be hidden */
    hide_nsfw?: boolean;
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
    required_props?: string[] | null;
    /** References the primary question that this is an inverse of (e.g., give vs receive). NULL means this is a primary/standalone question. */
    inverse_of?: string | null;
    created_at: string;
    deleted_at?: string | null;
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

// E2EE Keys Metadata for encrypted messages
export interface KeysMetadata {
    /** AES key encrypted with sender's RSA public key (base64) */
    sender_wrapped_key: string;
    /** AES key encrypted with recipient's RSA public key (base64) */
    recipient_wrapped_key?: string;
    /** AES key encrypted with admin's RSA public key (base64) */
    admin_wrapped_key: string;
    /** UUID of the master_keys record used */
    admin_key_id: string;
    /** Symmetric encryption algorithm */
    algorithm: 'AES-256-GCM';
    /** Key wrapping algorithm */
    key_wrap_algorithm: 'RSA-OAEP-SHA256';
    /** True if recipient key needs to be added */
    pending_recipient?: boolean;
}

// Chat message
export interface Message {
    id: string;
    match_id: string;
    user_id: string;
    content: string | null;
    created_at: string;
    read_at: string | null;
    delivered_at: string | null;
    media_path: string | null;
    media_type: 'image' | 'video' | null;
    media_expires_at: string | null;
    media_expired: boolean;
    media_viewed_at: string | null;
    /** Encryption version: 1 = plaintext (legacy), 2 = E2EE */
    version: number | null;
    /** Encrypted message content (base64, for v2 messages) */
    encrypted_content: string | null;
    /** Initialization vector for AES-GCM (base64, for v2 messages) */
    encryption_iv: string | null;
    /** Triple-wrapped encryption keys metadata (for v2 messages) */
    keys_metadata: KeysMetadata | null;
    /** Content moderation status: safe, flagged, unmoderated */
    moderation_status?: 'safe' | 'flagged' | 'unmoderated' | null;
    /** Reason for flagging */
    flag_reason?: string | null;
    /** Content category: Neutral, Romantic, Playful, Explicit, etc. */
    category?: 'Neutral' | 'Romantic' | 'Playful' | 'Explicit' | string | null;
}

// Match archive (per-user)
export interface MatchArchive {
    id: string;
    match_id: string;
    user_id: string;
    archived_at: string;
}

// Master key for admin E2EE access
export interface MasterKey {
    id: string;
    key_name: string;
    public_key_jwk: Record<string, unknown>;
    is_active: boolean;
    created_at: string;
    rotated_at: string | null;
}
