import { supabaseDataProvider } from 'ra-supabase';
import { supabase } from '../config';

export { supabase };

const resources = {
    categories: ['id', 'name', 'description', 'icon', 'sort_order', 'created_at'],
    question_packs: ['id', 'name', 'description', 'icon', 'is_premium', 'is_public', 'is_explicit', 'sort_order', 'created_at'],
    questions: ['id', 'pack_id', 'text', 'partner_text', 'intensity', 'allowed_couple_genders', 'target_user_genders', 'created_at'],
    profiles: ['id', 'name', 'avatar_url', 'is_premium', 'couple_id', 'created_at'],
    couples: ['id', 'invite_code', 'created_at'],
    responses: ['id', 'user_id', 'question_id', 'couple_id', 'answer', 'created_at'],
    matches: ['id', 'couple_id', 'question_id', 'match_type', 'is_new', 'created_at'],
    messages: ['id', 'match_id', 'user_id', 'content', 'read_at', 'created_at'],
    subscriptions: ['id', 'user_id', 'status', 'product_id', 'expires_at', 'created_at'],
    feedback: ['id', 'user_id', 'type', 'title', 'description', 'status', 'created_at'],
    audit_logs: ['id', 'table_name', 'record_id', 'action', 'old_values', 'new_values', 'changed_fields', 'admin_user_id', 'admin_role', 'created_at'],
    admin_users: ['id', 'user_id', 'role', 'created_at'],
};

export const dataProvider = supabaseDataProvider(supabase, resources);
