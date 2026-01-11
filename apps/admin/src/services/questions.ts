import { supabase } from '@/config';
import { auditedSupabase } from '@/hooks/useAuditedSupabase';

// =============================================================================
// Types
// =============================================================================

export interface Question {
    id: string;
    text: string;
    partner_text: string | null;
    intensity: number;
    pack_id: string;
    created_at: string | null;
    deleted_at: string | null;
}

export interface QuestionFormData {
    text: string;
    partner_text: string;
    intensity: number;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Fetch all questions for a pack (excludes soft-deleted by default)
 */
export async function fetchQuestionsForPack(packId: string, includeDeleted = false): Promise<Question[]> {
    let query = supabase
        .from('questions')
        .select('*')
        .eq('pack_id', packId)
        .order('created_at', { ascending: true });

    if (!includeDeleted) {
        query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
}

/**
 * Fetch a single question by ID
 */
export async function fetchQuestionById(id: string): Promise<Question | null> {
    const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return data;
}

/**
 * Fetch question count for a pack (excludes soft-deleted)
 */
export async function fetchQuestionCount(packId: string): Promise<number> {
    const { count, error } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('pack_id', packId)
        .is('deleted_at', null);

    if (error) throw error;
    return count || 0;
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Create a new question
 */
export async function createQuestion(
    packId: string,
    data: QuestionFormData
): Promise<Question> {
    const { data: created, error } = await auditedSupabase.insert('questions', {
        text: data.text,
        partner_text: data.partner_text || null,
        intensity: data.intensity,
        pack_id: packId,
    });

    if (error) throw error;
    if (!created || created.length === 0) throw new Error('Failed to create question');
    return created[0] as Question;
}

/**
 * Update an existing question
 */
export async function updateQuestion(
    id: string,
    data: Partial<QuestionFormData>
): Promise<void> {
    const { error } = await auditedSupabase.update('questions', id, {
        text: data.text,
        partner_text: data.partner_text || null,
        intensity: data.intensity,
    });

    if (error) throw error;
}

/**
 * Soft delete a question (sets deleted_at timestamp)
 */
export async function deleteQuestion(id: string): Promise<void> {
    const { error } = await auditedSupabase.update('questions', id, {
        deleted_at: new Date().toISOString(),
    });
    if (error) throw error;
}

/**
 * Soft delete multiple questions
 */
export async function deleteQuestions(ids: string[]): Promise<void> {
    await Promise.all(
        ids.map(id => auditedSupabase.update('questions', id, {
            deleted_at: new Date().toISOString(),
        }))
    );
}

/**
 * Restore a soft-deleted question
 */
export async function restoreQuestion(id: string): Promise<void> {
    const { error } = await auditedSupabase.update('questions', id, {
        deleted_at: null,
    });
    if (error) throw error;
}

/**
 * Bulk create questions (for AI generation)
 * Handles inverse_pair_id by grouping pairs and setting inverse_of links
 */
export async function bulkCreateQuestions(
    packId: string,
    questions: Array<{ text: string; partner_text?: string; intensity: number; inverse_pair_id?: string | null }>
): Promise<Question[]> {
    const results: Question[] = [];

    // Group questions by inverse_pair_id
    const pairMap = new Map<string, typeof questions>();
    const standaloneQuestions: typeof questions = [];

    for (const q of questions) {
        if (q.inverse_pair_id) {
            const existing = pairMap.get(q.inverse_pair_id) || [];
            existing.push(q);
            pairMap.set(q.inverse_pair_id, existing);
        } else {
            standaloneQuestions.push(q);
        }
    }

    // Insert standalone questions first
    for (const q of standaloneQuestions) {
        const { data, error } = await auditedSupabase.insert('questions', {
            pack_id: packId,
            text: q.text,
            partner_text: q.partner_text || null,
            intensity: q.intensity,
            inverse_of: null,
        });

        if (error) throw error;
        if (data && data.length > 0) results.push(data[0] as Question);
    }

    // Insert paired questions: primary first, then inverse with inverse_of link
    for (const [, pair] of pairMap) {
        if (pair.length >= 2) {
            // First question is primary
            const primary = pair[0];
            const { data: primaryData, error: primaryError } = await auditedSupabase.insert('questions', {
                pack_id: packId,
                text: primary.text,
                partner_text: primary.partner_text || null,
                intensity: primary.intensity,
                inverse_of: null,
            });

            if (primaryError) throw primaryError;
            if (primaryData && primaryData.length > 0) {
                results.push(primaryData[0] as Question);
                const primaryId = primaryData[0].id;

                // Second question is inverse
                const inverse = pair[1];
                const { data: inverseData, error: inverseError } = await auditedSupabase.insert('questions', {
                    pack_id: packId,
                    text: inverse.text,
                    partner_text: inverse.partner_text || null,
                    intensity: inverse.intensity,
                    inverse_of: primaryId,
                });

                if (inverseError) throw inverseError;
                if (inverseData && inverseData.length > 0) results.push(inverseData[0] as Question);
            }

            // Handle any additional questions in the pair
            for (let i = 2; i < pair.length; i++) {
                const extra = pair[i];
                const { data, error } = await auditedSupabase.insert('questions', {
                    pack_id: packId,
                    text: extra.text,
                    partner_text: extra.partner_text || null,
                    intensity: extra.intensity,
                    inverse_of: null,
                });
                if (error) throw error;
                if (data && data.length > 0) results.push(data[0] as Question);
            }
        } else if (pair.length === 1) {
            // Single question with pair_id but no pair
            const { data, error } = await auditedSupabase.insert('questions', {
                pack_id: packId,
                text: pair[0].text,
                partner_text: pair[0].partner_text || null,
                intensity: pair[0].intensity,
                inverse_of: null,
            });
            if (error) throw error;
            if (data && data.length > 0) results.push(data[0] as Question);
        }
    }

    return results;
}
